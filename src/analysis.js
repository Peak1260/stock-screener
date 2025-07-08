import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

const initialCriteria = {
  forwardPE: '',
  trailingPegRatio: '',
  enterpriseToEbitda: '',
  operatingMargins: '',
  earningsGrowth: '',
  revenueGrowth: '',
  returnOnAssets: '',
};

const tooltips = {
  forwardPE: 'Forward P/E: Less than 20 is considered good',
  trailingPegRatio: 'PEG Ratio: Less than 1 indicates undervalued stock',
  enterpriseToEbitda: 'EV/EBITDA: Less than 30 is considered good',
  operatingMargins: 'Operating Margin: Higher than 0.1 is considered good',
  earningsGrowth: 'Earnings Growth: Higher than 0.05 is considered good ',
  revenueGrowth: 'Revenue Growth: Higher than 0.05 is considered good',
  returnOnAssets: 'Return on Assets: Higher than 0.05 is considered good',
};

const inputLabels = {
  forwardPE: 'P/E (FWD)',
  trailingPegRatio: 'PEG (TTM)',
  enterpriseToEbitda: 'EV/EBITDA',
  operatingMargins: 'Operating Margin',
  earningsGrowth: 'Earnings Growth',
  revenueGrowth: 'Revenue Growth',
  returnOnAssets: 'Return On Assets',
};

export default function Analysis() {
  const [criteria, setCriteria] = useState(initialCriteria);
  const [stocks, setStocks] = useState([]);
  const [filtered, setFiltered] = useState([]);

  useEffect(() => {
    async function fetchStocks() {
      try {
        const snapshot = await getDocs(collection(db, 'total_stocks'));
        const data = snapshot.docs.map(doc => doc.data());
        setStocks(data);
      } catch (err) {
        console.error('Error fetching total_stocks:', err);
      }
    }
    fetchStocks();
  }, []);

  const handleInputChange = (e) => {
    const rawVal = e.target.value;
    const floatVal = rawVal === '' ? '' : parseFloat(rawVal);
    const roundedVal = typeof floatVal === 'number' && !isNaN(floatVal)
      ? Math.round(floatVal * 100) / 100
      : '';
    setCriteria(prev => ({
      ...prev,
      [e.target.name]: roundedVal,
    }));
  };

  const handleSearch = () => {
    const greaterIsBetter = ['operatingMargins', 'earningsGrowth', 'revenueGrowth', 'returnOnAssets'];

    const filteredStocks = stocks.filter(stock => {
      return Object.entries(criteria).every(([key, userVal]) => {
        if (userVal === '') return true; 

        const stockVal = stock[key];

        if (stockVal === null || stockVal === undefined || isNaN(stockVal)) return false;

        if (greaterIsBetter.includes(key)) {
          return stockVal > userVal;
        } else {
          return stockVal < userVal;
        }
      });
    });

    setFiltered(filteredStocks);
  };

  const displayValue = (val, isPercent = false) => {
    if (val === null || val === undefined || val === '' || isNaN(val)) return '-';
    const num = Number(val);
    return isPercent ? `${(num * 100).toFixed(2)}%` : num.toFixed(2);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Custom Stock Analysis</h2>

      {/* Input fields with tooltips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Object.keys(initialCriteria).map((key) => (
          <div key={key} className="relative group">
            <label className="text-sm capitalize cursor-help">
              {inputLabels[key] || key}
            </label>
            <div className="absolute left-0 top-full mt-1 w-48 p-2 bg-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {tooltips[key]}
            </div>
            <input
              type="number"
              step="any"
              name={key}
              value={criteria[key]}
              onChange={handleInputChange}
              className="border px-2 py-1 w-full rounded mt-1"
              placeholder={['operatingMargins','earningsGrowth','revenueGrowth','returnOnAssets'].includes(key) ? "Decimal (e.g. 0.05 = 5%)" : ""}
            />
          </div>
        ))}
      </div>

      {/* Analyze button */}
      <div className="mb-4">
        <button
          onClick={handleSearch}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 rounded transition"
        >
          Analyze
        </button>
      </div>

      {/* Results table */}
      {filtered.length > 0 ? (
        <table className="min-w-full border table-auto">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2">Ticker</th>
              <th className="px-4 py-2">P/E (FWD)</th>
              <th className="px-4 py-2">PEG (TTM)</th>
              <th className="px-4 py-2">EV/EBITDA</th>
              <th className="px-4 py-2">Operating Margin</th>
              <th className="px-4 py-2">Earnings Growth</th>
              <th className="px-4 py-2">Revenue Growth</th>
              <th className="px-4 py-2">Return On Assets</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(stock => (
              <tr key={stock.symbol} className="border-t">
                <td className="px-6 py-2 font-bold">{stock.symbol || '-'}</td>
                <td className={`px-6 py-2 text-gray-800`}>
                  {displayValue(stock.forwardPE)}
                </td>
                <td className={`px-6 py-2 text-gray-800`}>
                  {displayValue(stock.trailingPegRatio)}
                </td>
                <td className={`px-6 py-2 text-gray-800`}>
                  {displayValue(stock.enterpriseToEbitda)}
                </td>
                <td className={`px-6 py-2 text-gray-800`}>
                  {displayValue(stock.operatingMargins, true)}
                </td>
                <td className={`px-6 py-2 text-gray-800`}>
                  {displayValue(stock.earningsGrowth, true)}
                </td>
                <td className={`px-6 py-2 text-gray-800`}>
                  {displayValue(stock.revenueGrowth, true)}
                </td>
                <td className={`px-6 py-2 text-gray-800`}>
                  {displayValue(stock.returnOnAssets, true)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-gray-800">No results to display.</p>
      )}
    </div>
  );
}
