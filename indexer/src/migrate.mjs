import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const sqlDirectory = fileURLToPath(new URL("../sql/", import.meta.url));
const migrations = (await readdir(sqlDirectory))
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort();
const pool = new pg.Pool({ connectionString: databaseUrl, ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false } });

try {
  for (const migration of migrations) {
    await pool.query(await readFile(path.join(sqlDirectory, migration), "utf8"));
  }
  console.log("Bittensor Relics indexer schema is ready.");
} finally {
  await pool.end();
}
