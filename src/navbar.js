import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import React from "react";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import { useNavigate } from "react-router-dom";
import dingerLogo from "./dinger.png";
import { useAnalysis } from "./AnalysisContext";

export default function NavBar({ user }) {
  const { searchQuery, setSearchQuery, handleSearchSubmit } = useAnalysis();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const onFormSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      handleSearchSubmit(searchQuery.trim().toUpperCase());
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate("/signin");
    } catch (err) {
      alert(err.message);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="flex justify-between items-center px-4 py-4 bg-logo-background text-white shadow-md flex-wrap gap-4">
      <div className="flex items-center">
        <img src={dingerLogo} alt="Dinger App Logo" className="h-10 w-10" />
        <Link to="/" className="text-3xl font-extrabold">
          Dinger
        </Link>
      </div>

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
          to="/watchlist"
          className="hover:text-blue-500 transition-colors duration-200"
        >
          Watchlist
        </Link>

        {user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="truncate max-w-xs hover:text-blue-300 transition-colors duration-200"
              title={user.email}
            >
              {user.email}
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-36 bg-white rounded shadow-lg z-50">
                <button
                  onClick={handleSignOut}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
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