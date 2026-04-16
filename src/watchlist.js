import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';

const FINNHUB_KEY      = process.env.REACT_APP_FINNHUB_KEY;
const TWELVE_DATA_KEY  = process.env.REACT_APP_TWELVE_DATA_KEY;
const FH               = 'https://finnhub.io/api/v1';
const TD               = 'https://api.twelvedata.com';
const WATCHLIST_COL    = 'watchlist';

// ---------------------------------------------------------------------------
// Technical indicator calculations
// ---------------------------------------------------------------------------
function calcSMA(closes, period) {
  if (!closes || closes.length < period) return null;
  return closes.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calcPrevSMA(closes, period) {
  if (!closes || closes.length < period + 1) return null;
  return closes.slice(-(period + 1), -1).reduce((a, b) => a + b, 0) / period;
}

function detectSMACross(closes) {
  const sma20Now  = calcSMA(closes, 20);
  const sma50Now  = calcSMA(closes, 50);
  const sma20Prev = calcPrevSMA(closes, 20);
  const sma50Prev = calcPrevSMA(closes, 50);

  if (sma20Now == null || sma50Now == null || sma20Prev == null || sma50Prev == null) {
    return null;
  }

  return {
    sma20: sma20Now,
    sma50: sma50Now,
    crossedAbove: sma20Prev <= sma50Prev && sma20Now > sma50Now,
    crossedBelow: sma20Prev >= sma50Prev && sma20Now < sma50Now,
    sma20AboveSma50: sma20Now > sma50Now,
  };
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
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function calcMACD(closes) {
  if (!closes || closes.length < 35) return null;

  const k12 = 2 / 13;
  const k26 = 2 / 27;

  let ema12 = closes.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
  let ema26 = closes.slice(0, 26).reduce((a, b) => a + b, 0) / 26;

  for (let i = 12; i < 26; i++) ema12 = closes[i] * k12 + ema12 * (1 - k12);

  const macdLine = [];
  for (let i = 26; i < closes.length; i++) {
    ema12 = closes[i] * k12 + ema12 * (1 - k12);
    ema26 = closes[i] * k26 + ema26 * (1 - k26);
    macdLine.push(ema12 - ema26);
  }

  if (macdLine.length < 9) return null;

  const k9 = 2 / 10;
  let signal = macdLine.slice(0, 9).reduce((a, b) => a + b, 0) / 9;
  let prevSignal = signal;
  for (let i = 9; i < macdLine.length; i++) {
    prevSignal = signal;
    signal = macdLine[i] * k9 + signal * (1 - k9);
  }

  const macd     = macdLine[macdLine.length - 1];
  const prevMacd = macdLine[macdLine.length - 2];

  return {
    macd,
    signal,
    histogram: macd - signal,
    crossedAbove: prevMacd <= prevSignal && macd > signal,
    crossedBelow: prevMacd >= prevSignal && macd < signal,
    macdAboveSignal: macd > signal,
  };
}

// ---------------------------------------------------------------------------
// Overall signal scoring — simple majority of 4 indicators
// Each indicator votes: 'bullish' | 'bearish' | 'neutral'
// 3+ matching votes determines the final signal.
// ---------------------------------------------------------------------------
function scoreTechnicals({ price, sma, rsi14, macd }) {
  const votes = [];

  // 1. Price Location Vote (Relative to both SMAs)
  // Requires price to be above BOTH to be bullish, or below BOTH to be bearish.
  if (sma) {
    if (price > sma.sma20 && price > sma.sma50) {
      votes.push('bullish');
    } else if (price < sma.sma20 && price < sma.sma50) {
      votes.push('bearish');
    } else {
      votes.push('neutral'); // Price is between the two lines
    }
  }

  // 2. SMA Crossover Vote (The "Big Trend")
  if (sma) {
    votes.push(sma.sma20AboveSma50 ? 'bullish' : 'bearish');
  }

  // 3. RSI Vote (Relative Strength)
  if (rsi14 != null) {
    if (rsi14 > 70)      votes.push('bearish');
    else if (rsi14 < 30) votes.push('bullish');
    else                 votes.push('neutral');
  }

  // 4. MACD Vote (Momentum Shift)
  if (macd) {
    votes.push(macd.macdAboveSignal ? 'bullish' : 'bearish');
  }

  // If data is missing for some reason, we can't get a reliable majority
  if (votes.length < 4) return null;

  const bullCount = votes.filter(v => v === 'bullish').length;
  const bearCount = votes.filter(v => v === 'bearish').length;

  // Majority Logic: 3 or more required for a signal
  if (bullCount >= 3) return 'bullish';
  if (bearCount >= 3) return 'bearish';
  
  return 'neutral'; // If it's a 2-2 tie or mostly neutral votes
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fmt = (v, decimals = 2) =>
  v === null || v === undefined || isNaN(v) ? '—' : Number(v).toFixed(decimals);

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

function MetricBox({ label, value, colorCls, sub, badge }) {
  return (
    <div className="border rounded p-3 bg-gray-50">
      <div className="flex items-center gap-1.5 flex-wrap">
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        {badge && (
          <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${badge.cls}`}>
            {badge.text}
          </span>
        )}
      </div>
      <p className={`text-sm mt-1 font-semibold ${colorCls ?? 'text-gray-800'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function OverallSignalBox({ signal }) {
  if (!signal) return null;

  const config = {
    bullish: {
      label: '▲ Bullish',
      cls: 'bg-green-50 border-green-300',
      valueCls: 'text-green-700',
      sub: '3+ indicators agree: upward trend',
    },
    bearish: {
      label: '▼ Bearish',
      cls: 'bg-red-50 border-red-300',
      valueCls: 'text-red-600',
      sub: '3+ indicators agree: downward pressure',
    },
    neutral: {
      label: '◆ Neutral',
      cls: 'bg-yellow-50 border-yellow-300',
      valueCls: 'text-yellow-700',
      sub: 'Mixed signals across indicators',
    },
  }[signal];

  return (
    <div className={`border-2 rounded p-3 ${config.cls}`}>
      <p className="text-xs text-gray-400 uppercase tracking-wide">Overall Signal</p>
      <p className={`text-base mt-1 font-bold ${config.valueCls}`}>{config.label}</p>
      <p className="text-xs text-gray-500 mt-0.5">{config.sub}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Twelve Data — fetch daily closes (newest-first, reversed to oldest-first)
// ---------------------------------------------------------------------------
async function fetchTwelveDataCloses(ticker) {
  const url =
    `${TD}/time_series?symbol=${ticker}&interval=1day&outputsize=60&apikey=${TWELVE_DATA_KEY}`;
  const res  = await fetch(url);
  const json = await res.json();

  if (json.status === 'error') {
    throw new Error(`Twelve Data: ${json.message}`);
  }

  if (!Array.isArray(json.values) || json.values.length === 0) {
    return [];
  }

  // values are newest-first; reverse so index 0 = oldest
  return json.values
    .slice()
    .reverse()
    .map(bar => parseFloat(bar.close))
    .filter(n => !isNaN(n));
}

// ---------------------------------------------------------------------------
// Stock detail panel
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
        const [quoteRes, profileRes, metricsRes] = await Promise.all([
          fetch(`${FH}/quote?symbol=${ticker}&token=${FINNHUB_KEY}`),
          fetch(`${FH}/stock/profile2?symbol=${ticker}&token=${FINNHUB_KEY}`),
          fetch(`${FH}/stock/metric?symbol=${ticker}&metric=all&token=${FINNHUB_KEY}`),
        ]);

        const [quote, profile, metricsData] = await Promise.all([
          quoteRes.json(),
          profileRes.json(),
          metricsRes.json(),
        ]);

        let closes = [];
        let tdError = null;
        try {
          closes = await fetchTwelveDataCloses(ticker);
        } catch (e) {
          tdError = e.message;
          console.warn(`Twelve Data fetch failed for ${ticker}:`, e.message);
        }

        const sma    = detectSMACross(closes);
        const rsi14  = calcRSI(closes, 14);
        const macd   = calcMACD(closes);
        const price  = quote?.c ?? 0;
        const signal = scoreTechnicals({ price, sma, rsi14, macd });
        const m      = metricsData?.metric ?? {};

        setData({ quote, profile, m, closes, sma, rsi14, macd, signal, tdError });
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

  const { quote, profile, m, closes, sma, rsi14, macd, signal, tdError } = data;
  const price     = quote?.c ?? 0;
  const change    = quote?.d ?? 0;
  const changePct = quote?.dp ?? 0;
  const changePos = change >= 0;
  const noCandles = closes.length === 0;

  const rsiLabel = rsi14 == null ? null : rsi14 > 70 ? 'Overbought' : rsi14 < 30 ? 'Oversold' : 'Neutral';

  const smaCrossBadge = sma?.crossedAbove
    ? { text: '⬆ Golden Cross', cls: 'bg-green-100 text-green-700' }
    : sma?.crossedBelow
    ? { text: '⬇ Death Cross', cls: 'bg-red-100 text-red-600' }
    : null;

  const macdCrossBadge = macd?.crossedAbove
    ? { text: '⬆ Bullish Cross', cls: 'bg-green-100 text-green-700' }
    : macd?.crossedBelow
    ? { text: '⬇ Bearish Cross', cls: 'bg-red-100 text-red-600' }
    : null;

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
        <div className="flex items-center gap-2 mb-3">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Technicals</h4>
          {noCandles && (
            <span className="text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded">
              {tdError ? `Twelve Data: ${tdError}` : 'No price data available'}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <MetricBox
            label="SMA (20)"
            value={sma?.sma20 != null ? `$${fmt(sma.sma20)}` : '—'}
            colorCls={sma?.sma20 && price ? (price > sma.sma20 ? 'text-green-600' : 'text-red-500') : ''}
            sub={price > sma?.sma20 ? 'Price above 20' : 'Price below 20'}
          />

          <MetricBox
            label="SMA (50)"
            value={sma?.sma50 != null ? `$${fmt(sma.sma50)}` : '—'}
            colorCls={price > sma?.sma50 ? 'text-green-600' : 'text-red-500'}
            sub={price > sma?.sma50 ? 'Price above 50' : 'Price below 50'}
          />

          <MetricBox
            label="SMA Crossover"
            value={sma?.sma20AboveSma50 ? "Bullish Trend" : "Bearish Trend"}
            colorCls={sma?.sma20AboveSma50 ? 'text-green-600' : 'text-red-500'}
            sub={sma?.sma20AboveSma50 ? "20 SMA > 50 SMA" : "20 SMA < 50 SMA"}
            badge={smaCrossBadge}
          />
          <MetricBox
            label="RSI (14)"
            value={rsi14 != null ? fmt(rsi14) : '—'}
            colorCls={
              rsi14 != null
                ? rsi14 > 70 ? 'text-red-500 font-semibold'
                : rsi14 < 30 ? 'text-green-600 font-semibold'
                : 'text-gray-800 font-semibold'
                : 'text-gray-500 font-semibold'
            }
            sub={rsiLabel}
          />
          <MetricBox
            label="MACD"
            value={macd != null ? `${fmt(macd.macd)} / ${fmt(macd.signal)}` : '—'}
            colorCls={macd != null ? (macd.macdAboveSignal ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold') : 'text-gray-500 font-semibold'}
            sub={macd != null ? `Histogram: ${fmt(macd.histogram)}` : null}
            badge={macdCrossBadge}
          />
          <OverallSignalBox signal={signal} />
        </div>
      </div>

      {/* Fundamentals */}
      <div className="p-4">
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Fundamentals</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricBox
            label="P/E (TTM)"
            value={fmt(m['peNormalizedAnnual'])}
            colorCls={colorClass(m['peNormalizedAnnual'], false, 30)}
          />
          <MetricBox
            label="P/FCF (TTM)"
            value={m['pfcfShareTTM'] != null ? fmt(m['pfcfShareTTM']) : '—'}
            colorCls={colorClass(m['pfcfShareTTM'], false, 30)}
          />
          <MetricBox
            label="Debt / Equity"
            value={fmt(m['totalDebt/totalEquityAnnual'])}
            colorCls={colorClass(m['totalDebt/totalEquityAnnual'], false, 1)}
          />
          <MetricBox
            label="Revenue Growth"
            value={m['revenueGrowthTTMYoy'] != null ? `${fmt(m['revenueGrowthTTMYoy'])}%` : '—'}
            colorCls={colorClass(m['revenueGrowthTTMYoy'], true, 10)}
          />
          <MetricBox
            label="Operating Margin"
            value={m['operatingMarginAnnual'] != null ? `${fmt(m['operatingMarginAnnual'])}%` : '—'}
            colorCls={colorClass(m['operatingMarginAnnual'], true, 15)}
          />
          <MetricBox
            label="ROE"
            value={m['roeRfy'] != null ? `${fmt(m['roeRfy'])}%` : '—'}
            colorCls={colorClass(m['roeRfy'], true, 20)}
          />
          <MetricBox
            label="Market Cap"
            value={fmtLarge(profile?.marketCapitalization ? profile.marketCapitalization * 1e6 : null)}
            colorCls="text-gray-800 font-semibold"
          />
          <MetricBox
            label="52W High / Low"
            value={
              m['52WeekHigh'] != null && m['52WeekLow'] != null
                ? `$${fmt(m['52WeekHigh'])} / $${fmt(m['52WeekLow'])}`
                : '—'
            }
            colorCls="text-gray-800 font-semibold"
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Watchlist component
// ---------------------------------------------------------------------------
export default function Watchlist({ user }) {
  const [watchlist, setWatchlist]               = useState([]);
  const [input, setInput]                       = useState('');
  const [selectedTicker, setSelectedTicker]     = useState(null);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);

  useEffect(() => {
    if (!user) return;
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
  }, [user]);

  const addTicker = async () => {
    const t = input.trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (!t || watchlist.includes(t)) { setInput(''); return; }
    const next = [...watchlist, t].sort();
    setWatchlist(next);
    setInput('');
    try {
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

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && addTicker()}
          placeholder="Add ticker (e.g. AAPL)"
          maxLength={5}
          className="border px-2.5 py-1.5 rounded w-48 text-sm font-mono"
        />
        <button
          onClick={addTicker}
          className="px-7 py-1.5 rounded bg-blue-500 hover:bg-blue-600 text-white text-sm transition"
        >
          Add
        </button>
      </div>

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

      {selectedTicker && (
        <StockDetail ticker={selectedTicker} onClose={() => setSelectedTicker(null)} />
      )}
    </div>
  );
}