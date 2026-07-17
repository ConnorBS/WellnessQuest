import { z } from "zod";

export const TitleSummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  rarity: z.string(),
  category: z.string(),
});
export type TitleSummary = z.infer<typeof TitleSummarySchema>;

export const TitleSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  rarity: z.string(),
  is_secret: z.boolean(),
  sort_order: z.number().int(),
  unlocked: z.boolean(),
  unlocked_at: z.string().nullable(),
  acknowledged_at: z.string().nullable(),
});
export type Title = z.infer<typeof TitleSchema>;
export const TitleListSchema = z.array(TitleSchema);

export const CategorySummarySchema = z.object({
  category: z.string(),
  total: z.number().int(),
  unlocked: z.number().int(),
});
export type CategorySummary = z.infer<typeof CategorySummarySchema>;
export const CategorySummaryListSchema = z.array(CategorySummarySchema);

export const MeSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  display_name: z.string(),
  role: z.string(),
  xp_total: z.number().int(),
  level: z.number().int(),
  timezone: z.string(),
  show_weight_card: z.boolean(),
  show_bp_card: z.boolean(),
  weight_unit: z.string(),
  must_change_password: z.boolean(),
  disabled: z.boolean(),
  equipped_title: TitleSummarySchema.nullable(),
  title_hidden: z.boolean(),
  weight_titles_opt_out: z.boolean(),
  bp_titles_opt_out: z.boolean(),
  show_raw_weight_delta: z.boolean(),
  // Effective enabled state per feature key. Consumers still read defensively
  // (`me?.features?.[key] ?? true`) so a missing key falls open to "enabled".
  features: z.record(z.boolean()),
  pending_title_unlocks: z.array(TitleSummarySchema),
  pending_title_unlocks_total: z.number().int().nonnegative(),
});
export type Me = z.infer<typeof MeSchema>;

export const MeListSchema = z.array(MeSchema);

export const FeatureItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  enabled: z.boolean(),
});
export type FeatureItem = z.infer<typeof FeatureItemSchema>;

export const FeaturesResponseSchema = z.object({
  features: z.array(FeatureItemSchema),
});

export const TokenPairSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  access_expires_at: z.string(),
  token_type: z.string(),
});
export type TokenPair = z.infer<typeof TokenPairSchema>;

export const AuthOutSchema = z.object({
  user: MeSchema,
  tokens: TokenPairSchema,
});
export type AuthOut = z.infer<typeof AuthOutSchema>;

export const SetupStatusSchema = z.object({ setup_required: z.boolean() });
export type SetupStatus = z.infer<typeof SetupStatusSchema>;

export const WaterEntrySchema = z.object({
  id: z.number().int(),
  ml: z.number().int(),
  source: z.string(),
  occurred_at: z.string(),
  client_id: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
});
export type WaterEntry = z.infer<typeof WaterEntrySchema>;

export const WaterRecentEntrySchema = z.object({
  name: z.string(),
  ml: z.number().int(),
  last_logged_at: z.string(),
});
export type WaterRecentEntry = z.infer<typeof WaterRecentEntrySchema>;
export const WaterRecentListSchema = z.array(WaterRecentEntrySchema);

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
  name: z.string().nullable().optional(),
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

export const ActivityRecentEntrySchema = z.object({
  name: z.string().nullable().optional(),
  exercise_type: z.string().nullable().optional(),
  minutes: z.number().int(),
  last_logged_at: z.string(),
});
export type ActivityRecentEntry = z.infer<typeof ActivityRecentEntrySchema>;
export const ActivityRecentListSchema = z.array(ActivityRecentEntrySchema);

export const StepsTodaySchema = z.object({
  date: z.string(),
  total: z.number().int(),
  goal: z.number().int(),
  percent: z.number().int(),
});
export type StepsToday = z.infer<typeof StepsTodaySchema>;

export const SleepEntrySchema = z.object({
  id: z.number().int(),
  started_at: z.string(),
  ended_at: z.string(),
  duration_minutes: z.number().int(),
  quality_score: z.number().int().nullable().optional(),
  source: z.string(),
  client_id: z.string().nullable().optional(),
});
export type SleepEntry = z.infer<typeof SleepEntrySchema>;

export const SleepLastSchema = z.object({
  entry: SleepEntrySchema.nullable(),
  goal_minutes: z.number().int(),
});
export type SleepLast = z.infer<typeof SleepLastSchema>;

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
  trend_kg: z.coerce.number().nullable().optional(),
  trend_delta_kg: z.coerce.number().nullable().optional(),
  trend_lookback_days: z.number().int().default(14),
  trend_ready: z.boolean().default(false),
  starting_kg: z.coerce.number().nullable().optional(),
});
export type WeightSummary = z.infer<typeof WeightSummarySchema>;

export const WeightTrendPointSchema = z.object({
  occurred_at: z.string(),
  weight_kg: z.coerce.number(),
  trend_kg: z.coerce.number(),
});
export type WeightTrendPoint = z.infer<typeof WeightTrendPointSchema>;

export const WeightTrendSeriesSchema = z.object({
  unit: z.string(),
  points: z.array(WeightTrendPointSchema),
});
export type WeightTrendSeries = z.infer<typeof WeightTrendSeriesSchema>;

export const BloodPressureEntrySchema = z.object({
  id: z.number().int(),
  systolic: z.number().int(),
  diastolic: z.number().int(),
  pulse: z.number().int().nullable().optional(),
  occurred_at: z.string(),
  note: z.string().nullable().optional(),
});
export type BloodPressureEntry = z.infer<typeof BloodPressureEntrySchema>;

export const BloodPressureEntryListSchema = z.array(BloodPressureEntrySchema);

export const BloodPressureTargetSchema = z.object({
  id: z.number().int(),
  target_systolic: z.number().int().nullable(),
  target_diastolic: z.number().int().nullable(),
  effective_at: z.string(),
});
export type BloodPressureTarget = z.infer<typeof BloodPressureTargetSchema>;

export const BloodPressureTargetListSchema = z.array(BloodPressureTargetSchema);

export const BloodPressureSummarySchema = z.object({
  latest: BloodPressureEntrySchema.nullable(),
  current_target: BloodPressureTargetSchema.nullable().optional(),
});
export type BloodPressureSummary = z.infer<typeof BloodPressureSummarySchema>;

export const MoodValueSchema = z.enum([
  "happy",
  "calm",
  "excited",
  "motivated",
  "relaxed",
  "grateful",
  "productive",
  "tired",
  "sad",
  "stressed",
  "anxious",
  "overwhelmed",
  "frustrated",
  "low_energy",
  "angry",
]);
export type MoodValue = z.infer<typeof MoodValueSchema>;

export const MoodEntrySchema = z.object({
  id: z.number().int(),
  mood: MoodValueSchema,
  energy: z.number().int(),
  occurred_at: z.string(),
  note: z.string().nullable().optional(),
});
export type MoodEntry = z.infer<typeof MoodEntrySchema>;

export const MoodEntryListSchema = z.array(MoodEntrySchema);

export const MoodSummarySchema = z.object({
  latest: MoodEntrySchema.nullable(),
  today_count: z.number().int(),
});
export type MoodSummary = z.infer<typeof MoodSummarySchema>;

export const FlowValueSchema = z.enum(["spotting", "light", "medium", "heavy"]);
export type FlowValue = z.infer<typeof FlowValueSchema>;

export const PeriodSymptomSchema = z.enum([
  "cramps",
  "headache",
  "mood_swings",
  "bloating",
  "fatigue",
  "backache",
  "nausea",
  "tender_breasts",
  "acne",
  "cravings",
]);
export type PeriodSymptom = z.infer<typeof PeriodSymptomSchema>;

export const PeriodEntrySchema = z.object({
  id: z.number().int(),
  entry_date: z.string(),
  flow: FlowValueSchema,
  symptoms: z.array(PeriodSymptomSchema),
  note: z.string().nullable().optional(),
});
export type PeriodEntry = z.infer<typeof PeriodEntrySchema>;

export const PeriodEntryListSchema = z.array(PeriodEntrySchema);

export const SeveritySchema = z.enum(["none", "mild", "moderate", "severe"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const SymptomCatalogSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  sort_order: z.number().int(),
});
export type SymptomCatalogItem = z.infer<typeof SymptomCatalogSchema>;
export const SymptomCatalogListSchema = z.array(SymptomCatalogSchema);

export const SymptomLogSchema = z.object({
  id: z.number().int(),
  catalog_id: z.number().int(),
  name: z.string(),
  severity: SeveritySchema,
  duration_minutes: z.number().int().nullable().optional(),
});
export type SymptomLog = z.infer<typeof SymptomLogSchema>;

export const PainEntrySchema = z.object({
  id: z.number().int(),
  pain_level: z.number().int(),
  occurred_at: z.string(),
  note: z.string().nullable().optional(),
  locations: z.array(z.string()),
  symptoms: z.array(SymptomLogSchema),
});
export type PainEntry = z.infer<typeof PainEntrySchema>;
export const PainEntryListSchema = z.array(PainEntrySchema);

export const PainSummarySchema = z.object({
  latest: PainEntrySchema.nullable(),
});

export const TinyWinItemSchema = z.object({
  id: z.number().int(),
  label: z.string(),
  sort_order: z.number().int(),
  done: z.boolean(),
});
export type TinyWinItem = z.infer<typeof TinyWinItemSchema>;
export const TinyWinItemListSchema = z.array(TinyWinItemSchema);

export const TinyWinDayCountSchema = z.object({
  entry_date: z.string(),
  done: z.number().int(),
});
export const TinyWinCountListSchema = z.array(TinyWinDayCountSchema);

export const MealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
export type MealType = z.infer<typeof MealTypeSchema>;

// Per-portion Canadian Nutrition Facts panel. Mirrors backend
// schemas.food.NutrientPanel — keep the key list in sync. Values are
// already-multiplied for the logged portion (not per-100g).
export const NutrientPanelSchema = z.object({
  saturated_fat_g: z.coerce.number().nullable().optional(),
  trans_fat_g: z.coerce.number().nullable().optional(),
  saturated_trans_g: z.coerce.number().nullable().optional(),
  fibre_g: z.coerce.number().nullable().optional(),
  sugars_g: z.coerce.number().nullable().optional(),
  cholesterol_mg: z.coerce.number().nullable().optional(),
  sodium_mg: z.coerce.number().nullable().optional(),
  potassium_mg: z.coerce.number().nullable().optional(),
  calcium_mg: z.coerce.number().nullable().optional(),
  iron_mg: z.coerce.number().nullable().optional(),
  vit_a_mcg_rae: z.coerce.number().nullable().optional(),
  vit_c_mg: z.coerce.number().nullable().optional(),
  vit_d_mcg: z.coerce.number().nullable().optional(),
  vit_e_mg: z.coerce.number().nullable().optional(),
  vit_k_mcg: z.coerce.number().nullable().optional(),
  thiamin_mg: z.coerce.number().nullable().optional(),
  riboflavin_mg: z.coerce.number().nullable().optional(),
  niacin_mg: z.coerce.number().nullable().optional(),
  vit_b6_mg: z.coerce.number().nullable().optional(),
  folate_mcg_dfe: z.coerce.number().nullable().optional(),
  vit_b12_mcg: z.coerce.number().nullable().optional(),
  pantothenate_mg: z.coerce.number().nullable().optional(),
  phosphorus_mg: z.coerce.number().nullable().optional(),
  magnesium_mg: z.coerce.number().nullable().optional(),
  zinc_mg: z.coerce.number().nullable().optional(),
});
export type NutrientPanel = z.infer<typeof NutrientPanelSchema>;

export const FoodUnitSchema = z.enum(["g", "ml"]);
export type FoodUnit = z.infer<typeof FoodUnitSchema>;

export const FoodEntrySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  brand: z.string().nullable().optional(),
  kcal: z.number().int(),
  protein_g: z.coerce.number().nullable().optional(),
  carbs_g: z.coerce.number().nullable().optional(),
  fat_g: z.coerce.number().nullable().optional(),
  servings: z.coerce.number().nullable().optional(),
  serving_g: z.coerce.number().nullable().optional(),
  serving_label: z.string().nullable().optional(),
  unit: FoodUnitSchema.nullable().optional(),
  nutrients: z.record(z.string(), z.number()).nullable().optional(),
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
  nutrients_total: z.record(z.string(), z.number()),
  dv_percent: z.record(z.string(), z.number()),
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
  serving_g: z.coerce.number().nullable().optional(),
  serving_label: z.string().nullable().optional(),
  unit: FoodUnitSchema.nullable().optional(),
  nutrients: z.record(z.string(), z.number()).nullable().optional(),
  meal_type: MealTypeSchema.nullable(),
  provider: z.string().nullable(),
  provider_id: z.string().nullable(),
  icon_kind: IconKindSchema,
  icon_key: z.string().nullable(),
  sort_order: z.number().int(),
});
export type FoodPreset = z.infer<typeof FoodPresetSchema>;

export const FoodPresetListSchema = z.array(FoodPresetSchema);

export const IngredientUnitSchema = z.enum(["g", "ml", "serving"]);
export type IngredientUnit = z.infer<typeof IngredientUnitSchema>;

export const FoodRecipeIngredientSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  name: z.string(),
  brand: z.string().nullable().optional(),
  provider: z.string().nullable().optional(),
  provider_id: z.string().nullable().optional(),
  quantity: z.coerce.number(),
  unit: IngredientUnitSchema,
  serving_g: z.coerce.number().nullable().optional(),
  serving_label: z.string().nullable().optional(),
  kcal: z.number().int(),
  protein_g: z.coerce.number().nullable().optional(),
  carbs_g: z.coerce.number().nullable().optional(),
  fat_g: z.coerce.number().nullable().optional(),
  nutrients: z.record(z.string(), z.number()).nullable().optional(),
});
export type FoodRecipeIngredient = z.infer<typeof FoodRecipeIngredientSchema>;

export const FoodRecipeSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  brand: z.string().nullable().optional(),
  yields_servings: z.coerce.number(),
  serving_label: z.string().nullable().optional(),
  total_kcal: z.number().int(),
  total_protein_g: z.coerce.number().nullable().optional(),
  total_carbs_g: z.coerce.number().nullable().optional(),
  total_fat_g: z.coerce.number().nullable().optional(),
  total_nutrients: z.record(z.string(), z.number()).nullable().optional(),
  meal_type: MealTypeSchema.nullable().optional(),
  sort_order: z.number().int(),
  ingredients: z.array(FoodRecipeIngredientSchema),
  created_at: z.string(),
  updated_at: z.string(),
});
export type FoodRecipe = z.infer<typeof FoodRecipeSchema>;

export const FoodRecipeListItemSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  brand: z.string().nullable().optional(),
  yields_servings: z.coerce.number(),
  serving_label: z.string().nullable().optional(),
  total_kcal: z.number().int(),
  total_protein_g: z.coerce.number().nullable().optional(),
  total_carbs_g: z.coerce.number().nullable().optional(),
  total_fat_g: z.coerce.number().nullable().optional(),
  total_nutrients: z.record(z.string(), z.number()).nullable().optional(),
  meal_type: MealTypeSchema.nullable().optional(),
  sort_order: z.number().int(),
});
export type FoodRecipeListItem = z.infer<typeof FoodRecipeListItemSchema>;
export const FoodRecipeListSchema = z.array(FoodRecipeListItemSchema);

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
  nutrients_per_100g: z.record(z.string(), z.number()).nullable().optional(),
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
  servings: z.coerce.number().nullable().optional(),
  serving_g: z.coerce.number().nullable().optional(),
  serving_label: z.string().nullable().optional(),
  unit: FoodUnitSchema.nullable().optional(),
  nutrients: z.record(z.string(), z.number()).nullable().optional(),
  meal_type: MealTypeSchema.nullable().optional(),
  provider: z.string().nullable().optional(),
  provider_id: z.string().nullable().optional(),
  last_logged_at: z.string(),
});
export type FoodRecentEntry = z.infer<typeof FoodRecentEntrySchema>;
export const FoodRecentListSchema = z.array(FoodRecentEntrySchema);

// Server-side Canadian DV reference. Cached indefinitely on the client —
// editing requires a backend deploy.
export const DailyValuesSchema = z.object({
  values: z.record(z.string(), z.number()),
  meta: z.record(
    z.string(),
    z.object({
      label: z.string(),
      unit: z.string(),
      kind: z.enum(["macro", "encourage", "limit"]),
    }),
  ),
});
export type DailyValues = z.infer<typeof DailyValuesSchema>;

// Patch response — same shape as Add minus xp_delta (XP is only on first log).
export const FoodPatchOutSchema = z.object({
  entry: FoodEntrySchema,
  total_kcal: z.number().int(),
  target_kcal: z.number().int(),
  over_target: z.boolean(),
});
export type FoodPatchOut = z.infer<typeof FoodPatchOutSchema>;

// Label scan output. All fields optional except `raw_text` so the review
// screen can show the source for debugging / manual cross-check.
export const LabelScanOutSchema = z.object({
  name: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  serving_g: z.number().nullable().optional(),
  serving_label: z.string().nullable().optional(),
  unit: FoodUnitSchema.nullable().optional(),
  kcal: z.number().int().nullable().optional(),
  // Macros live on typed columns server-side, not in the JSONB nutrient panel.
  protein_g: z.coerce.number().nullable().optional(),
  carbs_g: z.coerce.number().nullable().optional(),
  fat_g: z.coerce.number().nullable().optional(),
  nutrients: NutrientPanelSchema,
  raw_text: z.string(),
  language: z.enum(["en", "fr", "mixed"]),
});
export type LabelScanOut = z.infer<typeof LabelScanOutSchema>;
