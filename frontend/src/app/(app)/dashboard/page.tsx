"use client";

import type { ReactNode } from "react";

import { ActivityCard } from "@/components/ActivityCard";
import { BPCard } from "@/components/BPCard";
import { FoodCard } from "@/components/FoodCard";
import { HabitsCard } from "@/components/HabitsCard";
import { JournalCard } from "@/components/JournalCard";
import { MedicationsCard } from "@/components/MedicationsCard";
import { MoodCard } from "@/components/MoodCard";
import { PainCard } from "@/components/PainCard";
import { PeriodCard } from "@/components/PeriodCard";
import { RefluxCard } from "@/components/RefluxCard";
import { SleepCard } from "@/components/SleepCard";
import { StepsCard } from "@/components/StepsCard";
import { StreakBadge } from "@/components/StreakBadge";
import { TinyWinsCard } from "@/components/TinyWinsCard";
import { WaterCard } from "@/components/WaterCard";
import { WeightCard } from "@/components/WeightCard";
import { XpBar } from "@/components/XpBar";
import { useFeatures } from "@/hooks/useFeatures";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { cardTintStyle } from "@/lib/theme";

// Card per feature key. Order on the dashboard is driven by the user's
// feature_order (see Settings → Trackers), not this map. `quickLog` is the
// user's Settings → Appearance choice for the "+ Log" shortcut buttons.
function cards(quickLog: boolean): Record<string, ReactNode> {
  return {
    water: <WaterCard showQuickLog={quickLog} />,
    food: <FoodCard showQuickLog={quickLog} />,
    activity: <ActivityCard showQuickLog={quickLog} />,
    steps: <StepsCard showQuickLog={quickLog} />,
    sleep: <SleepCard showQuickLog={quickLog} />,
    habits: <HabitsCard />,
    weight: <WeightCard showQuickLog={quickLog} />,
    blood_pressure: <BPCard showQuickLog={quickLog} />,
    mood: <MoodCard showQuickLog={quickLog} />,
    period: <PeriodCard />,
    pain: <PainCard />,
    reflux: <RefluxCard showQuickLog={quickLog} />,
    medications: <MedicationsCard />,
    tiny_wins: <TinyWinsCard />,
    journal: <JournalCard showQuickLog={quickLog} />,
  };
}

export default function DashboardPage() {
  const { order, isEnabled } = useFeatures();
  const { prefs, isHidden, cardColor } = useUiPrefs();
  const CARDS = cards(!isHidden("quick_log"));
  const keys = order.length > 0 ? order : Object.keys(CARDS);
  return (
    <>
      {!isHidden("xp_bar") && <XpBar />}
      {keys.map((key) =>
        CARDS[key] && isEnabled(key) ? (
          // A per-tracker tint overrides --wq-card for just this subtree.
          <div key={key} style={cardTintStyle(cardColor(key), prefs.theme)}>
            {CARDS[key]}
          </div>
        ) : null,
      )}
      {!isHidden("streaks") && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {isEnabled("water") && <StreakBadge metric="water_ml" />}
          {isEnabled("activity") && <StreakBadge metric="active_minutes" />}
          {isEnabled("steps") && <StreakBadge metric="steps" />}
          {isEnabled("sleep") && <StreakBadge metric="sleep_minutes" />}
        </div>
      )}
    </>
  );
}
