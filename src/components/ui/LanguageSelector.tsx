"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setLocaleCookie, useLocale } from "@/lib/i18n/client";
import { LOCALE_LABEL, LOCALES, type Locale } from "@/lib/i18n";

/**
 * Español / English. Guarda la cookie (interfaz) y, si hay sesión,
 * el perfil (idioma de los correos de recordatorio).
 */
export function LanguageSelector({ userId, compact = false }: { userId?: string; compact?: boolean }) {
  const router = useRouter();
  const locale = useLocale();
  const [supabase] = useState(() => createClient());

  async function choose(next: Locale) {
    if (next === locale) return;
    setLocaleCookie(next);
    if (userId) await supabase.from("profiles").update({ locale: next }).eq("id", userId);
    router.refresh();
  }

  if (compact) {
    const other = locale === "es" ? "en" : "es";
    return (
      <button type="button" onClick={() => choose(other)} className="text-xs text-ink-3 underline underline-offset-4">
        {LOCALE_LABEL[other]}
      </button>
    );
  }

  return (
    <div className="grid grid-cols-2 border border-line">
      {LOCALES.map((l, i) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          aria-pressed={locale === l}
          className={`py-2.5 text-sm transition ${i > 0 ? "border-l border-line" : ""} ${
            locale === l ? "bg-ink text-bg" : "text-ink-2"
          }`}
        >
          {LOCALE_LABEL[l]}
        </button>
      ))}
    </div>
  );
}
