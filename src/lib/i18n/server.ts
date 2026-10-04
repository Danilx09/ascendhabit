import { cookies, headers } from "next/headers";
import { getDict, isLocale, localeFromAcceptLanguage, LOCALE_COOKIE, type Locale } from "./index";

/** Idioma de la petición: cookie elegida en Ajustes → idioma del navegador → español */
export async function getLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  return localeFromAcceptLanguage((await headers()).get("accept-language"));
}

export async function getT() {
  return getDict(await getLocale());
}
