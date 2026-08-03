const baseUrl = (process.env.RELICS_BASE_URL ?? "https://bittensorrelics.com").replace(/\/$/, "");
const expectedGenesis = process.env.RELICS_EXPECTED_GENESIS ?? "0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105";
const maxCheckpointAgeSeconds = Number(process.env.RELICS_MAX_CHECKPOINT_AGE_SECONDS ?? "900");
const errors = [];

async function request(path, json = false) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { accept: json ? "application/json" : "text/html" }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) errors.push(`${path} returned HTTP ${response.status}.`);
  return { response, body: json && response.ok ? await response.json() : null };
}

const pagePaths = ["/", "/explore", "/marketplace", "/wallet", "/relic/1"];
const productionResponses = await Promise.all([
  request("/"),
  request("/api/v1/status", true),
  request("/api/v1/listings?limit=100", true),
  ...pagePaths.slice(1).map((path) => request(path)),
]);
const [home, statusResult, listingsResult] = productionResponses;

const status = statusResult.body;
const listingBody = listingsResult.body;
if (status?.chainGenesis !== expectedGenesis) errors.push("Status API returned the wrong chain genesis.");
const checkpointTime = Date.parse(status?.checkpoint?.updatedAt ?? "");
const checkpointAgeSeconds = Number.isFinite(checkpointTime) ? Math.max(0, (Date.now() - checkpointTime) / 1000) : Number.POSITIVE_INFINITY;
if (checkpointAgeSeconds > maxCheckpointAgeSeconds) errors.push(`Indexer checkpoint is ${Math.round(checkpointAgeSeconds)} seconds old.`);
if (listingBody?.settlementEnabled !== false) errors.push("Paid settlement unexpectedly reports enabled.");

const requiredHeaders = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
};
for (const [name, expected] of Object.entries(requiredHeaders)) {
  if (home.response.headers.get(name) !== expected) errors.push(`Missing or incorrect ${name} header.`);
}

const listingChecks = [];
for (const listing of listingBody?.listings ?? []) {
  const detail = await request(`/api/v1/artifacts/${encodeURIComponent(listing.artifactId)}?fresh=1`, true);
  const artifact = detail.body?.artifact;
  const ownerMatches = artifact?.ownerAccountHex === listing.sellerAccountHex;
  const nonceMatches = String(artifact?.ownershipNonce) === String(listing.ownershipNonce);
  if (!ownerMatches || !nonceMatches) errors.push(`Active listing ${listing.listingId} is stale.`);
  listingChecks.push({ listingId: listing.listingId, artifactId: listing.artifactId, ownerMatches, nonceMatches });
}

const report = {
  schemaVersion: 1,
  kind: "bittensor-relics-production-health",
  verified: errors.length === 0,
  generatedAt: new Date().toISOString(),
  baseUrl,
  checkedPages: pagePaths,
  chainGenesis: status?.chainGenesis ?? null,
  checkpoint: status?.checkpoint ?? null,
  checkpointAgeSeconds: Number.isFinite(checkpointAgeSeconds) ? Math.round(checkpointAgeSeconds) : null,
  artifactCount: status?.artifactCount ?? null,
  activeListingCount: listingBody?.listings?.length ?? null,
  settlementEnabled: listingBody?.settlementEnabled ?? null,
  listingChecks,
  errors,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (errors.length) process.exitCode = 1;
