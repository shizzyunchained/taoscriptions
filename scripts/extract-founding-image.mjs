import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { ApiPromise, HttpProvider } from "@polkadot/api";
import { findProtocolRemark, parseMintPayload } from "../indexer/src/protocol.mjs";

const endpoint = process.env.SUBTENSOR_HTTP_RPC ?? "https://test.chain.opentensor.ai";
const expectedGenesis = "0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105";
const expectedExtrinsicHash = "0xc465ceb52de83326e277066ad1212132f7f53e5e2d2fd69176896c229cafdf97";
const expectedContentHash = "e0c79e82fff74be7e1586ff85aace31e256391492bb9c81c109f52c841782282";
const output = new URL("../public/founding-relic.webp", import.meta.url);

const api = await ApiPromise.create({ provider: new HttpProvider(endpoint), noInitWarn: true });
try {
  assert.equal(api.genesisHash.toHex(), expectedGenesis, "GENESIS_HASH_MISMATCH");
  const blockHash = await api.rpc.chain.getBlockHash(7_698_721);
  const signedBlock = await api.rpc.chain.getBlock(blockHash);
  const extrinsic = signedBlock.block.extrinsics[6];
  assert.ok(extrinsic, "FOUNDING_EXTRINSIC_MISSING");
  assert.equal(extrinsic.hash.toHex().toLowerCase(), expectedExtrinsicHash, "FOUNDING_EXTRINSIC_HASH_MISMATCH");
  const remarkBytes = findProtocolRemark(extrinsic.method);
  assert.ok(remarkBytes, "FOUNDING_REMARK_MISSING");
  const decoded = parseMintPayload(remarkBytes);
  assert.ok(decoded.mediaBytes, "FOUNDING_MEDIA_MISSING");
  const actualHash = createHash("sha256").update(decoded.mediaBytes).digest("hex");
  assert.equal(actualHash, expectedContentHash, "FOUNDING_MEDIA_HASH_MISMATCH");
  assert.equal(decoded.mediaBytes.length, 8_698, "FOUNDING_MEDIA_LENGTH_MISMATCH");
  await writeFile(output, decoded.mediaBytes);
  console.log(JSON.stringify({ block: 7_698_721, extrinsicIndex: 6, bytes: decoded.mediaBytes.length, sha256: actualHash, output: output.pathname }, null, 2));
} finally {
  await api.disconnect();
}
