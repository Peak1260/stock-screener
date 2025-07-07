import { Link } from "react-router-dom";
import React from "react";
import dingerLogo from "./dinger.png"; 

export default function NavBar({ user }) {
  return (
    <div className="flex justify-between items-center px-6 py-3 bg-logo-background text-white">
      <div className="flex items-center">
        <img src={dingerLogo} alt="Dinger App Logo" className="h-10 w-10" />
        <div className="text-3xl font-bold">Dinger</div>
      </div>

      <div>
        {user ? (
          <div className="flex items-center gap-4">
            <span>{user.email}</span>
          </div>
        ) : (
          <Link to="/signin" className="text-blue-500 text-lg hover:underline">
            Sign In
          </Link>
        )}
      </div>
    </div>
  );
}