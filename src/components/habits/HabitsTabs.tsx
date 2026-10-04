import Link from "next/link";

/** Pestañas "Lista | Progreso" dentro de la sección Hábitos */
export function HabitsTabs({ active }: { active: "list" | "stats" }) {
  const items = [
    { key: "list", href: "/habits", label: "Lista" },
    { key: "stats", href: "/stats", label: "Progreso" },
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
