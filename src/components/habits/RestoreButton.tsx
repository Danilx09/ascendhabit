"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RestoreButton({ habitId }: { habitId: string }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(false);

  async function restore() {
    setLoading(true);
    const { error } = await supabase.rpc("set_habit_archived", { p_habit_id: habitId, p_archived: false });
    setLoading(false);
    if (!error) router.refresh();
  }

  return (
    <button
      type="button"
      onClick={restore}
      disabled={loading}
      className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium disabled:opacity-50 dark:border-zinc-700"
    >
      {loading ? "…" : "Restaurar"}
    </button>
  );
}
