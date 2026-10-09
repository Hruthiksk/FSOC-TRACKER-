/**
 * Formats a numeric value or returns N/A if null or undefined.
 */
export function formatValueOrNA(
  val: number | null | undefined,
  decimals: number = 2,
  unit: string = ""
): string {
  if (val === null || val === undefined || Number.isNaN(val)) {
    return "N/A";
  }
  const formatted = val.toFixed(decimals);
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Formats duration in seconds to standard mm:ss.s format.
 */
export function formatTimeS(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1);
  return `${m.toString().padStart(2, "0")}:${s.padStart(4, "0")}`;
}

/**
 * Formats percentage or returns N/A.
 */
export function formatPercentOrNA(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(val)) {
    return "N/A";
  }
  return `${val.toFixed(1)}%`;
}
