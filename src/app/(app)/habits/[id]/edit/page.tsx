import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HabitForm } from "@/components/habits/HabitForm";
import type { Category, HabitRow } from "@/types/app";

export const metadata: Metadata = { title: "Editar hábito · AscendHabit" };

export default async function EditHabitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [habit, categories] = await Promise.all([
    supabase.from("habits").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, name, color, icon").order("sort_order"),
  ]);
  if (habit.error) throw new Error(habit.error.message);
  if (!habit.data) notFound();
  if (categories.error) throw new Error(categories.error.message);

  return (
    <div className="space-y-6">
      <Link href={`/habits/${id}`} className="text-sm text-zinc-500">
        ‹ Volver
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Editar hábito</h1>
      <HabitForm
        templates={[]}
        categories={(categories.data ?? []) as Category[]}
        initial={habit.data as HabitRow}
      />
    </div>
  );
}
