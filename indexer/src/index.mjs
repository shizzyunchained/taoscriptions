import http from "node:http";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { blake2AsHex } from "@polkadot/util-crypto";
import pg from "pg";
import {
  findProtocolRemark,
  INDEXER_VERSION,
  parseMintPayload,
  parseProtocolPayload,
  validateMint,
  validateTransfer,
} from "./protocol.mjs";

const databaseUrl = process.env.DATABASE_URL;
const rpcUrl = process.env.SUBTENSOR_RPC ?? "wss://test.chain.opentensor.ai";
const expectedGenesis = process.env.CHAIN_GENESIS_HASH ?? "0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105";
const supportedSpec = Number.parseInt(process.env.SUPPORTED_SPEC_VERSION ?? "440", 10);
const startBlock = Number.parseInt(process.env.START_BLOCK ?? "", 10);
const port = Number.parseInt(process.env.PORT ?? "10000", 10);

if (!databaseUrl) throw new Error("DATABASE_URL is required.");
if (!Number.isSafeInteger(startBlock) || startBlock < 1) throw new Error("START_BLOCK must be an explicit positive finalized block number.");

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  max: 5,
});
const health = {
  status: "starting",
  chain: expectedGenesis,
  checkpoint: startBlock - 1,
  finalizedHead: null,
  lagBlocks: null,
  lastCommittedAt: null,
  error: null,
};

function healthSnapshot() {
  return { event: "indexer_health", version: INDEXER_VERSION, ...health };
}

setInterval(() => console.log(JSON.stringify(healthSnapshot())), 60_000).unref();

http.createServer((request, response) => {
  if (request.url !== "/health") {
    response.writeHead(404).end("Not found");
    return;
  }
  response.writeHead(health.status === "ready" ? 200 : 503, { "content-type": "application/json" });
  response.end(JSON.stringify(healthSnapshot()));
}).listen(port);

function scopedEvents(records, extrinsicIndex) {
  return records.filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.toNumber() === extrinsicIndex);
}

async function reject(client, context, reason, bytes) {
  const reasonCode = reason.message?.split(":", 1)[0] || "UNKNOWN_REJECTION";
  await client.query(
    `INSERT INTO rejected_operations
      (chain_genesis, block_number, block_hash, extrinsic_index, extrinsic_hash, payload_hash, reason_code, detail, indexer_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (chain_genesis, block_number, extrinsic_index) DO NOTHING`,
    [expectedGenesis, context.blockNumber, context.blockHash, context.extrinsicIndex,
      context.extrinsic.hash.toHex(), bytes ? blake2AsHex(bytes, 256) : null, reasonCode,
      String(reason.message ?? reason).slice(0, 500), INDEXER_VERSION],
  );
}

async function insertArtifact(client, context, mint) {
  const artifactId = `nr1:${expectedGenesis}:${context.blockNumber}:${context.extrinsicIndex}`;
  const existing = await client.query("SELECT 1 FROM artifacts WHERE artifact_id = $1", [artifactId]);
  if (existing.rowCount) return;
  const globalResult = await client.query(
    "SELECT COALESCE(MAX(global_number), 0) + 1 AS next FROM artifacts WHERE chain_genesis = $1",
    [expectedGenesis],
  );
  const subnetResult = await client.query(
    `SELECT COALESCE(MAX(subnet_number), 0) + 1 AS next FROM artifacts
     WHERE chain_genesis = $1 AND netuid = $2 AND subnet_generation = $3`,
    [expectedGenesis, mint.netuid, mint.payload.subnet_generation],
  );
  await client.query(
    `INSERT INTO artifacts (
      artifact_id, chain_genesis, block_number, block_hash, extrinsic_index,
      extrinsic_hash, extrinsic_hex,
      global_number, subnet_number, netuid, subnet_generation,
      creator_account_hex, owner_account_hex, hotkey_account_hex,
      name, media_type, body, content_uri, content_hash,
      payload_json, payload_hex, payload_hash,
      tao_spent_rao, alpha_burned_rao, limit_price_rao, evidence_json
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13,$14,$15,$16,$17,$18,
      $19::jsonb,$20,$21,$22,$23,$24,$25::jsonb
    )`,
    [artifactId, expectedGenesis, context.blockNumber, context.blockHash, context.extrinsicIndex,
      context.extrinsic.hash.toHex(), context.extrinsic.toHex(),
      globalResult.rows[0].next, subnetResult.rows[0].next, mint.netuid,
      mint.payload.subnet_generation, mint.creatorHex, mint.hotkeyHex,
      mint.payload.name.trim(), mint.payload.media_type,
      mint.payload.body?.trim() ?? null, mint.payload.content_uri ?? null,
      mint.payload.content_hash ?? null, JSON.stringify(mint.payload), mint.payloadHex,
      mint.payloadHash, mint.taoSpentRao.toString(), mint.alphaBurnedRao.toString(),
      mint.limitPriceRao.toString(), JSON.stringify({
        events: context.events.map(({ event }) => ({
          section: event.section,
          method: event.method,
          data: event.data.toJSON(),
        })),
      })],
  );
  console.log(JSON.stringify({ event: "artifact_indexed", artifactId }));
}

async function insertTransfer(client, context, transfer) {
  const current = await client.query(
    `SELECT owner_account_hex, ownership_nonce
     FROM artifacts WHERE artifact_id = $1 FOR UPDATE`,
    [transfer.artifactId],
  );
  if (!current.rowCount) throw new Error("ARTIFACT_NOT_FOUND");
  if (current.rows[0].owner_account_hex !== transfer.signerHex) throw new Error("SIGNER_IS_NOT_CURRENT_OWNER");
  const nextNonce = BigInt(current.rows[0].ownership_nonce) + 1n;
  if (BigInt(transfer.nonce) !== nextNonce) throw new Error("OWNERSHIP_NONCE_MISMATCH");
  const transferId = `nrt1:${expectedGenesis}:${context.blockNumber}:${context.extrinsicIndex}`;
  await client.query(
    `INSERT INTO transfers (
      transfer_id, artifact_id, chain_genesis, block_number, block_hash,
      extrinsic_index, extrinsic_hash, extrinsic_hex,
      from_account_hex, to_account_hex, ownership_nonce,
      payload_json, payload_hex, payload_hash, evidence_json
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15::jsonb)`,
    [transferId, transfer.artifactId, expectedGenesis, context.blockNumber, context.blockHash,
      context.extrinsicIndex, context.extrinsic.hash.toHex(), context.extrinsic.toHex(),
      transfer.signerHex, transfer.destinationHex, transfer.nonce,
      JSON.stringify(transfer.payload), transfer.payloadHex, transfer.payloadHash,
      JSON.stringify({
        events: context.events.map(({ event }) => ({
          section: event.section,
          method: event.method,
          data: event.data.toJSON(),
        })),
      })],
  );
  await client.query(
    `UPDATE artifacts SET owner_account_hex = $1, ownership_nonce = $2
     WHERE artifact_id = $3`,
    [transfer.destinationHex, transfer.nonce, transfer.artifactId],
  );
  console.log(JSON.stringify({ event: "artifact_transferred", transferId, artifactId: transfer.artifactId }));
}

async function processBlock(api, blockNumber) {
  const blockHash = (await api.rpc.chain.getBlockHash(blockNumber)).toHex();
  const [signedBlock, allEvents, runtimeVersion] = await Promise.all([
    api.rpc.chain.getBlock(blockHash),
    api.query.system.events.at(blockHash),
    api.rpc.state.getRuntimeVersion(blockHash),
  ]);
  const specVersion = runtimeVersion.specVersion.toNumber();
  if (specVersion !== supportedSpec) throw new Error(`UNSUPPORTED_RUNTIME_SPEC:${specVersion}`);
  const parentHash = signedBlock.block.header.parentHash.toHex();
  const candidates = [];

  for (let extrinsicIndex = 0; extrinsicIndex < signedBlock.block.extrinsics.length; extrinsicIndex += 1) {
    const extrinsic = signedBlock.block.extrinsics[extrinsicIndex];
    const bytes = findProtocolRemark(extrinsic.method);
    if (!bytes) continue;
    candidates.push({ extrinsicIndex, extrinsic, bytes, events: scopedEvents(allEvents, extrinsicIndex) });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const prior = await client.query(
      "SELECT block_hash FROM indexed_blocks WHERE chain_genesis = $1 AND block_number = $2",
      [expectedGenesis, blockNumber],
    );
    if (prior.rowCount && prior.rows[0].block_hash !== blockHash) throw new Error("FINALIZED_BLOCK_HASH_MISMATCH");
    await client.query(
      `INSERT INTO indexed_blocks (chain_genesis, block_number, block_hash, parent_hash, runtime_spec)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (chain_genesis, block_number) DO NOTHING`,
      [expectedGenesis, blockNumber, blockHash, parentHash, specVersion],
    );

    for (const candidate of candidates) {
      const context = {
        blockNumber,
        blockHash,
        extrinsicIndex: candidate.extrinsicIndex,
        extrinsic: candidate.extrinsic,
        events: candidate.events,
      };
      try {
        const operation = parseProtocolPayload(candidate.bytes);
        if (operation.payload.op === "mint") {
          const preview = parseMintPayload(candidate.bytes);
          const [generationAtParent, generationAtBlock] = await Promise.all([
            api.query.subtensorModule.networkRegisteredAt.at(parentHash, preview.payload.netuid),
            api.query.subtensorModule.networkRegisteredAt.at(blockHash, preview.payload.netuid),
          ]);
          if (generationAtParent.toString() !== generationAtBlock.toString()) {
            throw new Error("SUBNET_GENERATION_CHANGED_IN_BLOCK");
          }
          const mint = validateMint({
            api,
            extrinsic: candidate.extrinsic,
            eventRecords: candidate.events,
            subnetGeneration: generationAtBlock.toString(),
          });
          await insertArtifact(client, context, mint);
        } else if (operation.payload.op === "transfer") {
          const transfer = validateTransfer({
            api,
            extrinsic: candidate.extrinsic,
            eventRecords: candidate.events,
          });
          await insertTransfer(client, context, transfer);
        } else {
          throw new Error("UNSUPPORTED_OPERATION");
        }
      } catch (error) {
        await reject(client, context, error, candidate.bytes);
      }
    }

    await client.query(
      `INSERT INTO chain_checkpoints (chain_genesis, block_number, block_hash)
       VALUES ($1,$2,$3)
       ON CONFLICT (chain_genesis) DO UPDATE
       SET block_number = EXCLUDED.block_number, block_hash = EXCLUDED.block_hash, updated_at = NOW()`,
      [expectedGenesis, blockNumber, blockHash],
    );
    await client.query("COMMIT");
    health.checkpoint = blockNumber;
    health.lastCommittedAt = new Date().toISOString();
    health.lagBlocks = health.finalizedHead === null ? null : Math.max(health.finalizedHead - blockNumber, 0);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const lockClient = await pool.connect();
  const lock = await lockClient.query("SELECT pg_try_advisory_lock(684927314) AS acquired");
  if (!lock.rows[0].acquired) throw new Error("Another Neural Relics indexer owns the database lock.");

  const api = await ApiPromise.create({ provider: new WsProvider(rpcUrl), noInitWarn: true });
  const genesis = api.genesisHash.toHex();
  if (genesis !== expectedGenesis) throw new Error(`GENESIS_HASH_MISMATCH:${genesis}`);
  const checkpoint = await pool.query(
    "SELECT block_number FROM chain_checkpoints WHERE chain_genesis = $1",
    [expectedGenesis],
  );
  let processed = checkpoint.rowCount ? Number(checkpoint.rows[0].block_number) : startBlock - 1;
  health.checkpoint = processed;

  let queue = Promise.resolve();
  const catchUp = async (target) => {
    health.finalizedHead = target;
    health.lagBlocks = Math.max(target - processed, 0);
    while (processed < target) {
      await processBlock(api, processed + 1);
      processed += 1;
    }
    health.status = "ready";
    health.error = null;
  };
  const finalizedHash = await api.rpc.chain.getFinalizedHead();
  const finalizedHeader = await api.rpc.chain.getHeader(finalizedHash);
  await catchUp(finalizedHeader.number.toNumber());
  await api.rpc.chain.subscribeFinalizedHeads((header) => {
    const target = header.number.toNumber();
    health.finalizedHead = target;
    health.lagBlocks = Math.max(target - processed, 0);
    queue = queue.then(() => catchUp(target)).catch((error) => {
      health.status = "paused";
      health.error = String(error.message ?? error).slice(0, 500);
      console.error(error);
    });
  });
}

main().catch(async (error) => {
  health.status = "error";
  health.error = String(error.message ?? error).slice(0, 500);
  console.error(JSON.stringify(healthSnapshot()));
  console.error(error);
  process.exit(1);
});
