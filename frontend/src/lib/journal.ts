/** Mirrors JOURNAL_BODY_MAX in backend/app/models/journal_entry.py — the
 * textarea caps input here so the API never has to reject a long note. */
export const JOURNAL_BODY_MAX = 4000;

/** First line of a note, clipped, for card and list previews. */
export function journalPreview(body: string, max = 120): string {
  const firstLine = body.split("\n").find((l) => l.trim().length > 0) ?? "";
  const line = firstLine.trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
