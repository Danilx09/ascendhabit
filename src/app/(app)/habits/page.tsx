import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { frequencyLabel, streakLabel } from "@/lib/habits";
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
    <div className="space-y-10">
      <header className="flex items-end justify-between">
        <div>
          <p className="eyebrow">{active.length} activos</p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight">Hábitos</h1>
        </div>
        <Link href="/habits/new" className="btn btn-primary">
          Nuevo
        </Link>
      </header>

      {active.length === 0 ? (
        <p className="border-y border-line py-10 text-center text-sm text-ink-3">No tienes hábitos activos.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {active.map((h) => {
            const s = streakById.get(h.id);
            return (
              <li key={h.id}>
                <Link href={`/habits/${h.id}`} className="flex items-center gap-4 py-4">
                  <span className="mono w-6 text-center text-xl">{h.icon ?? "·"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">
                      {h.name}
                      {!h.share_with_partner && <span className="ml-2 text-xs text-ink-3">privado</span>}
                    </span>
                    <span className="text-xs text-ink-3">{frequencyLabel(h)}</span>
                  </span>
                  {s && s.current_streak > 0 && (
                    <span className="shrink-0 text-sm tabular-nums text-ink-2">
                      {streakLabel(s.current_streak, s.streak_unit)}
                    </span>
                  )}
                  <span className="text-ink-3" aria-hidden>
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {archived.length > 0 && (
        <section>
          <h2 className="eyebrow mb-1">Archivados · {archived.length}</h2>
          <ul className="divide-y divide-line border-y border-line">
            {archived.map((h) => (
              <li key={h.id} className="flex items-center gap-4 py-3">
                <span className="mono w-6 text-center opacity-50">{h.icon ?? "·"}</span>
                <Link href={`/habits/${h.id}`} className="min-w-0 flex-1 truncate text-sm text-ink-3">
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
