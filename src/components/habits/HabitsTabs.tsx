"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/client";

/** Pestañas "Lista | Progreso" dentro de la sección Hábitos */
export function HabitsTabs({ active }: { active: "list" | "stats" }) {
  const t = useT();
  const items = [
    { key: "list", href: "/habits", label: t.habits.tabs.list },
    { key: "stats", href: "/stats", label: t.habits.tabs.stats },
  ] as const;
  return (
    <div className="grid grid-cols-2 border border-line">
      {items.map((it, i) => (
        <Link
          key={it.key}
          href={it.href}
          aria-current={active === it.key ? "page" : undefined}
          className={`py-2.5 text-center text-sm transition ${i > 0 ? "border-l border-line" : ""} ${
            active === it.key ? "bg-ink text-bg" : "text-ink-2"
          }`}
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}
