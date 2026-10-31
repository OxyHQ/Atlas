/**
 * A size in bytes as a person reads it, in decimal units as the App Store gives them: "12.4 MB",
 * "860 KB", in the reader's digits.
 */
export function formatSize(bytes: number, locale: string): string {
  const units = ['bytes', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
  return `${number} ${units[unit]}`;
}
