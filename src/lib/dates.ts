/** "2026-10-03" → "Sábado, 3 de octubre" (sin depender de la zona del navegador) */
export function formatLongDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const text = new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function greeting(hour = new Date().getHours()) {
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** "2026-10-02" → "vie 2 oct" */
export function formatShortDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d, 12)))
    .replaceAll(".", "");
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
export function relativeDay(isoDate: string, today: string) {
  const diff = daysBetween(isoDate, today);
  if (diff === 0) return "hoy";
  if (diff === 1) return "ayer";
  if (diff === 2) return "anteayer";
  return formatShortDate(isoDate);
}

/** Horas restantes hasta una fecha ISO (redondeo hacia arriba, mínimo 0) */
export function hoursUntil(iso: string, now: number) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 3_600_000));
}

/** "2026-10-01" → "Octubre 2026" */
export function formatMonth(isoDate: string) {
  const [y, m] = isoDate.split("-").map(Number);
  const text = new Intl.DateTimeFormat("es", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1, 12)),
  );
  return text.charAt(0).toUpperCase() + text.slice(1);
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
