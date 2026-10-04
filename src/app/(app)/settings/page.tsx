import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { ReminderSettings } from "@/components/settings/ReminderSettings";
import { getT } from "@/lib/i18n/server";
import { pageTitle } from "@/lib/i18n/metadata";

export const generateMetadata = pageTitle("settings");

export default async function SettingsPage() {
  const supabase = await createClient();
  const t = await getT();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub as string;
  const email = (auth?.claims?.email as string | undefined) ?? "";

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, timezone, reminder_enabled, reminder_hour")
    .eq("id", userId)
    .single();
  if (error) throw new Error(error.message);

  return (
    <div className="space-y-12">
      <h1 className="font-serif text-4xl tracking-tight">{t.titles.settings}</h1>
      <ReminderSettings
        userId={userId}
        email={email}
        initialEnabled={profile.reminder_enabled}
        initialHour={profile.reminder_hour}
      />
      <SettingsForm userId={userId} email={email} initialName={profile.display_name ?? ""} initialTimezone={profile.timezone} />
    </div>
  );
}
