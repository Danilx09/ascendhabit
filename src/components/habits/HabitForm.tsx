"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ISO_DAYS, TIME_SLOTS } from "@/lib/habits";
import { translateDbError } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n/client";
import type { Category, FrequencyType, GoalType, HabitRow, HabitTemplate, TimeOfDay } from "@/types/app";

const ICONS = ["💧", "🏃", "🧘", "📖", "🎯", "📵", "✍️", "💪", "🥗", "😴", "💊", "🧹", "💰", "🎸", "🌱", "☀️", "🚭", "🧠"];
// El color se conserva en la BD, pero la interfaz es monocroma y no lo muestra
const COLORS = ["#6366F1", "#8B5CF6", "#EC4899", "#EF4444", "#F97316", "#EAB308", "#10B981", "#06B6D4", "#3B82F6"];

const GOALS: GoalType[] = ["boolean", "count", "duration"];
const FREQUENCIES: FrequencyType[] = ["daily", "specific_days", "times_per_week"];
const PRIORITIES: (1 | 2 | 3)[] = [1, 2, 3];

interface FormState {
  name: string;
  description: string;
  icon: string;
  color: string;
  category_id: string | null;
  goal_type: GoalType;
  target_value: number;
  unit: string;
  frequency_type: FrequencyType;
  frequency_days: number[];
  times_per_week: number;
  time_of_day: TimeOfDay;
  priority: 1 | 2 | 3;
  share_with_partner: boolean;
}

const EMPTY: FormState = {
  name: "",
  description: "",
  icon: "🎯",
  color: COLORS[0],
  category_id: null,
  goal_type: "boolean",
  target_value: 1,
  unit: "",
  frequency_type: "daily",
  frequency_days: [1, 2, 3, 4, 5],
  times_per_week: 3,
  time_of_day: "anytime",
  priority: 2,
  share_with_partner: false,
};

function fromRow(h: HabitRow): FormState {
  return {
    name: h.name,
    description: h.description ?? "",
    icon: h.icon ?? EMPTY.icon,
    color: h.color ?? EMPTY.color,
    category_id: h.category_id,
    goal_type: h.goal_type,
    target_value: Number(h.target_value),
    unit: h.unit ?? "",
    frequency_type: h.frequency_type,
    frequency_days: h.frequency_days ?? EMPTY.frequency_days,
    times_per_week: h.times_per_week ?? EMPTY.times_per_week,
    time_of_day: h.time_of_day,
    priority: h.priority,
    share_with_partner: h.share_with_partner,
  };
}

export function HabitForm({
  templates,
  categories,
  initial,
}: {
  templates: HabitTemplate[];
  categories: Category[];
  /** Si viene, el formulario edita ese hábito en lugar de crear uno nuevo */
  initial?: HabitRow;
}) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [supabase] = useState(() => createClient());
  const [form, setForm] = useState<FormState>(() => (initial ? fromRow(initial) : EMPTY));
  const frequencyChanged =
    !!initial &&
    (form.frequency_type !== initial.frequency_type ||
      (form.frequency_type === "specific_days" &&
        form.frequency_days.join() !== (initial.frequency_days ?? []).join()) ||
      (form.frequency_type === "times_per_week" && form.times_per_week !== initial.times_per_week));
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const en = locale === "en";
  const categoryName = (c: Category) => (en && c.name_en) || c.name;

  function applyTemplate(tpl: HabitTemplate) {
    const cat = categories.find((c) => c.name === tpl.category_name);
    setTemplateId(tpl.id);
    setForm({
      ...EMPTY,
      name: (en && tpl.name_en) || tpl.name,
      description: (en && tpl.description_en) || tpl.description || "",
      icon: tpl.icon ?? EMPTY.icon,
      color: cat?.color ?? EMPTY.color,
      category_id: cat?.id ?? null,
      goal_type: tpl.goal_type,
      target_value: tpl.target_value,
      unit: (en && tpl.unit_en) || tpl.unit || "",
      frequency_type: tpl.frequency_type,
      time_of_day: tpl.time_of_day,
    });
  }

  function changeGoal(goal: GoalType) {
    setForm((f) => ({
      ...f,
      goal_type: goal,
      target_value: goal === "boolean" ? 1 : f.goal_type === "boolean" ? (goal === "duration" ? 15 : 5) : f.target_value,
      unit: goal === "duration" ? "min" : goal === "boolean" ? "" : f.unit === "min" ? "" : f.unit,
    }));
  }

  function toggleDay(iso: number) {
    setForm((f) => ({
      ...f,
      frequency_days: f.frequency_days.includes(iso)
        ? f.frequency_days.filter((d) => d !== iso)
        : [...f.frequency_days, iso].sort((a, b) => a - b),
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) return setError(t.form.errName);
    if (form.goal_type !== "boolean" && !(form.target_value > 0)) return setError(t.form.errTarget);
    if (form.frequency_type === "specific_days" && form.frequency_days.length === 0)
      return setError(t.form.errDays);

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      icon: form.icon,
      color: form.color,
      category_id: form.category_id,
      goal_type: form.goal_type,
      target_value: form.goal_type === "boolean" ? 1 : form.target_value,
      unit: form.goal_type === "boolean" ? null : form.unit.trim() || (form.goal_type === "duration" ? "min" : null),
      frequency_type: form.frequency_type,
      frequency_days: form.frequency_type === "specific_days" ? form.frequency_days : null,
      times_per_week: form.frequency_type === "times_per_week" ? form.times_per_week : null,
      time_of_day: form.time_of_day,
      priority: form.priority,
      share_with_partner: form.share_with_partner,
    };
    const { error } = initial
      ? await supabase.from("habits").update(payload).eq("id", initial.id)
      : await supabase.from("habits").insert(payload);
    if (error) {
      setSaving(false);
      return setError(translateDbError(error.message, t));
    }
    router.push(initial ? `/habits/${initial.id}` : "/today");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-10">
      {/* Plantillas */}
      {templates.length > 0 && (
        <section>
          <Label>{t.form.template}</Label>
          <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none]">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition ${
                  templateId === tpl.id ? "border-ink bg-ink text-bg" : "border-line text-ink-2"
                }`}
              >
                <span className="mono">{tpl.icon}</span>
                {(en && tpl.name_en) || tpl.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Nombre + icono */}
      <section className="space-y-5">
        <div className="flex items-end gap-4">
          <span className="mono pb-2 text-3xl">{form.icon}</span>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={t.form.namePh}
            maxLength={80}
            className="field font-serif text-2xl"
          />
        </div>
        <div className="grid grid-cols-9 gap-1">
          {ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => set("icon", icon)}
              className={`mono grid aspect-square place-items-center text-lg transition ${
                form.icon === icon ? "border border-ink" : "border border-transparent opacity-60"
              }`}
            >
              {icon}
            </button>
          ))}
        </div>
      </section>

      {/* Meta */}
      <section>
        <Label>{t.form.goal}</Label>
        <Segmented options={GOALS.map((g) => ({ value: g, label: t.form.goals[g] }))} value={form.goal_type} onChange={changeGoal} />
        {form.goal_type !== "boolean" && (
          <div className="mt-4 flex items-end gap-4">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={form.target_value}
              onChange={(e) => set("target_value", Number(e.target.value))}
              className="field w-24 text-center font-serif text-xl"
            />
            {form.goal_type === "duration" ? (
              <span className="pb-3 text-ink-2">{t.form.minutesPerDay}</span>
            ) : (
              <input
                value={form.unit}
                onChange={(e) => set("unit", e.target.value)}
                placeholder={t.form.unitPh}
                maxLength={20}
                className="field"
              />
            )}
          </div>
        )}
      </section>

      {/* Frecuencia */}
      <section>
        <Label>{t.form.frequency}</Label>
        <Segmented
          options={FREQUENCIES.map((f) => ({ value: f, label: t.form.freqs[f] }))}
          value={form.frequency_type}
          onChange={(v) => set("frequency_type", v)}
        />
        {form.frequency_type === "specific_days" && (
          <div className="mt-4 flex justify-between">
            {ISO_DAYS.map((iso) => (
              <button
                key={iso}
                type="button"
                aria-label={t.weekdays.long[iso - 1]}
                aria-pressed={form.frequency_days.includes(iso)}
                onClick={() => toggleDay(iso)}
                className={`h-10 w-10 rounded-full text-sm transition ${
                  form.frequency_days.includes(iso) ? "bg-ink text-bg" : "border border-line text-ink-3"
                }`}
              >
                {t.weekdays.short[iso - 1]}
              </button>
            ))}
          </div>
        )}
        {frequencyChanged && (
          <p className="mt-3 border-l-2 border-ink pl-3 text-xs text-ink-2">
            {t.form.freqWarn}
          </p>
        )}
        {form.frequency_type === "times_per_week" && (
          <div className="mt-4 flex items-center justify-between border-b border-line pb-3">
            <span className="text-sm text-ink-2">{t.form.timesPerWeek}</span>
            <div className="flex items-center gap-4">
              <StepButton onClick={() => set("times_per_week", Math.max(1, form.times_per_week - 1))}>−</StepButton>
              <span className="w-4 text-center font-serif text-xl tabular-nums">{form.times_per_week}</span>
              <StepButton onClick={() => set("times_per_week", Math.min(7, form.times_per_week + 1))}>+</StepButton>
            </div>
          </div>
        )}
      </section>

      {/* Momento del día */}
      <section>
        <Label>{t.form.timeOfDay}</Label>
        <div className="flex flex-wrap gap-2">
          {TIME_SLOTS.map((slot) => (
            <Chip key={slot} active={form.time_of_day === slot} onClick={() => set("time_of_day", slot)}>
              {t.time[slot]}
            </Chip>
          ))}
        </div>
      </section>

      {/* Prioridad */}
      <section>
        <Label>{t.form.priority}</Label>
        <Segmented
          options={PRIORITIES.map((p) => ({ value: p, label: t.form.priorities[p] }))}
          value={form.priority}
          onChange={(v) => set("priority", v)}
        />
      </section>

      {/* Categoría */}
      {categories.length > 0 && (
        <section>
          <Label>{t.form.category}</Label>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Chip
                key={c.id}
                active={form.category_id === c.id}
                onClick={() => set("category_id", form.category_id === c.id ? null : c.id)}
              >
                {categoryName(c)}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {/* Privacidad */}
      <section>
        <label className="flex cursor-pointer items-start justify-between gap-6 border-y border-line py-4">
          <span>
            <span className="block text-[15px]">{t.form.visible}</span>
            <span className="mt-1 block text-sm text-ink-3">
              {t.form.visibleHint}
            </span>
          </span>
          <input
            type="checkbox"
            checked={form.share_with_partner}
            onChange={(e) => set("share_with_partner", e.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 accent-current"
          />
        </label>
      </section>

      {error && <p className="border-l-2 border-ink pl-3 text-sm">{error}</p>}

      <button type="submit" disabled={saving} className="btn btn-primary w-full">
        {saving ? t.form.saving : initial ? t.form.saveChanges : t.form.create}
      </button>
    </form>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow mb-3">{children}</p>;
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid border border-line" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`py-2.5 text-sm transition ${i > 0 ? "border-l border-line" : ""} ${
            value === o.value ? "bg-ink text-bg" : "text-ink-2"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
        active ? "border-ink bg-ink text-bg" : "border-line text-ink-2"
      }`}
    >
      {children}
    </button>
  );
}

function StepButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-full border border-line text-lg font-light"
    >
      {children}
    </button>
  );
}
