"use client";

import { ActivityCard } from "@/components/ActivityCard";
import { HabitsCard } from "@/components/HabitsCard";
import { StreakBadge } from "@/components/StreakBadge";
import { WaterCard } from "@/components/WaterCard";
import { WeightCard } from "@/components/WeightCard";
import { XpBar } from "@/components/XpBar";
import { useMe } from "@/hooks/useMe";

export default function DashboardPage() {
  const { data: me } = useMe();
  const showWeight = me?.show_weight_card ?? true;
  return (
    <>
      <XpBar />
      <WaterCard />
      <ActivityCard />
      <HabitsCard />
      {showWeight && <WeightCard />}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StreakBadge metric="water_ml" />
        <StreakBadge metric="active_minutes" />
      </div>
    </>
  );
}
