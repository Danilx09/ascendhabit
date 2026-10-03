import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Socio · AscendHabit" };

// Paso 3: aquí irá el Panel de Accountability y las solicitudes de rescate.
export default async function PartnerPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const { data: profile } = await supabase
    .from("profiles")
    .select("invite_code")
    .eq("id", auth?.claims?.sub as string)
    .single();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Socio</h1>
      <div className="rounded-3xl border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
        <p className="text-4xl">🤝</p>
        <p className="mt-3 font-semibold">Panel de Accountability</p>
        <p className="mt-1 text-sm text-zinc-500">Llega en el Paso 3. Mientras tanto, este es tu código de socio:</p>
        <p className="mt-4 font-mono text-3xl font-bold tracking-[0.25em] text-brand-500">
          {profile?.invite_code ?? "········"}
        </p>
      </div>
    </div>
  );
}
