/** Picker start times; the API still checks working hours (DESIGN.md I-13). */
const SLOT_MINUTES = 30;

const toMinutes = (hhmm: string): number => {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
};

const toHhmm = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** `HH:mm` start times every 30 minutes from `openTime` up to, not including, `closeTime` (same local day, A-4). */
export function timeSlots(openTime: string, closeTime: string): string[] {
  const slots: string[] = [];
  for (let m = toMinutes(openTime); m < toMinutes(closeTime); m += SLOT_MINUTES) {
    slots.push(toHhmm(m));
  }
  return slots;
}
