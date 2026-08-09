import type { CategoryDefinition } from "../../types/domain";
import { categoryDefinitionSchema, categoryIndexSchema, type CategoryIndex } from "./schemas";

function categoryDataUrl(file: string): string {
  const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}data/categories/${file}`;
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Category data could not be loaded (${response.status}).`);
  return response.json();
}

export async function fetchCategoryIndex(signal?: AbortSignal): Promise<CategoryIndex> {
  return categoryIndexSchema.parse(await fetchJson(categoryDataUrl("index.json"), signal));
}

export async function fetchCategory(file: string, signal?: AbortSignal): Promise<CategoryDefinition> {
  if (!/^[a-z0-9][a-z0-9._-]*\.json$/.test(file)) throw new Error("Invalid category filename.");
  return categoryDefinitionSchema.parse(await fetchJson(categoryDataUrl(file), signal));
}
