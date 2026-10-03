import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Entrar · AscendHabit" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const initialError =
    error === "link" ? "El enlace no es válido o ya expiró. Pide un código nuevo." : null;

  return (
    <main className="safe-top safe-bottom mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="mb-10">
        <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-brand-500 text-2xl text-white shadow-lg shadow-brand-500/30">
          ↗
        </div>
        <h1 className="text-3xl font-bold tracking-tight">AscendHabit</h1>
        <p className="mt-1 text-zinc-500">Hábitos individuales. Compromiso compartido.</p>
      </div>
      <LoginForm initialError={initialError} />
    </main>
  );
}
