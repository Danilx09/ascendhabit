import { es, type Dict } from "./es";
import { en } from "./en";

export type Locale = "es" | "en";
export type { Dict };

export const LOCALES: Locale[] = ["es", "en"];
export const LOCALE_COOKIE = "locale";
export const LOCALE_LABEL: Record<Locale, string> = { es: "Español", en: "English" };

const DICTS: Record<Locale, Dict> = { es, en };

export function isLocale(v: unknown): v is Locale {
  return v === "es" || v === "en";
}

export function getDict(locale: Locale): Dict {
  return DICTS[locale];
}

/** Idioma por defecto a partir de la cabecera Accept-Language */
export function localeFromAcceptLanguage(header: string | null): Locale {
  const first = (header ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("en") ? "en" : "es";
}

/**
 * Traduce los mensajes de error que lanzan las funciones SQL (están en español).
 * Si no se reconoce, devuelve el mensaje original.
 */
export function translateDbError(message: string, t: Dict): string {
  const e = t.errors;
  const exact: Record<string, string> = {
    "Campo no editable": e.notEditable,
    "Código no válido": e.invalidCode,
    "El hábito no estaba activo ese día": e.habitInactive,
    "Ese día no estaba programado para este hábito": e.notScheduled,
    'Ese día ya cerró. Usa "Solicitar recuperación de racha".': e.dayClosed,
    "Ese día ya está cumplido": e.alreadyDone,
    "Espera un par de minutos antes de enviar otra prueba": e.waitTest,
    "Faltan los secretos reminder_endpoint / reminder_secret en Supabase Vault": e.missingSecrets,
    "Hábito no encontrado": e.habitNotFound,
    "Necesitas un socio activo para pedir recuperación": e.needPartner,
    "No autenticado": e.notAuthenticated,
    "No puedes escribir en días futuros": e.futureJournal,
    "No puedes registrar días futuros": e.futureLog,
    "No puedes ser tu propio socio": e.selfPartner,
    "Pasaron más de 48 h desde ese día": e.over48h,
    "Solicitud no encontrada": e.requestNotFound,
    "Solo se pueden recuperar días que ya terminaron": e.onlyPastDays,
    "Un día recuperado no se puede borrar": e.recoveredLocked,
    "Uno de los dos ya tiene un socio activo": e.partnerTaken,
    "Ya existe una solicitud para ese día": e.duplicateRequest,
    "Ya no son socios": e.noLongerPartners,
    "Ya tienes una frase configurada": e.phraseExists,
    "recovered_via solo lo asigna la aprobación del socio": e.recoveredOnlyByPartner,
  };
  const msg = message.trim();
  if (exact[msg]) return exact[msg];
  let m = msg.match(/^Campo desconocido: (.+)$/);
  if (m) return e.unknownField(m[1]);
  m = msg.match(/^La solicitud ya fue resuelta \((.+)\)$/);
  if (m) return e.alreadyResolved(m[1]);
  m = msg.match(/^Ya usaste las (\d+) recuperaciones de este mes para este hábito$/);
  if (m) return e.monthlyLimit(m[1]);
  return msg;
}
