"use client";

import { useState } from "react";

export interface BarDatum {
  key: string;
  /** Etiqueta corta del eje X */
  label: string;
  value: number | null;
  /** Texto completo que se muestra al tocar/pasar por la barra */
  readout: string;
  /** Periodo en curso: se dibuja con contorno discontinuo */
  inProgress?: boolean;
}

/**
 * Gráfico de barras monocromo, una sola serie (sin leyenda: el título la nombra).
 * Barras finas ancladas a la base, rejilla discreta, lectura al tocar/pasar
 * y tabla accesible en "Ver tabla".
 */
export function BarChart({
  title,
  data,
  max,
  ticks,
  formatTick = (n) => String(n),
  defaultKey,
  labelEvery = 1,
  height = 160,
}: {
  title: string;
  data: BarDatum[];
  max: number;
  ticks: number[];
  formatTick?: (n: number) => string;
  defaultKey?: string;
  labelEvery?: number;
  height?: number;
}) {
  const [selected, setSelected] = useState<string | null>(defaultKey ?? data[data.length - 1]?.key ?? null);
  const current = data.find((d) => d.key === selected);

  return (
    <figure>
      <figcaption>
        <p className="eyebrow">{title}</p>
        <p className="mt-2 min-h-[1.5rem] font-serif text-lg" aria-live="polite">
          {current?.readout ?? " "}
        </p>
      </figcaption>

      <div className="relative mt-4" style={{ height }}>
        {/* Rejilla discreta */}
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 border-t border-line" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="absolute -top-2 right-0 bg-bg pl-1 text-[10px] tabular-nums text-ink-3">{formatTick(t)}</span>
          </div>
        ))}
        <div className="absolute inset-x-0 bottom-0 border-t border-ink-3" />

        {/* Barras: el área táctil es la columna entera, más grande que la marca */}
        <div className="absolute inset-0 flex items-end pr-7">
          {data.map((d) => {
            const h = d.value === null ? 0 : Math.max(0, Math.min(1, d.value / max)) * 100;
            const isSel = d.key === selected;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => setSelected(d.key)}
                onPointerEnter={(e) => e.pointerType === "mouse" && setSelected(d.key)}
                aria-label={d.readout}
                aria-pressed={isSel}
                className="flex h-full flex-1 items-end justify-center"
              >
                {d.value === null ? (
                  <span className="mb-0 h-px w-3 bg-ink-3" />
                ) : (
                  <span
                    className={`block w-3 max-w-[70%] rounded-t-[3px] transition-opacity ${
                      d.inProgress ? "border border-b-0 border-dashed border-ink bg-transparent" : "bg-ink"
                    } ${isSel ? "opacity-100" : "opacity-35"}`}
                    style={{ height: `${h}%`, minHeight: d.value > 0 ? 2 : 0 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Eje X */}
      <div className="mt-2 flex pr-7">
        {data.map((d, i) => (
          <span key={d.key} className="flex-1 text-center text-[10px] text-ink-3">
            {i % labelEvery === 0 || i === data.length - 1 ? d.label : ""}
          </span>
        ))}
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-ink-3 underline underline-offset-4">Ver tabla</summary>
        <table className="mt-2 w-full text-left text-sm">
          <tbody className="divide-y divide-line">
            {data.map((d) => (
              <tr key={d.key}>
                <td className="py-1.5 text-ink-2">{d.readout}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
