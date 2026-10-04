"use client";

import Link from "next/link";
import { useState } from "react";
import { formatNumber, frequencyLabel, isQuantitative, stepFor, streakLabel } from "@/lib/habits";
import { Sheet } from "@/components/ui/Sheet";
import type { TodayHabit } from "@/types/app";

export function ProgressSheet({
  habit: h,
  onClose,
  onSave,
}: {
  habit: TodayHabit;
  onClose: () => void;
  onSave: (value: number) => void;
}) {
  const [value, setValue] = useState(h.value_today);
  const quantitative = isQuantitative(h);
  const step = stepFor(h);
  const unit = h.unit ?? (h.goal_type === "duration" ? "min" : "");

  return (
    <Sheet onClose={onClose}>
      <div className="flex items-start gap-4">
        <span className="mono text-3xl">{h.icon ?? "·"}</span>
        <div className="min-w-0">
          <h2 className="font-serif text-2xl leading-tight">{h.name}</h2>
          <p className="mt-1 text-sm text-ink-3">{frequencyLabel(h)}</p>
        </div>
      </div>
      {h.description && <p className="mt-4 text-sm text-ink-2">{h.description}</p>}

      <dl className="mt-6 grid grid-cols-3 border-y border-line text-center">
        <Stat label="Racha" value={streakLabel(h.current_streak, h.streak_unit)} />
        <Stat label="Mejor" value={streakLabel(h.best_streak, h.streak_unit)} border />
        <Stat
          label="Semana"
          value={h.frequency_type === "times_per_week" ? `${h.week_done}/${h.times_per_week}` : `${h.week_done}`}
          border
        />
      </dl>

      {!h.scheduled_today ? (
        <p className="mt-6 text-center text-sm text-ink-3">Este hábito no está programado para hoy.</p>
      ) : quantitative ? (
        <>
          <div className="mt-8 flex items-center justify-center gap-6">
            <RoundButton onClick={() => setValue((v) => Math.max(0, v - step))} label="Restar">
              −
            </RoundButton>
            <label className="flex flex-col items-center">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={Number.isNaN(value) ? "" : value}
                onChange={(e) => setValue(e.target.value === "" ? 0 : Number(e.target.value))}
                className="w-28 bg-transparent text-center font-serif text-5xl tabular-nums outline-none"
              />
              <span className="mt-1 text-sm text-ink-3">
                de {formatNumber(h.target_value)} {unit}
              </span>
            </label>
            <RoundButton onClick={() => setValue((v) => v + step)} label="Sumar">
              +
            </RoundButton>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => onSave(h.target_value)} className="btn btn-ghost">
              Completar meta
            </button>
            <button type="button" onClick={() => onSave(Math.max(0, value))} className="btn btn-primary">
              Guardar
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => onSave(h.done_today ? 0 : 1)}
          className={`btn mt-8 w-full ${h.done_today ? "btn-ghost" : "btn-primary"}`}
        >
          {h.done_today ? "Marcar como pendiente" : "Marcar como hecho"}
        </button>
      )}

      <Link href={`/habits/${h.id}`} className="mt-6 block text-center text-sm text-ink-2 underline underline-offset-4">
        Ver calendario y estadísticas
      </Link>
    </Sheet>
  );
}

function Stat({ label, value, border = false }: { label: string; value: string; border?: boolean }) {
  return (
    <div className={`px-2 py-3 ${border ? "border-l border-line" : ""}`}>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}

function RoundButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-12 w-12 place-items-center rounded-full border border-line text-2xl font-light transition active:scale-90"
    >
      {children}
    </button>
  );
}
