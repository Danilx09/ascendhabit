import Link from "next/link";
import { formatMonth, formatShortDate, isoWeekday } from "@/lib/dates";
import { MOOD_LABELS } from "./constants";
import type { JournalMonthItem, JournalYearItem } from "@/types/app";

const WEEK_HEADER = ["L", "M", "X", "J", "V", "S", "D"];
const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function daysInMonth(monthStart: string) {
  const [y, m] = monthStart.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Calendario del diario: año ‹ › + tira de 12 meses + rejilla del mes.
 * Círculo lleno = escribiste en el diario · contorno = solo bitácora.
 */
export function JournalCalendar({
  today,
  monthStart,
  entries,
  yearSummary,
}: {
  today: string;
  monthStart: string;
  entries: JournalMonthItem[];
  yearSummary: JournalYearItem[];
}) {
  const year = Number(monthStart.slice(0, 4));
  const currentYear = Number(today.slice(0, 4));
  const todayMonth = `${today.slice(0, 7)}-01`;
  const byDate = new Map(entries.map((e) => [e.entry_date, e]));
  const total = daysInMonth(monthStart);
  const leading = isoWeekday(monthStart) - 1;
  const ym = monthStart.slice(0, 7);
  const monthLink = (y: number, m: number) => `/journal/history?month=${y}-${String(m).padStart(2, "0")}`;
  const yearCount = yearSummary.reduce((sum, m) => sum + m.entries, 0);

  return (
    <div className="space-y-10">
      {/* Año */}
      <section>
        <div className="flex items-center justify-between">
          <Link href={monthLink(year - 1, 12)} aria-label="Año anterior" className="px-2 py-1 text-ink-2">
            ←
          </Link>
          <div className="text-center">
            <p className="font-serif text-3xl tabular-nums">{year}</p>
            <p className="text-xs text-ink-3">
              {yearCount} {yearCount === 1 ? "día escrito" : "días escritos"}
            </p>
          </div>
          {year < currentYear ? (
            <Link href={monthLink(year + 1, 1)} aria-label="Año siguiente" className="px-2 py-1 text-ink-2">
              →
            </Link>
          ) : (
            <span className="w-8" />
          )}
        </div>

        {/* Tira de meses: el número es cuántos días tienen entrada */}
        <div className="mt-5 grid grid-cols-6 border-l border-t border-line">
          {MONTHS_SHORT.map((label, i) => {
            const mStart = `${year}-${String(i + 1).padStart(2, "0")}-01`;
            const count = yearSummary.find((y) => y.month === mStart)?.entries ?? 0;
            const future = mStart > todayMonth;
            const selected = mStart === monthStart;
            const cls = `flex flex-col items-center border-b border-r border-line py-2.5 text-xs transition ${
              selected ? "bg-ink text-bg" : future ? "text-ink-3 opacity-40" : "text-ink-2"
            }`;
            const inner = (
              <>
                <span>{label}</span>
                <span className="mt-0.5 font-serif text-base tabular-nums">{count || "·"}</span>
              </>
            );
            return future ? (
              <span key={label} className={cls} aria-disabled>
                {inner}
              </span>
            ) : (
              <Link key={label} href={monthLink(year, i + 1)} className={cls} aria-current={selected ? "date" : undefined}>
                {inner}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Mes */}
      <section>
        <h2 className="mb-4 text-center font-serif text-2xl">{formatMonth(monthStart)}</h2>
        <div className="grid grid-cols-7 gap-y-2 text-center">
          {WEEK_HEADER.map((w) => (
            <span key={w} className="eyebrow pb-1">
              {w}
            </span>
          ))}
          {Array.from({ length: leading }).map((_, i) => (
            <span key={`pad-${i}`} />
          ))}
          {Array.from({ length: total }).map((_, i) => {
            const date = `${ym}-${String(i + 1).padStart(2, "0")}`;
            const e = byDate.get(date);
            const future = date > today;
            const label = `${formatShortDate(date)}${
              e ? ` · ${e.has_journal ? "diario" : "bitácora"}${e.mood_score ? ` · energía ${e.mood_score}` : ""}` : ""
            }`;
            const shape = e?.has_journal
              ? "bg-ink text-bg"
              : e
                ? "border border-ink"
                : future
                  ? "text-ink-3 opacity-40"
                  : "text-ink-3";
            const cls = `mx-auto grid h-9 w-9 place-items-center rounded-full text-sm tabular-nums transition ${shape} ${
              date === today && !e?.has_journal ? "font-semibold text-ink underline underline-offset-4" : ""
            }`;
            return future ? (
              <span key={date} className={cls}>
                {i + 1}
              </span>
            ) : (
              <Link key={date} href={`/journal?date=${date}`} title={label} aria-label={label} className={cls}>
                {i + 1}
              </Link>
            );
          })}
        </div>

        <ul className="mt-6 flex justify-center gap-6 border-t border-line pt-4 text-xs text-ink-3">
          <li className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-ink" /> Diario escrito
          </li>
          <li className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border border-ink" /> Solo bitácora
          </li>
        </ul>
      </section>

      {/* Lista del mes */}
      {entries.length > 0 ? (
        <section>
          <h2 className="eyebrow mb-1">Entradas de {formatMonth(monthStart).toLowerCase()}</h2>
          <ul className="divide-y divide-line border-y border-line">
            {entries.map((m) => (
              <li key={m.entry_date}>
                <Link href={`/journal?date=${m.entry_date}`} className="flex items-center gap-4 py-3">
                  <span className="w-20 shrink-0 text-sm">{formatShortDate(m.entry_date)}</span>
                  <span
                    className="flex items-center gap-1"
                    aria-label={m.mood_score ? `Energía ${m.mood_score} de 5, ${MOOD_LABELS[m.mood_score]}` : "Sin energía registrada"}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={`h-1.5 w-1.5 rounded-full ${m.mood_score && n <= m.mood_score ? "bg-ink" : "bg-line"}`} />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm italic text-ink-2">{m.primary_emotion ?? ""}</span>
                  <span className="shrink-0 text-xs text-ink-3">
                    {[m.has_journal && "diario", m.has_reflection && "bitácora"].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="border-y border-line py-8 text-center text-sm text-ink-3">No hay entradas este mes.</p>
      )}
    </div>
  );
}
