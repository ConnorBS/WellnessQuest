"use client";

import type { ReactNode } from "react";

import { ActivityCard } from "@/components/ActivityCard";
import { BPCard } from "@/components/BPCard";
import { FoodCard } from "@/components/FoodCard";
import { HabitsCard } from "@/components/HabitsCard";
import { MoodCard } from "@/components/MoodCard";
import { PainCard } from "@/components/PainCard";
import { PeriodCard } from "@/components/PeriodCard";
import { SleepCard } from "@/components/SleepCard";
import { StepsCard } from "@/components/StepsCard";
import { StreakBadge } from "@/components/StreakBadge";
import { TinyWinsCard } from "@/components/TinyWinsCard";
import { WaterCard } from "@/components/WaterCard";
import { WeightCard } from "@/components/WeightCard";
import { XpBar } from "@/components/XpBar";
import { useFeatures } from "@/hooks/useFeatures";

// Card per feature key. Order on the dashboard is driven by the user's
// feature_order (see Settings → Trackers), not this map.
const CARDS: Record<string, ReactNode> = {
  water: <WaterCard showQuickLog />,
  food: <FoodCard showQuickLog />,
  activity: <ActivityCard showQuickLog />,
  steps: <StepsCard />,
  sleep: <SleepCard />,
  habits: <HabitsCard />,
  weight: <WeightCard showQuickLog />,
  blood_pressure: <BPCard showQuickLog />,
  mood: <MoodCard showQuickLog />,
  period: <PeriodCard />,
  pain: <PainCard />,
  tiny_wins: <TinyWinsCard />,
};

export default function DashboardPage() {
  const { order, isEnabled } = useFeatures();
  const keys = order.length > 0 ? order : Object.keys(CARDS);
  return (
    <>
      <XpBar />
      {keys.map((key) =>
        CARDS[key] && isEnabled(key) ? (
          <div key={key}>{CARDS[key]}</div>
        ) : null,
      )}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {isEnabled("water") && <StreakBadge metric="water_ml" />}
        {isEnabled("activity") && <StreakBadge metric="active_minutes" />}
        {isEnabled("steps") && <StreakBadge metric="steps" />}
        {isEnabled("sleep") && <StreakBadge metric="sleep_minutes" />}
      </div>
    </>
  );
}
