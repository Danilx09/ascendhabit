"use client";

import { formatNumber, frequencyLabel, isQuantitative, progressLabel, stepFor } from "@/lib/habits";
import type { TodayHabit } from "@/types/app";

/** Una línea de la libreta: icono, nombre, detalle y control a la derecha */
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
  const quantitative = isQuantitative(h);
  const step = stepFor(h);
  const ratio = Math.min(1, h.value_today / h.target_value);
  const weekly = h.frequency_type === "times_per_week";

  const detail = weekly
    ? `${h.week_done}/${h.times_per_week} esta semana`
    : quantitative
      ? progressLabel(h)
      : frequencyLabel(h);

  function onAction() {
    if (disabled) return;
    if (!quantitative) return onSetValue(h.done_today ? 0 : 1);
    if (h.done_today) return onOpen();
    // El "+" se detiene en la meta; para pasarse, usar la hoja de detalle
    onSetValue(Math.min(h.target_value, h.value_today + step));
  }

  return (
    <div className="flex items-center gap-4 py-4">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-4 text-left">
        <span className="mono w-6 shrink-0 text-center text-xl">{h.icon ?? "·"}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className={`truncate text-[15px] ${h.done_today ? "text-ink-3 line-through decoration-1" : ""}`}>
              {h.name}
            </span>
            {h.priority === 1 && <span className="shrink-0 text-[10px] tracking-[0.14em] text-ink-3">ALTA</span>}
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
            <span className="truncate">{detail}</span>
            {h.current_streak > 0 && (
              <span className="shrink-0 tabular-nums text-ink-2">
                — {h.current_streak} {h.streak_unit === "weeks" ? "sem" : h.current_streak === 1 ? "día" : "días"}
              </span>
            )}
          </span>
          {quantitative && !weekly && (
            <span className="mt-2 block h-px w-full bg-line">
              <span className="block h-px bg-ink transition-[width] duration-300" style={{ width: `${ratio * 100}%` }} />
            </span>
          )}
        </span>
      </button>

      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        aria-label={h.done_today ? `Desmarcar ${h.name}` : `Registrar ${h.name}`}
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs tabular-nums transition active:scale-90 disabled:opacity-40 ${
          h.done_today ? "bg-ink text-bg" : "border border-ink-3 text-ink-2 hover:border-ink"
        }`}
      >
        {h.done_today ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="m5 12 5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : quantitative ? (
          `+${formatNumber(step)}`
        ) : null}
      </button>
    </div>
  );
}
