import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { JournalCalendar } from "@/components/journal/JournalCalendar";
import { getT } from "@/lib/i18n/server";
import { pageTitle } from "@/lib/i18n/metadata";
import type { JournalDay, JournalMonthItem, JournalYearItem } from "@/types/app";

export const generateMetadata = pageTitle("history");

export default async function JournalHistoryPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  const supabase = await createClient();
  const t = await getT();

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
          {t.history.back}
        </Link>
        <h1 className="mt-4 font-serif text-4xl tracking-tight">{t.history.title}</h1>
        <p className="mt-2 text-sm text-ink-2">{t.history.hint}</p>
      </header>
      <JournalCalendar
        t={t}
        today={today}
        monthStart={monthStart}
        entries={(monthRes.data ?? []) as JournalMonthItem[]}
        yearSummary={(yearRes.data ?? []) as JournalYearItem[]}
      />
    </div>
  );
}
