import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { Link } from "react-router-dom";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const signIn = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (err) {
      alert(err.message);
    }
  };

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      navigate("/");
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="p-6 max-w-md w-full bg-white shadow rounded">
        <h2 className="text-xl font-bold mb-4 text-center">Sign In to Your Account</h2>
        <form onSubmit={signIn}>
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
            className="bg-blue-500 text-white px-4 py-2 rounded w-full"
            type="submit"
          >
            Sign In
          </button>
        </form>
        <button
          onClick={signInWithGoogle}
          className="mt-4 w-full bg-red-500 text-white px-4 py-2 rounded"
        >
          Sign in with Google
        </button>
        <p className="mt-4 text-center">
            Don't have an account?{" "}
            <Link to="/signup" className="text-blue-500 hover:underline">
                Sign Up
            </Link>
        </p>
      </div>
    </div>
  );
}
