import { useState } from "react";
import { Link } from "react-router-dom";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { auth } from "./firebase";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const signUp = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
      setMessage("Verification email sent! Please check your inbox.");
      await auth.signOut();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="p-6 max-w-md w-full bg-white shadow rounded">
        <h2 className="text-xl font-bold mb-4 text-center">Create a New Account</h2>
        <form onSubmit={signUp}>
          <input
            className="border p-2 w-full mb-2"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="border p-2 w-full mb-2"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            className="bg-green-500 text-white px-4 py-2 rounded w-full"
            type="submit"
          >
            Sign Up
          </button>
        </form>
        {message && <p className="mt-4 text-green-600">{message}</p>}
        <p className="mt-4 text-center">
          Already have an account?{" "}
          <Link to="/signin" className="text-blue-500 hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
