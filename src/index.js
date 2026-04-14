import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AnalysisProvider } from './AnalysisContext';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import './index.css';

function Root() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  if (authLoading) return <div>Loading...</div>;

  return (
    <BrowserRouter>
      <AnalysisProvider>
        <App user={user} />
      </AnalysisProvider>
    </BrowserRouter>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Root />);