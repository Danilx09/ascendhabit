import { createClient } from "@/lib/supabase/server";
import { JournalView } from "@/components/journal/JournalView";
import { pageTitle } from "@/lib/i18n/metadata";
import type { JournalDay } from "@/types/app";

export const generateMetadata = pageTitle("journal");

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const validDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const { data, error } = await supabase.rpc("get_journal_day", { p_date: validDate });
  if (error) throw new Error(error.message);

  return <JournalView userId={auth?.claims?.sub as string} day={data as JournalDay} />;
}
