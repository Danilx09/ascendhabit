import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { JournalView } from "@/components/journal/JournalView";
import type { JournalDay, JournalMonthItem } from "@/types/app";

export const metadata: Metadata = { title: "Diario · AscendHabit" };

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const validDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const { data, error } = await supabase.rpc("get_journal_day", { p_date: validDate });
  if (error) throw new Error(error.message);
  const day = data as JournalDay;

  const month = await supabase.rpc("get_journal_month", { p_month: day.date });
  if (month.error) throw new Error(month.error.message);

  return (
    <JournalView
      userId={auth?.claims?.sub as string}
      day={day}
      month={(month.data ?? []) as JournalMonthItem[]}
    />
  );
}
