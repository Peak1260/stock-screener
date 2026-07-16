import os
import requests
import random
import yfinance as yf
from dotenv import load_dotenv
from pathlib import Path
import time
import urllib.error
import csv

from google.cloud import firestore
from google.oauth2 import service_account

# Load environment variables
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path, override=False)

cred = service_account.Credentials.from_service_account_file("src/serviceAccount.json")
db = firestore.Client(credentials=cred, database="stock-screener")

# Filtering thresholds
FILTERS = {
    "grossMargins": 0.50,
    "ebitdaMargins": 0.15,
    "operatingMargins": 0.10,
    "earningsGrowth": 0.10,
    "revenueGrowth": 0.10,
    "returnOnAssets": 0.05,
    "returnOnEquity": 0.20,
    "freeCashflow": 0.0
}


def get_tickers_from_nasdaq():
    """
    Download ticker lists directly from NASDAQ Trader's public FTP files.
    No API key required. Covers NASDAQ + NYSE + other US exchanges.
    Files are pipe-delimited with a metadata line at the end.
    """
    tickers = set()

    ftp_urls = [
        "https://www.nasdaqtrader.com/dynamic/symdir/nasdaqlisted.txt",
        "https://www.nasdaqtrader.com/dynamic/symdir/otherlisted.txt",
    ]

    headers = {"User-Agent": "Mozilla/5.0"}

    for url in ftp_urls:
        try:
            resp = requests.get(url, headers=headers, timeout=15)
            resp.raise_for_status()
            lines = resp.text.splitlines()

            # First line is header, last line is a file-created timestamp -- skip it
            reader = csv.DictReader(lines[:-1], delimiter="|")
            for row in reader:
                symbol = row.get("Symbol", "").strip()
                test_issue = row.get("Test Issue", "").strip()
                etf = row.get("ETF", "").strip()

                if (
                    symbol
                    and test_issue == "N"
                    and etf == "N"
                    and len(symbol) <= 4
                    and symbol.isalpha()
                ):
                    tickers.add(symbol)

            print(f"Fetched {url.split('/')[-1]}: running total {len(tickers)} tickers")
        except Exception as e:
            print(f"Failed to fetch {url}: {e}")

    return list(tickers)


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


def fetch_ticker_with_retry(symbol, max_retries=2):
    """
    Fetch a single ticker's info with exponential backoff on rate limit errors.
    Returns info dict or None if all retries fail.
    """
    for attempt in range(max_retries):
        try:
            t = yf.Ticker(symbol)
            info = t.info

            if not info or len(info) < 10:
                raise ValueError(f"Suspiciously thin info dict ({len(info)} keys)")

            return info

        except Exception as e:
            err = str(e).lower()
            is_rate_limit = any(x in err for x in ["429", "too many", "rate limit", "thin info", "suspiciously"])

            if attempt < max_retries - 1:
                # Exponential backoff: 10-20s, 20-40s
                sleep_time = (2 ** attempt) * random.uniform(10, 20)
                if is_rate_limit:
                    print(f"  Rate limited on {symbol} (attempt {attempt+1}), sleeping {sleep_time:.0f}s...")
                else:
                    print(f"  Error on {symbol} (attempt {attempt+1}): {e}, retrying in {sleep_time:.0f}s...")
                time.sleep(sleep_time)
            else:
                print(f"  Giving up on {symbol} after {max_retries} attempts: {e}")
                return None

    return None


def fetch_in_batches(tickers, existing_symbols):
    """
    Fetch tickers one at a time with retry logic and paced sleeping.
    Updates existing stocks, adds new ones, and removes ones that no longer pass.
    """
    all_results = []
    total = len(tickers)

    for i, symbol in enumerate(tickers):
        print(f"[{i+1}/{total}] Fetching {symbol}...")

        info = fetch_ticker_with_retry(symbol)
        if not info:
            continue
            
        # Check if it passes our valuation / price checks
        passed = passes_filters(info)
        price = info.get("currentPrice", info.get("regularMarketPrice", 0))

        # If it fails the checks, but is currently in the DB, delete it
        if not passed or price < 1:
            if symbol in existing_symbols:
                try:
                    db.collection("stocks").document(symbol).delete()
                    print(f"  Removed {symbol} (no longer passes filters)")
                except Exception as e:
                    print(f"  Firestore delete failed for {symbol}: {e}")
            continue

        # --- BEGIN ADR / ASML MULTIPLE FIX ---
        # 1. Pull the raw figures to calculate Enterprise Value (EV)
        market_cap = info.get("marketCap", 0)
        total_debt = info.get("totalDebt", 0)
        total_cash = info.get("totalCash", 0)
        revenue = info.get("totalRevenue", 0)
        ebitda = info.get("ebitda", 0)

        # 2. Calculate EV: Market Cap + Debt - Cash
        # Need to ensure they aren't None before doing math
        safe_mc = market_cap if market_cap else 0
        safe_debt = total_debt if total_debt else 0
        safe_cash = total_cash if total_cash else 0
        ev = safe_mc + safe_debt - safe_cash

        # 3. Manually calculate the ratios, falling back to Yahoo's if raw data is missing
        if ev and revenue:
            ev_to_rev = ev / revenue
        else:
            ev_to_rev = info.get("enterpriseToRevenue")

        if ev and ebitda:
            ev_to_ebitda = ev / ebitda
        else:
            ev_to_ebitda = info.get("enterpriseToEbitda")

        if ev_to_rev and ev_to_rev > 1000 and ev_to_rev < 0:
            ev_to_rev = None
        if ev_to_ebitda and ev_to_ebitda > 1000 and ev_to_ebitda < 0:
            ev_to_ebitda = None

        stock_data = {
            "symbol": info.get("symbol"),
            "name": info.get("shortName"),
            "marketCap": market_cap,
            "grossMargins": info.get("grossMargins"),
            "ebitdaMargins": info.get("ebitdaMargins"),
            "operatingMargins": info.get("operatingMargins"),
            "earningsGrowth": info.get("earningsGrowth"),
            "revenueGrowth": info.get("revenueGrowth"),
            "forwardPE": info.get("forwardPE"),
            "trailingPegRatio": info.get("trailingPegRatio"),
            "enterpriseToRevenue": ev_to_rev,      
            "enterpriseToEbitda": ev_to_ebitda,        
            "freeCashflow": info.get("freeCashflow"),
            "returnOnAssets": info.get("returnOnAssets"),
            "returnOnEquity": info.get("returnOnEquity"),
        }

        try:
            # .set() automatically overwrites the entire document, giving you an updated valuation
            db.collection("stocks").document(stock_data["symbol"]).set(stock_data)
            all_results.append(stock_data)
            
            if symbol in existing_symbols:
                print(f"  Updated {symbol}")
            else:
                print(f"  Added {symbol}")
        except Exception as e:
            print(f"  Firestore write failed for {symbol}: {e}")

        # Every 50 tickers take a longer cooldown to let Yahoo's rate limit window reset
        if (i + 1) % 50 == 0:
            cooldown = random.uniform(30, 45)
            print(f"--- {i+1}/{total} done, cooling down {cooldown:.0f}s ---")
            time.sleep(cooldown)
        else:
            time.sleep(random.uniform(1, 3))

    print(f"Done. {len(all_results)} total stocks passed and saved to Firestore.")
    return all_results


def main():
    all_tickers = get_tickers_from_nasdaq()
    print(f"Total tickers from NASDAQ/NYSE listings: {len(all_tickers)}")

    if not all_tickers:
        print("No tickers fetched -- check network or NASDAQ trader URLs.")
        return

    existing_docs = db.collection("stocks").stream()
    existing_symbols = set(doc.id for doc in existing_docs)
    print(f"Tickers currently in DB: {len(existing_symbols)}")

    fetch_in_batches(all_tickers, existing_symbols)


if __name__ == "__main__":
    main()