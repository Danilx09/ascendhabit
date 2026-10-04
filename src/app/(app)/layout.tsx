import Link from "next/link";
import { BottomNav } from "@/components/layout/BottomNav";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Si el perfil aún no tiene idioma, se guarda el actual (el elegido en la pantalla de
  // entrada o el del teléfono) para que los correos lleguen en ese idioma.
  // Solo actualiza filas con locale vacío: después de la primera vez no cambia nada.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (userId) {
    await supabase.from("profiles").update({ locale: await getLocale() }).eq("id", userId).is("locale", null);
  }

  return (
    <div className="min-h-dvh pb-28">
      <header className="safe-top mx-auto flex max-w-md items-center justify-between px-6 pt-3">
        <Link href="/today" className="font-serif text-lg italic tracking-tight">
          AscendHabit
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-md px-6 pt-6">{children}</main>
      <BottomNav />
    </div>
  );
}
