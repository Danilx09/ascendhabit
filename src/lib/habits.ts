import type { Dict } from "@/lib/i18n";
import type { RecoveryReason, TimeOfDay, TodayHabit } from "@/types/app";

export const TIME_SLOTS: TimeOfDay[] = ["morning", "afternoon", "evening", "anytime"];
export const ISO_DAYS = [1, 2, 3, 4, 5, 6, 7];
export const RECOVERY_REASONS: RecoveryReason[] = ["illness", "travel", "forgot", "other"];

export function isQuantitative(h: Pick<TodayHabit, "goal_type">) {
  return h.goal_type !== "boolean";
}

/** Cuánto suma el botón "+" en la tarjeta */
export function stepFor(h: Pick<TodayHabit, "goal_type" | "target_value">) {
  if (h.goal_type === "boolean") return 1;
  if (h.goal_type === "duration") return 5;
  return h.target_value >= 20 ? 5 : 1;
}

export function formatNumber(n: number, intl = "es") {
  return Number.isInteger(n) ? String(n) : n.toLocaleString(intl, { maximumFractionDigits: 1 });
}

export function unitOf(h: Pick<TodayHabit, "unit" | "goal_type">) {
  return h.unit ?? (h.goal_type === "duration" ? "min" : "");
}

export function progressLabel(h: TodayHabit, t: Dict) {
  if (!isQuantitative(h)) return h.done_today ? t.habitRow.done : t.habitRow.pending;
  return `${formatNumber(h.value_today, t.intl)} / ${formatNumber(h.target_value, t.intl)} ${unitOf(h)}`.trim();
}

export function frequencyLabel(
  h: Pick<TodayHabit, "frequency_type" | "frequency_days" | "times_per_week">,
  t: Dict,
) {
  if (h.frequency_type === "daily") return t.freq.daily;
  if (h.frequency_type === "times_per_week") return t.freq.weekly(h.times_per_week ?? 0);
  const days = (h.frequency_days ?? [])
    .slice()
    .sort((a, b) => a - b)
    .map((d) => t.weekdays.short[d - 1])
    .join(" ");
  return days || t.freq.specific;
}

export function streakLabel(n: number, unit: "days" | "weeks", t: Dict) {
  return unit === "weeks" ? t.units.weeks(n) : t.units.days(n);
}

/** Aplica un nuevo valor de hoy a un hábito (para la actualización optimista) */
export function withValue(h: TodayHabit, value: number): TodayHabit {
  const done = value >= h.target_value;
  const delta = done === h.done_today ? 0 : done ? 1 : -1;
  return { ...h, value_today: value, done_today: done, week_done: Math.max(0, h.week_done + delta) };
}
