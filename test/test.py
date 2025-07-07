import sqlite3

# Connect to the database
conn = sqlite3.connect("stocks.db")
c = conn.cursor()

# Fetch all rows
c.execute("SELECT * FROM stocks")
rows = c.fetchall()

# Print rows
for row in rows:
    print(row)

conn.close()