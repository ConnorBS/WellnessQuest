"use client";

import { ActivityCard } from "@/components/ActivityCard";
import { HabitsCard } from "@/components/HabitsCard";
import { StreakBadge } from "@/components/StreakBadge";
import { WaterCard } from "@/components/WaterCard";
import { XpBar } from "@/components/XpBar";

export default function DashboardPage() {
  return (
    <>
      <XpBar />
      <WaterCard />
      <ActivityCard />
      <HabitsCard />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StreakBadge metric="water_ml" />
        <StreakBadge metric="active_minutes" />
      </div>
    </>
  );
}
