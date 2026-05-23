// Default `occurred_at` for an entry being logged against `viewedDay`.
// Today → exact "now"; a past day → noon local so the entry lands on the
// right calendar day regardless of timezone.
export function occurredAtFor(viewedDay: string, isToday: boolean): string {
  if (isToday) return new Date().toISOString();
  return new Date(`${viewedDay}T12:00:00`).toISOString();
}
