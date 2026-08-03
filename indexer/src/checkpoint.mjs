import { blake2AsHex } from "@polkadot/util-crypto";
import { stringToU8a, u8aConcat, hexToU8a } from "@polkadot/util";

export const CHECKPOINT_VERSION = 1;
export const CHECKPOINT_GENESIS_ROOT = blake2AsHex(
  stringToU8a("bittensor-relics/checkpoint/v1"),
  256,
);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

export function blockTranscript({ blockNumber, blockHash, artifacts, transfers, rejections }) {
  return canonical({
    checkpointVersion: CHECKPOINT_VERSION,
    blockNumber: String(blockNumber),
    blockHash,
    artifacts: artifacts.map((row) => ({
      extrinsicIndex: Number(row.extrinsic_index),
      artifactId: row.artifact_id,
      payloadHash: row.payload_hash,
      owner: row.owner_account_hex,
      ownershipNonce: String(row.ownership_nonce),
    })),
    transfers: transfers.map((row) => ({
      extrinsicIndex: Number(row.extrinsic_index),
      transferId: row.transfer_id,
      artifactId: row.artifact_id,
      payloadHash: row.payload_hash,
      from: row.from_account_hex,
      to: row.to_account_hex,
      ownershipNonce: String(row.ownership_nonce),
    })),
    rejections: rejections.map((row) => ({
      extrinsicIndex: Number(row.extrinsic_index),
      payloadHash: row.payload_hash,
      reasonCode: row.reason_code,
    })),
  });
}

export function nextCheckpointRoot(previousRoot, transcript) {
  const transcriptHash = blake2AsHex(
    stringToU8a(JSON.stringify(canonical(transcript))),
    256,
  );
  return {
    transcriptHash,
    stateRoot: blake2AsHex(
      u8aConcat(hexToU8a(previousRoot), hexToU8a(transcriptHash)),
      256,
    ),
  };
}

export async function transcriptForBlock(client, chainGenesis, blockNumber, blockHash) {
  const [artifacts, transfers, rejections] = await Promise.all([
    client.query(
      `SELECT extrinsic_index, artifact_id, payload_hash, owner_account_hex, ownership_nonce
       FROM artifacts WHERE chain_genesis = $1 AND block_number = $2
       ORDER BY extrinsic_index ASC`,
      [chainGenesis, blockNumber],
    ),
    client.query(
      `SELECT extrinsic_index, transfer_id, artifact_id, payload_hash,
        from_account_hex, to_account_hex, ownership_nonce
       FROM transfers WHERE chain_genesis = $1 AND block_number = $2
       ORDER BY extrinsic_index ASC`,
      [chainGenesis, blockNumber],
    ),
    client.query(
      `SELECT extrinsic_index, payload_hash, reason_code
       FROM rejected_operations WHERE chain_genesis = $1 AND block_number = $2
       ORDER BY extrinsic_index ASC`,
      [chainGenesis, blockNumber],
    ),
  ]);
  return blockTranscript({
    blockNumber,
    blockHash,
    artifacts: artifacts.rows,
    transfers: transfers.rows,
    rejections: rejections.rows,
  });
}
