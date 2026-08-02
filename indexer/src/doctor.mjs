import { ApiPromise, WsProvider } from "@polkadot/api";
import pg from "pg";
import { parseBlockBounds } from "./config.mjs";
import { validateDoctorState } from "./doctor-lib.mjs";

const databaseUrl = process.env.DATABASE_URL;
const rpcUrl = process.env.SUBTENSOR_RPC ?? "wss://test.chain.opentensor.ai";
const expectedGenesis = process.env.CHAIN_GENESIS_HASH ?? "0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105";
const supportedSpec = Number.parseInt(process.env.SUPPORTED_SPEC_VERSION ?? "440", 10);
const { startBlock, stopBlock } = parseBlockBounds();

if (!databaseUrl) throw new Error("DATABASE_URL is required.");
if (!/^0x[0-9a-f]{64}$/.test(expectedGenesis)) throw new Error("CHAIN_GENESIS_HASH must be a full lowercase hash.");
if (!Number.isSafeInteger(supportedSpec) || supportedSpec < 1) throw new Error("SUPPORTED_SPEC_VERSION must be a positive integer.");

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 5_000,
});
let api;
try {
  api = await ApiPromise.create({ provider: new WsProvider(rpcUrl), noInitWarn: true });
  const finalizedHash = await api.rpc.chain.getFinalizedHead();
  const [header, runtime, tableResult, columnResult, transferColumnResult, checkpointResult] = await Promise.all([
    api.rpc.chain.getHeader(finalizedHash),
    api.rpc.state.getRuntimeVersion(finalizedHash),
    pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"),
    pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'artifacts'"),
    pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transfers'"),
    pool.query("SELECT block_number FROM chain_checkpoints WHERE chain_genesis = $1", [expectedGenesis]),
  ]);
  const report = validateDoctorState({
    expectedGenesis,
    actualGenesis: api.genesisHash.toHex(),
    supportedSpec,
    actualSpec: runtime.specVersion.toNumber(),
    startBlock,
    stopBlock,
    finalizedHead: header.number.toNumber(),
    checkpoint: checkpointResult.rowCount ? Number(checkpointResult.rows[0].block_number) : null,
    tables: tableResult.rows.map(({ table_name: name }) => name),
    artifactColumns: columnResult.rows.map(({ column_name: name }) => name),
    transferColumns: transferColumnResult.rows.map(({ column_name: name }) => name),
  });
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), submitted: false, rpcUrl, ...report }, null, 2));
} finally {
  if (api) await api.disconnect();
  await pool.end();
}
