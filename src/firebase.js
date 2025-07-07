import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";  
const firebaseConfig = {
  apiKey: "AIzaSyCHR7XmdaSqfY6152i-YDhxAfn8R3_sOgY",
  authDomain: "stock-screener-ec452.firebaseapp.com",
  projectId: "stock-screener-ec452",
  storageBucket: "stock-screener-ec452.firebasestorage.app",
  messagingSenderId: "325847703652",
  appId: "1:325847703652:web:428b1d3933d61f7571bf71"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);  
