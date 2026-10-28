"use client";

interface Props {
  value: string | null;
  onChange: (v: string | null) => void;
  defaultLabel?: string;
  initialPickerIso?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoToLocalDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localDateTimeToIso(local: string): string {
  return new Date(local).toISOString();
}

export function OccurredAtField({
  value,
  onChange,
  defaultLabel = "now",
  initialPickerIso,
}: Props) {
  const expanded = value !== null;

  function expand() {
    onChange(initialPickerIso ?? new Date().toISOString());
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={labelStyle}>Time</span>
      {!expanded ? (
        <button
          type="button"
          onClick={expand}
          data-testid="occurred-at-expand"
          style={linkBtn}
        >
          Logged at {defaultLabel} · Set custom time
        </button>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="datetime-local"
            value={isoToLocalDateTime(value)}
            onChange={(e) => {
              if (e.target.value === "") return;
              onChange(localDateTimeToIso(e.target.value));
            }}
            data-testid="occurred-at-input"
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            data-testid="occurred-at-reset"
            style={linkBtn}
          >
            Use {defaultLabel}
          </button>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--wq-muted)",
};

const linkBtn: React.CSSProperties = {
  alignSelf: "start",
  fontSize: 12,
  color: "var(--wq-accent)",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 0,
  textAlign: "left",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  background: "var(--wq-bg)",
  border: "1px solid var(--wq-surface-2)",
  borderRadius: 6,
  color: "var(--wq-text)",
  fontSize: 14,
};
