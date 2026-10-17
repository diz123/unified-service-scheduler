/** Normalizes a license plate for comparison: uppercase; spaces, `-` and `.` removed. */
export function normalizeLicensePlate(plate: string): string {
  return plate.replace(/[ .-]/g, '').toUpperCase();
}
