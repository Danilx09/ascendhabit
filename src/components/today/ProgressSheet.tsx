"use client";

import { useEffect, useState } from "react";
import {
  BRAND_COLOR,
  formatNumber,
  frequencyLabel,
  isQuantitative,
  stepFor,
  streakLabel,
} from "@/lib/habits";
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
  const color = h.color ?? BRAND_COLOR;
  const unit = h.unit ?? (h.goal_type === "duration" ? "min" : "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="safe-bottom relative w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 shadow-2xl dark:bg-zinc-900">
        <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />

        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl text-2xl" style={{ backgroundColor: `${color}22` }}>
            {h.icon ?? "✨"}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{h.name}</h2>
            <p className="text-sm text-zinc-500">{frequencyLabel(h)}</p>
          </div>
        </div>
        {h.description && <p className="mt-3 text-sm text-zinc-500">{h.description}</p>}

        <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
          <Stat label="Racha" value={streakLabel(h.current_streak, h.streak_unit)} />
          <Stat label="Mejor" value={streakLabel(h.best_streak, h.streak_unit)} />
          <Stat
            label="Semana"
            value={h.frequency_type === "times_per_week" ? `${h.week_done}/${h.times_per_week}` : `${h.week_done} ✓`}
          />
        </dl>

        {!h.scheduled_today ? (
          <p className="mt-6 rounded-xl bg-zinc-100 p-3 text-center text-sm text-zinc-500 dark:bg-zinc-800">
            Este hábito no está programado para hoy.
          </p>
        ) : quantitative ? (
          <>
            <div className="mt-6 flex items-center justify-center gap-4">
              <RoundButton onClick={() => setValue((v) => Math.max(0, v - step))} label="Restar">−</RoundButton>
              <label className="flex flex-col items-center">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={Number.isNaN(value) ? "" : value}
                  onChange={(e) => setValue(e.target.value === "" ? 0 : Number(e.target.value))}
                  className="w-28 bg-transparent text-center text-4xl font-bold outline-none"
                />
                <span className="text-sm text-zinc-500">
                  de {formatNumber(h.target_value)} {unit}
                </span>
              </label>
              <RoundButton onClick={() => setValue((v) => v + step)} label="Sumar">+</RoundButton>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSave(h.target_value)}
                className="rounded-xl border border-zinc-300 py-3 font-medium dark:border-zinc-700"
              >
                Completar meta
              </button>
              <button
                type="button"
                onClick={() => onSave(Math.max(0, value))}
                className="rounded-xl bg-brand-600 py-3 font-semibold text-white"
              >
                Guardar
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onSave(h.done_today ? 0 : 1)}
            className={`mt-6 w-full rounded-xl py-3 font-semibold ${
              h.done_today ? "border border-zinc-300 dark:border-zinc-700" : "bg-emerald-500 text-white"
            }`}
          >
            {h.done_today ? "Marcar como pendiente" : "Marcar como hecho ✓"}
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-100 px-2 py-2.5 dark:bg-zinc-800">
      <dt className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  );
}

function RoundButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-12 w-12 place-items-center rounded-full bg-zinc-100 text-2xl font-medium transition active:scale-90 dark:bg-zinc-800"
    >
      {children}
    </button>
  );
}
