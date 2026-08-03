import { writeFile } from "node:fs/promises";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key?.startsWith("--") || !value) throw new Error(`Missing value for ${key ?? "argument"}.`);
  args.set(key.slice(2), value);
}

const baseUrl = (args.get("base-url") ?? process.env.RELICS_BASE_URL ?? "https://bittensorrelics.com").replace(/\/$/, "");
const artifactId = args.get("artifact") ?? process.env.RELICS_TRANSFER_ARTIFACT_ID;
const listingId = args.get("listing") ?? process.env.RELICS_PRETRANSFER_LISTING_ID;
const outputPath = args.get("out") ?? null;

if (!artifactId || !listingId) {
  console.error("Usage: npm run verify:marketplace-beta -- --artifact <artifact-id> --listing <pre-transfer-listing-id> [--out report.json]");
  process.exit(2);
}

async function json(path) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  const body = await response.json();
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

const encodedArtifact = encodeURIComponent(artifactId);
const [artifactState, transferState, listingState, activeState, status] = await Promise.all([
  json(`/api/v1/artifacts/${encodedArtifact}?fresh=1`),
  json(`/api/v1/artifacts/${encodedArtifact}/transfers`),
  json(`/api/v1/listings/${encodeURIComponent(listingId)}`),
  json("/api/v1/listings?limit=100"),
  json("/api/v1/status"),
]);

const artifact = artifactState.artifact;
const transfers = transferState.transfers ?? [];
const listing = listingState.listing;
const latestTransfer = transfers.at(-1) ?? null;
const activeListingIds = new Set((activeState.listings ?? []).map((item) => item.listingId));
const checks = {
  settlementRemainsDisabled: activeState.settlementEnabled === false && listingState.settlementEnabled === false,
  transferFinalized: transfers.length > 0,
  transferOwnerMatchesArtifact: Boolean(latestTransfer && latestTransfer.toAccountHex === artifact.ownerAccountHex),
  transferNonceMatchesArtifact: Boolean(latestTransfer && String(latestTransfer.ownershipNonce) === String(artifact.ownershipNonce)),
  preTransferListingBelongsToArtifact: listing.artifactId === artifactId,
  preTransferListingIsInactive: listing.active === false,
  invalidatedByOwnershipChange: ["owner_changed", "ownership_nonce_changed"].includes(listing.inactiveReason),
  staleListingAbsentFromMarketplace: !activeListingIds.has(listingId),
};
const verified = Object.values(checks).every(Boolean);
const report = {
  schemaVersion: 1,
  kind: "bittensor-relics-marketplace-beta",
  verified,
  generatedAt: new Date().toISOString(),
  baseUrl,
  chainGenesis: status.chainGenesis,
  checkpoint: status.checkpoint,
  artifactId,
  listingId,
  currentOwnerAccountHex: artifact.ownerAccountHex,
  ownershipNonce: artifact.ownershipNonce,
  transferCount: transfers.length,
  latestTransfer,
  listingStatus: { active: listing.active, inactiveReason: listing.inactiveReason },
  checks,
};

const rendered = `${JSON.stringify(report, null, 2)}\n`;
if (outputPath) await writeFile(outputPath, rendered, "utf8");
process.stdout.write(rendered);
if (!verified) process.exitCode = 1;
