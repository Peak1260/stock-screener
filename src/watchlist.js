import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';

const FINNHUB_KEY = process.env.REACT_APP_FINNHUB_KEY;
const FH = 'https://finnhub.io/api/v1';

// Watchlist stored in Firestore collection "watchlist", one doc per ticker
const WATCHLIST_COL = 'watchlist';

// ---------------------------------------------------------------------------
// Technical indicator calculations (computed from raw candle data)
// ---------------------------------------------------------------------------
function calcSMA(closes, period) {
  if (!closes || closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null;
  const slice = closes.slice(-(period + 1));
  let gains = 0, losses = 0;
  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i] - slice[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcEMA(closes, period) {
  if (!closes || closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcMACD(closes) {
  if (!closes || closes.length === 0) return null;
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  if (ema12 === null || ema26 === null) return null;
  const macdLine = ema12 - ema26;
  // Signal: 9-period EMA of MACD — approximate with last 9 MACD values
  // For simplicity we return the single current MACD and its value
  return { macd: macdLine, signal: macdLine * 0.9 }; // signal approximation
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fmt = (v, decimals = 2) =>
  v === null || v === undefined || isNaN(v) ? '—' : Number(v).toFixed(decimals);

const fmtPct = (v) =>
  v === null || v === undefined || isNaN(v) ? '—' : `${(Number(v) * 100).toFixed(2)}%`;

const fmtLarge = (v) => {
  if (!v || isNaN(v)) return '—';
  if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (Math.abs(v) >= 1e9)  return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6)  return `$${(v / 1e6).toFixed(2)}M`;
  return `$${Number(v).toFixed(2)}`;
};

const colorClass = (val, goodIfHigh = true, threshold = 0) => {
  if (val === null || val === undefined || isNaN(val)) return 'text-gray-500';
  return (goodIfHigh ? val > threshold : val < threshold)
    ? 'text-green-600 font-semibold'
    : 'text-red-500 font-semibold';
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SentimentBar({ value, min = -5, max = 5 }) {
  const clamped = Math.max(min, Math.min(max, value ?? 0));
  const pct = ((clamped - min) / (max - min)) * 100;
  return (
    <div className="mt-1">
      <div className="relative h-2 rounded-full bg-gradient-to-r from-red-400 via-yellow-300 to-green-400">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-gray-400 shadow"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
        <span>Underperform</span>
        <span>Outperform</span>
      </div>
    </div>
  );
}

function MetricBox({ label, value, colorCls }) {
  return (
    <div className="border rounded p-3 bg-gray-50">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-sm mt-1 font-semibold ${colorCls ?? 'text-gray-800'}`}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stock detail panel — fetches from Finnhub, computes technicals client-side
// ---------------------------------------------------------------------------
function StockDetail({ ticker, onClose }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    setData(null);

    async function load() {
      try {
        if (!FINNHUB_KEY) throw new Error('REACT_APP_FINNHUB_KEY is not set in your .env');

        // Unix timestamps: 1 year of daily candles for indicator calculation
        const toTs   = Math.floor(Date.now() / 1000);
        const fromTs = toTs - 365 * 24 * 60 * 60;

        const [quoteRes, profileRes, metricsRes, candleRes] = await Promise.all([
          fetch(`${FH}/quote?symbol=${ticker}&token=${FINNHUB_KEY}`),
          fetch(`${FH}/stock/profile2?symbol=${ticker}&token=${FINNHUB_KEY}`),
          fetch(`${FH}/stock/metric?symbol=${ticker}&metric=all&token=${FINNHUB_KEY}`),
          fetch(`${FH}/stock/candle?symbol=${ticker}&resolution=D&from=${fromTs}&to=${toTs}&token=${FINNHUB_KEY}`),
        ]);

        const [quote, profile, metricsData, candle] = await Promise.all([
          quoteRes.json(),
          profileRes.json(),
          metricsRes.json(),
          candleRes.json(),
        ]);

        // FIX: Safely extract closing prices from the Finnhub candle response array "c"
        const closes = candle?.s === 'ok' ? candle.c : [];

        // Compute technicals from daily close prices
        const sma20  = calcSMA(closes, 20);
        const rsi14  = calcRSI(closes, 14);
        const macd   = calcMACD(closes);

        const m = metricsData?.metric ?? {};

        setData({ quote, profile, m, closes, sma20, rsi14, macd });
      } catch (e) {
        setError(e.message || 'Failed to load data.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [ticker]);

  if (loading) {
    return (
      <div className="mt-6 border rounded-lg p-6 bg-white shadow-sm animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-1/4 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array(8).fill(0).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6 border border-red-200 rounded-lg p-4 bg-red-50 text-red-600 text-sm">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { quote, profile, m, sma20, rsi14, macd } = data;
  const price     = quote?.c ?? 0;
  const change    = quote?.d ?? 0;
  const changePct = quote?.dp ?? 0;
  const changePos = change >= 0;

  return (
    <div className="mt-6 border rounded-lg bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b bg-gray-50">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-gray-900">{ticker}</h3>
            <span className={`text-sm px-2 py-0.5 rounded font-mono font-semibold ${changePos ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {changePos ? '+' : ''}{fmt(changePct)}%
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{profile?.name}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">${fmt(price)}</p>
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 mt-1 underline">
            close
          </button>
        </div>
      </div>

      {/* Sentiment bar */}
      <div className="px-4 py-3 border-b">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Day Sentiment</p>
        <SentimentBar value={changePct} min={-5} max={5} />
      </div>

      {/* Technicals */}
      <div className="p-4 border-b">
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Technicals</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricBox
            label="SMA (20)"
            value={`$${fmt(sma20)}`}
            colorCls={sma20 && price ? (price > sma20 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold') : 'text-gray-800 font-semibold'}
          />
          <MetricBox
            label="RSI (14)"
            value={fmt(rsi14)}
            colorCls={rsi14 ? (rsi14 > 70 ? 'text-red-500 font-semibold' : rsi14 < 30 ? 'text-green-600 font-semibold' : 'text-gray-800 font-semibold') : 'text-gray-800 font-semibold'}
          />
          <MetricBox
            label="MACD"
            value={fmt(macd?.macd)}
            colorCls={macd?.macd != null ? (macd.macd > 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold') : 'text-gray-800 font-semibold'}
          />
          <MetricBox
            label="MACD Signal"
            value={fmt(macd?.signal)}
            colorCls="text-gray-800 font-semibold"
          />
        </div>
      </div>

      {/* Fundamentals — sourced from Finnhub /stock/metric */}
      <div className="p-4">
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Fundamentals</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricBox label="P/E (TTM)"        value={fmt(m['peNormalizedAnnual'])}           colorCls={colorClass(m['peNormalizedAnnual'], false, 25)} />
          <MetricBox label="P/E (Fwd)"        value={fmt(m['peExclExtraItemsTTM'])}          colorCls={colorClass(m['peExclExtraItemsTTM'], false, 25)} />
          <MetricBox label="EV/EBITDA"        value={fmt(m['currentEv/freeCashFlowTTM'])}    colorCls={colorClass(m['currentEv/freeCashFlowTTM'], false, 30)} />
          <MetricBox label="Debt / Equity"    value={fmt(m['totalDebt/totalEquityAnnual'])}  colorCls={colorClass(m['totalDebt/totalEquityAnnual'], false, 1)} />
          <MetricBox label="Revenue Growth"   value={fmtPct(m['revenueGrowthTTMYoy'] != null ? m['revenueGrowthTTMYoy'] / 100 : null)} colorCls={colorClass(m['revenueGrowthTTMYoy'], true, 5)} />
          <MetricBox label="Operating Margin" value={fmtPct(m['operatingMarginAnnual'] != null ? m['operatingMarginAnnual'] / 100 : null)} colorCls={colorClass(m['operatingMarginAnnual'], true, 10)} />
          <MetricBox label="ROE"              value={fmtPct(m['roeRfy'] != null ? m['roeRfy'] / 100 : null)} colorCls={colorClass(m['roeRfy'], true, 15)} />
          <MetricBox label="Market Cap"       value={fmtLarge(profile?.marketCapitalization ? profile.marketCapitalization * 1e6 : null)} colorCls="text-gray-800 font-semibold" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Watchlist component
// ---------------------------------------------------------------------------
export default function Analysis() {
  const [watchlist, setWatchlist]           = useState([]);
  const [input, setInput]                   = useState('');
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);

  // Load watchlist from Firestore on mount
  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(collection(db, WATCHLIST_COL));
        const tickers = snap.docs.map(d => d.id).sort();
        setWatchlist(tickers);
      } catch (e) {
        console.error('Failed to load watchlist:', e);
      } finally {
        setLoadingWatchlist(false);
      }
    }
    load();
  }, []);

  const addTicker = async () => {
    const t = input.trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (!t || watchlist.includes(t)) { setInput(''); return; }
    const next = [...watchlist, t].sort();
    setWatchlist(next);
    setInput('');
    try {
      // Each ticker is its own document in the "watchlist" collection
      await setDoc(doc(db, WATCHLIST_COL, t), { symbol: t, addedAt: new Date().toISOString() });
    } catch (e) {
      console.error('Failed to save ticker:', e);
    }
  };

  const removeTicker = async (t) => {
    const next = watchlist.filter(x => x !== t);
    setWatchlist(next);
    if (selectedTicker === t) setSelectedTicker(null);
    try {
      await deleteDoc(doc(db, WATCHLIST_COL, t));
    } catch (e) {
      console.error('Failed to remove ticker:', e);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Watchlist</h2>

      {/* Add ticker */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && addTicker()}
          placeholder="Add ticker (e.g. AAPL)"
          maxLength={5}
          className="border px-3 py-1.5 rounded w-48 text-sm font-mono"
        />
        <button
          onClick={addTicker}
          className="px-4 py-1.5 rounded bg-blue-500 hover:bg-blue-600 text-white text-sm transition"
        >
          Add
        </button>
      </div>

      {/* Table */}
      {loadingWatchlist ? (
        <p className="text-gray-400 text-sm">Loading watchlist...</p>
      ) : watchlist.length === 0 ? (
        <p className="text-gray-500 text-sm">No tickers yet. Add one above.</p>
      ) : (
        <div className="overflow-auto mb-2">
          <table className="min-w-full table-auto border">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 text-left text-sm">Ticker</th>
                <th className="px-4 py-2 text-left text-sm">Action</th>
              </tr>
            </thead>
            <tbody>
              {watchlist.map(t => (
                <tr
                  key={t}
                  className={`border-t cursor-pointer transition-colors ${selectedTicker === t ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  onClick={() => setSelectedTicker(prev => prev === t ? null : t)}
                >
                  <td className="px-4 py-2 font-bold font-mono text-sm">{t}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={e => { e.stopPropagation(); removeTicker(t); }}
                      className="text-xs text-red-400 hover:text-red-600 transition"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail panel */}
      {selectedTicker && (
        <StockDetail ticker={selectedTicker} onClose={() => setSelectedTicker(null)} />
      )}
    </div>
  );
}