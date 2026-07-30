"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import {
  useAddMedicationChange,
  useDeleteMedication,
  useDeleteMedicationChange,
  useMedication,
  useMedicationOptions,
  useResumeMedication,
  useStopMedication,
  useUpdateMedication,
} from "@/hooks/useMedications";
import { todayLocalIso } from "@/lib/day-context";
import { changeLabel, changeSummary, doseText, durationText, formatDay } from "@/lib/medications";
import type { MedicationDetail } from "@/lib/schemas";

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

const dangerBtn: React.CSSProperties = {
  padding: "6px 10px",
  background: "transparent",
  color: "#fca5a5",
  border: "1px solid #7f1d1d",
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

const label: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 12,
  display: "block",
  marginBottom: 4,
};

type Panel = "none" | "change" | "stop" | "edit";

function ChangeForm({ med, onDone }: { med: MedicationDetail; onDone: () => void }) {
  const add = useAddMedicationChange();
  const options = useMedicationOptions();
  const today = todayLocalIso();
  const [kind, setKind] = useState("dose_change");
  const [effectiveOn, setEffectiveOn] = useState(today);
  const [amount, setAmount] = useState(med.dose_amount === null ? "" : String(med.dose_amount));
  const [unit, setUnit] = useState(med.dose_unit ?? "mg");
  const [frequency, setFrequency] = useState(med.frequency ?? "");
  const [note, setNote] = useState("");

  const showDose = kind === "dose_change";
  const showFrequency = kind === "dose_change" || kind === "schedule_change";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    add.mutate(
      {
        id: med.id,
        change: {
          kind,
          effective_on: effectiveOn,
          dose_amount: showDose && amount ? Number(amount) : null,
          dose_unit: showDose && amount ? unit : null,
          frequency: showFrequency && frequency.trim() ? frequency.trim() : null,
          note: note.trim() || null,
        },
      },
      { onSuccess: onDone },
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 10, marginTop: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={label} htmlFor="chg-kind">
            What happened
          </label>
          <select id="chg-kind" style={field} value={kind} onChange={(e) => setKind(e.target.value)}>
            {(options.data?.change_kinds ?? ["dose_change", "schedule_change", "paused", "note"]).map(
              (k) => (
                <option key={k} value={k}>
                  {changeLabel(k)}
                </option>
              ),
            )}
          </select>
        </div>
        <div>
          <label style={label} htmlFor="chg-date">
            Effective from
          </label>
          <input
            id="chg-date"
            type="date"
            style={field}
            max={today}
            value={effectiveOn}
            onChange={(e) => setEffectiveOn(e.target.value)}
          />
        </div>
      </div>
      {showDose && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={label} htmlFor="chg-amount">
              New dose
            </label>
            <input
              id="chg-amount"
              style={field}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label style={label} htmlFor="chg-unit">
              Unit
            </label>
            <select id="chg-unit" style={field} value={unit} onChange={(e) => setUnit(e.target.value)}>
              {(options.data?.dose_units ?? ["mg"]).map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {showFrequency && (
        <div>
          <label style={label} htmlFor="chg-frequency">
            How often
          </label>
          <input
            id="chg-frequency"
            style={field}
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            placeholder="twice daily"
          />
        </div>
      )}
      <div>
        <label style={label} htmlFor="chg-note">
          Note
        </label>
        <textarea
          id="chg-note"
          style={{ ...field, minHeight: 60 }}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why it changed, side effects, who advised it…"
        />
      </div>
      {add.isError && (
        <p style={{ color: "#fca5a5", fontSize: 13 }}>Couldn&apos;t save that change.</p>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" style={primaryBtn} disabled={add.isPending}>
          {add.isPending ? "Saving…" : "Record it"}
        </button>
        <button type="button" style={ghostBtn} onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function StopForm({ med, onDone }: { med: MedicationDetail; onDone: () => void }) {
  const stop = useStopMedication();
  const today = todayLocalIso();
  const [endedOn, setEndedOn] = useState(today);
  const [reason, setReason] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        stop.mutate(
          { id: med.id, ended_on: endedOn, reason: reason.trim() || null },
          { onSuccess: onDone },
        );
      }}
      style={{ display: "grid", gap: 10, marginTop: 12 }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={label} htmlFor="stop-date">
            Last taken
          </label>
          <input
            id="stop-date"
            type="date"
            style={field}
            min={med.started_on}
            max={today}
            value={endedOn}
            onChange={(e) => setEndedOn(e.target.value)}
          />
        </div>
        <div>
          <label style={label} htmlFor="stop-reason">
            Why
          </label>
          <input
            id="stop-reason"
            style={field}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="optional"
          />
        </div>
      </div>
      {stop.isError && (
        <p style={{ color: "#fca5a5", fontSize: 13 }}>
          Couldn&apos;t stop it — the end date must be on or after {formatDay(med.started_on)}.
        </p>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" style={primaryBtn} disabled={stop.isPending}>
          {stop.isPending ? "Saving…" : "Move to past medications"}
        </button>
        <button type="button" style={ghostBtn} onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function EditForm({ med, onDone }: { med: MedicationDetail; onDone: () => void }) {
  const update = useUpdateMedication();
  const options = useMedicationOptions();
  const today = todayLocalIso();
  const [name, setName] = useState(med.name);
  const [form, setForm] = useState(med.form ?? "");
  const [reason, setReason] = useState(med.reason ?? "");
  const [prescriber, setPrescriber] = useState(med.prescriber ?? "");
  const [notes, setNotes] = useState(med.notes ?? "");
  const [startedOn, setStartedOn] = useState(med.started_on);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        update.mutate(
          {
            id: med.id,
            patch: {
              name: name.trim(),
              form: form || null,
              reason: reason.trim() || null,
              prescriber: prescriber.trim() || null,
              notes: notes.trim() || null,
              started_on: startedOn,
            },
          },
          { onSuccess: onDone },
        );
      }}
      style={{ display: "grid", gap: 10, marginTop: 12 }}
    >
      <div>
        <label style={label} htmlFor="edit-name">
          Name
        </label>
        <input id="edit-name" style={field} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={label} htmlFor="edit-form">
            Form
          </label>
          <select id="edit-form" style={field} value={form} onChange={(e) => setForm(e.target.value)}>
            <option value="">—</option>
            {(options.data?.forms ?? []).map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={label} htmlFor="edit-started">
            Started on
          </label>
          <input
            id="edit-started"
            type="date"
            style={field}
            max={today}
            value={startedOn}
            onChange={(e) => setStartedOn(e.target.value)}
          />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={label} htmlFor="edit-reason">
            What it&apos;s for
          </label>
          <input
            id="edit-reason"
            style={field}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div>
          <label style={label} htmlFor="edit-prescriber">
            Prescriber
          </label>
          <input
            id="edit-prescriber"
            style={field}
            value={prescriber}
            onChange={(e) => setPrescriber(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label style={label} htmlFor="edit-notes">
          Notes
        </label>
        <textarea
          id="edit-notes"
          style={{ ...field, minHeight: 70 }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {update.isError && (
        <p style={{ color: "#fca5a5", fontSize: 13 }}>Couldn&apos;t save those details.</p>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" style={primaryBtn} disabled={update.isPending || !name.trim()}>
          {update.isPending ? "Saving…" : "Save details"}
        </button>
        <button type="button" style={ghostBtn} onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// The frontend ships as a static export (`output: "export"`), which has no
// server to resolve a `/medications/[id]` segment at request time. The
// medication id therefore travels as a query param on a static route.
function MedicationDetail() {
  const search = useSearchParams();
  const router = useRouter();
  const id = Number(search.get("id"));
  const q = useMedication(id);
  const resume = useResumeMedication();
  const removeMed = useDeleteMedication();
  const removeChange = useDeleteMedicationChange();
  const [panel, setPanel] = useState<Panel>("none");
  const today = todayLocalIso();

  if (q.isLoading) {
    return <p style={{ color: "#94a3b8" }}>Loading…</p>;
  }
  if (q.isError || !q.data) {
    return (
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <p style={{ color: "#94a3b8" }}>That medication isn&apos;t here.</p>
        <Link href="/medications" style={{ color: "#10b981", fontSize: 13 }}>
          ← Back to medications
        </Link>
      </section>
    );
  }

  const med = q.data;
  const dose = doseText(med);

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <Link href="/medications" style={{ color: "#10b981", fontSize: 13 }}>
          ← Medications
        </Link>
        <header style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
          <h2 className="text-lg font-semibold">{med.name}</h2>
          <span
            style={{
              fontSize: 12,
              padding: "2px 8px",
              borderRadius: 999,
              color: med.active ? "#0b1220" : "#cbd5e1",
              background: med.active ? "#10b981" : "#334155",
            }}
          >
            {med.active ? "Taking now" : "Past"}
          </span>
        </header>

        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "120px 1fr",
            rowGap: 6,
            fontSize: 14,
            marginTop: 12,
          }}
        >
          <dt style={{ color: "#94a3b8" }}>Dose</dt>
          <dd>{dose ?? "—"}</dd>
          {med.form && (
            <>
              <dt style={{ color: "#94a3b8" }}>Form</dt>
              <dd>{med.form}</dd>
            </>
          )}
          {med.reason && (
            <>
              <dt style={{ color: "#94a3b8" }}>For</dt>
              <dd>{med.reason}</dd>
            </>
          )}
          {med.prescriber && (
            <>
              <dt style={{ color: "#94a3b8" }}>Prescriber</dt>
              <dd>{med.prescriber}</dd>
            </>
          )}
          <dt style={{ color: "#94a3b8" }}>Started</dt>
          <dd>{formatDay(med.started_on)}</dd>
          {med.ended_on && (
            <>
              <dt style={{ color: "#94a3b8" }}>Stopped</dt>
              <dd>
                {formatDay(med.ended_on)}
                {med.stopped_reason ? ` · ${med.stopped_reason}` : ""}
              </dd>
            </>
          )}
          <dt style={{ color: "#94a3b8" }}>{med.active ? "Taking for" : "Taken for"}</dt>
          <dd>{durationText(med.started_on, med.ended_on, today)}</dd>
        </dl>

        {med.notes && (
          <p style={{ color: "#cbd5e1", fontSize: 14, marginTop: 10, whiteSpace: "pre-wrap" }}>
            {med.notes}
          </p>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <button
            type="button"
            style={primaryBtn}
            onClick={() => setPanel(panel === "change" ? "none" : "change")}
          >
            Record a change
          </button>
          {med.active ? (
            <button
              type="button"
              style={ghostBtn}
              onClick={() => setPanel(panel === "stop" ? "none" : "stop")}
            >
              Stop taking
            </button>
          ) : (
            <button
              type="button"
              style={ghostBtn}
              disabled={resume.isPending}
              onClick={() => resume.mutate({ id: med.id })}
            >
              {resume.isPending ? "…" : "Start taking again"}
            </button>
          )}
          <button
            type="button"
            style={ghostBtn}
            onClick={() => setPanel(panel === "edit" ? "none" : "edit")}
          >
            Edit details
          </button>
          <button
            type="button"
            style={dangerBtn}
            disabled={removeMed.isPending}
            onClick={() => {
              if (
                !window.confirm(
                  `Delete ${med.name} and its whole history? To retire a medication you actually took, use "Stop taking" instead.`,
                )
              ) {
                return;
              }
              removeMed.mutate(med.id, { onSuccess: () => router.push("/medications") });
            }}
          >
            Delete
          </button>
        </div>

        {panel === "change" && <ChangeForm med={med} onDone={() => setPanel("none")} />}
        {panel === "stop" && <StopForm med={med} onDone={() => setPanel("none")} />}
        {panel === "edit" && <EditForm med={med} onDone={() => setPanel("none")} />}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold" style={{ marginBottom: 4 }}>
          History
        </h2>
        <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 10 }}>
          Newest first. Every dose and schedule change stays here.
        </p>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {med.changes.map((c) => (
            <li
              key={c.id}
              style={{
                borderLeft: "2px solid #334155",
                paddingLeft: 10,
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 14 }}>
                  <span style={{ color: "#e2e8f0" }}>{changeSummary(c)}</span>
                </div>
                <div style={{ color: "#64748b", fontSize: 12 }}>
                  {formatDay(c.effective_on)} · {changeLabel(c.kind)}
                </div>
                {c.note && (
                  <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 2 }}>{c.note}</div>
                )}
              </div>
              {c.kind !== "started" && (
                <button
                  type="button"
                  aria-label="Delete entry"
                  style={{ ...ghostBtn, alignSelf: "start" }}
                  disabled={removeChange.isPending}
                  onClick={() => removeChange.mutate({ id: med.id, changeId: c.id })}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

// `useSearchParams` needs a Suspense boundary to prerender under static export.
export default function MedicationDetailPage() {
  return (
    <Suspense fallback={<p style={{ color: "#94a3b8" }}>Loading…</p>}>
      <MedicationDetail />
    </Suspense>
  );
}
