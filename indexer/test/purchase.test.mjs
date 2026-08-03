import assert from "node:assert/strict";
import test from "node:test";
import { stringToU8a, u8aToHex } from "@polkadot/util";
import {
  blake2AsHex,
  cryptoWaitReady,
  sr25519PairFromSeed,
  sr25519Sign,
} from "@polkadot/util-crypto";
import {
  messageId,
  normalizeAccount,
} from "../../src/lib/listing-protocol.mjs";
import { createPurchasePayload } from "../../src/lib/protocol.ts";
import { validatePurchase } from "../src/protocol.mjs";

await cryptoWaitReady();

const sellerPair = sr25519PairFromSeed(new Uint8Array(32).fill(11));
const buyerPair = sr25519PairFromSeed(new Uint8Array(32).fill(12));
const seller = normalizeAccount(u8aToHex(sellerPair.publicKey));
const buyer = normalizeAccount(u8aToHex(buyerPair.publicKey));
const chain = `0x${"1".repeat(64)}`;
const artifact = `br1:${chain}:100:2`;
const listingNonce = "a".repeat(64);
const priceRao = "2500000000";
const expiryBlock = "500";
const message = `BITTENSOR_RELICS_SALE_V2\nchain=${chain}\nartifact=${artifact}\nseller=${seller}\nownership_nonce=3\nprice_rao=${priceRao}\nexpiry_block=${expiryBlock}\nnonce=${listingNonce}\nbuyer=*\nsettlement=atomic_tao_transfer_and_relic_ownership\n`;
const signature = u8aToHex(sr25519Sign(stringToU8a(message), sellerPair));
const purchase = createPurchasePayload({
  artifactId: artifact,
  listingId: messageId(message),
  sellerAccountHex: seller,
  buyerAccountHex: buyer,
  listingBuyerAccountHex: null,
  listingOwnershipNonce: "3",
  priceRao,
  expiryBlock,
  listingNonce,
  listingSignature: signature,
});

const codec = (value, encoded = null) => ({
  toString: () => String(value),
  ...(encoded ? { toHex: () => encoded } : {}),
});
const event = (section, method, data = []) => ({ event: { section, method, data } });
const guards = new Proxy({}, {
  get: (_target, section) => new Proxy({}, {
    get: (_section, method) => ({ is: (candidate) => candidate.section === section && candidate.method === method }),
  }),
});
const paymentCall = {
  section: "balances",
  method: "transferKeepAlive",
  args: [codec(seller), codec(priceRao)],
};
const remarkCall = {
  section: "system",
  method: "remarkWithEvent",
  args: [{ toU8a: () => stringToU8a(purchase.json) }],
};
const extrinsic = {
  isSigned: true,
  signer: codec(buyer),
  method: { section: "utility", method: "batchAll", args: [[paymentCall, remarkCall]] },
};
const records = [
  event("transactionPayment", "TransactionFeePaid", [codec(buyer), codec(900_000), codec(0)]),
  event("balances", "Transfer", [codec(buyer), codec(seller), codec(priceRao)]),
  event("system", "Remarked", [codec(buyer), codec(blake2AsHex(stringToU8a(purchase.json), 256), blake2AsHex(stringToU8a(purchase.json), 256))]),
  event("utility", "BatchCompleted"),
  event("system", "ExtrinsicSuccess"),
];

test("the disabled prototype validates an atomic payment and purchase receipt", async () => {
  const result = await validatePurchase({
    api: { events: guards },
    extrinsic,
    eventRecords: records,
    chainGenesis: chain,
    blockNumber: 400,
  });
  assert.equal(result.signerHex, seller);
  assert.equal(result.destinationHex, buyer);
  assert.equal(result.priceRao, 2_500_000_000n);
  assert.equal(result.nonce, 4);
});

test("purchase validation rejects wrong payment, expiry, or seller authorization", async () => {
  const underpaid = [...records];
  underpaid[1] = event("balances", "Transfer", [codec(buyer), codec(seller), codec("1")]);
  await assert.rejects(validatePurchase({ api: { events: guards }, extrinsic, eventRecords: underpaid, chainGenesis: chain, blockNumber: 400 }), /PAYMENT_EVENT_MISMATCH/);
  await assert.rejects(validatePurchase({ api: { events: guards }, extrinsic, eventRecords: records, chainGenesis: chain, blockNumber: 501 }), /LISTING_EXPIRED/);
  const badRemark = { ...remarkCall, args: [{ toU8a: () => stringToU8a(purchase.json.replace(signature, `0x${"c".repeat(128)}`)) }] };
  const badExtrinsic = { ...extrinsic, method: { ...extrinsic.method, args: [[paymentCall, badRemark]] } };
  await assert.rejects(validatePurchase({ api: { events: guards }, extrinsic: badExtrinsic, eventRecords: records, chainGenesis: chain, blockNumber: 400 }), /INVALID_LISTING_SIGNATURE/);
});
