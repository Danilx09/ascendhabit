"use client";

import { useEffect, useState } from "react";

export type ThemePref = "light" | "dark" | "system";

function resolve(pref: ThemePref) {
  return pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ? "dark"
    : "light";
}

function apply(pref: ThemePref) {
  const theme = resolve(pref);
  document.documentElement.dataset.theme = theme;
  // Barra de estado / barra del navegador acorde al tema
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) =>
    m.setAttribute("content", theme === "dark" ? "#0a0a0a" : "#ffffff"),
  );
}

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem("theme");
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const p = readPref();
    setPref(p);
    setResolved(resolve(p));
    // Si sigue al sistema, reaccionar a cambios (p. ej. modo oscuro automático del iPhone)
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readPref() === "system") {
        apply("system");
        setResolved(resolve("system"));
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function choose(next: ThemePref) {
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      // almacenamiento bloqueado: el cambio dura hasta recargar
    }
    apply(next);
    setPref(next);
    setResolved(resolve(next));
  }

  return { pref, resolved, choose };
}

/** Botón compacto Día/Noche para la cabecera */
export function ThemeToggle() {
  const { resolved, choose } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => choose(next)}
      aria-label={resolved === "dark" ? "Cambiar a modo normal" : "Cambiar a modo noche"}
      className="grid h-9 w-9 place-items-center rounded-full text-ink-2 transition hover:text-ink"
    >
      {resolved === "dark" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
        </svg>
      )}
    </button>
  );
}

/** Selector completo para Ajustes */
export function ThemeSelector() {
  const { pref, choose } = useTheme();
  const options: { value: ThemePref; label: string }[] = [
    { value: "light", label: "Normal" },
    { value: "dark", label: "Noche" },
    { value: "system", label: "Sistema" },
  ];
  return (
    <div className="grid grid-cols-3 border border-line">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => choose(o.value)}
          className={`py-2.5 text-sm transition ${pref === o.value ? "bg-ink text-bg" : "text-ink-2"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
