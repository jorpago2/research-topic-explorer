import type { JifDataset } from "../../types/domain";
import { jifDatasetIndexSchema, jifDatasetSchema } from "./schemas";

const dataBase = `${import.meta.env.BASE_URL}data/journal-metrics/`;

export async function fetchLatestJifDataset(signal?: AbortSignal): Promise<JifDataset | null> {
  const indexResponse = await fetch(`${dataBase}index.json`, { signal });
  if (!indexResponse.ok) return null;
  const index = jifDatasetIndexSchema.parse(await indexResponse.json());
  const latest = [...index.datasets].sort((a, b) => b.edition.localeCompare(a.edition))[0];
  if (!latest) return null;
  const datasetResponse = await fetch(`${dataBase}${latest.file}`, { signal });
  if (!datasetResponse.ok) return null;
  return jifDatasetSchema.parse(await datasetResponse.json());
}
