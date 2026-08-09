const ISSN_PATTERN = /^\d{4}-[\dX]{4}$/;

function checkDigit(firstSevenDigits: string): string {
  const sum = [...firstSevenDigits].reduce((total, digit, index) => total + Number(digit) * (8 - index), 0);
  const remainder = (11 - (sum % 11)) % 11;
  return remainder === 10 ? "X" : String(remainder);
}

export function normalizeIssn(value: string): string | null {
  const compact = value.trim().toUpperCase().replace(/[^\dX]/g, "");
  if (!/^\d{7}[\dX]$/.test(compact)) return null;
  const normalized = `${compact.slice(0, 4)}-${compact.slice(4)}`;
  if (!ISSN_PATTERN.test(normalized) || checkDigit(compact.slice(0, 7)) !== compact[7]) return null;
  return normalized;
}
