// src/lib/evidence.js — shared evidence helpers (D2-0, owner: Dev2).
// readFileAsText(file) -> Promise<string> "smart text"; evidenceBadge(fingerprint) -> display badge.
// Contract note: no engine wrapper is exported here; pages hash with
// JuriDAO.fileFingerprint (B1) directly.

// Names that are text even when the browser reports no MIME type.
const TEXT_LIKE =
  /\.(txt|md|markdown|csv|tsv|json|ya?ml|js|jsx|ts|tsx|css|scss|html?|xml|svg|log|sol|py|rb|go|rs|sh|bat|env|ini|conf|toml)$/i;

/**
 * Read a File as text ("smart text").
 * - No file            -> "" (matches engine fileFingerprint("") === "")
 * - Text content       -> the file's own text
 * - Binary content     -> a deterministic stand-in "<binary ...>" string, so the
 *   fingerprint is stable and reproducible for the same file (the engine hashes
 *   whatever string it is given; images/pdf/zips are not FileReader-decodable
 *   as meaningful text).
 * Rejects only when the browser itself fails to read a text file.
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    const name = String(file.name || "file");
    const type = String(file.type || "");
    const textual =
      TEXT_LIKE.test(name) ||
      type.startsWith("text/") ||
      type === "application/json" ||
      type === "application/xml" ||
      type.endsWith("+json") ||
      type === "";
    if (!textual) {
      resolve(`<binary file: ${name} | ${type || "unknown type"} | ${Number(file.size) || 0} bytes>`);
      return;
    }
    if (typeof FileReader === "undefined") {
      reject(new Error("FileReader is not available in this environment"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error || new Error(`Could not read ${name}`));
    reader.readAsText(file);
  });
}

/**
 * Display badge for an evidence/delivery fingerprint (`fp_` + 10 hex chars).
 * Short form keeps cards readable; the full fingerprint stays in the data and
 * can be shown as a title/tooltip. Empty fingerprint (no file) -> "".
 */
export function evidenceBadge(fingerprint) {
  if (!fingerprint) return "";
  const fp = String(fingerprint);
  const hex = fp.startsWith("fp_") ? fp.slice(3) : fp;
  return "fp_" + hex.slice(0, 6);
}
