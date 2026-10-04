import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings/SettingsForm";

export const metadata: Metadata = { title: "Ajustes · AscendHabit" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub as string;
  const email = (auth?.claims?.email as string | undefined) ?? "";

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, timezone")
    .eq("id", userId)
    .single();
  if (error) throw new Error(error.message);

  return (
    <div className="space-y-10">
      <h1 className="font-serif text-4xl tracking-tight">Ajustes</h1>
      <SettingsForm userId={userId} email={email} initialName={profile.display_name ?? ""} initialTimezone={profile.timezone} />
    </div>
  );
}
