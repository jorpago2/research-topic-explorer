import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

interface JifRow {
  journalName: string;
  eissn: string;
  index: string;
  citations: number | null;
  jif: number | null;
  previousJif: number | null;
  quartile: "Q1" | "Q2" | "Q3" | "Q4" | null;
  edition: string;
  provider: "Clarivate";
}

function parseNumber(value: string): number | null {
  const normalized = value.trim().replaceAll(",", "");
  if (!normalized || normalized === "N/A") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePage(page: string, edition: string): JifRow[] {
  const lines = page.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.includes("Journal Name") && line.includes("eISSN") && line.includes("JIF Quartile"));
  if (headerIndex < 0) return [];

  return lines.slice(headerIndex + 1).flatMap((line): JifRow[] => {
    const issnMatch = line.match(/\b\d{4}-[\dX]{4}\b/i);
    if (!issnMatch || issnMatch.index === undefined) return [];
    const eissn = issnMatch[0].toUpperCase();
    const journalName = line.slice(0, issnMatch.index).trim();
    if (!journalName) return [];
    const columns = line.slice(issnMatch.index + issnMatch[0].length).trim().split(/\s{2,}/);
    if (columns.length < 4) return [];
    const [index, citations, currentJif, ...tail] = columns;
    const quartileValue = tail.at(-1) ?? "";
    const previousJif = tail.length > 1 ? tail[0] : "";
    const quartile = /^Q[1-4]$/.test(quartileValue) ? quartileValue as JifRow["quartile"] : null;
    return [{
      journalName,
      eissn,
      index,
      citations: parseNumber(citations),
      jif: parseNumber(currentJif),
      previousJif: parseNumber(previousJif),
      quartile,
      edition,
      provider: "Clarivate",
    }];
  });
}

function readArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const input = path.resolve(readArgument("--input") ?? "JCR Journal Impact Factor 2026.pdf");
  const publicOutput = process.argv.includes("--public");
  if (publicOutput && !process.argv.includes("--confirm-redistribution-rights")) {
    throw new Error("Public output requires --confirm-redistribution-rights. Verify your Clarivate redistribution rights first.");
  }
  const output = path.resolve(readArgument("--output") ?? (publicOutput
    ? "public/data/journal-metrics/jif-2026.json"
    : "data-private/jif-2026.json"));
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "research-topic-explorer-jif-"));
  const textPath = path.join(temporaryDirectory, "jif.txt");
  try {
    await execFileAsync("pdftotext", ["-layout", input, textPath], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    const text = await readFile(textPath, "utf8");
    const editionMatch = text.match(/Journal Impact Factor\s+(\d{4})/i);
    if (!editionMatch) throw new Error("The JIF edition could not be read from the PDF heading.");
    const edition = editionMatch[1];
    const rows = text.split("\f").flatMap((page) => parsePage(page, edition));
    const journals = [...new Map(rows.map((row) => [row.eissn, row])).values()];
    if (journals.length < 1_000) throw new Error(`Only ${journals.length} rows were parsed; refusing to write a likely incomplete dataset.`);
    const dataset = {
      schemaVersion: 1,
      provider: "Clarivate",
      metric: "Journal Impact Factor",
      edition,
      sourceNote: "Owner-supplied Journal Citation Reports PDF; matched to OpenAlex Sources by eISSN.",
      journals,
    };
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(dataset, null, publicOutput ? undefined : 2)}\n`, "utf8");
    if (publicOutput) {
      const indexPath = path.resolve("public/data/journal-metrics/index.json");
      const index = JSON.parse(await readFile(indexPath, "utf8")) as { schemaVersion: 1; datasets: Array<{ edition: string; file: string }> };
      index.datasets = [...index.datasets.filter((item) => item.edition !== edition), { edition, file: path.basename(output) }]
        .sort((a, b) => b.edition.localeCompare(a.edition));
      await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
    }
    console.info(`Extracted ${journals.length.toLocaleString("en-US")} unique eISSN records to ${output}.`);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
