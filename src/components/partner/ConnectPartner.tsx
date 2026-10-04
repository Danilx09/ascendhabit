"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ConnectPartner({ inviteCode }: { inviteCode: string }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function share() {
    const text = `Sé mi socio en AscendHabit 💪 Entra en ${window.location.origin} y usa mi código: ${inviteCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "AscendHabit", text });
        return;
      }
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // El usuario canceló el menú de compartir
    }
  }

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.rpc("connect_partner", { p_invite_code: code.trim() });
    setLoading(false);
    if (error) return setError(error.message);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-brand-600 to-violet-600 p-6 text-center text-white shadow-lg shadow-brand-600/20">
        <p className="text-4xl">🤝</p>
        <p className="mt-3 text-lg font-semibold">Hábitos individuales, compromiso compartido</p>
        <p className="mt-1 text-sm text-white/80">
          Tu socio verá tu % del día y tus rachas, y podrá aprobar tus rescates. Nunca verá tus hábitos privados.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 p-5 text-center dark:border-zinc-800">
        <p className="text-sm text-zinc-500">Tu código de socio</p>
        <p className="mt-2 font-mono text-3xl font-bold tracking-[0.25em] text-brand-500">{inviteCode}</p>
        <button
          type="button"
          onClick={share}
          className="mt-4 w-full rounded-xl border border-zinc-300 py-2.5 font-medium dark:border-zinc-700"
        >
          {copied ? "¡Copiado! ✓" : "Compartir código"}
        </button>
      </div>

      <form onSubmit={connect} className="space-y-3 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
        <p className="text-sm font-medium">¿Tu socio ya te pasó su código?</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          maxLength={8}
          placeholder="ABCD1234"
          autoCapitalize="characters"
          autoComplete="off"
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-center font-mono text-xl tracking-[0.3em] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading || code.length !== 8}
          className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Conectando…" : "Conectar con mi socio"}
        </button>
      </form>
    </div>
  );
}
