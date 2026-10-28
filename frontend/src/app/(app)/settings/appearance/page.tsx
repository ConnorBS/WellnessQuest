"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useFeatureList } from "@/hooks/useFeatures";
import { useMe } from "@/hooks/useMe";
import { useUpdateMe } from "@/hooks/useUpdateMe";
import {
  DEFAULT_THEME,
  EMPTY_PREFS,
  SECTIONS,
  THEME_PRESETS,
  THEME_SLOTS,
  applyTheme,
  isHex,
  type ThemeSlot,
  type UiPrefs,
  type UiSection,
  type UiTheme,
} from "@/lib/theme";

const SAVE_DELAY_MS = 600;

const ghostBtn: React.CSSProperties = {
  padding: "6px 10px",
  background: "transparent",
  color: "var(--wq-muted)",
  border: "1px solid var(--wq-border)",
  borderRadius: 6,
  fontSize: 13,
};

const presetBtn: React.CSSProperties = {
  ...ghostBtn,
  color: "var(--wq-text-2)",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const dangerBtn: React.CSSProperties = {
  ...ghostBtn,
  color: "#fca5a5",
  borderColor: "#7f1d1d",
};

const swatchInput: React.CSSProperties = {
  width: 44,
  height: 32,
  padding: 2,
  border: "1px solid var(--wq-border)",
  borderRadius: 6,
  background: "var(--wq-surface)",
};

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 0",
  borderBottom: "1px solid var(--wq-surface-2)",
};

function cleanTheme(theme: UiTheme): UiTheme {
  const out: UiTheme = {};
  for (const { key } of THEME_SLOTS) {
    const v = theme[key];
    if (isHex(v)) out[key] = v;
  }
  return out;
}

/** Drop nulls so the PATCH body is the compact shape the backend stores. */
function toPayload(prefs: UiPrefs): UiPrefs {
  return {
    theme: cleanTheme(prefs.theme),
    card_colors: Object.fromEntries(
      Object.entries(prefs.card_colors).filter(([, v]) => isHex(v)),
    ),
    hidden_sections: prefs.hidden_sections,
  };
}

function PresetSwatch({ theme }: { theme: UiTheme }) {
  const bg = theme.background ?? DEFAULT_THEME.background;
  const card = theme.card ?? DEFAULT_THEME.card;
  const accent = theme.accent ?? DEFAULT_THEME.accent;
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        width: 36,
        height: 20,
        borderRadius: 4,
        overflow: "hidden",
        border: "1px solid var(--wq-border)",
      }}
    >
      <span style={{ flex: 1, background: bg }} />
      <span style={{ flex: 1, background: card }} />
      <span style={{ flex: 1, background: accent }} />
    </span>
  );
}

export default function AppearanceSettingsPage() {
  const { data: me } = useMe();
  const features = useFeatureList();
  const updateMe = useUpdateMe();

  // Local draft so colour pickers preview live without a request per drag
  // step; persisted a moment after the last change.
  const [draft, setDraft] = useState<UiPrefs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<UiPrefs | null>(null);

  useEffect(() => {
    if (me && draft === null) setDraft(toPayload(me.ui_prefs ?? EMPTY_PREFS));
  }, [me, draft]);

  const persist = useCallback(
    (prefs: UiPrefs) => {
      pending.current = null;
      setError(null);
      updateMe.mutate(
        { ui_prefs: toPayload(prefs) },
        { onError: () => setError("Could not save — check your connection and try again.") },
      );
    },
    [updateMe],
  );

  // Flush a pending debounced save if the user leaves the page early.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current) persist(pending.current);
    },
    [persist],
  );

  function commit(next: UiPrefs, { immediate = false } = {}) {
    setDraft(next);
    applyTheme(next.theme);
    if (timer.current) clearTimeout(timer.current);
    if (immediate) {
      persist(next);
      return;
    }
    pending.current = next;
    timer.current = setTimeout(() => persist(next), SAVE_DELAY_MS);
  }

  if (!me || !draft) {
    return (
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <p style={{ color: "var(--wq-muted)" }}>Loading…</p>
      </section>
    );
  }

  const theme = draft.theme;
  const effectiveCard = theme.card ?? DEFAULT_THEME.card;
  const hidden = new Set<UiSection>(draft.hidden_sections);
  const enabledFeatures = (features.data?.features ?? []).filter((f) => f.enabled);
  const anyCustom =
    Object.keys(theme).length > 0 ||
    Object.keys(draft.card_colors).length > 0 ||
    draft.hidden_sections.length > 0;

  function setSlot(slot: ThemeSlot, value: string | null) {
    const nextTheme = { ...theme };
    if (value && isHex(value)) nextTheme[slot] = value;
    else delete nextTheme[slot];
    commit({ ...draft!, theme: nextTheme });
  }

  function setCardColor(key: string, value: string | null) {
    const next = { ...draft!.card_colors };
    if (value && isHex(value)) next[key] = value;
    else delete next[key];
    commit({ ...draft!, card_colors: next });
  }

  function setSectionShown(section: UiSection, shown: boolean) {
    const next = draft!.hidden_sections.filter((s) => s !== section);
    if (!shown) next.push(section);
    commit({ ...draft!, hidden_sections: next }, { immediate: true });
  }

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 8 }}>
          Theme
        </h2>
        <p style={{ color: "var(--wq-muted)", fontSize: 14, marginBottom: 12 }}>
          Pick a preset or set each colour yourself. Changes preview as you go and
          save automatically; they follow your account, so every device matches.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {THEME_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              style={presetBtn}
              onClick={() => commit({ ...draft, theme: { ...p.theme } })}
            >
              <PresetSwatch theme={p.theme} />
              {p.name}
            </button>
          ))}
        </div>

        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {THEME_SLOTS.map(({ key, label, hint }) => {
            const set = isHex(theme[key]);
            return (
              <li key={key} style={row}>
                <input
                  type="color"
                  aria-label={label}
                  value={theme[key] ?? DEFAULT_THEME[key]}
                  onChange={(e) => setSlot(key, e.target.value)}
                  style={swatchInput}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15 }}>{label}</div>
                  <div style={{ color: "var(--wq-muted-2)", fontSize: 12 }}>
                    {set ? theme[key] : hint}
                  </div>
                </div>
                {set && (
                  <button type="button" style={ghostBtn} onClick={() => setSlot(key, null)}>
                    Reset
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <p style={{ marginTop: 8, color: "var(--wq-muted-2)", fontSize: 13 }}>
          Set just the background and the text, borders and card colours adjust to
          stay readable; set them yourself to override that.
        </p>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 8 }}>
          Card colours
        </h2>
        <p style={{ color: "var(--wq-muted)", fontSize: 14, marginBottom: 12 }}>
          Give a tracker its own card colour. It applies to its dashboard card and
          its page. Trackers that are turned off aren&apos;t listed — manage those under
          Trackers.
        </p>
        {features.isLoading ? (
          <p style={{ color: "var(--wq-muted)" }}>Loading…</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {enabledFeatures.map((f) => {
              const set = isHex(draft.card_colors[f.key]);
              return (
                <li key={f.key} style={row}>
                  <input
                    type="color"
                    aria-label={`${f.label} card colour`}
                    value={draft.card_colors[f.key] ?? effectiveCard}
                    onChange={(e) => setCardColor(f.key, e.target.value)}
                    style={swatchInput}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15 }}>{f.label}</div>
                    <div style={{ color: "var(--wq-muted-2)", fontSize: 12 }}>
                      {set ? draft.card_colors[f.key] : "Uses the theme card colour"}
                    </div>
                  </div>
                  {set && (
                    <button
                      type="button"
                      style={ghostBtn}
                      onClick={() => setCardColor(f.key, null)}
                    >
                      Reset
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 8 }}>
          Sections
        </h2>
        <p style={{ color: "var(--wq-muted)", fontSize: 14, marginBottom: 12 }}>
          Hide the parts of the page that aren&apos;t a tracker. Trackers themselves are
          shown, hidden and reordered under Trackers.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {SECTIONS.map(({ key, label, hint }) => (
            <li key={key} style={row}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                <input
                  type="checkbox"
                  checked={!hidden.has(key)}
                  disabled={updateMe.isPending}
                  onChange={(e) => setSectionShown(key, e.target.checked)}
                />
                <span>
                  <span style={{ fontSize: 15, display: "block" }}>Show {label}</span>
                  <span style={{ color: "var(--wq-muted-2)", fontSize: 12 }}>{hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 className="text-lg font-semibold">Reset</h2>
            <p style={{ color: "var(--wq-muted)", fontSize: 14, margin: 0 }}>
              Back to the default look, every section shown.
            </p>
          </div>
          <button
            type="button"
            style={dangerBtn}
            disabled={!anyCustom || updateMe.isPending}
            onClick={() => {
              if (confirm("Reset all appearance settings to the defaults?")) {
                commit({ theme: {}, card_colors: {}, hidden_sections: [] }, { immediate: true });
              }
            }}
          >
            Reset everything
          </button>
        </div>
        {error && <p style={{ color: "#fca5a5", fontSize: 13, marginTop: 8 }}>{error}</p>}
        {updateMe.isPending && !error && (
          <p style={{ color: "var(--wq-muted-2)", fontSize: 13, marginTop: 8 }}>Saving…</p>
        )}
      </section>
    </>
  );
}
