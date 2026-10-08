// scripts/check-format.mjs — pure-function asserts for src/lib/format.js
import { ethFromMicro, ethToMicro, juri, mmss } from "../src/lib/format.js";

const fails = [];
const eq = (got, want, what) => {
  if (got !== want) fails.push(`${what}: expected ${want}, got ${got}`);
};

eq(ethFromMicro(1000000), "1.0000 ETH", "1 ETH");
eq(ethFromMicro(6000), "0.0060 ETH", "fee");
eq(ethToMicro(0.1), 100000, "0.1 ETH");
eq(juri(1000), "1,000", "thousands");
eq(juri(1234567), "1,234,567", "millions");
eq(mmss(90), "01:30", "90s");
eq(mmss(0), "00:00", "zero");

if (fails.length) {
  console.log("FAIL");
  for (const f of fails) console.log(" -", f);
  process.exit(1);
}
console.log("PASS");
