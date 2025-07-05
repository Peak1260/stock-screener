import sqlite3 from "sqlite3";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

async function migrate() {
  // Initialize Firebase Admin SDK
  initializeApp({
    credential: applicationDefault(),
  });

  const db = new sqlite3.Database("./backend/stocks.db");
  const firestore = getFirestore();

  db.serialize(() => {
    db.all("SELECT * FROM stocks", async (err, rows) => {
      if (err) {
        console.error(err);
        return;
      }
      for (const row of rows) {
        const docRef = firestore.collection("stocks").doc(row.symbol);
        await docRef.set(row);
        console.log(`Migrated ${row.symbol}`);
      }
      console.log("Migration complete!");
      db.close();
    });
  });
}

migrate();
