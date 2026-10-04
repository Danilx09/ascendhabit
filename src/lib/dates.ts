import type { Dict } from "@/lib/i18n";

/** Las fechas YYYY-MM-DD se formatean en UTC a mediodía: así no dependen de la zona del navegador */
function utcNoon(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d || 1, 12));
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "2026-10-03" → "Sábado, 3 de octubre" / "Saturday, October 3" */
export function formatLongDate(isoDate: string, intl = "es") {
  return capitalize(
    new Intl.DateTimeFormat(intl, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(utcNoon(isoDate)),
  );
}

/** "2026-10-02" → "vie 2 oct" / "Fri, Oct 2" */
export function formatShortDate(isoDate: string, intl = "es") {
  return new Intl.DateTimeFormat(intl, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .format(utcNoon(isoDate))
    .replaceAll(".", "");
}

/** "2026-10-02" → "2 oct" / "Oct 2" */
export function formatDayMonth(isoDate: string, intl = "es") {
  return new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", timeZone: "UTC" })
    .format(utcNoon(isoDate))
    .replaceAll(".", "");
}

/** "2026-10-01" → "Octubre 2026" / "October 2026" */
export function formatMonth(isoDate: string, intl = "es") {
  return capitalize(new Intl.DateTimeFormat(intl, { month: "long", year: "numeric", timeZone: "UTC" }).format(utcNoon(isoDate)));
}

/** Hora del día → "8:00 p. m." / "8:00 PM" */
export function formatHour(hour: number, intl = "es") {
  return new Intl.DateTimeFormat(intl, { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(
    new Date(Date.UTC(2026, 0, 1, hour)),
  );
}

export function formatClock(date: Date, intl = "es") {
  return new Intl.DateTimeFormat(intl, { hour: "2-digit", minute: "2-digit" }).format(date);
}

export function greeting(t: Dict, hour = new Date().getHours()) {
  if (hour < 12) return t.greet.morning;
  if (hour < 19) return t.greet.afternoon;
  return t.greet.evening;
}

/** Días entre dos fechas YYYY-MM-DD (b - a) */
export function daysBetween(a: string, b: string) {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** "ayer", "anteayer" o la fecha corta */
export function relativeDay(isoDate: string, today: string, t: Dict) {
  const diff = daysBetween(isoDate, today);
  if (diff === 0) return t.rel.today;
  if (diff === 1) return t.rel.yesterday;
  if (diff === 2) return t.rel.dayBefore;
  return formatShortDate(isoDate, t.intl);
}

/** Horas restantes hasta una fecha ISO (redondeo hacia arriba, mínimo 0) */
export function hoursUntil(iso: string, now: number) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 3_600_000));
}

/** Suma meses a una fecha YYYY-MM-01 → YYYY-MM-01 */
export function addMonths(isoDate: string, delta: number) {
  const [y, m] = isoDate.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Día de la semana ISO (1 = lunes … 7 = domingo) de una fecha YYYY-MM-DD */
export function isoWeekday(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}
