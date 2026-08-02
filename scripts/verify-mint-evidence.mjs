import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { parseMintEvidenceJson } from "../src/lib/mint-evidence.ts";
import { calculateLimitPrice, DEFAULT_SLIPPAGE_BPS } from "../src/lib/protocol.ts";
import { accountHex, validateMint } from "../indexer/src/protocol.mjs";

const evidencePath = process.argv[2];
if (!evidencePath) throw new Error("Usage: npm run verify:mint-evidence -- <downloaded-proof.json>");
const evidence = parseMintEvidenceJson(await readFile(resolve(evidencePath), "utf8"));
const endpoint = process.env.SUBTENSOR_RPC ?? "wss://test.chain.opentensor.ai";
const expectedGenesis = process.env.CHAIN_GENESIS_HASH ?? "0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105";
const supportedSpec = Number.parseInt(process.env.SUPPORTED_SPEC_VERSION ?? "440", 10);
const blockNumber = Number(evidence.blockNumber);
if (!Number.isSafeInteger(blockNumber) || blockNumber < 2) throw new Error("INVALID_EVIDENCE_BLOCK_NUMBER");

const api = await ApiPromise.create({ provider: new WsProvider(endpoint), noInitWarn: true });
try {
  assert.equal(api.genesisHash.toHex(), expectedGenesis, "GENESIS_HASH_MISMATCH");
  assert.equal(evidence.genesisHash, expectedGenesis, "EVIDENCE_GENESIS_MISMATCH");
  assert.equal(accountHex(evidence.signerAddress), evidence.signerAccountHex, "EVIDENCE_SIGNER_ADDRESS_MISMATCH");
  assert.equal(accountHex(evidence.routeHotkey), evidence.routeHotkeyHex, "EVIDENCE_ROUTE_ADDRESS_MISMATCH");
  const finalizedHash = await api.rpc.chain.getFinalizedHead();
  const finalizedHeader = await api.rpc.chain.getHeader(finalizedHash);
  assert.ok(finalizedHeader.number.toNumber() >= blockNumber, "EVIDENCE_BLOCK_NOT_FINALIZED");
  const canonicalHash = (await api.rpc.chain.getBlockHash(blockNumber)).toHex().toLowerCase();
  assert.equal(canonicalHash, evidence.blockHash, "EVIDENCE_BLOCK_HASH_MISMATCH");

  const [signedBlock, eventRecords, runtime, blockTimestamp] = await Promise.all([
    api.rpc.chain.getBlock(canonicalHash),
    api.query.system.events.at(canonicalHash),
    api.rpc.state.getRuntimeVersion(canonicalHash),
    api.query.timestamp.now.at(canonicalHash),
  ]);
  const actualSpec = runtime.specVersion.toNumber();
  assert.equal(actualSpec, supportedSpec, "UNSUPPORTED_RUNTIME_SPEC");
  assert.equal(evidence.runtimeSpec, String(actualSpec), "EVIDENCE_RUNTIME_SPEC_MISMATCH");
  const extrinsic = signedBlock.block.extrinsics[evidence.extrinsicIndex];
  assert.ok(extrinsic, "EVIDENCE_EXTRINSIC_INDEX_MISSING");
  assert.equal(extrinsic.hash.toHex().toLowerCase(), evidence.extrinsicHash, "EVIDENCE_EXTRINSIC_HASH_MISMATCH");
  const scopedEvents = eventRecords.filter(({ phase }) => (
    phase.isApplyExtrinsic && phase.asApplyExtrinsic.toNumber() === evidence.extrinsicIndex
  ));
  const parentHash = signedBlock.block.header.parentHash.toHex();
  const [generationAtParent, generationAtBlock] = await Promise.all([
    api.query.subtensorModule.networkRegisteredAt.at(parentHash, evidence.netuid),
    api.query.subtensorModule.networkRegisteredAt.at(canonicalHash, evidence.netuid),
  ]);
  assert.equal(generationAtParent.toString(), generationAtBlock.toString(), "SUBNET_GENERATION_CHANGED_IN_BLOCK");
  const mint = validateMint({
    api,
    extrinsic,
    eventRecords: scopedEvents,
    subnetGeneration: generationAtBlock.toString(),
  });
  assert.equal(mint.text, evidence.payload, "EVIDENCE_PAYLOAD_MISMATCH");
  assert.equal(mint.payloadHash, evidence.payloadHash, "EVIDENCE_PAYLOAD_HASH_MISMATCH");
  assert.equal(mint.creatorHex, evidence.signerAccountHex, "EVIDENCE_SIGNER_MISMATCH");
  assert.equal(mint.hotkeyHex, evidence.routeHotkeyHex, "EVIDENCE_ROUTE_HOTKEY_MISMATCH");
  assert.equal(mint.netuid, evidence.netuid, "EVIDENCE_NETUID_MISMATCH");
  assert.equal(String(mint.payload.subnet_generation), evidence.subnetGeneration, "EVIDENCE_SUBNET_GENERATION_MISMATCH");
  assert.equal(mint.taoSpentRao.toString(), evidence.taoSpentRao, "EVIDENCE_TAO_AMOUNT_MISMATCH");
  assert.equal(mint.alphaBurnedRao.toString(), evidence.alphaBurnedRao, "EVIDENCE_ALPHA_AMOUNT_MISMATCH");
  assert.equal(mint.limitPriceRao.toString(), evidence.limitPriceRao, "EVIDENCE_LIMIT_PRICE_MISMATCH");
  assert.equal(mint.transactionFeeRao.toString(), evidence.transactionFeeRao, "EVIDENCE_TRANSACTION_FEE_MISMATCH");
  assert.equal(mint.transactionTipRao.toString(), evidence.transactionTipRao, "EVIDENCE_TRANSACTION_TIP_MISMATCH");
  assert.equal(new Date(Number(blockTimestamp.toString())).toISOString(), evidence.finalizedAt, "EVIDENCE_BLOCK_TIME_MISMATCH");
  assert.ok(BigInt(evidence.quoteBlock) <= BigInt(evidence.blockNumber), "EVIDENCE_QUOTE_AFTER_FINALITY");
  const quoteBlockNumber = Number(evidence.quoteBlock);
  assert.ok(Number.isSafeInteger(quoteBlockNumber) && quoteBlockNumber >= 1, "INVALID_EVIDENCE_QUOTE_BLOCK");
  const quoteBlockHash = await api.rpc.chain.getBlockHash(quoteBlockNumber);
  const quoteApi = await api.at(quoteBlockHash);
  const [quoteGeneration, quoteHotkey, quoteSpotPrice] = await Promise.all([
    quoteApi.query.subtensorModule.networkRegisteredAt(evidence.netuid),
    quoteApi.query.subtensorModule.subnetOwnerHotkey(evidence.netuid),
    quoteApi.call.swapRuntimeApi.currentAlphaPrice(evidence.netuid),
  ]);
  assert.equal(quoteGeneration.toString(), evidence.subnetGeneration, "EVIDENCE_QUOTE_GENERATION_MISMATCH");
  assert.equal(accountHex(quoteHotkey.toString()), evidence.routeHotkeyHex, "EVIDENCE_QUOTE_ROUTE_MISMATCH");
  assert.equal(
    calculateLimitPrice(BigInt(quoteSpotPrice.toString()), DEFAULT_SLIPPAGE_BPS).toString(),
    evidence.limitPriceRao,
    "EVIDENCE_QUOTE_LIMIT_MISMATCH",
  );

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    verified: true,
    submitted: false,
    artifactId: evidence.artifactId,
    blockNumber: evidence.blockNumber,
    blockHash: evidence.blockHash,
    extrinsicIndex: evidence.extrinsicIndex,
    extrinsicHash: evidence.extrinsicHash,
    activationBlock: blockNumber - 1,
    recommendedStartBlock: blockNumber - 1,
    recommendedStopBlock: finalizedHeader.number.toNumber(),
    finalizedHeadHash: finalizedHash.toHex(),
  }, null, 2));
} finally {
  await api.disconnect();
}
