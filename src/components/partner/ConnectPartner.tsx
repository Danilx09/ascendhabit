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
    const text = `Sé mi socio en AscendHabit. Entra en ${window.location.origin} y usa mi código: ${inviteCode}`;
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
    <div className="space-y-10">
      <p className="font-serif text-2xl leading-snug">
        Hábitos individuales, compromiso compartido.
        <span className="text-ink-3"> Tu socio verá tu % del día y tus rachas, y podrá aprobar tus rescates. Nunca tus hábitos privados ni tu diario.</span>
      </p>

      <section className="border-y border-line py-6 text-center">
        <p className="eyebrow">Tu código de socio</p>
        <p className="mt-3 font-serif text-4xl tracking-[0.2em]">{inviteCode}</p>
        <button type="button" onClick={share} className="btn btn-ghost mt-5">
          {copied ? "Copiado" : "Compartir código"}
        </button>
      </section>

      <form onSubmit={connect} className="space-y-5">
        <p className="eyebrow">¿Ya tienes el código de tu socio?</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          maxLength={8}
          placeholder="ABCD1234"
          autoCapitalize="characters"
          autoComplete="off"
          className="field text-center font-serif text-2xl tracking-[0.3em]"
        />
        {error && <p className="border-l-2 border-ink pl-3 text-sm">{error}</p>}
        <button type="submit" disabled={loading || code.length !== 8} className="btn btn-primary w-full">
          {loading ? "Conectando…" : "Conectar con mi socio"}
        </button>
      </form>
    </div>
  );
}
