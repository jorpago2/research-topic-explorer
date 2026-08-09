import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(fullPath));
    else result.push(fullPath);
  }
  return result;
}

async function assertAbsent(directory, patterns) {
  for (const file of await files(directory)) {
    const content = await readFile(file);
    const text = content.toString("utf8");
    for (const pattern of patterns.filter(Boolean)) {
      if (text.includes(pattern)) throw new Error(`Forbidden value “${pattern}” found in ${file}.`);
    }
  }
}

await assertAbsent(path.resolve("dist"), ["OPENALEX_API_KEY", process.env.OPENALEX_API_KEY]);
await assertAbsent(path.resolve("src"), ["api.openalex.org"]);
await assertAbsent(path.resolve("src"), ["data/journal-metrics/", "localStorage", "sessionStorage", "indexedDB"]);

const metricIndex = JSON.parse(await readFile(path.resolve("public/data/journal-metrics/index.json"), "utf8"));
if (!Array.isArray(metricIndex.datasets) || metricIndex.datasets.length !== 0) {
  throw new Error("The public JIF manifest must remain empty; use local browser import.");
}

console.info("Frontend bundle and runtime source passed secret, direct-OpenAlex, browser-storage, and private-JIF checks.");
