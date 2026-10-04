export type GoalType = "boolean" | "count" | "duration";
export type FrequencyType = "daily" | "specific_days" | "times_per_week";
export type TimeOfDay = "morning" | "afternoon" | "evening" | "anytime";

/** Un hábito tal como lo devuelve la RPC get_today() */
export interface TodayHabit {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  category_id: string | null;
  goal_type: GoalType;
  target_value: number;
  unit: string | null;
  frequency_type: FrequencyType;
  frequency_days: number[] | null;
  times_per_week: number | null;
  priority: 1 | 2 | 3;
  time_of_day: TimeOfDay;
  share_with_partner: boolean;
  scheduled_today: boolean;
  value_today: number;
  done_today: boolean;
  week_done: number;
  current_streak: number;
  best_streak: number;
  streak_unit: "days" | "weeks";
}

export interface TodayData {
  today: string; // YYYY-MM-DD en la zona horaria del usuario
  display_name: string | null;
  today_scheduled: number;
  today_done: number;
  today_pct: number | null;
  perfect_day_streak: number;
  perfect_day_best: number;
  pending_recovery_requests: number;
  habits: TodayHabit[];
}

export interface HabitTemplate {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  unit_en: string | null;
  category_name: string | null;
  icon: string | null;
  goal_type: GoalType;
  target_value: number;
  unit: string | null;
  frequency_type: FrequencyType;
  time_of_day: TimeOfDay;
}

export interface Category {
  id: string;
  name: string;
  name_en: string | null;
  color: string;
  icon: string | null;
}

/** Resumen que devuelven get_my_summary() y get_partner_summary() */
export interface UserSummary {
  user_id: string;
  display_name: string | null;
  today: string;
  today_scheduled: number;
  today_done: number;
  today_pct: number | null;
  week_pct: number | null;
  perfect_day_streak: number;
  perfect_day_best: number;
  habits: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    frequency_type: FrequencyType;
    scheduled_today: boolean;
    done_today: boolean;
    progress_today: number;
    target: number;
    unit: string | null;
    current_streak: number;
    best_streak: number;
    streak_unit: "days" | "weeks";
  }[];
}

export interface PartnerInfo {
  invite_code: string;
  partner_id: string | null;
  partner_name: string | null;
  since: string | null;
}

export type RecoveryReason = "illness" | "travel" | "forgot" | "other";
export type RecoveryStatus = "pending" | "approved" | "rejected" | "expired";

export interface RecoveryRequest {
  id: string;
  direction: "incoming" | "outgoing";
  habit_id: string;
  habit_name: string;
  habit_icon: string | null;
  missed_date: string;
  reason: RecoveryReason;
  message: string | null;
  status: RecoveryStatus;
  created_at: string;
  expires_at: string;
  resolved_at: string | null;
}

export interface RecoverableMiss {
  habit_id: string;
  habit_name: string;
  habit_icon: string | null;
  habit_color: string | null;
  missed_date: string;
  used_this_month: number;
  monthly_max: number;
  partner_name: string | null;
}

/** Fila de la tabla habits */
export interface HabitRow {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  category_id: string | null;
  goal_type: GoalType;
  target_value: number;
  unit: string | null;
  frequency_type: FrequencyType;
  frequency_days: number[] | null;
  times_per_week: number | null;
  priority: 1 | 2 | 3;
  time_of_day: TimeOfDay;
  share_with_partner: boolean;
  start_date: string;
  archived_on: string | null;
}

export interface CalendarDay {
  date: string;
  scheduled: boolean;
  value: number;
  target: number;
  done: boolean;
  recovered: boolean;
}

/** Respuesta de get_habit_detail() */
export interface HabitDetail {
  habit: HabitRow;
  today: string;
  month: string; // primer día del mes mostrado
  current_streak: number;
  best_streak: number;
  streak_unit: "days" | "weeks";
  rate_30d: number | null;
  total_done: number;
  recovered_count: number;
  days: CalendarDay[];
}

/** Fila de journal_entries tal como la devuelve get_journal_day() (textos cifrados) */
export interface JournalEntry {
  id: string;
  entry_date: string;
  free_journal: string | null;
  mood_score: number | null;
  primary_emotion: string | null;
  q_gratitude: string | null;
  q_challenge: string | null;
  q_learning: string | null;
  updated_at: string;
}

export interface JournalDay {
  today: string;
  date: string;
  entry: JournalEntry | null;
  prev_date: string | null;
  next_date: string | null;
  total_entries: number;
  key: { salt: string; iterations: number; verifier: string } | null;
}

export interface JournalMonthItem {
  entry_date: string;
  mood_score: number | null;
  primary_emotion: string | null;
  has_journal: boolean;
  has_reflection: boolean;
}

export interface JournalYearItem {
  month: string; // YYYY-MM-01
  entries: number;
  journal_days: number;
  avg_mood: number | null;
}

/** Respuesta de get_stats() */
export interface StatsData {
  today: string;
  weeks: number;
  weekly: {
    week_start: string;
    scheduled: number;
    done: number;
    pct: number | null;
    avg_mood: number | null;
    journal_days: number;
    is_current: boolean;
  }[];
  weekday: { isodow: number; scheduled: number; done: number; pct: number | null }[];
  habits: {
    id: string;
    name: string;
    icon: string | null;
    rate_30d: number | null;
    current_streak: number;
    best_streak: number;
    streak_unit: "days" | "weeks";
  }[];
  perfect_day_streak: number;
  perfect_day_best: number;
  perfect_days_30d: number;
  active_days_30d: number;
}
