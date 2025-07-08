import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AnalysisProvider } from './AnalysisContext'; 
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
      <AnalysisProvider> 
        <App />
      </AnalysisProvider>
  </BrowserRouter>
);