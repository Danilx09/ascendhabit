import Link from "next/link";
import { addMonths, formatMonth, formatShortDate, isoWeekday } from "@/lib/dates";
import { formatNumber, unitOf } from "@/lib/habits";
import type { Dict } from "@/lib/i18n";
import type { CalendarDay, HabitDetail } from "@/types/app";

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

/**
 * Calendario mensual monocromo. Cada estado se distingue por FORMA:
 * círculo lleno = hecho · contorno doble = rescatado · contorno discontinuo = parcial
 * · barra diagonal = fallado. Hay leyenda y cada día describe su estado (title/aria-label).
 */
export function HabitCalendar({ detail, t }: { detail: HabitDetail; t: Dict }) {
  const { habit, days, today, month } = detail;
  const weekly = habit.frequency_type === "times_per_week";
  const unit = unitOf(habit);
  const leading = days.length ? isoWeekday(days[0].date) - 1 : 0;
  const currentMonth = today.slice(0, 7) + "-01";
  const canGoNext = month < currentMonth;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <Link href={`?month=${addMonths(month, -1)}`} scroll={false} aria-label={t.calendar.prevMonth} className="px-2 py-1 text-ink-2">
          ←
        </Link>
        <h2 className="font-serif text-xl">{formatMonth(month, t.intl)}</h2>
        {canGoNext ? (
          <Link href={`?month=${addMonths(month, 1)}`} scroll={false} aria-label={t.calendar.nextMonth} className="px-2 py-1 text-ink-2">
            →
          </Link>
        ) : (
          <span className="w-8" />
        )}
      </div>

      <div className="grid grid-cols-7 gap-y-2 text-center">
        {t.weekdays.short.map((w, i) => (
          <span key={i} className="eyebrow pb-1">
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
              ? ` · ${formatNumber(day.value, t.intl)}/${formatNumber(day.target, t.intl)} ${unit}`
              : "";
          const tip = `${formatShortDate(day.date, t.intl)}${t.calendar.states[state] ? ` · ${t.calendar.states[state]}` : ""}${progress}`;

          const shape =
            state === "done"
              ? "bg-ink text-bg"
              : state === "recovered"
                ? "border border-ink outline outline-1 outline-offset-2 outline-ink"
                : state === "partial"
                  ? "border border-dashed border-ink"
                  : state === "future" || state === "off"
                    ? "text-ink-3"
                    : "";

          return (
            <span
              key={day.date}
              title={tip}
              aria-label={tip}
              className={`relative mx-auto grid h-9 w-9 place-items-center rounded-full text-sm tabular-nums ${shape} ${
                day.date === today && state !== "done" ? "font-semibold underline underline-offset-4" : ""
              }`}
            >
              {n}
              {state === "missed" && (
                <span aria-hidden className="pointer-events-none absolute h-px w-6 -rotate-45 bg-ink-3" />
              )}
            </span>
          );
        })}
      </div>

      {/* Leyenda: siempre visible, con las mismas formas */}
      <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-line pt-4 text-xs text-ink-3">
        <li className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-ink" /> {t.calendar.legend.done}
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border border-ink outline outline-1 outline-offset-1 outline-ink" /> {t.calendar.legend.recovered}
        </li>
        {habit.goal_type !== "boolean" && (
          <li className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border border-dashed border-ink" /> {t.calendar.legend.partial}
          </li>
        )}
        {!weekly && (
          <li className="flex items-center gap-2">
            <span className="relative grid h-3 w-3 place-items-center">
              <span className="absolute h-px w-3 -rotate-45 bg-ink-3" />
            </span>
            {t.calendar.legend.missed}
          </li>
        )}
      </ul>
    </section>
  );
}
