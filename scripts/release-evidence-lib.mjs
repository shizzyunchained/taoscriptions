export const REQUIRED_RELEASE_EVIDENCE = Object.freeze({
  1: ["brand_protocol_review", "candidate_commit"],
  2: ["ci_run", "runtime_run", "transaction_report"],
  3: ["wallet_rejection", "wrong_genesis", "stale_quote", "insufficient_balance"],
  4: ["mint_receipt"],
  5: ["mint_verification"],
  6: ["primary_doctor", "replay_doctor"],
  7: ["replay_audit", "status_api"],
  8: ["transfer_receipt", "listing_invalidation"],
  9: ["security_review", "monitoring", "beta_observation"],
  10: ["approval", "production_deployment", "rollback_target"],
});

const SHA_PATTERN = /^[0-9a-f]{40}$/;

function isIsoTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function checkReleaseRecord(record) {
  const errors = [];
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return { ready: false, completedSteps: 0, totalSteps: 10, errors: ["Record must be a JSON object."] };
  }
  if (record.schemaVersion !== 1) errors.push("schemaVersion must be 1.");
  if (record.product !== "Neural Relics") errors.push("product must be Neural Relics.");
  if (record.network !== "Bittensor testnet") errors.push("network must be Bittensor testnet for v1.");

  const release = record.release ?? {};
  const commitSha = release.commitSha;
  if (!SHA_PATTERN.test(commitSha ?? "")) errors.push("release.commitSha must be a lowercase 40-character Git SHA.");
  if (!/^https:\/\/github\.com\//.test(release.pullRequestUrl ?? "")) errors.push("release.pullRequestUrl must be a GitHub URL.");
  if (!/^https:\/\//.test(release.previewUrl ?? "")) errors.push("release.previewUrl must be an HTTPS URL.");
  if (!isIsoTimestamp(release.createdAt)) errors.push("release.createdAt must be an ISO timestamp.");

  const steps = Array.isArray(record.steps) ? record.steps : [];
  if (steps.length !== 10) errors.push("steps must contain exactly ten entries.");
  let completedSteps = 0;

  for (let id = 1; id <= 10; id += 1) {
    const step = steps[id - 1];
    if (!step || step.id !== id) {
      errors.push(`Step ${id} is missing or out of order.`);
      continue;
    }
    if (!["pending", "complete"].includes(step.status)) {
      errors.push(`Step ${id} status must be pending or complete.`);
      continue;
    }
    const evidence = Array.isArray(step.evidence) ? step.evidence : [];
    const keys = new Set();
    for (const item of evidence) {
      if (!item || typeof item !== "object") {
        errors.push(`Step ${id} has an invalid evidence item.`);
        continue;
      }
      if (typeof item.key !== "string" || !item.key.trim()) errors.push(`Step ${id} evidence is missing a key.`);
      else if (keys.has(item.key)) errors.push(`Step ${id} repeats evidence key ${item.key}.`);
      else keys.add(item.key);
      if (typeof item.value !== "string" || !item.value.trim()) errors.push(`Step ${id} evidence ${item.key ?? "item"} is missing a value.`);
      if (item.commitSha !== commitSha) errors.push(`Step ${id} evidence ${item.key ?? "item"} does not match the release SHA.`);
    }
    if (step.status === "complete") {
      completedSteps += 1;
      for (const requiredKey of REQUIRED_RELEASE_EVIDENCE[id]) {
        if (!keys.has(requiredKey)) errors.push(`Step ${id} is complete but missing ${requiredKey}.`);
      }
    } else if (evidence.length) {
      errors.push(`Step ${id} is pending but already contains evidence; review it before marking complete.`);
    }
  }

  if (completedSteps !== 10) errors.push(`${10 - completedSteps} release step(s) remain pending.`);
  return { ready: errors.length === 0, completedSteps, totalSteps: 10, errors };
}
