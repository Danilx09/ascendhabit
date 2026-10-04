"use client";

import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { BRAND_COLOR, formatNumber, streakLabel } from "@/lib/habits";
import { ProgressRing } from "@/components/ui/ProgressRing";
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
    <div className="space-y-6">
      <header>
        <p className="text-sm text-zinc-500">Panel de Accountability</p>
        <h1 className="text-2xl font-bold tracking-tight">Tú vs {partnerName}</h1>
      </header>

      <Duel me={me} partner={partner} partnerName={partnerName} />

      <RecoveryInbox requests={requests} partnerName={partnerName} today={me.today} />

      <section>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Hábitos que comparte {partnerName}
        </h2>
        {partner.habits.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            {partnerName} no comparte el detalle de sus hábitos. Sus % y rachas sí cuentan todos.
          </p>
        ) : (
          <ul className="space-y-2">
            {partner.habits.map((h) => {
              const color = h.color ?? BRAND_COLOR;
              const quantitative = h.target !== 1 || h.unit;
              return (
                <li
                  key={h.id}
                  className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg"
                    style={{ backgroundColor: `${color}22` }}
                  >
                    {h.icon ?? "✨"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{h.name}</span>
                    <span className="text-xs text-zinc-500">
                      {!h.scheduled_today
                        ? "Hoy no toca"
                        : quantitative
                          ? `${formatNumber(h.progress_today)} / ${formatNumber(h.target)} ${h.unit ?? ""}`
                          : h.done_today
                            ? "Hecho hoy"
                            : "Pendiente hoy"}
                      {h.current_streak > 0 && (
                        <span className="ml-2 font-medium text-orange-500">
                          🔥 {streakLabel(h.current_streak, h.streak_unit)}
                        </span>
                      )}
                    </span>
                  </span>
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm ${
                      h.done_today ? "bg-emerald-500 text-white" : "border-2 border-zinc-300 dark:border-zinc-700"
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
          ? "¡Los dos con Día Perfecto! 🎉"
          : "Empatados por ahora. ¡A por ello!"
        : myPct > theirPct
          ? `Vas por delante hoy. Anima a ${partnerName} 💬`
          : `${partnerName} va por delante hoy. ¡Tu turno! 💪`;

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid grid-cols-2 divide-x divide-zinc-200 dark:divide-zinc-800">
        <Player label="Tú" summary={me} />
        <Player label={partnerName} summary={partner} />
      </div>
      <p className="mt-4 rounded-xl bg-zinc-100 px-3 py-2 text-center text-sm dark:bg-zinc-800">{verdict}</p>
    </section>
  );
}

function Player({ label, summary }: { label: string; summary: UserSummary }) {
  return (
    <div className="flex flex-col items-center gap-3 px-2">
      <p className="max-w-full truncate text-sm font-semibold">{label}</p>
      <ProgressRing pct={summary.today_pct ?? 0} size={84}>
        <span className="text-center leading-tight">
          <span className="block text-base font-bold">{summary.today_pct === null ? "–" : `${summary.today_pct}%`}</span>
          <span className="block text-[10px] text-zinc-500">hoy</span>
        </span>
      </ProgressRing>
      <dl className="w-full space-y-1 text-center text-xs">
        <div>
          <dt className="inline text-zinc-500">Semana </dt>
          <dd className="inline font-semibold">{summary.week_pct === null ? "–" : `${summary.week_pct}%`}</dd>
        </div>
        <div>
          <dt className="sr-only">Racha de Día Perfecto</dt>
          <dd className="text-lg font-bold">🔥 {summary.perfect_day_streak}</dd>
          <dd className="text-[11px] text-zinc-500">Día Perfecto · mejor {summary.perfect_day_best}</dd>
        </div>
      </dl>
    </div>
  );
}
