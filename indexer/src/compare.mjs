import pg from "pg";
import { auditSnapshot, compareSnapshots } from "./audit.mjs";

const primaryUrl = process.env.DATABASE_URL;
const replayUrl = process.env.REPLAY_DATABASE_URL;
const chainGenesis = process.env.CHAIN_GENESIS_HASH ?? "0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105";

if (!primaryUrl) throw new Error("DATABASE_URL is required.");
if (!replayUrl) throw new Error("REPLAY_DATABASE_URL is required.");
if (primaryUrl === replayUrl) throw new Error("REPLAY_DATABASE_URL must point to an independent database.");

function pool(connectionString) {
  return new pg.Pool({
    connectionString,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 5_000,
  });
}

const primary = pool(primaryUrl);
const replay = pool(replayUrl);
try {
  const [primarySnapshot, replaySnapshot] = await Promise.all([
    auditSnapshot(primary, chainGenesis),
    auditSnapshot(replay, chainGenesis),
  ]);
  const differences = compareSnapshots(primarySnapshot, replaySnapshot);
  console.log(JSON.stringify({ primary: primarySnapshot, replay: replaySnapshot, differences }, null, 2));
  if (differences.length) throw new Error(`INDEX_REPLAY_MISMATCH: ${differences.join(", ")}`);
  console.log("Neural Relics replay audit passed: both finalized indexes are identical.");
} finally {
  await Promise.all([primary.end(), replay.end()]);
}
