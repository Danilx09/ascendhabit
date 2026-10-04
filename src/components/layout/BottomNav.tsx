"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/today", label: "Hoy" },
  { href: "/habits", label: "Hábitos" },
  { href: "/journal", label: "Diario" },
  { href: "/partner", label: "Socio" },
  { href: "/settings", label: "Ajustes" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur">
      <ul className="mx-auto flex max-w-md px-2">
        {ITEMS.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1.5 pb-2.5 pt-3 text-[12px] tracking-wide transition ${
                  active ? "text-ink" : "text-ink-3"
                }`}
              >
                {label}
                <span className={`h-1 w-1 rounded-full ${active ? "bg-ink" : "bg-transparent"}`} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
