"use client";

import { useFeatureList, useToggleFeature } from "@/hooks/useFeatures";

export default function TrackersSettingsPage() {
  const { data, isLoading } = useFeatureList();
  const toggle = useToggleFeature();

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 8 }}>
          Trackers
        </h2>
        <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 16 }}>
          Turn a tracker off to hide it everywhere — its dashboard card, its top-nav
          link, and its settings page all disappear. Your logged data is kept; turn it
          back on here anytime.
        </p>

        {isLoading || !data ? (
          <p style={{ color: "#94a3b8" }}>Loading...</p>
        ) : (
          <ul style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {data.features.map((f) => (
              <li key={f.key}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 15,
                    padding: "8px 0",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={f.enabled}
                    disabled={toggle.isPending}
                    onChange={(e) =>
                      toggle.mutate({ key: f.key, enabled: e.target.checked })
                    }
                  />
                  {f.label}
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
