import Link from "next/link";
import { addMonths, formatMonth, formatShortDate, isoWeekday } from "@/lib/dates";
import { BRAND_COLOR, formatNumber } from "@/lib/habits";
import type { CalendarDay, HabitDetail } from "@/types/app";

const WEEK_HEADER = ["L", "M", "X", "J", "V", "S", "D"];

type DayState = "done" | "recovered" | "partial" | "missed" | "pending" | "off" | "future";

function stateOf(day: CalendarDay, today: string, weekly: boolean): DayState {
  if (day.date > today) return "future";
  if (day.recovered) return "recovered";
  if (day.done) return "done";
  if (!day.scheduled) return "off";
  if (day.value > 0) return "partial";
  if (day.date === today) return "pending";
  return weekly ? "off" : "missed"; // en hábitos semanales un día sin registro no es un fallo
}

const STATE_LABEL: Record<DayState, string> = {
  done: "Hecho",
  recovered: "Rescatado por tu socio",
  partial: "Parcial",
  missed: "Fallado",
  pending: "Pendiente",
  off: "No programado",
  future: "",
};

/**
 * Calendario mensual. Cada estado lleva forma/icono además de color
 * (relleno = hecho, 🛡 = rescatado, borde discontinuo = parcial, punto = fallado)
 * para no depender solo del color.
 */
export function HabitCalendar({ detail }: { detail: HabitDetail }) {
  const { habit, days, today, month } = detail;
  const color = habit.color ?? BRAND_COLOR;
  const weekly = habit.frequency_type === "times_per_week";
  const unit = habit.unit ?? (habit.goal_type === "duration" ? "min" : "");
  const leading = days.length ? isoWeekday(days[0].date) - 1 : 0;
  const currentMonth = today.slice(0, 7) + "-01";
  const canGoNext = month < currentMonth;

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <Link
          href={`?month=${addMonths(month, -1)}`}
          scroll={false}
          aria-label="Mes anterior"
          className="grid h-9 w-9 place-items-center rounded-full text-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          ‹
        </Link>
        <h2 className="font-semibold">{formatMonth(month)}</h2>
        {canGoNext ? (
          <Link
            href={`?month=${addMonths(month, 1)}`}
            scroll={false}
            aria-label="Mes siguiente"
            className="grid h-9 w-9 place-items-center rounded-full text-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ›
          </Link>
        ) : (
          <span className="h-9 w-9" />
        )}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEK_HEADER.map((w) => (
          <span key={w} className="pb-1 text-[11px] font-medium text-zinc-400">
            {w}
          </span>
        ))}
        {Array.from({ length: leading }).map((_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {days.map((day) => {
          const state = stateOf(day, today, weekly);
          const n = Number(day.date.slice(8));
          const progress =
            habit.goal_type !== "boolean" && day.value > 0
              ? ` · ${formatNumber(day.value)}/${formatNumber(day.target)} ${unit}`
              : "";
          const tip = `${formatShortDate(day.date)}${STATE_LABEL[state] ? ` · ${STATE_LABEL[state]}` : ""}${progress}`;

          return (
            <span
              key={day.date}
              title={tip}
              aria-label={tip}
              className={`relative mx-auto grid aspect-square w-full max-w-10 place-items-center rounded-full text-sm ${
                day.date === today ? "ring-2 ring-zinc-400 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900" : ""
              } ${state === "future" || state === "off" ? "text-zinc-300 dark:text-zinc-600" : ""}`}
              style={
                state === "done"
                  ? { backgroundColor: color, color: "white", fontWeight: 600 }
                  : state === "recovered"
                    ? { backgroundColor: `${color}55`, fontWeight: 600 }
                    : state === "partial"
                      ? { border: `2px dashed ${color}` }
                      : undefined
              }
            >
              {n}
              {state === "recovered" && <span className="absolute -right-1 -top-1 text-[10px]">🛡</span>}
              {state === "missed" && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-red-500" />}
            </span>
          );
        })}
      </div>

      {/* Leyenda: siempre presente, con la misma forma que en el calendario */}
      <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[11px] text-zinc-500">
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} /> Hecho
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: `${color}55` }} /> 🛡 Rescatado
        </li>
        {habit.goal_type !== "boolean" && (
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full" style={{ border: `2px dashed ${color}` }} /> Parcial
          </li>
        )}
        {!weekly && (
          <li className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Fallado
          </li>
        )}
      </ul>
    </section>
  );
}
