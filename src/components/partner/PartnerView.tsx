"use client";

import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { formatNumber, streakLabel } from "@/lib/habits";
import { useT } from "@/lib/i18n/client";
import type { Dict } from "@/lib/i18n";
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
  const t = useT();
  const partnerName = partner.display_name ?? info.partner_name ?? t.common.yourPartnerCap;

  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow">{t.partner.panel}</p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight">
          {t.partner.you} <span className="italic text-ink-3">{t.partner.and}</span> {partnerName}
        </h1>
      </header>

      <Duel me={me} partner={partner} partnerName={partnerName} t={t} />

      <RecoveryInbox requests={requests} partnerName={partnerName} today={me.today} />

      <section>
        <h2 className="eyebrow mb-1">{t.partner.shares(partnerName)}</h2>
        {partner.habits.length === 0 ? (
          <p className="border-y border-line py-6 text-center text-sm text-ink-3">
            {t.partner.notShared(partnerName)}
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
                        ? t.partner.notToday
                        : quantitative
                          ? `${formatNumber(h.progress_today, t.intl)} / ${formatNumber(h.target, t.intl)} ${h.unit ?? ""}`
                          : h.done_today
                            ? t.partner.doneToday
                            : t.partner.pendingToday}
                      {h.current_streak > 0 && ` — ${streakLabel(h.current_streak, h.streak_unit, t)}`}
                    </span>
                  </span>
                  <span
                    aria-label={h.done_today ? t.partner.done : t.partner.pending}
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

function Duel({ me, partner, partnerName, t }: { me: UserSummary; partner: UserSummary; partnerName: string; t: Dict }) {
  const myPct = me.today_pct ?? 0;
  const theirPct = partner.today_pct ?? 0;
  const verdict =
    me.today_pct === null && partner.today_pct === null
      ? t.partner.none
      : myPct === theirPct
        ? myPct === 100
          ? t.partner.bothPerfect
          : t.partner.tied
        : myPct > theirPct
          ? t.partner.ahead(partnerName)
          : t.partner.behind(partnerName);

  return (
    <section>
      <div className="grid grid-cols-2 border-y border-line">
        <Player label={t.partner.you} summary={me} t={t} />
        <Player label={partnerName} summary={partner} t={t} left />
      </div>
      <p className="mt-4 font-serif text-lg italic text-ink-2">{verdict}</p>
    </section>
  );
}

function Player({ label, summary, t, left = false }: { label: string; summary: UserSummary; t: Dict; left?: boolean }) {
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
          <dt className="text-ink-3">{t.partner.week}</dt>
          <dd className="tabular-nums">{summary.week_pct === null ? "–" : `${summary.week_pct}%`}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-3">{t.partner.perfectDay}</dt>
          <dd className="tabular-nums">{summary.perfect_day_streak}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-3">{t.partner.bestStreak}</dt>
          <dd className="tabular-nums">{summary.perfect_day_best}</dd>
        </div>
      </dl>
    </div>
  );
}
