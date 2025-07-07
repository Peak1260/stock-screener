from fastapi import FastAPI, HTTPException
from databases import Database
from fastapi.middleware.cors import CORSMiddleware

DATABASE_URL = "sqlite:///backend/stocks.db"
database = Database(DATABASE_URL)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://dinger-screener.vercel.app"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await database.connect()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

@app.get("/stocks")
async def get_stocks():
    query = """
    SELECT
        symbol,
        name,
        marketCap,
        grossMargins,
        ebitdaMargins,
        operatingMargins,
        earningsGrowth,
        revenueGrowth,
        returnOnAssets,
        returnOnEquity,
        forwardPE,
        trailingPegRatio,
        enterpriseToRevenue,
        enterpriseToEbitda,
        freeCashflow
    FROM stocks
    """
    try:
        rows = await database.fetch_all(query)
        data = [dict(row) for row in rows]
        return data
    except Exception as e:
        print(f"Error fetching stocks: {e}")
        raise HTTPException(status_code=500, detail=str(e))
