import NavBar from './navbar';
import { Link } from "react-router-dom";

const criteria = [
  { label: "Gross Margins", value: "> 45%" },
  { label: "EBITDA Margins", value: "> 15%" },
  { label: "Operating Margins", value: "> 10%" },
  { label: "Earnings Growth", value: "> 8%" },
  { label: "Revenue Growth", value: "> 8%" },
  { label: "Return on Assets", value: "> 5%" },
  { label: "Return on Equity", value: "> 20%" },
  { label: "Market Cap", value: "> $10 billion" },
  { label: "Exchange", value: "NYSE or NASDAQ" },
];

export default function StockCriteria() {
  return (
    <div className="min-h-screen bg-gray-100">
      <NavBar />
      <div className="flex justify-center items-center p-6">
        <div className="bg-white shadow-md rounded p-6 max-w-3xl">
          <h1 className="text-2xl font-bold mb-4 text-center">Stock Selection Criteria</h1>
          <p className="text-gray-700 mb-4">
            Our stock selection method filters companies based on the following key financial metrics and criteria:
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-800">
            {criteria.map(({ label, value }) => (
              <li key={label}>
                <strong>{label}:</strong> {value}
              </li>
            ))}
          </ul>
          <p className="text-gray-700 mt-6">
            In addition to the fundamental metrics listed above, we apply specific valuation thresholds to help identify attractively priced stocks. For example, we consider a forward P/E ratio between 10 and 40, a PEG ratio below 2, enterprise value to revenue below 15, enterprise value to EBITDA below 30, and positive free cash flow. Stocks that meet these valuation thresholds are highlighted in green, while those outside the desired range are marked in red. Our screener also visually de-emphasizes stocks that meet three or fewer of these criteria by greying them out, allowing you to focus on companies with stronger financials and valuations aligned with our strategy.
          </p>
          <Link
            to="/"
            className="inline-block mt-8 text-blue-500 hover:underline"
          >
            ← Back to Stock Screener
          </Link>
        </div>
      </div>
    </div>
  );
}
