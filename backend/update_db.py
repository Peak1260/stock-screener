import os
import requests
import yfinance as yf
import sqlite3
from dotenv import load_dotenv
from pathlib import Path
import time
import urllib.error

# Load .env from parent directory
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

API_KEY = os.getenv("FMP_API_KEY")
FMP_URL = f"https://financialmodelingprep.com/api/v3/stock/list?apikey={API_KEY}"

FILTERS = {
    "grossMargins": 0.45,
    "ebitdaMargins": 0.15,
    "operatingMargins": 0.10,
    "earningsGrowth": 0.07,
    "revenueGrowth": 0.07,
    "returnOnAssets": 0.05,
    "returnOnEquity": 0.20,
}

def passes_filters(info):
    try:
        return (
            info.get("grossMargins", 0) > FILTERS["grossMargins"] and
            info.get("ebitdaMargins", 0) > FILTERS["ebitdaMargins"] and
            info.get("operatingMargins", 0) > FILTERS["operatingMargins"] and
            info.get("earningsGrowth", 0) > FILTERS["earningsGrowth"] and
            info.get("revenueGrowth", 0) > FILTERS["revenueGrowth"] and
            info.get("returnOnAssets", 0) > FILTERS["returnOnAssets"] and
            info.get("returnOnEquity", 0) > FILTERS["returnOnEquity"]
        )
    except Exception:
        return False

def main():
    response = requests.get(FMP_URL)
    stocks = response.json()

    filtered_tickers = [
        s['symbol'] for s in stocks
        if s.get("exchangeShortName") in {"NYSE", "NASDAQ"} and s.get("price", 0) is not None and s.get("price", 0) >= 10.0 and s.get("type") == "stock"
    ]

    print(f"Tickers passing exchange: {len(filtered_tickers)}")

    conn = sqlite3.connect("stocks.db")
    c = conn.cursor()

    # Step 1: Create a temporary table
    c.execute("DROP TABLE IF EXISTS stocks_temp")
    c.execute("""
        CREATE TABLE stocks_temp (
            symbol TEXT PRIMARY KEY,
            name TEXT,
            marketCap REAL,
            grossMargins REAL,
            ebitdaMargins REAL,
            operatingMargins REAL,
            earningsGrowth REAL,
            revenueGrowth REAL,
            forwardPE REAL,
            trailingPegRatio REAL,
            enterpriseToRevenue REAL,
            enterpriseToEbitda REAL,
            freeCashflow REAL,
            returnOnAssets REAL,
            returnOnEquity REAL
        )
    """)

    for ticker in filtered_tickers:
        try:
            yf_ticker = yf.Ticker(ticker)
            info = yf_ticker.info

            if not info:
                continue

            if passes_filters(info):
                row = (
                    info.get("symbol"),
                    info.get("shortName"),
                    info.get("marketCap"),
                    info.get("grossMargins"),
                    info.get("ebitdaMargins"),
                    info.get("operatingMargins"),
                    info.get("earningsGrowth"),
                    info.get("revenueGrowth"),
                    info.get("forwardPE"),
                    info.get("trailingPegRatio"),
                    info.get("enterpriseToRevenue"),
                    info.get("enterpriseToEbitda"),
                    info.get("freeCashflow"),
                    info.get("returnOnAssets"),
                    info.get("returnOnEquity"),
                )
                c.execute("INSERT OR REPLACE INTO stocks_temp VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", row)
                print(f"Added {ticker}")

            time.sleep(0.2)

        except urllib.error.HTTPError as e:
            if e.code == 404:
                print(f"HTTP 404 error for {ticker}")
            else:
                print(f"HTTP error for {ticker}: {e}")
        except Exception as e:
            print(f"Error for {ticker}: {e}")

    # Step 2: Final commit & atomic swap
    conn.commit()
    try:
        c.execute("DROP TABLE IF EXISTS stocks_backup")
        c.execute("ALTER TABLE stocks RENAME TO stocks_backup")
        c.execute("ALTER TABLE stocks_temp RENAME TO stocks")
        c.execute("DROP TABLE IF EXISTS stocks_backup")
        print("✅ Table swap complete.")
    except Exception as e:
        print(f"⚠️ Error during table swap: {e}")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    main()
