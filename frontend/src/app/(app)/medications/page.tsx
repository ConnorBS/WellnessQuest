"use client";

import Link from "next/link";
import { useState } from "react";

import {
  useCreateMedication,
  useMedicationHistory,
  useMedicationOptions,
  useMedications,
} from "@/hooks/useMedications";
import { todayLocalIso } from "@/lib/day-context";
import { changeSummary, doseText, durationText, formatDay } from "@/lib/medications";
import type { Medication } from "@/lib/schemas";

const card: React.CSSProperties = {
  border: "1px solid #1e293b",
  borderRadius: 10,
  padding: "10px 12px",
  display: "block",
  color: "inherit",
  textDecoration: "none",
};

const primaryBtn: React.CSSProperties = {
  padding: "8px 12px",
  background: "#10b981",
  color: "#0b1220",
  border: 0,
  borderRadius: 6,
  fontWeight: 500,
};

const ghostBtn: React.CSSProperties = {
  padding: "6px 10px",
  background: "transparent",
  color: "#94a3b8",
  border: "1px solid #334155",
  borderRadius: 6,
  fontSize: 13,
};

const field: React.CSSProperties = {
  padding: "8px 10px",
  background: "#0f172a",
  color: "#e2e8f0",
  border: "1px solid #334155",
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
};

const label: React.CSSProperties = { color: "#94a3b8", fontSize: 12, display: "block", marginBottom: 4 };

function MedRow({ med, today }: { med: Medication; today: string }) {
  const dose = doseText(med);
  return (
    <Link href={`/medications/${med.id}`} style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <strong style={{ fontSize: 15 }}>{med.name}</strong>
        <span style={{ color: "#64748b", fontSize: 12 }}>
          {med.change_count} {med.change_count === 1 ? "entry" : "entries"}
        </span>
      </div>
      {dose && <div style={{ color: "#cbd5e1", fontSize: 14, marginTop: 2 }}>{dose}</div>}
      <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
        {med.active
          ? `Since ${formatDay(med.started_on)} · ${durationText(med.started_on, null, today)}`
          : `${formatDay(med.started_on)} → ${formatDay(med.ended_on!)} · ${durationText(
              med.started_on,
              med.ended_on,
              today,
            )}`}
        {med.reason ? ` · ${med.reason}` : ""}
      </div>
      {!med.active && med.stopped_reason && (
        <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
          Stopped: {med.stopped_reason}
        </div>
      )}
    </Link>
  );
}

function AddForm({ onDone }: { onDone: () => void }) {
  const create = useCreateMedication();
  const options = useMedicationOptions();
  const today = todayLocalIso();
  const [name, setName] = useState("");
  const [form, setForm] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("mg");
  const [frequency, setFrequency] = useState("");
  const [reason, setReason] = useState("");
  const [prescriber, setPrescriber] = useState("");
  const [startedOn, setStartedOn] = useState(today);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate(
      {
        name: name.trim(),
        form: form || null,
        reason: reason.trim() || null,
        prescriber: prescriber.trim() || null,
        started_on: startedOn,
        dose_amount: amount ? Number(amount) : null,
        dose_unit: amount ? unit : null,
        frequency: frequency.trim() || null,
      },
      { onSuccess: onDone },
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 10, marginBottom: 16 }}>
      <div>
        <label style={label} htmlFor="med-name">
          Name
        </label>
        <input
          id="med-name"
          style={field}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sertraline"
          autoFocus
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={label} htmlFor="med-amount">
            Dose
          </label>
          <input
            id="med-amount"
            style={field}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="50"
          />
        </div>
        <div>
          <label style={label} htmlFor="med-unit">
            Unit
          </label>
          <select id="med-unit" style={field} value={unit} onChange={(e) => setUnit(e.target.value)}>
            {(options.data?.dose_units ?? ["mg"]).map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={label} htmlFor="med-frequency">
            How often
          </label>
          <input
            id="med-frequency"
            style={field}
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            placeholder="once daily"
          />
        </div>
        <div>
          <label style={label} htmlFor="med-form">
            Form
          </label>
          <select id="med-form" style={field} value={form} onChange={(e) => setForm(e.target.value)}>
            <option value="">—</option>
            {(options.data?.forms ?? []).map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={label} htmlFor="med-started">
            Started on
          </label>
          <input
            id="med-started"
            type="date"
            style={field}
            max={today}
            value={startedOn}
            onChange={(e) => setStartedOn(e.target.value)}
          />
        </div>
        <div>
          <label style={label} htmlFor="med-reason">
            What it&apos;s for
          </label>
          <input
            id="med-reason"
            style={field}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="optional"
          />
        </div>
      </div>
      <div>
        <label style={label} htmlFor="med-prescriber">
          Prescriber
        </label>
        <input
          id="med-prescriber"
          style={field}
          value={prescriber}
          onChange={(e) => setPrescriber(e.target.value)}
          placeholder="optional"
        />
      </div>
      {create.isError && (
        <p style={{ color: "#fca5a5", fontSize: 13 }}>
          Couldn&apos;t save that — check the dates and try again.
        </p>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" style={primaryBtn} disabled={create.isPending || !name.trim()}>
          {create.isPending ? "Saving…" : "Add medication"}
        </button>
        <button type="button" style={ghostBtn} onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function MedicationsPage() {
  const today = todayLocalIso();
  const active = useMedications("active");
  const past = useMedications("past");
  const history = useMedicationHistory(20);
  const [showAdd, setShowAdd] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const actives = active.data ?? [];
  const pasts = past.data ?? [];
  const changes = history.data ?? [];

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 12,
            gap: 8,
          }}
        >
          <h2 className="text-lg font-semibold">Currently taking</h2>
          {!showAdd && (
            <button type="button" style={primaryBtn} onClick={() => setShowAdd(true)}>
              Add
            </button>
          )}
        </header>

        {showAdd && <AddForm onDone={() => setShowAdd(false)} />}

        {active.isLoading ? (
          <p style={{ color: "#94a3b8" }}>Loading…</p>
        ) : actives.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 14 }}>
            Nothing here yet. Add a medication to keep a record of what you take and how it
            changes.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {actives.map((m) => (
              <MedRow key={m.id} med={m} today={today} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <button
          type="button"
          onClick={() => setShowPast((v) => !v)}
          style={{
            all: "unset",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <h2 className="text-lg font-semibold">Past medications</h2>
          <span style={{ color: "#94a3b8", fontSize: 13 }}>
            {pasts.length} · {showPast ? "hide" : "show"}
          </span>
        </button>
        {showPast &&
          (pasts.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 10 }}>
              Nothing stopped yet. Medications you stop move here — the history stays.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {pasts.map((m) => (
                <MedRow key={m.id} med={m} today={today} />
              ))}
            </div>
          ))}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          style={{
            all: "unset",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <h2 className="text-lg font-semibold">What changed, and when</h2>
          <span style={{ color: "#94a3b8", fontSize: 13 }}>{showHistory ? "hide" : "show"}</span>
        </button>
        {showHistory &&
          (changes.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 10 }}>
              No changes recorded yet.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "10px 0 0",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {changes.map((c) => (
                <li key={c.id} style={{ fontSize: 14 }}>
                  <span style={{ color: "#64748b", fontSize: 12 }}>
                    {formatDay(c.effective_on)}
                  </span>{" "}
                  <Link href={`/medications/${c.medication_id}`} style={{ color: "#10b981" }}>
                    {c.medication_name}
                  </Link>{" "}
                  <span style={{ color: "#cbd5e1" }}>— {changeSummary(c)}</span>
                  {c.note && (
                    <div style={{ color: "#94a3b8", fontSize: 13 }}>{c.note}</div>
                  )}
                </li>
              ))}
            </ul>
          ))}
      </section>
    </>
  );
}
