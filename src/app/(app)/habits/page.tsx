import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { frequencyLabel, streakLabel } from "@/lib/habits";
import { RestoreButton } from "@/components/habits/RestoreButton";
import { HabitsTabs } from "@/components/habits/HabitsTabs";
import { HabitList } from "@/components/habits/HabitList";
import { getT } from "@/lib/i18n/server";
import { pageTitle } from "@/lib/i18n/metadata";
import type { HabitRow } from "@/types/app";

export const generateMetadata = pageTitle("habits");

type Streak = { habit_id: string; current_streak: number; streak_unit: "days" | "weeks" };

export default async function HabitsPage() {
  const supabase = await createClient();
  const t = await getT();
  const [habits, streaks] = await Promise.all([
    supabase.from("habits").select("*").order("sort_order").order("created_at"),
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
      <header className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow">{t.habits.active(active.length)}</p>
            <h1 className="mt-2 font-serif text-4xl tracking-tight">{t.titles.habits}</h1>
          </div>
          <Link href="/habits/new" className="btn btn-primary">
            {t.habits.new}
          </Link>
        </div>
        <HabitsTabs active="list" />
      </header>

      {active.length === 0 ? (
        <p className="border-y border-line py-10 text-center text-sm text-ink-3">{t.habits.none}</p>
      ) : (
        <HabitList
          items={active.map((h) => {
            const st = streakById.get(h.id);
            return {
              id: h.id,
              icon: h.icon,
              name: h.name,
              isPrivate: !h.share_with_partner,
              high: h.priority === 1,
              frequency: frequencyLabel(h, t),
              streak: st && st.current_streak > 0 ? streakLabel(st.current_streak, st.streak_unit, t) : null,
            };
          })}
        />
      )}

      {archived.length > 0 && (
        <section>
          <h2 className="eyebrow mb-1">{t.habits.archived(archived.length)}</h2>
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
