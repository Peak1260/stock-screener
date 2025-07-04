import React, { useEffect, useState } from 'react';

const API_KEY = 'wzNXU4pF6LNPg9u3BQbzmEu4xdYCu2WO'; // replace with your actual FMP API key

const ALL_STOCKS_URL = `https://financialmodelingprep.com/api/v3/stock/list?apikey=${API_KEY}`;
const METRICS_URL = (symbol) =>
  `https://financialmodelingprep.com/stable/key-metrics-ttm?symbol=${symbol}&apikey=${API_KEY}`;
const RATIOS_URL = (symbol) =>
  `https://financialmodelingprep.com/stable/ratios-ttm?symbol=${symbol}&apikey=${API_KEY}`;

const MARKET_CAP_THRESHOLD = 10000000000; // 10 billion
const PEG_THRESHOLD = 10;
const PE_THRESHOLD = 200;

function App() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAndFilterStocks = async () => {
      setLoading(true);

      try {
        // Step 1: Get all stocks and filter for NYSE/NASDAQ
        const res = await fetch(ALL_STOCKS_URL);
        const allStocks = await res.json();

        const filtered = allStocks.filter(
          (stock) =>
            ['NASDAQ', 'NYSE'].includes(stock.exchangeShortName) &&
            stock.type === 'stock'
        );

        const sample = filtered.slice(0, 5);

        const result = [];

        for (const stock of sample) {
          const symbol = stock.symbol;

          try {
            const [metricsRes, ratiosRes] = await Promise.all([
              fetch(METRICS_URL(symbol)).then((r) => r.json()),
              fetch(RATIOS_URL(symbol)).then((r) => r.json()),
            ]);

            const metrics = metricsRes[0];
            const ratios = ratiosRes[0];

            if (!metrics || !ratios) continue;

            const marketCap = metrics.marketCap;
            const peg = ratios.priceToEarningsGrowthRatioTTM;
            const pe = ratios.priceToEarningsRatioTTM;

            if (
              marketCap > MARKET_CAP_THRESHOLD &&
              peg > 0 && peg < PEG_THRESHOLD &&
              pe > 0 && pe < PE_THRESHOLD
            ) {
              result.push({
                symbol: symbol,
                name: stock.name,
                marketCap,
                pe,
                peg,
              });
            }
          } catch (err) {
            console.error(`Error for ${symbol}`, err);
          }
        }

        setStocks(result);
      } catch (err) {
        console.error('Failed to fetch stock list', err);
      }

      setLoading(false);
    };

    fetchAndFilterStocks();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Filtered Stocks (NYSE + NASDAQ)</h1>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <table className="table-auto w-full border border-gray-300 text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Symbol</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Market Cap ($B)</th>
              <th className="p-2 text-left">PE</th>
              <th className="p-2 text-left">PEG</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock) => (
              <tr key={stock.symbol} className="border-t border-gray-200">
                <td className="p-2 font-medium">{stock.symbol}</td>
                <td className="p-2">{stock.name}</td>
                <td className="p-2">{(stock.marketCap / 1_000_000_000).toFixed(1)}</td>
                <td className="p-2">{stock.pe.toFixed(2)}</td>
                <td className="p-2">{stock.peg.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default App;
