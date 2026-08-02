import assert from "node:assert/strict";
import { ApiPromise, HttpProvider, WsProvider } from "@polkadot/api";
import { blake2AsHex, encodeAddress } from "@polkadot/util-crypto";
import { calculateLimitPrice, createInlineMintPayload, DEFAULT_SLIPPAGE_BPS } from "../src/lib/protocol.ts";

const endpoint = process.env.SUBTENSOR_RPC ?? "https://test.chain.opentensor.ai";
const expectedGenesis = process.env.CHAIN_GENESIS_HASH ?? "0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105";
const expectedSpec = Number.parseInt(process.env.SUPPORTED_SPEC_VERSION ?? "440", 10);
const taoAmountRao = 5_000_000n;
const signer = encodeAddress(new Uint8Array(32).fill(7), 42);

const provider = endpoint.startsWith("http://") || endpoint.startsWith("https://")
  ? new HttpProvider(endpoint)
  : new WsProvider(endpoint);
const api = await ApiPromise.create({ provider, noInitWarn: true });
try {
  assert.equal(api.genesisHash.toHex(), expectedGenesis, "GENESIS_HASH_MISMATCH");
  assert.equal(api.runtimeVersion.specVersion.toNumber(), expectedSpec, "UNSUPPORTED_RUNTIME_SPEC");
  const finalizedHash = await api.rpc.chain.getFinalizedHead();
  const [apiAt, finalizedHeader] = await Promise.all([
    api.at(finalizedHash),
    api.rpc.chain.getHeader(finalizedHash),
  ]);
  const entries = await apiAt.query.subtensorModule.networksAdded.entries();
  const activeNetuids = entries
    .filter(([, enabled]) => enabled.toString() === "true")
    .map(([key]) => Number.parseInt(key.args[0].toString(), 10))
    .filter((netuid) => Number.isSafeInteger(netuid) && netuid > 0)
    .sort((left, right) => left - right);
  assert.ok(activeNetuids.length, "NO_ACTIVE_NON_ROOT_SUBNET");

  let selected = null;
  for (const netuid of activeNetuids) {
    try {
      const quote = await apiAt.call.swapRuntimeApi.simSwapTaoForAlpha(netuid, taoAmountRao.toString());
      const decoded = quote;
      const alphaAmount = BigInt(decoded.alphaAmount.toString());
      if (alphaAmount > 0n) { selected = { netuid, quote: decoded, alphaAmount }; break; }
    } catch { /* Try the next currently registered subnet. */ }
  }
  assert.ok(selected, "NO_ACTIVE_SUBNET_WITH_NONZERO_QUOTE");

  const generation = (await apiAt.query.subtensorModule.networkRegisteredAt(selected.netuid)).toString();
  assert.equal((await apiAt.query.subtensorModule.subtokenEnabled(selected.netuid)).toString(), "true", "SUBTOKEN_DISABLED");
  const minimumStakeRao = BigInt(apiAt.consts.subtensorModule.initialMinStake.toString());
  const routeHotkey = (await apiAt.query.subtensorModule.subnetOwnerHotkey(selected.netuid)).toString();
  assert.notEqual(api.registry.createType("AccountId32", routeHotkey).toHex(), `0x${"0".repeat(64)}`, "MISSING_SUBNET_OWNER_HOTKEY");
  const routeHotkeyOwner = (await apiAt.query.subtensorModule.owner(routeHotkey)).toString();
  assert.notEqual(api.registry.createType("AccountId32", routeHotkeyOwner).toHex(), `0x${"0".repeat(64)}`, "UNREGISTERED_ROUTE_HOTKEY");
  const currentSpotPrice = BigInt((await apiAt.call.swapRuntimeApi.currentAlphaPrice(selected.netuid)).toString());
  assert.ok(BigInt(selected.quote.taoAmount.toString()) >= minimumStakeRao, "POOL_INPUT_BELOW_MINIMUM_STAKE");
  const limitPrice = calculateLimitPrice(currentSpotPrice, DEFAULT_SLIPPAGE_BPS);
  const payload = createInlineMintPayload({
    netuid: selected.netuid,
    subnetGeneration: generation,
    name: "Bittensor Relics construction proof",
    body: "Unsigned live-runtime verification. This payload is never submitted.",
  });
  const batch = api.tx.utility.batchAll([
    api.tx.subtensorModule.addStakeBurn(routeHotkey, selected.netuid, taoAmountRao.toString(), limitPrice.toString()),
    api.tx.system.remarkWithEvent(payload.hex),
  ]);

  assert.equal(batch.method.section, "utility");
  assert.equal(batch.method.method, "batchAll");
  const calls = batch.method.args[0];
  assert.equal(calls.length, 2);
  assert.equal(calls[0].section, "subtensorModule");
  assert.equal(calls[0].method, "addStakeBurn");
  assert.equal(calls[0].args[0].toString(), routeHotkey);
  assert.equal(calls[0].args[1].toString(), selected.netuid.toString());
  assert.equal(calls[0].args[2].toString(), taoAmountRao.toString());
  assert.equal(calls[0].args[3].toString(), limitPrice.toString());
  assert.equal(calls[1].section, "system");
  assert.equal(calls[1].method, "remarkWithEvent");
  assert.equal(calls[1].args[0].toHex(), payload.hex);

  const encodedCall = batch.method.toHex();
  const roundTrip = api.registry.createType("Call", encodedCall);
  assert.equal(roundTrip.toHex(), encodedCall, "CALL_ROUND_TRIP_MISMATCH");
  const payment = await batch.paymentInfo(signer);

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    submitted: false,
    endpoint,
    quoteBlockNumber: finalizedHeader.number.toString(),
    quoteBlockHash: finalizedHash.toHex(),
    genesisHash: api.genesisHash.toHex(),
    specName: api.runtimeVersion.specName.toString(),
    specVersion: api.runtimeVersion.specVersion.toNumber(),
    signer,
    routeHotkey,
    routeHotkeyOwner,
    netuid: selected.netuid,
    subnetGeneration: generation,
    taoAmountRao: taoAmountRao.toString(),
    minimumStakeRao: minimumStakeRao.toString(),
    expectedAlphaRao: selected.alphaAmount.toString(),
    alphaSlippageRao: selected.quote.alphaSlippage.toString(),
    taoFeeRao: selected.quote.taoFee.toString(),
    currentSpotPriceRao: currentSpotPrice.toString(),
    limitPriceRao: limitPrice.toString(),
    estimatedExtrinsicFeeRao: payment.partialFee.toString(),
    payloadBytes: payload.byteLength,
    payloadHash: blake2AsHex(payload.hex, 256),
    encodedCallBytes: (encodedCall.length - 2) / 2,
    encodedCallHash: blake2AsHex(encodedCall, 256),
    callPath: ["utility.batchAll", "subtensorModule.addStakeBurn", "system.remarkWithEvent"],
  }, null, 2));
} finally {
  await api.disconnect();
}
