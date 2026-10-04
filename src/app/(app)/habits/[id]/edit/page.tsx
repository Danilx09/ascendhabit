import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HabitForm } from "@/components/habits/HabitForm";
import { getT } from "@/lib/i18n/server";
import { pageTitle } from "@/lib/i18n/metadata";
import type { Category, HabitRow } from "@/types/app";

export const generateMetadata = pageTitle("editHabit");

export default async function EditHabitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const t = await getT();
  const [habit, categories] = await Promise.all([
    supabase.from("habits").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, name, name_en, color, icon").order("sort_order"),
  ]);
  if (habit.error) throw new Error(habit.error.message);
  if (!habit.data) notFound();
  if (categories.error) throw new Error(categories.error.message);

  return (
    <div className="space-y-8">
      <Link href={`/habits/${id}`} className="text-sm text-ink-3">
        {t.habits.backShort}
      </Link>
      <h1 className="font-serif text-4xl tracking-tight">{t.titles.editHabit}</h1>
      <HabitForm templates={[]} categories={(categories.data ?? []) as Category[]} initial={habit.data as HabitRow} />
    </div>
  );
}
