import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const sqlUrl = new URL("../sql/001_initial.sql", import.meta.url);
const sql = await readFile(fileURLToPath(sqlUrl), "utf8");
const pool = new pg.Pool({ connectionString: databaseUrl, ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false } });

try {
  await pool.query(sql);
  console.log("Neural Relics indexer schema is ready.");
} finally {
  await pool.end();
}
