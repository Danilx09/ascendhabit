import { createClient } from "@/lib/supabase/server";
import { TodayView } from "@/components/today/TodayView";
import { pageTitle } from "@/lib/i18n/metadata";
import type { RecoverableMiss, TodayData } from "@/types/app";

export const generateMetadata = pageTitle("today");

export default async function TodayPage() {
  const supabase = await createClient();
  const [today, misses] = await Promise.all([
    supabase.rpc("get_today"),
    supabase.rpc("get_recoverable_misses"),
  ]);
  if (today.error) throw new Error(today.error.message);
  if (misses.error) throw new Error(misses.error.message);

  return <TodayView data={today.data as TodayData} misses={(misses.data ?? []) as RecoverableMiss[]} />;
}
