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
import { useMe } from "@/hooks/useMe";

export default function DashboardPage() {
  const { data: me } = useMe();
  const showWeight = me?.show_weight_card ?? true;
  const showBP = me?.show_bp_card ?? true;
  return (
    <>
      <XpBar />
      <WaterCard />
      <FoodCard />
      <ActivityCard />
      <StepsCard />
      <SleepCard />
      <HabitsCard />
      {showWeight && <WeightCard />}
      {showBP && <BPCard />}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StreakBadge metric="water_ml" />
        <StreakBadge metric="active_minutes" />
        <StreakBadge metric="steps" />
        <StreakBadge metric="sleep_minutes" />
      </div>
    </>
  );
}
