import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { categoryDefinitionSchema, categoryIndexSchema } from "../src/features/categories/schemas";
import { normalizeIssn } from "../src/lib/issn";

const categoryDirectory = path.resolve("public/data/categories");

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function main(): Promise<void> {
  const index = categoryIndexSchema.parse(await readJson(path.join(categoryDirectory, "index.json")));
  const ids = new Set<string>();
  const files = new Set(await readdir(categoryDirectory));
  const warnings: string[] = [];

  for (const entry of index.categories) {
    if (ids.has(entry.id)) throw new Error(`Duplicate category id in index: ${entry.id}`);
    ids.add(entry.id);
    if (!files.has(entry.file)) throw new Error(`Category file does not exist: ${entry.file}`);
    const category = categoryDefinitionSchema.parse(await readJson(path.join(categoryDirectory, entry.file)));
    if (category.id !== entry.id) throw new Error(`Category id mismatch for ${entry.file}: ${category.id} !== ${entry.id}`);
    if (category.name !== entry.name) warnings.push(`${entry.id}: name differs between index and file.`);

    const seenIssns = new Map<string, string>();
    const seenJournalNames = new Set<string>();
    for (const journal of category.journals) {
      const normalizedJournalName = journal.name.trim().toLocaleLowerCase();
      if (seenJournalNames.has(normalizedJournalName)) warnings.push(`${entry.id}: duplicate journal name “${journal.name}”.`);
      seenJournalNames.add(normalizedJournalName);
      for (const rawIssn of journal.issns) {
        const issn = normalizeIssn(rawIssn);
        if (!issn) throw new Error(`${entry.id}: invalid ISSN “${rawIssn}” in “${journal.name}”.`);
        const previousJournal = seenIssns.get(issn);
        if (previousJournal) warnings.push(`${entry.id}: ISSN ${issn} is repeated by “${previousJournal}” and “${journal.name}”.`);
        else seenIssns.set(issn, journal.name);
      }
    }
  }

  for (const warning of warnings) console.warn(`Warning: ${warning}`);
  console.info(`Validated ${index.categories.length} production category definition(s).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
