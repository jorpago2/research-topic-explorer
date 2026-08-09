const ISSN_PATTERN = /^\d{4}-[\dX]{4}$/;

export function calculateIssnCheckDigit(firstSevenDigits: string): string {
  if (!/^\d{7}$/.test(firstSevenDigits)) {
    throw new Error("An ISSN checksum requires exactly seven digits.");
  }
  const sum = [...firstSevenDigits].reduce(
    (total, digit, index) => total + Number(digit) * (8 - index),
    0,
  );
  const remainder = (11 - (sum % 11)) % 11;
  return remainder === 10 ? "X" : String(remainder);
}

export function normalizeIssn(value: string, validateChecksum = true): string | null {
  const compact = value.trim().toUpperCase().replace(/[^\dX]/g, "");
  if (!/^\d{7}[\dX]$/.test(compact)) return null;
  const normalized = `${compact.slice(0, 4)}-${compact.slice(4)}`;
  if (!ISSN_PATTERN.test(normalized)) return null;
  if (validateChecksum && calculateIssnCheckDigit(compact.slice(0, 7)) !== compact[7]) {
    return null;
  }
  return normalized;
}

export function deduplicateIssns(values: string[]): { valid: string[]; invalid: string[] } {
  const valid = new Set<string>();
  const invalid = new Set<string>();
  for (const value of values) {
    const normalized = normalizeIssn(value);
    if (normalized) valid.add(normalized);
    else invalid.add(value);
  }
  return { valid: [...valid].sort(), invalid: [...invalid].sort() };
}
