"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateDbError } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";

export function HabitActions({ habitId, archived }: { habitId: string; archived: boolean }) {
  const router = useRouter();
  const t = useT();
  const [supabase] = useState(() => createClient());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleArchive() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("set_habit_archived", { p_habit_id: habitId, p_archived: !archived });
    setBusy(false);
    if (error) return setError(translateDbError(error.message, t));
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("habits").delete().eq("id", habitId);
    if (error) {
      setBusy(false);
      return setError(translateDbError(error.message, t));
    }
    router.replace("/habits");
    router.refresh();
  }

  return (
    <section className="space-y-3 border-t border-line pt-8">
      {!archived && (
        <Link href={`/habits/${habitId}/edit`} className="btn btn-primary w-full">
          {t.detail.edit}
        </Link>
      )}
      <button type="button" onClick={toggleArchive} disabled={busy} className="btn btn-ghost w-full">
        {archived ? t.detail.restore : t.detail.archive}
      </button>
      {!archived && (
        <p className="text-center text-xs text-ink-3">
          {t.detail.archiveHint}
        </p>
      )}

      {!confirmDelete ? (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="block w-full pt-4 text-center text-sm text-ink-3 underline underline-offset-4"
        >
          {t.detail.deleteHabit}
        </button>
      ) : (
        <div className="border border-ink p-4">
          <p className="text-sm">{t.detail.deleteWarn}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setConfirmDelete(false)} className="btn btn-ghost">
              {t.common.cancel}
            </button>
            <button type="button" onClick={remove} disabled={busy} className="btn btn-primary">
              {t.detail.deleteConfirm}
            </button>
          </div>
        </div>
      )}
      {error && <p className="border-l-2 border-ink pl-3 text-sm">{error}</p>}
    </section>
  );
}
