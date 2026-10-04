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
    <section className="space-y-2">
      {!archived && (
        <Link
          href={`/habits/${habitId}/edit`}
          className="block w-full rounded-xl bg-brand-600 py-3 text-center font-semibold text-white"
        >
          Editar hábito
        </Link>
      )}
      <button
        type="button"
        onClick={toggleArchive}
        disabled={busy}
        className="w-full rounded-xl border border-zinc-300 py-3 font-medium disabled:opacity-50 dark:border-zinc-700"
      >
        {archived ? "Restaurar (empieza de nuevo hoy)" : "Archivar"}
      </button>
      {!archived && (
        <p className="px-1 text-xs text-zinc-500">
          Archivar lo saca de Hoy sin perder el historial. Si lo restauras, la racha empieza desde ese día.
        </p>
      )}

      {!confirmDelete ? (
        <button type="button" onClick={() => setConfirmDelete(true)} className="w-full py-2 text-sm text-red-500">
          Eliminar hábito
        </button>
      ) : (
        <div className="rounded-2xl border border-red-500/30 p-4">
          <p className="text-sm">
            Se borrarán el hábito, todo su historial y sus solicitudes de rescate. Esto no se puede deshacer.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-xl border border-zinc-300 py-2 text-sm dark:border-zinc-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="rounded-xl bg-red-500 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Eliminar para siempre
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </section>
  );
}
