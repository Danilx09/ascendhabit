"use client";

import { BRAND_COLOR, formatNumber, frequencyLabel, isQuantitative, progressLabel, stepFor } from "@/lib/habits";
import type { TodayHabit } from "@/types/app";

export function HabitCard({
  habit: h,
  onSetValue,
  onOpen,
  disabled = false,
}: {
  habit: TodayHabit;
  onSetValue: (value: number) => void;
  onOpen: () => void;
  disabled?: boolean;
}) {
  const color = h.color ?? BRAND_COLOR;
  const quantitative = isQuantitative(h);
  const step = stepFor(h);
  const ratio = Math.min(1, h.value_today / h.target_value);
  const weekly = h.frequency_type === "times_per_week";

  const subtitle = weekly
    ? `${h.week_done}/${h.times_per_week} esta semana`
    : quantitative
      ? progressLabel(h)
      : frequencyLabel(h);

  function onAction() {
    if (disabled) return;
    if (!quantitative) return onSetValue(h.done_today ? 0 : 1);
    if (h.done_today) return onOpen();
    // El "+" se detiene en la meta; para pasarse de la meta, usar la hoja de detalle
    onSetValue(Math.min(h.target_value, h.value_today + step));
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
        h.done_today
          ? "border-transparent bg-zinc-100 dark:bg-zinc-900/60"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl"
          style={{ backgroundColor: `${color}22` }}
        >
          {h.icon ?? "✨"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={`truncate font-medium ${h.done_today ? "text-zinc-500" : ""}`}>{h.name}</span>
            {h.priority === 1 && (
              <span className="shrink-0 rounded bg-red-500/10 px-1 text-[10px] font-semibold text-red-500">ALTA</span>
            )}
          </span>
          <span className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="truncate">{subtitle}</span>
            {h.current_streak > 0 && (
              <span className="shrink-0 font-medium text-orange-500">
                🔥 {h.current_streak}
                {h.streak_unit === "weeks" ? " sem" : ""}
              </span>
            )}
          </span>
          {quantitative && !weekly && (
            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <span
                className="block h-full rounded-full transition-[width] duration-300"
                style={{ width: `${ratio * 100}%`, backgroundColor: h.done_today ? "#10B981" : color }}
              />
            </span>
          )}
        </span>
      </button>

      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        aria-label={h.done_today ? `Desmarcar ${h.name}` : `Registrar ${h.name}`}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 text-sm font-bold transition active:scale-90 disabled:opacity-40"
        style={
          h.done_today
            ? { backgroundColor: "#10B981", borderColor: "#10B981", color: "white" }
            : { borderColor: color, color }
        }
      >
        {h.done_today ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
            <path d="m5 12 5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : quantitative ? (
          `+${formatNumber(step)}`
        ) : null}
      </button>
    </div>
  );
}
