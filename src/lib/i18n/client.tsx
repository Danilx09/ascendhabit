"use client";

import { createContext, useContext } from "react";
import { getDict, LOCALE_COOKIE, type Dict, type Locale } from "./index";

const LocaleContext = createContext<Locale>("es");

/** Recibe solo el código de idioma (serializable); el diccionario se importa aquí */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT(): Dict {
  return getDict(useContext(LocaleContext));
}

/** Guarda el idioma elegido (1 año) para que el servidor lo lea en cada petición */
export function setLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}
