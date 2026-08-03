import { buildPrototypeReport } from "../../src/lib/subnet-consensus.mjs";

process.stdout.write(`${JSON.stringify(buildPrototypeReport(), null, 2)}\n`);
