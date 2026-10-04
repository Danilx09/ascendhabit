import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HabitForm } from "@/components/habits/HabitForm";
import { getT } from "@/lib/i18n/server";
import { pageTitle } from "@/lib/i18n/metadata";
import type { Category, HabitTemplate } from "@/types/app";

export const generateMetadata = pageTitle("newHabit");

export default async function NewHabitPage() {
  const supabase = await createClient();
  const t = await getT();
  const [templates, categories] = await Promise.all([
    supabase.from("habit_templates").select("*").order("sort_order"),
    supabase.from("categories").select("id, name, name_en, color, icon").order("sort_order"),
  ]);
  if (templates.error) throw new Error(templates.error.message);
  if (categories.error) throw new Error(categories.error.message);

  return (
    <div className="space-y-8">
      <Link href="/habits" className="text-sm text-ink-3">
        {t.habits.back}
      </Link>
      <h1 className="font-serif text-4xl tracking-tight">{t.titles.newHabit}</h1>
      <HabitForm
        templates={(templates.data ?? []) as HabitTemplate[]}
        categories={(categories.data ?? []) as Category[]}
      />
    </div>
  );
}
