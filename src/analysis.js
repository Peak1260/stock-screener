import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

const initialCriteria = {
  forwardPE: '',
  trailingPegRatio: '',
  enterpriseToEbitda: '',
  operatingMargins: '',
  revenueGrowth: '',
  returnOnAssets: '',
};

const tooltips = {
  forwardPE: 'Forward P/E: Less than 25 is considered good',
  trailingPegRatio: 'PEG Ratio: Less than 2 is considered good',
  enterpriseToEbitda: 'EV/EBITDA: Less than 30 is considered good',
  operatingMargins: 'Operating Margin: Higher than 0.1 is considered good',
  revenueGrowth: 'Revenue Growth: Higher than 0.1 is considered good',
  returnOnAssets: 'Return on Assets: Higher than 0.05 is considered good',
};

const inputLabels = {
  forwardPE: 'P/E (FWD)',
  trailingPegRatio: 'PEG (TTM)',
  enterpriseToEbitda: 'EV/EBITDA',
  operatingMargins: 'Operating Margin',
  revenueGrowth: 'Revenue Growth',
  returnOnAssets: 'Return On Assets',
};

export default function Analysis() {
  const [criteria, setCriteria] = useState(initialCriteria);
  const [stocks, setStocks] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [showWarning, setShowWarning] = useState(false);

  const allFieldsFilled = Object.values(criteria).every(val => val !== '' && !isNaN(val));

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
    setShowWarning(false);
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
    if (!allFieldsFilled) {
      setShowWarning(true);
      return;
    }

    const greaterIsBetter = ['operatingMargins', 'revenueGrowth', 'returnOnAssets'];

    const filteredStocks = stocks.filter(stock => {
      return Object.entries(criteria).every(([key, userVal]) => {
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
    setShowWarning(false);
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
            <div className="absolute left-0 top-full mt-1 w-42 p-2 bg-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {tooltips[key]}
            </div>
            <input
              type="number"
              step="any"
              min="0"
              name={key}
              value={criteria[key]}
              onChange={handleInputChange}
              className="border px-2 py-1 w-full rounded mt-1"
              placeholder={['operatingMargins','revenueGrowth','returnOnAssets'].includes(key) ? "Decimal (e.g. 0.1 = 10%)" : ""}
            />
          </div>
        ))}
      </div>

      {/* Analyze button with warning */}
      <div className="mb-4">
        <button
          onClick={handleSearch}
          disabled={!allFieldsFilled}
          className={`px-4 py-1 rounded transition text-white ${
            allFieldsFilled
              ? 'bg-blue-500 hover:bg-blue-600'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          Analyze
        </button>
        {showWarning && (
          <p className="text-red-500 mt-2 text-sm">
            Please fill out all fields before analyzing.
          </p>
        )}
      </div>

      {/* Results table */}
      {filtered.length > 0 ? (
        <div className="overflow-auto">
          <table className="min-w-full table-auto border">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2">Ticker</th>
                <th className="px-4 py-2">P/E (FWD)</th>
                <th className="px-4 py-2">PEG (TTM)</th>
                <th className="px-4 py-2">EV/EBITDA</th>
                <th className="px-4 py-2">Operating Margin</th>
                <th className="px-4 py-2">Revenue Growth</th>
                <th className="px-4 py-2">Return On Assets</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(stock => (
                <tr key={stock.symbol} className="border-t">
                  <td className="px-6 py-2 font-bold">{stock.symbol || '-'}</td>
                  <td className="px-6 py-2">{displayValue(stock.forwardPE)}</td>
                  <td className="px-6 py-2">{displayValue(stock.trailingPegRatio)}</td>
                  <td className="px-6 py-2">{displayValue(stock.enterpriseToEbitda)}</td>
                  <td className="px-6 py-2">{displayValue(stock.operatingMargins, true)}</td>
                  <td className="px-6 py-2">{displayValue(stock.revenueGrowth, true)}</td>
                  <td className="px-6 py-2">{displayValue(stock.returnOnAssets, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-800">No results to display.</p>
      )}
    </div>
  );
}
