import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const assetsDir = resolve("dist/assets");
const files = readdirSync(assetsDir);

const KB = 1024;
const formatKb = (bytes) => `${(bytes / KB).toFixed(2)} kB`;

const findChunk = (prefix) =>
  files.find((file) => file.startsWith(`${prefix}-`) && file.endsWith(".js"));

const requiredChunks = [
  { prefix: "index", label: "core-index", maxBytes: 360 * KB },
  { prefix: "vendor-matrix", label: "vendor-matrix", maxBytes: 1100 * KB },
  { prefix: "feature-admin", label: "feature-admin", maxBytes: 50 * KB },
  { prefix: "feature-calls", label: "feature-calls", maxBytes: 25 * KB }
];

const failures = [];
const resolved = new Map();

for (const chunk of requiredChunks) {
  const file = findChunk(chunk.prefix);
  if (!file) {
    failures.push(`Missing chunk: ${chunk.label} (${chunk.prefix}-*.js)`);
    continue;
  }

  const size = statSync(resolve(assetsDir, file)).size;
  resolved.set(chunk.label, { file, size, maxBytes: chunk.maxBytes });
  if (size > chunk.maxBytes) {
    failures.push(
      `${chunk.label} exceeds budget: ${formatKb(size)} > ${formatKb(chunk.maxBytes)} (${file})`
    );
  }
}

const index = resolved.get("core-index");
const matrix = resolved.get("vendor-matrix");
if (index && matrix) {
  const combined = index.size + matrix.size;
  const combinedBudget = 1450 * KB;
  if (combined > combinedBudget) {
    failures.push(
      `core+matrix combined exceeds budget: ${formatKb(combined)} > ${formatKb(combinedBudget)}`
    );
  }
}

if (failures.length > 0) {
  console.error("Bundle budget check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Bundle budget check passed:");
for (const [label, chunk] of resolved.entries()) {
  console.log(`- ${label}: ${formatKb(chunk.size)} <= ${formatKb(chunk.maxBytes)} (${chunk.file})`);
}
