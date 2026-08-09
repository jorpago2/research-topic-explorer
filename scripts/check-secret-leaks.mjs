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
console.info("Frontend bundle and runtime source passed secret/direct-OpenAlex checks.");
