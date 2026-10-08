// scripts/check-contract.mjs — B1/B3/C gate: manifest <-> engine <-> storage keys <-> state shape.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "api", "engine-api.yaml");
const enginePath = path.join(root, "src", "lib", "juridao-engine.js");

let failures = 0;
const fail = (m) => { console.log("FAIL -", m); failures++; };
const ok = (m) => console.log("ok   -", m);

// ---------- tiny YAML subset parser for engine-api.yaml ----------
function parseManifest(text) {
  const lines = text.split(/\r?\n/);
  const ops = [];
  const storageKeys = [];
  let section = null;
  let cur = null;
  let inParams = false;
  for (const raw of lines) {
    const line = raw.replace(/\s+#.*$/, "").replace(/\s+$/, "");
    if (!line.trim()) continue;
    if (/^[a-zA-Z-]+:/.test(line)) {
      section = line.split(":")[0].trim();
      inParams = false;
      cur = null;
      continue;
    }
    if (section === "x-storage-keys" && line.trim().startsWith("- ")) {
      storageKeys.push(line.trim().slice(2).split(/\s+#/)[0].trim());
      continue;
    }
    if (section === "operations") {
      const opStart = line.match(/^\s+- name:\s*(.+)$/);
      if (opStart) {
        cur = { name: opStart[1].trim(), params: [], throws: [] };
        ops.push(cur);
        inParams = false;
        continue;
      }
      if (!cur) continue;
      if (/params: \[\]/.test(line)) { cur.params = []; inParams = false; continue; }
      if (/params:\s*$/.test(line)) { inParams = true; continue; }
      const p = line.match(/^\s+- \{(.+)\}\s*$/);
      if (p && inParams) {
        const parts = {};
        for (const kv of p[1].split(",")) {
          const [k, v] = kv.split(":").map((x) => x && x.trim());
          parts[k] = v;
        }
        cur.params.push({ name: parts.name, type: parts.type, optional: parts.optional === "true" });
        continue;
      }
      const f = line.match(/^\s+\w[\w-]*:\s*(.*)$/);
      if (f) {
        inParams = false;
        const [key, val] = [line.trim().split(":")[0], f[1]];
        if (key === "throws") {
          cur.throws = val.replace(/[\[\]]/g, "").split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean);
        }
      }
    }
  }
  return { ops, storageKeys };
}

const manifest = parseManifest(fs.readFileSync(manifestPath, "utf8"));
const J = (await import(pathToFileURL(enginePath).href)).default;

// ---------- (a) operations exist, arity rule ----------
if (!manifest.ops.length) fail("no operations parsed from manifest");
for (const op of manifest.ops) {
  const fn = J[op.name];
  if (typeof fn !== "function") { fail(`operation missing on engine default export: ${op.name}`); continue; }
  const required = op.params.filter((p) => !p.optional).length;
  if (fn.length !== required) fail(`${op.name}: engine fn.length ${fn.length} != manifest required params ${required}`);
  if (op.params.length < fn.length) fail(`${op.name}: manifest has fewer params (${op.params.length}) than fn.length (${fn.length})`);
}
ok(`(a) ${manifest.ops.length} manifest operations checked against engine`);

// ---------- (b) storage-key gate ----------
const usedKeys = new Map(); // key -> file
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|jsx)$/.test(e.name)) {
      const text = fs.readFileSync(p, "utf8");
      const re = /localStorage\.(?:getItem|setItem|removeItem)\(\s*(['"`])([^'"`]+)\1/g;
      let m;
      while ((m = re.exec(text))) usedKeys.set(m[2], p);
    }
  }
}
walk(path.join(root, "src"));
for (const key of usedKeys.keys()) {
  const inRegistry = manifest.storageKeys.some((k) =>
    k.endsWith("}") ? key.startsWith(k.split("{")[0]) : key === k
  );
  if (!inRegistry) fail(`storage key used in code but not in x-storage-keys: "${key}"`);
}
ok(`(b) ${usedKeys.size} storage keys used in src all present in registry`);

// ---------- (c) initial state shape ----------
function checkShape(s, label) {
  const keys = ["params", "accounts", "courts", "stake", "pending", "treasury", "deals", "disputes", "log"];
  for (const k of keys) if (!(k in s)) fail(`${label}: missing top-level key ${k}`);
  if (!(s.params && Object.values(s.params).every((v) => typeof v === "number" && v >= 0))) fail(`${label}: params must be non-negative number seconds`);
  if (!(s.accounts && Object.keys(s.accounts).length > 0 && Object.values(s.accounts).every((a) => typeof a.name === "string" && typeof a.eth === "number" && typeof a.juri === "number"))) fail(`${label}: accounts shape`);
  if (!Array.isArray(s.deals)) fail(`${label}: deals must be an array`);
  if (!Array.isArray(s.disputes)) fail(`${label}: disputes must be an array`);
  if (!(Array.isArray(s.courts) && s.courts.length > 0 && s.courts.every((c) => typeof c.id === "number" && c.minStake >= 0 && c.feePerJuror >= 0))) fail(`${label}: courts shape`);
}
const s0 = J.createInitialState();
checkShape(s0, "initial state");
ok("(c) createInitialState() has required keys and critical field types");

// ---------- (d) one driven scenario keeps the shape ----------
try {
  const s = J.createInitialState();
  for (let i = 1; i <= 7; i++) { J.faucet(s, "juror" + i); J.stakeJuri(s, "juror" + i, 2, 1000); }
  const dealId = J.createDeal(s, "sam", { freelancer: "deepa", amount: 1000000, deadline: J.nowOf(s) + 86400, courtId: 2, numJurors: 3, title: "t", description: "d", criteria: ["c"] });
  J.markDelivered(s, "deepa", dealId, "n", "f.txt", "x");
  const did = J.raiseDispute(s, "deepa", dealId);
  J.submitEvidence(s, "sam", did, { title: "A", description: "a", fileName: "a.txt", fileText: "abc" });
  J.skipPeriod(s, did);
  const d = s.disputes.find((x) => x.id === did);
  if (d.period !== "Commit") fail(`scenario: expected period Commit, got ${d.period}`);
  checkShape(s, "after scenario");
  ok("(d) driven scenario reaches Commit and state still passes shape check");
} catch (e) {
  fail(`scenario threw: ${e.message}`);
}

if (failures) {
  console.log(`${failures} contract check(s) failed`);
  process.exit(1);
}
console.log("CONTRACT CHECKS PASSED");
