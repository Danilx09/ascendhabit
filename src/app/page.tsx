import { createClient } from "@/lib/supabase/server";

// Página temporal del Paso 1: confirma que Next.js + Supabase están conectados.
// En el Paso 2 se reemplaza por login + pantalla "Hoy".
export default async function Home() {
  const configured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  let status: "ok" | "error" | "missing-env" = "missing-env";
  let detail = "Falta configurar .env.local";

  if (configured) {
    const supabase = await createClient();
    // RPC protegida: sin sesión debe responder "permission denied".
    // Si responde eso, la base de datos y la migración están en su sitio.
    const { error } = await supabase.rpc("get_my_summary");
    if (error && /permission denied/i.test(error.message)) {
      status = "ok";
      detail = "Supabase conectado · migración aplicada · RPC protegidas";
    } else if (error) {
      status = "error";
      detail = error.message;
    } else {
      status = "ok";
      detail = "Supabase conectado";
    }
  }

  const color =
    status === "ok" ? "bg-emerald-500" : status === "error" ? "bg-red-500" : "bg-amber-500";

  return (
    <main className="safe-top safe-bottom mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-sm font-medium text-brand-500">Paso 1 · Inicialización</p>
        <h1 className="mt-1 text-4xl font-bold tracking-tight">AscendHabit</h1>
        <p className="mt-2 text-zinc-500">Hábitos individuales. Compromiso compartido.</p>
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <span className={`h-3 w-3 shrink-0 rounded-full ${color}`} />
        <span className="text-sm">{detail}</span>
      </div>
    </main>
  );
}
