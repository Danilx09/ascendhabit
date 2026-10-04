"use client";

import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { formatNumber, streakLabel } from "@/lib/habits";
import { RecoveryInbox } from "./RecoveryInbox";
import { EndPartnership } from "./EndPartnership";
import type { PartnerInfo, RecoveryRequest, UserSummary } from "@/types/app";

export function PartnerView({
  info,
  me,
  partner,
  requests,
}: {
  info: PartnerInfo;
  me: UserSummary;
  partner: UserSummary;
  requests: RecoveryRequest[];
}) {
  useRefreshOnFocus();
  const partnerName = partner.display_name ?? info.partner_name ?? "Tu socio";

  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow">Panel de Accountability</p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight">
          Tú <span className="italic text-ink-3">y</span> {partnerName}
        </h1>
      </header>

      <Duel me={me} partner={partner} partnerName={partnerName} />

      <RecoveryInbox requests={requests} partnerName={partnerName} today={me.today} />

      <section>
        <h2 className="eyebrow mb-1">Lo que comparte {partnerName}</h2>
        {partner.habits.length === 0 ? (
          <p className="border-y border-line py-6 text-center text-sm text-ink-3">
            {partnerName} no comparte el detalle de sus hábitos. Su % y sus rachas sí los cuentan todos.
          </p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {partner.habits.map((h) => {
              const quantitative = h.target !== 1 || h.unit;
              return (
                <li key={h.id} className="flex items-center gap-4 py-3.5">
                  <span className="mono w-6 text-center text-lg">{h.icon ?? "·"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{h.name}</span>
                    <span className="text-xs text-ink-3">
                      {!h.scheduled_today
                        ? "Hoy no toca"
                        : quantitative
                          ? `${formatNumber(h.progress_today)} / ${formatNumber(h.target)} ${h.unit ?? ""}`
                          : h.done_today
                            ? "Hecho hoy"
                            : "Pendiente hoy"}
                      {h.current_streak > 0 && ` — ${streakLabel(h.current_streak, h.streak_unit)}`}
                    </span>
                  </span>
                  <span
                    aria-label={h.done_today ? "Hecho" : "Pendiente"}
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs ${
                      h.done_today ? "bg-ink text-bg" : "border border-ink-3"
                    }`}
                  >
                    {h.done_today ? "✓" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <EndPartnership partnerName={partnerName} since={info.since} />
    </div>
  );
}

function Duel({ me, partner, partnerName }: { me: UserSummary; partner: UserSummary; partnerName: string }) {
  const myPct = me.today_pct ?? 0;
  const theirPct = partner.today_pct ?? 0;
  const verdict =
    me.today_pct === null && partner.today_pct === null
      ? "Hoy ninguno tiene hábitos programados."
      : myPct === theirPct
        ? myPct === 100
          ? "Los dos con Día Perfecto."
          : "Empatados por ahora."
        : myPct > theirPct
          ? `Vas por delante hoy. Anima a ${partnerName}.`
          : `${partnerName} va por delante hoy. Tu turno.`;

  return (
    <section>
      <div className="grid grid-cols-2 border-y border-line">
        <Player label="Tú" summary={me} />
        <Player label={partnerName} summary={partner} left />
      </div>
      <p className="mt-4 font-serif text-lg italic text-ink-2">{verdict}</p>
    </section>
  );
}

function Player({ label, summary, left = false }: { label: string; summary: UserSummary; left?: boolean }) {
  const pct = summary.today_pct ?? 0;
  return (
    <div className={`py-5 ${left ? "border-l border-line pl-5" : "pr-5"}`}>
      <p className="eyebrow truncate">{label}</p>
      <p className="mt-3 font-serif text-5xl leading-none tabular-nums">
        {summary.today_pct === null ? "–" : `${summary.today_pct}%`}
      </p>
      <div className="mt-3 h-px w-full bg-line">
        <div className="h-px bg-ink" style={{ width: `${pct}%` }} />
      </div>
      <dl className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-3">Semana</dt>
          <dd className="tabular-nums">{summary.week_pct === null ? "–" : `${summary.week_pct}%`}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-3">Día Perfecto</dt>
          <dd className="tabular-nums">{summary.perfect_day_streak}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-3">Mejor racha</dt>
          <dd className="tabular-nums">{summary.perfect_day_best}</dd>
        </div>
      </dl>
    </div>
  );
}
