import { z } from "zod";

export const MeSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  display_name: z.string(),
  role: z.string(),
  xp_total: z.number().int(),
  level: z.number().int(),
  timezone: z.string(),
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
  icon_kind: IconKindSchema,
  icon_key: z.string().nullable(),
  sort_order: z.number().int(),
});
export type ActivityPreset = z.infer<typeof ActivityPresetSchema>;

export const ActivityPresetListSchema = z.array(ActivityPresetSchema);

export const ActivityGoalOutSchema = z.object({ target_minutes: z.number().int().positive() });
export type ActivityGoalOut = z.infer<typeof ActivityGoalOutSchema>;
