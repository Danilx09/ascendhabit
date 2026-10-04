import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Entrar · AscendHabit" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const initialError = error === "link" ? "El enlace no es válido o ya expiró. Pide un código nuevo." : null;

  return (
    <main className="safe-top safe-bottom mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="mb-14">
        <p className="eyebrow">Hábitos · Diario · Socio</p>
        <h1 className="mt-4 font-serif text-5xl italic tracking-tight">AscendHabit</h1>
        <p className="mt-3 text-ink-2">Hábitos individuales. Compromiso compartido.</p>
      </div>
      <LoginForm initialError={initialError} />
    </main>
  );
}
