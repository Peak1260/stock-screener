import os
from tkinter.filedialog import test
import requests
import yfinance as yf
from dotenv import load_dotenv
from pathlib import Path
import time
import urllib.error
import json

from google.cloud import firestore
from google.oauth2 import service_account

# Load .env from parent directory
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

API_KEY = os.getenv("FMP_API_KEY")
FMP_URL = f"https://financialmodelingprep.com/api/v3/stock/list?apikey={API_KEY}"

# Load Firebase credentials
cred = service_account.Credentials.from_service_account_file("serviceAccount.json")
db = firestore.Client(credentials=cred)

def main():
    # Get all existing stock symbols from Firestore
    print("Fetching existing symbols from Firestore...")
    existing_docs = db.collection("total_stocks").stream()
    existing_symbols = set(doc.id for doc in existing_docs)
    print(f"Found {len(existing_symbols)} already in database")

    # Get stock list from FMP
    print("Fetching stock list from FMP...")
    response = requests.get(FMP_URL)
    stocks = response.json()

    filtered_tickers = [
        s['symbol'] for s in stocks
        if (s.get("exchangeShortName") in {"NASDAQ", "NYSE"})
        and s.get("price", 0) is not None
        and s.get("price", 0) > 10.0
        and s.get("type") == "stock"
        and s['symbol'] not in existing_symbols  
    ]

    print(f"Tickers to fetch: {len(filtered_tickers)}")

    for ticker in filtered_tickers:
        try:
            yf_ticker = yf.Ticker(ticker)
            info = yf_ticker.info

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

            if stock_data["symbol"]:
                db.collection("total_stocks").document(stock_data["symbol"]).set(stock_data)
                print(f"Added {ticker}")
            else:
                print(f"Skipping {ticker}: No symbol found")

            time.sleep(1)  

        except urllib.error.HTTPError as e:
            print(f"HTTP error for {ticker}: {e}")
        except Exception as e:
            print(f"Error for {ticker}: {e}")

if __name__ == "__main__":
    main()
