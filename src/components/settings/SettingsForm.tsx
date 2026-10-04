"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { forgetKeys } from "@/lib/journal-crypto";
import { ThemeSelector } from "@/components/ui/ThemeToggle";

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
    await forgetKeys(); // la clave del diario no se queda en el dispositivo
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="space-y-12">
      <section>
        <p className="eyebrow mb-3">Apariencia</p>
        <ThemeSelector />
      </section>

      <form onSubmit={save} className="space-y-6">
        <p className="eyebrow">Perfil</p>
        <label className="block">
          <span className="text-sm text-ink-2">Tu nombre</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            placeholder="Cómo te verá tu socio"
            className="field"
          />
        </label>

        <label className="block">
          <span className="text-sm text-ink-2">Zona horaria</span>
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="field bg-bg">
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <span className="mt-2 block text-xs text-ink-3">
            Define cuándo empieza y termina tu día para las rachas.
            {deviceZone && deviceZone !== timezone && (
              <>
                {" "}
                <button type="button" onClick={() => setTimezone(deviceZone)} className="text-ink underline underline-offset-4">
                  Usar la de este dispositivo ({deviceZone})
                </button>
              </>
            )}
          </span>
        </label>

        {message && <p className="border-l-2 border-ink pl-3 text-sm">{message}</p>}
        <button type="submit" disabled={status === "saving"} className="btn btn-primary w-full">
          {status === "saving" ? "Guardando…" : status === "saved" ? "Guardado" : "Guardar cambios"}
        </button>
      </form>

      <section className="border-t border-line pt-6">
        <p className="eyebrow">Sesión</p>
        <p className="mt-2 text-sm">{email}</p>
        <button type="button" onClick={signOut} className="btn btn-ghost mt-5 w-full">
          Cerrar sesión
        </button>
      </section>
    </div>
  );
}
