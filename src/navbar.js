import { Link } from "react-router-dom";
import React from "react";
import dingerLogo from "./dinger.png";
import { useAnalysis } from "./AnalysisContext"; // Import the context hook

export default function NavBar({ user }) {
  // Get state and functions from the global context instead of props
  const { searchQuery, setSearchQuery, handleSearchSubmit } = useAnalysis();

  const onFormSubmit = (e) => {
    e.preventDefault(); // Prevent page reload
    if (searchQuery.trim()) {
      handleSearchSubmit(searchQuery.trim().toUpperCase());
    }
  };

  return (
    <nav className="flex justify-between items-center px-4 py-4 bg-logo-background text-white shadow-md flex-wrap gap-4">
      <div className="flex items-center">
        <img src={dingerLogo} alt="Dinger App Logo" className="h-10 w-10" />
        <Link to="/" className="text-3xl font-extrabold">
          Dinger
        </Link>
      </div>

      {/* --- Search Bar Form --- */}
      <div className="flex-grow max-w-xl mx-auto">
        <form onSubmit={onFormSubmit}>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Ticker or Name..."
            className="w-full px-4 py-2 text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>
      </div>

      <div className="flex items-center gap-8 text-lg font-medium">
        <Link
          to="/analysis"
          className="hover:text-blue-500 transition-colors duration-200"
        >
          Analysis
        </Link>

        {user ? (
          <span className="truncate max-w-xs" title={user.email}>
            {user.email}
          </span>
        ) : (
          <Link
            to="/signin"
            className="hover:text-blue-500 transition-colors duration-200"
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}