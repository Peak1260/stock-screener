import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import NavBar from "./navbar";
import SignIn from "./signin"; 
import SignUp from "./signup";
import StockCriteria from "./criteria"; 
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (currentUser.emailVerified) {
          setUser(currentUser);
        } else {
          alert("Please verify your email before to enjoy full access.");
          signOut(auth);
          setUser(null);
        }
      } else {
        setUser(null);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <Router>
      <Routes>
        {/* Pass user to Main so NavBar can show email or sign in */}
        <Route path="/" element={<Main user={user} />} />
        <Route path="/criteria" element={<StockCriteria />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/signin" element={<SignIn />} />
      </Routes>
    </Router>
  );
}

function Main({ user }) {
  const [stocks, setStocks] = useState([]);

  const thresholds = {
    forwardPE: [10, 40],
    trailingPegRatio: 2,
    enterpriseToRevenue: 15,
    enterpriseToEbitda: 30,
    freeCashflow: 0,
  };

  const getStatusClass = (value, threshold, rule = 'range') => {
    if (value === null || value === undefined) return 'text-gray-400';

    if (rule === 'range') {
      const [min, max] = threshold;
      return value >= min && value <= max ? 'text-green-500' : 'text-red-500';
    }

    if (rule === 'greater') {
      return value > threshold ? 'text-green-500' : 'text-red-500';
    }

    if (rule === 'less') {
      return value < threshold ? 'text-green-500' : 'text-red-500';
    }

    return 'text-gray-400';
  };

  const formatNumber = (value) => Number(value).toFixed(2);

  useEffect(() => {
    axios.get('http://localhost:8000/stocks')
      .then(res => setStocks(res.data))
      .catch(err => console.error(err));
  }, []);

  const countCriteriaPassed = (stock) => {
    let count = 0;
    if (stock.forwardPE >= thresholds.forwardPE[0] && stock.forwardPE <= thresholds.forwardPE[1]) count++;
    if (stock.trailingPegRatio < thresholds.trailingPegRatio) count++;
    if (stock.enterpriseToRevenue < thresholds.enterpriseToRevenue) count++;
    if (stock.enterpriseToEbitda < thresholds.enterpriseToEbitda) count++;
    if (stock.freeCashflow > thresholds.freeCashflow) count++;
    return count;
  };

  const hasMissingValue = (stock) => {
    const requiredFields = [
      'marketCap',
      'forwardPE',
      'trailingPegRatio',
      'enterpriseToRevenue',
      'enterpriseToEbitda',
      'freeCashflow'
    ];
    return requiredFields.some(field => stock[field] === null || stock[field] === undefined || isNaN(stock[field]));
  };

  const filteredStocks = stocks
    .filter(stock => stock.marketCap >= 10_000_000_000)
    .filter(stock => !hasMissingValue(stock))
    .map(stock => ({ ...stock, criteriaPassed: countCriteriaPassed(stock) }))
    .sort((a, b) => b.criteriaPassed - a.criteriaPassed);

  return (
    <div className="min-h-screen bg-gray-100">
      <NavBar user={user} />
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4 flex items-center">
          Stock Screener
          {/* Use React Router Link here for client side navigation */}
          <Link
            to="/criteria"
            className="text-sm text-blue-500 hover:underline cursor-pointer ml-2"
          >
            View Strategy Criteria
          </Link>
        </h1>
        <div className="overflow-auto">
          <table className="min-w-full table-auto border">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-4 py-2">Ticker</th>
                <th className="px-4 py-2">Company</th>
                <th className="px-4 py-2">Criteria Passed</th>
                <th className="px-4 py-2">Market Cap (B)</th>
                <th className="px-4 py-2">Forward P/E</th>
                <th className="px-4 py-2">PEG Ratio</th>
                <th className="px-4 py-2">EV/Revenue</th>
                <th className="px-4 py-2">EV/EBITDA</th>
                <th className="px-4 py-2">Free Cash Flow</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map(stock => {
                const rowStyle = stock.criteriaPassed <= 3 ? "bg-gray-800 text-gray-400" : "";
                return (
                  <tr key={stock.symbol} className={`border-b hover:bg-gray-50 ${rowStyle}`}>
                    <td className="px-4 py-2 font-semibold">{stock.symbol}</td>
                    <td className="px-4 py-2">
                      <a
                        href={`https://finance.yahoo.com/quote/${stock.symbol}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {stock.name}
                      </a>
                    </td>
                    <td className="px-4 py-2">{stock.criteriaPassed}/5</td>
                    <td className="px-4 py-2">{(stock.marketCap / 1e9).toFixed(2)}B</td>
                    <td className={`px-4 py-2 ${getStatusClass(stock.forwardPE, thresholds.forwardPE, 'range')}`}>
                      {formatNumber(stock.forwardPE)}
                    </td>
                    <td className={`px-4 py-2 ${getStatusClass(stock.trailingPegRatio, thresholds.trailingPegRatio, 'less')}`}>
                      {formatNumber(stock.trailingPegRatio)}
                    </td>
                    <td className={`px-4 py-2 ${getStatusClass(stock.enterpriseToRevenue, thresholds.enterpriseToRevenue, 'less')}`}>
                      {formatNumber(stock.enterpriseToRevenue)}
                    </td>
                    <td className={`px-4 py-2 ${getStatusClass(stock.enterpriseToEbitda, thresholds.enterpriseToEbitda, 'less')}`}>
                      {formatNumber(stock.enterpriseToEbitda)}
                    </td>
                    <td className={`px-4 py-2 ${getStatusClass(stock.freeCashflow, thresholds.freeCashflow, 'greater')}`}>
                      {stock.freeCashflow ? `$${(stock.freeCashflow / 1e9).toFixed(2)}B` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
