import { describe, expect, it } from "vitest";
import { parseLocalJifFile } from "../src/features/journal-metrics/local";

function dataset(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    provider: "Clarivate",
    metric: "Journal Impact Factor",
    edition: "2026",
    sourceNote: "Owner-supplied local fixture",
    journals: [{
      journalName: "Optics Express",
      eissn: "1094-4087",
      index: "SCIE",
      citations: 100,
      jif: 4.8,
      previousJif: 4.6,
      quartile: "Q1",
      edition: "2026",
      provider: "Clarivate",
    }],
    ...overrides,
  };
}

describe("local JIF import", () => {
  it("validates a private JSON dataset", async () => {
    const file = new File([JSON.stringify(dataset())], "jif-2026-local.json", { type: "application/json" });
    await expect(parseLocalJifFile(file)).resolves.toMatchObject({ edition: "2026", journals: [{ eissn: "1094-4087", jif: 4.8 }] });
  });

  it("rejects malformed JSON and inconsistent journal editions", async () => {
    await expect(parseLocalJifFile(new File(["{"], "broken.json"))).rejects.toThrow("not valid JSON");
    const inconsistent = dataset({ journals: [{ ...dataset().journals[0], edition: "2025" }] });
    await expect(parseLocalJifFile(new File([JSON.stringify(inconsistent)], "inconsistent.json"))).rejects.toThrow("required schema");
  });

  it("rejects duplicate eISSNs", async () => {
    const row = dataset().journals[0];
    const duplicated = dataset({ journals: [row, { ...row, journalName: "Duplicate" }] });
    await expect(parseLocalJifFile(new File([JSON.stringify(duplicated)], "duplicate.json"))).rejects.toThrow("required schema");
  });
});
