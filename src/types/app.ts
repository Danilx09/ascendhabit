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
  description: string | null;
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
  color: string;
  icon: string | null;
}
