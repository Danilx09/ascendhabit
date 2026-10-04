import { LoginForm } from "@/components/auth/LoginForm";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { getT } from "@/lib/i18n/server";
import { pageTitle } from "@/lib/i18n/metadata";

export const generateMetadata = pageTitle("login");

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const t = await getT();
  const initialError = error === "link" ? t.login.linkInvalid : null;

  return (
    <main className="safe-top safe-bottom mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="mb-14">
        <p className="eyebrow">{t.login.eyebrow}</p>
        <h1 className="mt-4 font-serif text-5xl italic tracking-tight">AscendHabit</h1>
        <p className="mt-3 text-ink-2">{t.common.tagline}</p>
      </div>
      <LoginForm initialError={initialError} />
      <div className="mt-12 text-center">
        <LanguageSelector compact />
      </div>
    </main>
  );
}
