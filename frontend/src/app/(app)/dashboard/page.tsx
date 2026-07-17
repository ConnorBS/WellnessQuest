"use client";

import { ActivityCard } from "@/components/ActivityCard";
import { BPCard } from "@/components/BPCard";
import { FoodCard } from "@/components/FoodCard";
import { HabitsCard } from "@/components/HabitsCard";
import { SleepCard } from "@/components/SleepCard";
import { StepsCard } from "@/components/StepsCard";
import { StreakBadge } from "@/components/StreakBadge";
import { WaterCard } from "@/components/WaterCard";
import { WeightCard } from "@/components/WeightCard";
import { XpBar } from "@/components/XpBar";
import { useFeatures } from "@/hooks/useFeatures";

export default function DashboardPage() {
  const { isEnabled } = useFeatures();
  return (
    <>
      <XpBar />
      {isEnabled("water") && <WaterCard showQuickLog />}
      {isEnabled("food") && <FoodCard showQuickLog />}
      {isEnabled("activity") && <ActivityCard showQuickLog />}
      {isEnabled("steps") && <StepsCard />}
      {isEnabled("sleep") && <SleepCard />}
      {isEnabled("habits") && <HabitsCard />}
      {isEnabled("weight") && <WeightCard showQuickLog />}
      {isEnabled("blood_pressure") && <BPCard showQuickLog />}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {isEnabled("water") && <StreakBadge metric="water_ml" />}
        {isEnabled("activity") && <StreakBadge metric="active_minutes" />}
        {isEnabled("steps") && <StreakBadge metric="steps" />}
        {isEnabled("sleep") && <StreakBadge metric="sleep_minutes" />}
      </div>
    </>
  );
}
