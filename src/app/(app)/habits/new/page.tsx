import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { HabitForm } from "@/components/habits/HabitForm";
import type { Category, HabitTemplate } from "@/types/app";

export const metadata: Metadata = { title: "Nuevo hábito · AscendHabit" };

export default async function NewHabitPage() {
  const supabase = await createClient();
  const [templates, categories] = await Promise.all([
    supabase.from("habit_templates").select("*").order("sort_order"),
    supabase.from("categories").select("id, name, color, icon").order("sort_order"),
  ]);
  if (templates.error) throw new Error(templates.error.message);
  if (categories.error) throw new Error(categories.error.message);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Nuevo hábito</h1>
      <HabitForm
        templates={(templates.data ?? []) as HabitTemplate[]}
        categories={(categories.data ?? []) as Category[]}
      />
    </div>
  );
}
