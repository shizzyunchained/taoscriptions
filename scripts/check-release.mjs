import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { checkReleaseRecord } from "./release-evidence-lib.mjs";

const recordPath = process.argv[2];
if (!recordPath) throw new Error("Usage: npm run release:check -- <release-record.json>");

const record = JSON.parse(await readFile(resolve(recordPath), "utf8"));
const report = {
  checkedAt: new Date().toISOString(),
  submitted: false,
  recordPath: resolve(recordPath),
  ...checkReleaseRecord(record),
};

console.log(JSON.stringify(report, null, 2));
if (!report.ready) process.exitCode = 1;
