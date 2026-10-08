// src/lib/flow.mjs runner: node scripts/flow.mjs
// Prints "NOT BUILT YET" (exit 0) until src/lib/flowtests.js exists; then runs the
// 21 flow tests against src/lib/juridao-engine.js and exits 1 on any failure.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flowPath = path.join(root, "src/lib/flowtests.js");
const enginePath = path.join(root, "src/lib/juridao-engine.js");

if (!fs.existsSync(flowPath) || !fs.existsSync(enginePath)) {
  console.log("NOT BUILT YET");
  process.exit(0);
}

const J = (await import(pathToFileURL(enginePath).href)).default;
const { runFlowTests } = await import(pathToFileURL(flowPath).href);
const results = runFlowTests(J);
for (const r of results) console.log(r.ok ? "PASS" : "FAIL", r.name, "-", r.detail);
const passed = results.filter((r) => r.ok).length;
console.log(`${passed} of ${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
