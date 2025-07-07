import { Link } from "react-router-dom";
import React from "react";

export default function NavBar({ user }) {
  return (
    <div className="flex justify-between items-center px-6 py-3 bg-gray-900 text-white">
      <div className="text-xl font-bold">Dinger</div>
      <div>
        {user ? (
          <div className="flex items-center gap-4">
            <span>{user.email}</span>
          </div>
        ) : (
          <Link to="/signin" className="text-blue-300 hover:underline">
            Sign In
          </Link>
        )}
      </div>
    </div>
  );
}
