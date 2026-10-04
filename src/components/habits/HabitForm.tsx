"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TIME_OF_DAY_LABEL, WEEKDAYS } from "@/lib/habits";
import type { Category, FrequencyType, GoalType, HabitRow, HabitTemplate, TimeOfDay } from "@/types/app";

const ICONS = ["💧", "🏃", "🧘", "📖", "🎯", "📵", "✍️", "💪", "🥗", "😴", "💊", "🧹", "💰", "🎸", "🌱", "☀️", "🚭", "🧠"];
const COLORS = ["#6366F1", "#8B5CF6", "#EC4899", "#EF4444", "#F97316", "#EAB308", "#10B981", "#06B6D4", "#3B82F6"];

const GOALS: { value: GoalType; label: string }[] = [
  { value: "boolean", label: "Sí / No" },
  { value: "count", label: "Cantidad" },
  { value: "duration", label: "Tiempo" },
];
const FREQUENCIES: { value: FrequencyType; label: string }[] = [
  { value: "daily", label: "Diario" },
  { value: "specific_days", label: "Días" },
  { value: "times_per_week", label: "Semanal" },
];
const PRIORITIES: { value: 1 | 2 | 3; label: string }[] = [
  { value: 1, label: "Alta" },
  { value: 2, label: "Media" },
  { value: 3, label: "Baja" },
];

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

  function applyTemplate(t: HabitTemplate) {
    const cat = categories.find((c) => c.name === t.category_name);
    setTemplateId(t.id);
    setForm({
      ...EMPTY,
      name: t.name,
      description: t.description ?? "",
      icon: t.icon ?? EMPTY.icon,
      color: cat?.color ?? EMPTY.color,
      category_id: cat?.id ?? null,
      goal_type: t.goal_type,
      target_value: t.target_value,
      unit: t.unit ?? "",
      frequency_type: t.frequency_type,
      time_of_day: t.time_of_day,
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

    if (!form.name.trim()) return setError("Ponle un nombre al hábito.");
    if (form.goal_type !== "boolean" && !(form.target_value > 0)) return setError("La meta debe ser mayor que 0.");
    if (form.frequency_type === "specific_days" && form.frequency_days.length === 0)
      return setError("Elige al menos un día.");

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
      return setError(error.message);
    }
    router.push(initial ? `/habits/${initial.id}` : "/today");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Plantillas */}
      {templates.length > 0 && (
        <section>
          <Label>Empieza con una plantilla</Label>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                  templateId === t.id
                    ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-50"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <span>{t.icon}</span>
                {t.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Nombre + icono + color */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-3xl"
            style={{ backgroundColor: `${form.color}22` }}
          >
            {form.icon}
          </span>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Nombre del hábito"
            maxLength={80}
            className={`${inputClass} text-lg font-medium`}
          />
        </div>
        <div className="grid grid-cols-9 gap-1.5">
          {ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => set("icon", icon)}
              className={`grid aspect-square place-items-center rounded-lg text-lg transition ${
                form.icon === icon ? "bg-zinc-200 dark:bg-zinc-700" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {icon}
            </button>
          ))}
        </div>
        <div className="flex justify-between">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              onClick={() => set("color", c)}
              className={`h-8 w-8 rounded-full transition ${form.color === c ? "scale-110 ring-2 ring-offset-2 ring-zinc-400 dark:ring-offset-zinc-950" : ""}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </section>

      {/* Meta */}
      <section>
        <Label>Meta</Label>
        <Segmented options={GOALS} value={form.goal_type} onChange={changeGoal} />
        {form.goal_type !== "boolean" && (
          <div className="mt-3 flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={form.target_value}
              onChange={(e) => set("target_value", Number(e.target.value))}
              className={`${inputClass} w-28 text-center`}
            />
            {form.goal_type === "duration" ? (
              <span className="flex items-center px-2 text-zinc-500">minutos al día</span>
            ) : (
              <input
                value={form.unit}
                onChange={(e) => set("unit", e.target.value)}
                placeholder="unidad (vasos, páginas…)"
                maxLength={20}
                className={inputClass}
              />
            )}
          </div>
        )}
      </section>

      {/* Frecuencia */}
      <section>
        <Label>Frecuencia</Label>
        <Segmented options={FREQUENCIES} value={form.frequency_type} onChange={(v) => set("frequency_type", v)} />
        {form.frequency_type === "specific_days" && (
          <div className="mt-3 flex justify-between">
            {WEEKDAYS.map((d) => (
              <button
                key={d.iso}
                type="button"
                aria-label={d.long}
                onClick={() => toggleDay(d.iso)}
                className={`h-10 w-10 rounded-full text-sm font-semibold transition ${
                  form.frequency_days.includes(d.iso)
                    ? "bg-brand-600 text-white"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                }`}
              >
                {d.short}
              </button>
            ))}
          </div>
        )}
        {frequencyChanged && (
          <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            Cambiar la frecuencia recalcula también las rachas de días pasados.
          </p>
        )}
        {form.frequency_type === "times_per_week" && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-zinc-100 px-4 py-2 dark:bg-zinc-800/60">
            <span className="text-sm">Veces por semana</span>
            <div className="flex items-center gap-3">
              <StepButton onClick={() => set("times_per_week", Math.max(1, form.times_per_week - 1))}>−</StepButton>
              <span className="w-4 text-center font-semibold">{form.times_per_week}</span>
              <StepButton onClick={() => set("times_per_week", Math.min(7, form.times_per_week + 1))}>+</StepButton>
            </div>
          </div>
        )}
      </section>

      {/* Momento del día */}
      <section>
        <Label>Momento del día</Label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(TIME_OF_DAY_LABEL) as TimeOfDay[]).map((t) => (
            <Chip key={t} active={form.time_of_day === t} onClick={() => set("time_of_day", t)}>
              {TIME_OF_DAY_LABEL[t]}
            </Chip>
          ))}
        </div>
      </section>

      {/* Prioridad */}
      <section>
        <Label>Prioridad</Label>
        <Segmented options={PRIORITIES} value={form.priority} onChange={(v) => set("priority", v)} />
      </section>

      {/* Categoría */}
      {categories.length > 0 && (
        <section>
          <Label>Categoría</Label>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Chip
                key={c.id}
                active={form.category_id === c.id}
                onClick={() => set("category_id", form.category_id === c.id ? null : c.id)}
              >
                {c.icon} {c.name}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {/* Privacidad */}
      <section>
        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <span>
            <span className="block font-medium">Visible para mi socio</span>
            <span className="mt-0.5 block text-sm text-zinc-500">
              Si está apagado, tu socio no ve el nombre del hábito, aunque sí cuenta en tu % del día.
            </span>
          </span>
          <input
            type="checkbox"
            checked={form.share_with_partner}
            onChange={(e) => set("share_with_partner", e.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 accent-brand-600"
          />
        </label>
      </section>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-brand-600 py-3.5 font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
      >
        {saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear hábito"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 dark:border-zinc-700 dark:bg-zinc-900";

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{children}</p>;
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
    <div className="grid rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/60" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-lg py-2 text-sm font-medium transition ${
            value === o.value ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-500"
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
      className={`rounded-xl border px-3 py-2 text-sm transition ${
        active
          ? "border-brand-500 bg-brand-500/10 font-medium text-brand-600 dark:text-brand-50"
          : "border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
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
      className="grid h-8 w-8 place-items-center rounded-full bg-white text-lg dark:bg-zinc-700"
    >
      {children}
    </button>
  );
}
