import React, { useEffect, useState } from 'react';
import { Link, Routes, Route } from 'react-router-dom';
import NavBar from "./navbar";
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import Criteria from './criteria';
import SignIn from './signin';
import SignUp from "./signup";
import Watchlist from './watchlist';

function StockScreener({ user }) {
  //console.log("StockScreener rendered, user:", user);
  const [stocks, setStocks] = useState([]);

  const thresholds = {
    forwardPE: 30,
    trailingPegRatio: 2,
    enterpriseToRevenue: 15,
    enterpriseToEbitda: 30,
    revenueGrowth: 0.1,
  };

  const getStatusClass = (value, threshold, rule) => {
    if (value === null || value === undefined) return 'text-gray-400';

    if (rule === 'greater') {
      return value > threshold ? 'text-green-500' : 'text-red-500';
    }

    if (rule === 'less') {
      return value < threshold ? 'text-green-500' : 'text-red-500';
    }

    return 'text-gray-400';
  };

  const formatNumber = (value) => Number(value).toFixed(2);

  const formatMarketCap = (value) => {
    if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}T`;
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  };

  useEffect(() => {
    async function fetchStocks() {
      try {
        const querySnapshot = await getDocs(collection(db, "stocks"));
        const stocksData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          if (!data) {
            console.warn("Empty document found, id:", doc.id);
            return null;
          }
          return data;
        }).filter(Boolean);

        setStocks(stocksData);
      } catch (err) {
        console.error("Error fetching stocks from Firestore:", err);
      }
    }

    fetchStocks();
  }, []);

  const countCriteriaPassed = (stock) => {
    let count = 0;
    if (stock.forwardPE <= thresholds.forwardPE) count++;
    if (stock.trailingPegRatio <= thresholds.trailingPegRatio) count++;
    if (stock.enterpriseToRevenue <= thresholds.enterpriseToRevenue) count++;
    if (stock.enterpriseToEbitda <= thresholds.enterpriseToEbitda) count++;
    if (stock.revenueGrowth >= thresholds.revenueGrowth) count++;
    return count;
  };

  const hasMissingValue = (stock) => {
    const requiredFields = [
      'marketCap',
      'forwardPE',
      'trailingPegRatio',
      'enterpriseToRevenue',
      'enterpriseToEbitda',
      'revenueGrowth',
    ];
    return requiredFields.some(field => stock[field] === null || stock[field] === undefined || isNaN(stock[field]));
  };

  const filteredStocks = stocks
    .filter(stock => stock.marketCap > 1_000_000_000)
    .filter(stock => !hasMissingValue(stock))
    .map(stock => ({ ...stock, criteriaPassed: countCriteriaPassed(stock) }))
    .sort((a, b) => b.criteriaPassed - a.criteriaPassed);

  return (
    <>
      <h1 className="text-2xl font-bold mb-4 flex items-center">
        Stock Screener
        <Link
          to="/criteria"
          className="text-sm text-blue-500 hover:underline cursor-pointer ml-2"
        >
          View Strategy Criteria
        </Link>
      </h1>
    {/* Conditionally render the sign-in prompt or the table */}
      {!user ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 max-w-md w-full text-center">
            <h2 className="text-xl font-bold text-gray-800 mb-3">Authentication Required</h2>
            <p className="text-gray-500 mb-6 text-sm">
              Please sign in to view the stock screener and track your portfolio with fundamental/technical signals.
            </p>
            <div className="flex justify-center gap-3">
              <Link 
                to="/signin" 
                className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-5 rounded transition-colors"
              >
                Sign In
              </Link>
              <Link 
                to="/signup" 
                className="bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium py-2 px-5 rounded border border-gray-300 transition-colors"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-auto bg-white rounded-lg shadow-sm border border-gray-200">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-200">
                <th className="px-4 py-3 text-sm font-semibold text-gray-600">Ticker</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-600">Company</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-600">Criteria Passed</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-600">Market Cap (B)</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-600">Forward P/E</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-600">PEG Ratio</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-600">EV/Revenue</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-600">EV/EBITDA</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-600">Revenue Growth</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map(stock => {
                const rowStyle = stock.criteriaPassed <= 3 ? "bg-gray-800 text-gray-600" : "";
                return (
                  <tr key={stock.symbol} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${rowStyle}`}>
                    <td className="px-4 py-3 font-semibold">{stock.symbol}</td>
                    <td className="px-4 py-3">
                      <a
                        href={`https://finance.yahoo.com/quote/${stock.symbol}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {stock.name}
                      </a>
                    </td>
                    <td className="px-4 py-3">{stock.criteriaPassed}/5</td>
                    <td className="px-4 py-3">{formatMarketCap(stock.marketCap)}</td>
                    <td className={`px-4 py-3 ${getStatusClass(stock.forwardPE, thresholds.forwardPE, 'less')}`}>
                      {formatNumber(stock.forwardPE)}
                    </td>
                    <td className={`px-4 py-3 ${getStatusClass(stock.trailingPegRatio, thresholds.trailingPegRatio, 'less')}`}>
                      {formatNumber(stock.trailingPegRatio)}
                    </td>
                    <td className={`px-4 py-3 ${getStatusClass(stock.enterpriseToRevenue, thresholds.enterpriseToRevenue, 'less')}`}>
                      {formatNumber(stock.enterpriseToRevenue)}
                    </td>
                    <td className={`px-4 py-3 ${getStatusClass(stock.enterpriseToEbitda, thresholds.enterpriseToEbitda, 'less')}`}>
                      {formatNumber(stock.enterpriseToEbitda)}
                    </td>
                    <td className={`px-4 py-3 ${getStatusClass(stock.revenueGrowth, thresholds.revenueGrowth, 'greater')}`}>
                      {stock.revenueGrowth ? `${(stock.revenueGrowth * 100).toFixed(2)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function App({ user }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <NavBar user={user} />
      <div className="p-6">
        <Routes>
          <Route path="/" element={<StockScreener user={user} />} />
          <Route path="/criteria" element={<Criteria />} />
          <Route path="/watchlist" element={<Watchlist user={user} />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
