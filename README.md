# Stock Screener Web App

This is a full-stack stock screener that helps users identify potential “home run” stocks based on key financial metrics like P/E ratio, PEG, EV/EBITDA, and more. It uses a Firebase Firestore database, updates automatically via GitHub Actions, and is deployed on Vercel with Google Sign-In support.

##  Tech Stack

- **Frontend**: React + Tailwind CSS
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication (Google Sign-In)
- **Deployment**:
  - Frontend: Vercel
  - Backend: GitHub Actions (runs `update_db.py` every Monday)
- **Stock Data**: Financial Modeling Prep (FMP) API, yfinance API, Finnhub API

---

## Features

- 🔍 Filter stocks by valuation criteria
- ✅ Highlights stocks that pass multiple quality filters
- 🔒 Google Sign-In authentication
- 🔄 Automatic backend data updates via GitHub Actions
- 🌐 Fully deployed with Firebase + Vercel
