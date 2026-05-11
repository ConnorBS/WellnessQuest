"use client";

import { StreakBadge } from "@/components/StreakBadge";
import { WaterCard } from "@/components/WaterCard";
import { XpBar } from "@/components/XpBar";

export default function DashboardPage() {
  return (
    <>
      <XpBar />
      <WaterCard />
      <div>
        <StreakBadge metric="water_ml" />
      </div>
    </>
  );
}
