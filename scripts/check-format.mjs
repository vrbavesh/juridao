// scripts/check-format.mjs — pure-function asserts for src/lib/format.js and src/lib/evidence.js (D2-0)
import { ethFromMicro, ethToMicro, juri, mmss } from "../src/lib/format.js";
import { evidenceBadge, readFileAsText } from "../src/lib/evidence.js";

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

// evidence.js (D2-0)
eq(evidenceBadge("fp_abcdef1234"), "fp_abcdef", "badge short form");
eq(evidenceBadge("deadbeef0000"), "fp_deadbe", "badge without fp_ prefix");
eq(evidenceBadge(""), "", "badge for no file");
eq(await readFileAsText(null), "", "readFileAsText(null)");
eq(await readFileAsText(undefined), "", "readFileAsText(undefined)");
eq(
  await readFileAsText({ name: "shot.png", type: "image/png", size: 10 }),
  "<binary file: shot.png | image/png | 10 bytes>",
  "readFileAsText binary stand-in"
);
eq(
  await readFileAsText({ name: "notes.txt", type: "text/plain", size: 5 }).then(
    () => "resolved",
    (e) => e.message
  ),
  "FileReader is not available in this environment",
  "readFileAsText text file without FileReader (Node)"
);

if (fails.length) {
  console.log("FAIL");
  for (const f of fails) console.log(" -", f);
  process.exit(1);
}
console.log("PASS");
