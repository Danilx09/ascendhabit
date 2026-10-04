import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BRAND_COLOR, frequencyLabel, streakLabel } from "@/lib/habits";
import { RestoreButton } from "@/components/habits/RestoreButton";
import type { HabitRow } from "@/types/app";

export const metadata: Metadata = { title: "Hábitos · AscendHabit" };

type Streak = { habit_id: string; current_streak: number; streak_unit: "days" | "weeks" };

export default async function HabitsPage() {
  const supabase = await createClient();
  const [habits, streaks] = await Promise.all([
    supabase.from("habits").select("*").order("priority").order("sort_order").order("created_at"),
    supabase.rpc("get_my_habit_streaks"),
  ]);
  if (habits.error) throw new Error(habits.error.message);
  if (streaks.error) throw new Error(streaks.error.message);

  const rows = (habits.data ?? []) as HabitRow[];
  const streakById = new Map(((streaks.data ?? []) as Streak[]).map((s) => [s.habit_id, s]));
  const active = rows.filter((h) => !h.archived_on);
  const archived = rows.filter((h) => h.archived_on);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Hábitos</h1>
        <Link href="/habits/new" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
          + Nuevo
        </Link>
      </header>

      {active.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No tienes hábitos activos.
        </p>
      ) : (
        <ul className="space-y-2">
          {active.map((h) => {
            const s = streakById.get(h.id);
            return (
              <li key={h.id}>
                <Link
                  href={`/habits/${h.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 transition active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl"
                    style={{ backgroundColor: `${h.color ?? BRAND_COLOR}22` }}
                  >
                    {h.icon ?? "✨"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{h.name}</span>
                      {!h.share_with_partner && <span className="text-xs" title="Privado">🔒</span>}
                    </span>
                    <span className="text-xs text-zinc-500">{frequencyLabel(h)}</span>
                  </span>
                  {s && s.current_streak > 0 && (
                    <span className="shrink-0 text-sm font-semibold text-orange-500">
                      🔥 {streakLabel(s.current_streak, s.streak_unit)}
                    </span>
                  )}
                  <span className="text-zinc-400">›</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {archived.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Archivados ({archived.length})
          </h2>
          <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {archived.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-lg opacity-60">{h.icon ?? "✨"}</span>
                <Link href={`/habits/${h.id}`} className="min-w-0 flex-1 truncate text-sm text-zinc-500">
                  {h.name}
                </Link>
                <RestoreButton habitId={h.id} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
