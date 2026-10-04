import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { JournalCalendar } from "@/components/journal/JournalCalendar";
import type { JournalDay, JournalMonthItem, JournalYearItem } from "@/types/app";

export const metadata: Metadata = { title: "Historial del diario · AscendHabit" };

export default async function JournalHistoryPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  const supabase = await createClient();

  // "Hoy" en la zona horaria del usuario (lo calcula el servidor de base de datos)
  const { data: dayData, error: dayError } = await supabase.rpc("get_journal_day", { p_date: null });
  if (dayError) throw new Error(dayError.message);
  const today = (dayData as JournalDay).today;

  // Mes a mostrar: ?month=YYYY-MM (nunca en el futuro)
  const requested = month && /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : `${today.slice(0, 7)}-01`;
  const monthStart = requested > today ? `${today.slice(0, 7)}-01` : requested;
  const year = Number(monthStart.slice(0, 4));

  const [monthRes, yearRes] = await Promise.all([
    supabase.rpc("get_journal_month", { p_month: monthStart }),
    supabase.rpc("get_journal_year", { p_year: year }),
  ]);
  if (monthRes.error) throw new Error(monthRes.error.message);
  if (yearRes.error) throw new Error(yearRes.error.message);

  return (
    <div className="space-y-10">
      <header>
        <Link href="/journal" className="text-sm text-ink-3">
          ← Diario de hoy
        </Link>
        <h1 className="mt-4 font-serif text-4xl tracking-tight">Historial</h1>
        <p className="mt-2 text-sm text-ink-2">Toca cualquier día para leerlo o escribir sobre él.</p>
      </header>
      <JournalCalendar
        today={today}
        monthStart={monthStart}
        entries={(monthRes.data ?? []) as JournalMonthItem[]}
        yearSummary={(yearRes.data ?? []) as JournalYearItem[]}
      />
    </div>
  );
}
