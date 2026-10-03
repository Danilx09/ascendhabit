"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SettingsForm({
  userId,
  email,
  initialName,
  initialTimezone,
}: {
  userId: string;
  email: string;
  initialName: string;
  initialTimezone: string;
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [name, setName] = useState(initialName);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  // Solo existe en el navegador → se lee tras montar para no romper la hidratación
  const [deviceZone, setDeviceZone] = useState<string | null>(null);
  useEffect(() => setDeviceZone(Intl.DateTimeFormat().resolvedOptions().timeZone), []);

  const zones = useMemo(() => {
    try {
      const all = Intl.supportedValuesOf("timeZone");
      return all.includes(timezone) ? all : [timezone, ...all];
    } catch {
      return [timezone];
    }
  }, [timezone]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setMessage(null);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim() || null, timezone })
      .eq("id", userId);
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("saved");
    router.refresh();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }


  return (
    <div className="space-y-6">
      <form onSubmit={save} className="space-y-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Tu nombre</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            placeholder="Cómo te verá tu socio"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Zona horaria</span>
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputClass}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <span className="mt-1.5 block text-xs text-zinc-500">
            Define cuándo empieza y termina tu día para las rachas.
            {deviceZone && deviceZone !== timezone && (
              <>
                {" "}
                <button type="button" onClick={() => setTimezone(deviceZone)} className="font-medium text-brand-500">
                  Usar la de este dispositivo ({deviceZone})
                </button>
              </>
            )}
          </span>
        </label>

        {message && <p className="text-sm text-red-500">{message}</p>}
        <button
          type="submit"
          disabled={status === "saving"}
          className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          {status === "saving" ? "Guardando…" : status === "saved" ? "Guardado ✓" : "Guardar cambios"}
        </button>
      </form>

      <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-sm text-zinc-500">Sesión iniciada como</p>
        <p className="font-medium">{email}</p>
        <button
          type="button"
          onClick={signOut}
          className="mt-4 w-full rounded-xl border border-red-500/40 py-3 font-medium text-red-500"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 dark:border-zinc-700 dark:bg-zinc-900";
