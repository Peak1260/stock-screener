import requests
import sqlite3
import os

# API_KEY = os.getenv("FMP_API_KEY")  # Load securely from GitHub Actions secret
URL = f"https://financialmodelingprep.com/api/v3/stock/list?apikey=wzNXU4pF6LNPg9u3BQbzmEu4xdYCu2WO"

FILTER_CONDITIONS = {
    "exchange": {"NYSE", "NASDAQ"},
    "marketCap": 10_000_000_000,
    "grossMargin": 0.40,
    "ebitdaMargin": 0.15,
    "operatingMargin": 0.10,
    "earningsGrowth": 0.08,
    "revenueGrowth": 0.08,
    "returnOnAssets": 0.10,
    "returnOnEquity": 0.15,
}

def passes_filters(stock):
    try:
        return (
            stock.get("exchangeShortName") in FILTER_CONDITIONS["exchange"] and
            stock.get("marketCap", 0) >= FILTER_CONDITIONS["marketCap"] and
            stock.get("grossMargin", 0) >= FILTER_CONDITIONS["grossMargin"] and
            stock.get("ebitdaMargin", 0) >= FILTER_CONDITIONS["ebitdaMargin"] and
            stock.get("operatingMargin", 0) >= FILTER_CONDITIONS["operatingMargin"] and
            stock.get("earningsGrowth", 0) >= FILTER_CONDITIONS["earningsGrowth"] and
            stock.get("revenueGrowth", 0) >= FILTER_CONDITIONS["revenueGrowth"] and
            stock.get("returnOnAssets", 0) >= FILTER_CONDITIONS["returnOnAssets"] and
            stock.get("returnOnEquity", 0) >= FILTER_CONDITIONS["returnOnEquity"]
        )
    except Exception:
        return False

def main():
    response = requests.get(URL)
    data = response.json()

    # Filter down to valid stocks
    filtered = [stock for stock in data if passes_filters(stock)]

    # Write to SQLite
    conn = sqlite3.connect("stocks.db")
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS filtered_stocks (
            symbol TEXT PRIMARY KEY,
            name TEXT,
            marketCap REAL,
            grossMargin REAL,
            ebitdaMargin REAL,
            operatingMargin REAL,
            earningsGrowth REAL,
            revenueGrowth REAL,
            returnOnAssets REAL,
            returnOnEquity REAL
        )
    """)

    c.execute("DELETE FROM filtered_stocks")

    for stock in filtered:
        c.execute("""
            INSERT OR REPLACE INTO filtered_stocks VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            stock.get("symbol"),
            stock.get("name"),
            stock.get("marketCap"),
            stock.get("grossMargin"),
            stock.get("ebitdaMargin"),
            stock.get("operatingMargin"),
            stock.get("earningsGrowth"),
            stock.get("revenueGrowth"),
            stock.get("returnOnAssets"),
            stock.get("returnOnEquity"),
        ))

    conn.commit()
    conn.close()

if __name__ == "__main__":
    main()
