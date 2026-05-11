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
