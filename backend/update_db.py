import os
import requests
import yfinance as yf
import sqlite3

API_KEY = os.getenv("FMP_API_KEY")
FMP_URL = f"https://financialmodelingprep.com/api/v3/stock/list?apikey={API_KEY}"

FILTERS = {
    "grossMargins": 0.40,
    "ebitdaMargins": 0.15,
    "operatingMargins": 0.10,
    "earningsGrowth": 0.08,
    "revenueGrowth": 0.08,
    "returnOnAssets": 0.10,
    "returnOnEquity": 0.15,
}

def passes_filters(info):
    try:
        return (
            info.get("grossMargins", 0) and info["grossMargins"] >= FILTERS["grossMargins"] and
            info.get("ebitdaMargins", 0) and info["ebitdaMargins"] >= FILTERS["ebitdaMargins"] and
            info.get("operatingMargins", 0) and info["operatingMargins"] >= FILTERS["operatingMargins"] and
            info.get("earningsGrowth", 0) and info["earningsGrowth"] >= FILTERS["earningsGrowth"] and
            info.get("revenueGrowth", 0) and info["revenueGrowth"] >= FILTERS["revenueGrowth"] and
            info.get("returnOnAssets", 0) and info["returnOnAssets"] >= FILTERS["returnOnAssets"] and
            info.get("returnOnEquity", 0) and info["returnOnEquity"] >= FILTERS["returnOnEquity"]
        )
    except Exception:
        return False

def main():
    # Step 1: Get all stocks from FMP
    response = requests.get(FMP_URL)
    stocks = response.json()

    # Step 2: Filter stocks by exchange and market cap
    filtered_tickers = [
        s['symbol'] for s in stocks
        if s.get("exchangeShortName") in {"NYSE", "NASDAQ"} and s.get("marketCap", 0) >= 10_000_000_000
    ]

    print(f"Tickers passing exchange & market cap filter: {len(filtered_tickers)}")

    # Set up SQLite
    conn = sqlite3.connect("stocks.db")
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS stocks (
            symbol TEXT PRIMARY KEY,
            name TEXT,
            marketCap REAL,
            grossMargins REAL,
            ebitdaMargins REAL,
            operatingMargins REAL,
            earningsGrowth REAL,
            revenueGrowth REAL,
            returnOnAssets REAL,
            returnOnEquity REAL
        )
    """)
    c.execute("DELETE FROM stocks")

    # Step 3: Use yfinance to get detailed metrics and filter again
    for ticker in filtered_tickers:
        try:
            yf_ticker = yf.Ticker(ticker)
            info = yf_ticker.info

            # Defensive: skip if no info or missing keys
            if not info or 'marketCap' not in info:
                continue

            # Apply your detailed filters
            if passes_filters(info):
                c.execute("""
                    INSERT OR REPLACE INTO stocks VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    info.get("symbol"),
                    info.get("shortName"),
                    info.get("marketCap"),
                    info.get("grossMargins"),
                    info.get("ebitdaMargins"),
                    info.get("operatingMargins"),
                    info.get("earningsGrowth"),
                    info.get("revenueGrowth"),
                    info.get("returnOnAssets"),
                    info.get("returnOnEquity"),
                ))
                print(f"Added {ticker}")

        except Exception as e:
            print(f"Error for {ticker}: {e}")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    main()
