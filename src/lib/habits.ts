import type { TimeOfDay, TodayHabit } from "@/types/app";

export const BRAND_COLOR = "#6366F1";

export const TIME_OF_DAY_LABEL: Record<TimeOfDay, string> = {
  morning: "Mañana",
  afternoon: "Tarde",
  evening: "Noche",
  anytime: "Cualquier momento",
};

export const WEEKDAYS = [
  { iso: 1, short: "L", long: "Lunes" },
  { iso: 2, short: "M", long: "Martes" },
  { iso: 3, short: "X", long: "Miércoles" },
  { iso: 4, short: "J", long: "Jueves" },
  { iso: 5, short: "V", long: "Viernes" },
  { iso: 6, short: "S", long: "Sábado" },
  { iso: 7, short: "D", long: "Domingo" },
];

export function isQuantitative(h: Pick<TodayHabit, "goal_type">) {
  return h.goal_type !== "boolean";
}

/** Cuánto suma el botón "+" en la tarjeta */
export function stepFor(h: Pick<TodayHabit, "goal_type" | "target_value">) {
  if (h.goal_type === "boolean") return 1;
  if (h.goal_type === "duration") return 5;
  return h.target_value >= 20 ? 5 : 1;
}

export function formatNumber(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

export function progressLabel(h: TodayHabit) {
  if (!isQuantitative(h)) return h.done_today ? "Hecho" : "Pendiente";
  const unit = h.unit ?? (h.goal_type === "duration" ? "min" : "");
  return `${formatNumber(h.value_today)} / ${formatNumber(h.target_value)} ${unit}`.trim();
}

export function frequencyLabel(h: Pick<TodayHabit, "frequency_type" | "frequency_days" | "times_per_week">) {
  if (h.frequency_type === "daily") return "Todos los días";
  if (h.frequency_type === "times_per_week") return `${h.times_per_week} veces por semana`;
  const days = (h.frequency_days ?? [])
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAYS.find((w) => w.iso === d)?.short)
    .join(" ");
  return days || "Días específicos";
}

export function streakLabel(n: number, unit: "days" | "weeks") {
  if (unit === "weeks") return `${n} ${n === 1 ? "semana" : "semanas"}`;
  return `${n} ${n === 1 ? "día" : "días"}`;
}

/** Aplica un nuevo valor de hoy a un hábito (para la actualización optimista) */
export function withValue(h: TodayHabit, value: number): TodayHabit {
  const done = value >= h.target_value;
  const delta = done === h.done_today ? 0 : done ? 1 : -1;
  return { ...h, value_today: value, done_today: done, week_done: Math.max(0, h.week_done + delta) };
}
