"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function HabitActions({ habitId, archived }: { habitId: string; archived: boolean }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleArchive() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("set_habit_archived", { p_habit_id: habitId, p_archived: !archived });
    setBusy(false);
    if (error) return setError(error.message);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("habits").delete().eq("id", habitId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    router.replace("/habits");
    router.refresh();
  }

  return (
    <section className="space-y-3 border-t border-line pt-8">
      {!archived && (
        <Link href={`/habits/${habitId}/edit`} className="btn btn-primary w-full">
          Editar hábito
        </Link>
      )}
      <button type="button" onClick={toggleArchive} disabled={busy} className="btn btn-ghost w-full">
        {archived ? "Restaurar · empieza de nuevo hoy" : "Archivar"}
      </button>
      {!archived && (
        <p className="text-center text-xs text-ink-3">
          Archivar lo saca de Hoy sin perder el historial. Al restaurarlo, la racha empieza ese día.
        </p>
      )}

      {!confirmDelete ? (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="block w-full pt-4 text-center text-sm text-ink-3 underline underline-offset-4"
        >
          Eliminar hábito
        </button>
      ) : (
        <div className="border border-ink p-4">
          <p className="text-sm">Se borrarán el hábito, todo su historial y sus rescates. No se puede deshacer.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setConfirmDelete(false)} className="btn btn-ghost">
              Cancelar
            </button>
            <button type="button" onClick={remove} disabled={busy} className="btn btn-primary">
              Eliminar
            </button>
          </div>
        </div>
      )}
      {error && <p className="border-l-2 border-ink pl-3 text-sm">{error}</p>}
    </section>
  );
}
