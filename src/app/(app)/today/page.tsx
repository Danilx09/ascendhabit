import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { TodayView } from "@/components/today/TodayView";
import type { TodayData } from "@/types/app";

export const metadata: Metadata = { title: "Hoy · AscendHabit" };

export default async function TodayPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_today");
  if (error) throw new Error(error.message);

  return <TodayView data={data as TodayData} />;
}
