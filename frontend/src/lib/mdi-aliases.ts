// Maps the original hand-drawn icon keys (water-bottle, glass-tall, etc.) to
// their MDI equivalents. Lets existing presets keep working without a DB
// migration when we switched the icon set to Material Design Icons.

export const LEGACY_ICON_ALIASES: Record<string, string> = {
  // Water module
  "glass-small": "cup-water",
  "glass-tall": "cup",
  tumbler: "cup",
  "water-bottle": "bottle-soda",
  mug: "coffee",
  "mason-jar": "bottle-tonic",
  pint: "beer",
  "shot-glass": "glass-cocktail",
  droplet: "water",

  // Activity module
  walk: "walk",
  run: "run",
  bike: "bike",
  dumbbell: "dumbbell",
  yoga: "yoga",
  stretch: "human-handsup",
  cardio: "heart-pulse",
  swim: "swim",
};

export function resolveIconName(key: string | null | undefined): string {
  if (!key) return "circle-outline";
  return LEGACY_ICON_ALIASES[key] ?? key;
}
