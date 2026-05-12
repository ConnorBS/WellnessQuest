import { z } from "zod";

export const MeSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  display_name: z.string(),
  role: z.string(),
  xp_total: z.number().int(),
  level: z.number().int(),
  timezone: z.string(),
  show_weight_card: z.boolean(),
  weight_unit: z.string(),
});
export type Me = z.infer<typeof MeSchema>;

export const TokenPairSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  access_expires_at: z.string(),
  token_type: z.string(),
});
export type TokenPair = z.infer<typeof TokenPairSchema>;

export const SignupOutSchema = z.object({
  user: MeSchema,
  tokens: TokenPairSchema,
});

export const WaterEntrySchema = z.object({
  id: z.number().int(),
  ml: z.number().int(),
  source: z.string(),
  occurred_at: z.string(),
  client_id: z.string().nullable().optional(),
});
export type WaterEntry = z.infer<typeof WaterEntrySchema>;

export const WaterTodaySchema = z.object({
  date: z.string(),
  total_ml: z.number().int(),
  goal_ml: z.number().int(),
  percent: z.number().int(),
  entries: z.array(WaterEntrySchema),
});
export type WaterToday = z.infer<typeof WaterTodaySchema>;

export const WaterAddOutSchema = z.object({
  entry: WaterEntrySchema,
  total_ml: z.number().int(),
  goal_ml: z.number().int(),
  xp_delta: z.number().int(),
  goal_met: z.boolean(),
});
export type WaterAddOut = z.infer<typeof WaterAddOutSchema>;

export const IconKindSchema = z.enum(["builtin", "upload", "none"]);
export type IconKind = z.infer<typeof IconKindSchema>;

export const WaterPresetSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  volume_ml: z.number().int().positive(),
  icon_kind: IconKindSchema,
  icon_key: z.string().nullable(),
  sort_order: z.number().int(),
});
export type WaterPreset = z.infer<typeof WaterPresetSchema>;

export const WaterPresetListSchema = z.array(WaterPresetSchema);

export const WaterGoalOutSchema = z.object({ target_ml: z.number().int().positive() });
export type WaterGoalOut = z.infer<typeof WaterGoalOutSchema>;

export const UploadOutSchema = z.object({
  id: z.string().uuid(),
  filename: z.string(),
  content_type: z.string(),
  size_bytes: z.number().int().nonnegative(),
  url: z.string(),
});
export type UploadOut = z.infer<typeof UploadOutSchema>;

export const ActivityEntrySchema = z.object({
  id: z.number().int(),
  minutes: z.number().int(),
  source: z.string(),
  occurred_at: z.string(),
  client_id: z.string().nullable().optional(),
  exercise_type: z.string().nullable().optional(),
});
export type ActivityEntry = z.infer<typeof ActivityEntrySchema>;

export const ActivityTodaySchema = z.object({
  date: z.string(),
  total_minutes: z.number().int(),
  goal_minutes: z.number().int(),
  percent: z.number().int(),
  entries: z.array(ActivityEntrySchema),
});
export type ActivityToday = z.infer<typeof ActivityTodaySchema>;

export const ActivityAddOutSchema = z.object({
  entry: ActivityEntrySchema,
  total_minutes: z.number().int(),
  goal_minutes: z.number().int(),
  xp_delta: z.number().int(),
  goal_met: z.boolean(),
});
export type ActivityAddOut = z.infer<typeof ActivityAddOutSchema>;

export const ActivityPresetSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  minutes: z.number().int().positive(),
  exercise_type: z.string().nullable().optional(),
  icon_kind: IconKindSchema,
  icon_key: z.string().nullable(),
  sort_order: z.number().int(),
});
export type ActivityPreset = z.infer<typeof ActivityPresetSchema>;

export const ActivityPresetListSchema = z.array(ActivityPresetSchema);

export const ActivityGoalOutSchema = z.object({ target_minutes: z.number().int().positive() });
export type ActivityGoalOut = z.infer<typeof ActivityGoalOutSchema>;

export const CadenceKindSchema = z.enum(["daily", "weekly", "monthly", "interval"]);
export type CadenceKind = z.infer<typeof CadenceKindSchema>;

export const HabitStatusKindSchema = z.enum(["done", "ok", "due_today", "overdue"]);
export type HabitStatusKind = z.infer<typeof HabitStatusKindSchema>;

export const HabitSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  icon_kind: IconKindSchema,
  icon_key: z.string().nullable(),
  cadence_kind: CadenceKindSchema,
  weekly_target: z.number().int().nullable(),
  monthly_target: z.number().int().nullable(),
  interval_days: z.number().int().nullable(),
  sort_order: z.number().int(),
});
export type Habit = z.infer<typeof HabitSchema>;

export const HabitStatusSchema = z.object({
  status: HabitStatusKindSchema,
  done_today: z.boolean(),
  last_checked_on: z.string().nullable(),
  period_count: z.number().int().nullable().optional(),
  period_target: z.number().int().nullable().optional(),
  period_ends_on: z.string().nullable().optional(),
  days_since_last: z.number().int().nullable().optional(),
  days_until_due: z.number().int().nullable().optional(),
  streak: z.number().int(),
});
export type HabitStatus = z.infer<typeof HabitStatusSchema>;

export const HabitWithStatusSchema = z.object({
  habit: HabitSchema,
  status: HabitStatusSchema,
});
export type HabitWithStatus = z.infer<typeof HabitWithStatusSchema>;

export const HabitListSchema = z.array(HabitWithStatusSchema);

export const WeightEntrySchema = z.object({
  id: z.number().int(),
  weight_kg: z.coerce.number(),
  occurred_at: z.string(),
  note: z.string().nullable().optional(),
});
export type WeightEntry = z.infer<typeof WeightEntrySchema>;

export const WeightEntryListSchema = z.array(WeightEntrySchema);

export const WeightTargetSchema = z.object({
  id: z.number().int(),
  target_kg: z.coerce.number().nullable(),
  effective_at: z.string(),
});
export type WeightTarget = z.infer<typeof WeightTargetSchema>;

export const WeightTargetListSchema = z.array(WeightTargetSchema);

export const WeightSummarySchema = z.object({
  unit: z.string(),
  latest: WeightEntrySchema.nullable(),
  prior_week: WeightEntrySchema.nullable(),
  delta_kg: z.coerce.number().nullable(),
  current_target: WeightTargetSchema.nullable().optional(),
});
export type WeightSummary = z.infer<typeof WeightSummarySchema>;

export const MealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
export type MealType = z.infer<typeof MealTypeSchema>;

export const FoodEntrySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  brand: z.string().nullable().optional(),
  kcal: z.number().int(),
  protein_g: z.coerce.number().nullable().optional(),
  carbs_g: z.coerce.number().nullable().optional(),
  fat_g: z.coerce.number().nullable().optional(),
  meal_type: MealTypeSchema.nullable().optional(),
  source: z.string(),
  provider: z.string().nullable().optional(),
  provider_id: z.string().nullable().optional(),
  occurred_at: z.string(),
  client_id: z.string().nullable().optional(),
});
export type FoodEntry = z.infer<typeof FoodEntrySchema>;

export const FoodMacroTotalsSchema = z.object({
  protein_g: z.coerce.number(),
  carbs_g: z.coerce.number(),
  fat_g: z.coerce.number(),
});
export type FoodMacroTotals = z.infer<typeof FoodMacroTotalsSchema>;

export const FoodTodaySchema = z.object({
  date: z.string(),
  total_kcal: z.number().int(),
  target_kcal: z.number().int(),
  percent: z.number().int(),
  over_target: z.boolean(),
  remaining_kcal: z.number().int(),
  macros: FoodMacroTotalsSchema,
  entries: z.array(FoodEntrySchema),
});
export type FoodToday = z.infer<typeof FoodTodaySchema>;

export const FoodAddOutSchema = z.object({
  entry: FoodEntrySchema,
  total_kcal: z.number().int(),
  target_kcal: z.number().int(),
  xp_delta: z.number().int(),
  over_target: z.boolean(),
});
export type FoodAddOut = z.infer<typeof FoodAddOutSchema>;

export const FoodGoalOutSchema = z.object({ target_kcal: z.number().int().positive() });
export type FoodGoalOut = z.infer<typeof FoodGoalOutSchema>;

export const FoodPresetSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  brand: z.string().nullable(),
  kcal: z.number().int(),
  protein_g: z.coerce.number().nullable(),
  carbs_g: z.coerce.number().nullable(),
  fat_g: z.coerce.number().nullable(),
  meal_type: MealTypeSchema.nullable(),
  provider: z.string().nullable(),
  provider_id: z.string().nullable(),
  icon_kind: IconKindSchema,
  icon_key: z.string().nullable(),
  sort_order: z.number().int(),
});
export type FoodPreset = z.infer<typeof FoodPresetSchema>;

export const FoodPresetListSchema = z.array(FoodPresetSchema);

export const FoodUnitSchema = z.enum(["g", "ml"]);
export type FoodUnit = z.infer<typeof FoodUnitSchema>;

export const FoodSearchHitSchema = z.object({
  provider: z.string(),
  provider_id: z.string(),
  name: z.string(),
  brand: z.string().nullable().optional(),
  serving_g: z.number().nullable().optional(),
  serving_label: z.string().nullable().optional(),
  unit: FoodUnitSchema.nullable().optional(),
  kcal_per_100g: z.number().nullable().optional(),
  protein_per_100g: z.number().nullable().optional(),
  carbs_per_100g: z.number().nullable().optional(),
  fat_per_100g: z.number().nullable().optional(),
  kcal_per_100ml: z.number().nullable().optional(),
  protein_per_100ml: z.number().nullable().optional(),
  carbs_per_100ml: z.number().nullable().optional(),
  fat_per_100ml: z.number().nullable().optional(),
});
export type FoodSearchHit = z.infer<typeof FoodSearchHitSchema>;

export const FoodSearchSchema = z.object({
  query: z.string(),
  hits: z.array(FoodSearchHitSchema),
});
export type FoodSearch = z.infer<typeof FoodSearchSchema>;

export const FoodRecentEntrySchema = z.object({
  name: z.string(),
  brand: z.string().nullable().optional(),
  kcal: z.number().int(),
  protein_g: z.coerce.number().nullable().optional(),
  carbs_g: z.coerce.number().nullable().optional(),
  fat_g: z.coerce.number().nullable().optional(),
  meal_type: MealTypeSchema.nullable().optional(),
  provider: z.string().nullable().optional(),
  provider_id: z.string().nullable().optional(),
  last_logged_at: z.string(),
});
export type FoodRecentEntry = z.infer<typeof FoodRecentEntrySchema>;
export const FoodRecentListSchema = z.array(FoodRecentEntrySchema);
