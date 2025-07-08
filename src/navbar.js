import { Link } from "react-router-dom";
import React from "react";
import dingerLogo from "./dinger.png";

export default function NavBar({ user }) {
  return (
    <nav className="flex justify-between items-center px-8 py-4 bg-logo-background text-white shadow-md">
      <div className="flex items-center">
        <img src={dingerLogo} alt="Dinger App Logo" className="h-10 w-10" />
        <Link to="/" className="text-3xl font-extrabold">
          Dinger
        </Link>
      </div>

      <div className="flex items-center gap-4 text-xl font-medium">
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
