import os
import requests
import random
import yfinance as yf
from dotenv import load_dotenv
from pathlib import Path
import time
import urllib.error
import json

from google.cloud import firestore
from google.oauth2 import service_account

# Load environment variables
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path, override=False)

API_KEY = os.getenv("FMP_API_KEY")
if not API_KEY:
    raise ValueError(
        "FMP_API_KEY not found. Set it in your .env for local dev "
        "or as a GitHub Actions secret for CI."
    )

FMP_URL = f"https://financialmodelingprep.com/api/v3/stock/list?apikey={API_KEY}"

cred = service_account.Credentials.from_service_account_file("src/serviceAccount.json")
db = firestore.Client(credentials=cred)

# Filtering thresholds
FILTERS = {
    "grossMargins": 0.50,
    "ebitdaMargins": 0.15,
    "operatingMargins": 0.10,
    "earningsGrowth": 0.10,
    "revenueGrowth": 0.05,
    "returnOnAssets": 0.05,
    "returnOnEquity": 0.20,
    "freeCashflow": 0.0
}

def passes_filters(info):
    """Apply custom filters to Yahoo Finance data."""
    try:
        return (
            info.get("grossMargins", 0) > FILTERS["grossMargins"] and
            info.get("ebitdaMargins", 0) > FILTERS["ebitdaMargins"] and
            info.get("operatingMargins", 0) > FILTERS["operatingMargins"] and
            info.get("earningsGrowth", 0) > FILTERS["earningsGrowth"] and
            info.get("revenueGrowth", 0) > FILTERS["revenueGrowth"] and
            info.get("returnOnAssets", 0) > FILTERS["returnOnAssets"] and
            info.get("returnOnEquity", 0) > FILTERS["returnOnEquity"] and
            info.get("freeCashflow", 0) > FILTERS["freeCashflow"]
        )
    except Exception:
        return False

def fetch_in_batches(tickers, batch_size=300):
    all_results = []
    total_batches = (len(tickers) + batch_size - 1) // batch_size

    for i in range(0, len(tickers), batch_size):
        batch_num = i // batch_size + 1
        batch = tickers[i:i + batch_size]
        print(f"Processing batch {batch_num}/{total_batches} ({len(batch)} tickers)")

        try:
            data = yf.Tickers(" ".join(batch))
        except Exception as e:
            print(f"Batch {batch_num} fetch failed: {e}")
            continue

        added_count = 0
        for symbol in batch:
            try:
                t = data.tickers.get(symbol)
                if not t:
                    continue
                info = t.info
                if not info or not passes_filters(info):
                    continue

                stock_data = {
                    "symbol": info.get("symbol"),
                    "name": info.get("shortName"),
                    "marketCap": info.get("marketCap"),
                    "grossMargins": info.get("grossMargins"),
                    "ebitdaMargins": info.get("ebitdaMargins"),
                    "operatingMargins": info.get("operatingMargins"),
                    "earningsGrowth": info.get("earningsGrowth"),
                    "revenueGrowth": info.get("revenueGrowth"),
                    "forwardPE": info.get("forwardPE"),
                    "trailingPegRatio": info.get("trailingPegRatio"),
                    "enterpriseToRevenue": info.get("enterpriseToRevenue"),
                    "enterpriseToEbitda": info.get("enterpriseToEbitda"),
                    "freeCashflow": info.get("freeCashflow"),
                    "returnOnAssets": info.get("returnOnAssets"),
                    "returnOnEquity": info.get("returnOnEquity"),
                }
                all_results.append(stock_data)

                db.collection("stocks").document(stock_data["symbol"]).set(stock_data)
                added_count += 1
            except urllib.error.HTTPError as e:
                print(f"HTTP error for {symbol}: {e}")
            except Exception as e:
                print(f"Error for {symbol}: {e}")

        print(f"Batch {batch_num} complete: {added_count} added")
        time.sleep(random.uniform(5, 8))

    return all_results

def main():
    response = requests.get(FMP_URL)
    stocks = response.json()

    existing_docs = db.collection("stocks").stream()
    existing_symbols = set(doc.id for doc in existing_docs)

    filtered_tickers = [
        s['symbol'] for s in stocks
        if (
            s.get("exchange") == "NASDAQ Global Select" or
            s.get("exchangeShortName") == "NYSE"
        ) and s.get("price", 0) > 20.0
        and s.get("type") == "stock"
        and s['symbol'] not in existing_symbols
        and len(s['symbol']) <= 4
    ]

    print(f"Tickers passing exchange filter: {len(filtered_tickers)}")

    fetch_in_batches(filtered_tickers)

if __name__ == "__main__":
    main()
