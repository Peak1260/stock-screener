from fastapi import FastAPI, HTTPException
from databases import Database

DATABASE_URL = "sqlite:///backend/stocks.db"
database = Database(DATABASE_URL)

app = FastAPI()

@app.on_event("startup")
async def startup():
    await database.connect()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

@app.get("/stocks")
async def get_stocks():
    try:
        rows = await database.fetch_all("SELECT * FROM stocks")
        data = [dict(row) for row in rows]
        return data
    except Exception as e:
        print(f"❌ Error fetching stocks: {e}")
        raise HTTPException(status_code=500, detail=str(e))