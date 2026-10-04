import { getDict, isLocale, type Dict } from "@/lib/i18n";
import { formatLongDate } from "@/lib/dates";
import { formatNumber } from "@/lib/habits";

/** Datos que envía la base de datos (private.reminder_payload) */
export interface ReminderPayload {
  email: string;
  name: string | null;
  locale: string;
  today: string;
  pending: {
    name: string;
    icon: string | null;
    kind: "weekly" | "amount" | "check";
    value: number;
    target: number;
    unit: string | null;
    week_done: number;
    times_per_week: number | null;
  }[];
  journal_written: boolean;
  recovery_pending: number;
  test: boolean;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function detailOf(p: ReminderPayload["pending"][number], t: Dict) {
  if (p.kind === "weekly") return t.email.thisWeek(p.week_done, p.times_per_week ?? 0);
  if (p.kind === "amount") {
    return `${formatNumber(Number(p.value), t.intl)} / ${formatNumber(Number(p.target), t.intl)} ${p.unit ?? ""}`.trim();
  }
  return null;
}

/** Correo monocromo y editorial, igual que la app. Nunca incluye nada del diario. */
export function buildReminderEmail(r: ReminderPayload, appUrl: string) {
  const t = getDict(isLocale(r.locale) ? r.locale : "es");
  const n = r.pending.length;
  const hello = t.email.hello(r.name);
  const subject =
    (r.test ? t.email.testPrefix : "") +
    (n > 0 ? t.email.subjectPending(n) : r.recovery_pending > 0 ? t.email.subjectRecovery : t.email.subjectDefault);

  const lines: string[] = [hello, ""];
  if (n > 0) {
    lines.push(t.email.pending(n));
    r.pending.forEach((p) => {
      const d = detailOf(p, t);
      lines.push(`  · ${p.name}${d ? ` (${d})` : ""}`);
    });
  } else {
    lines.push(t.email.allDone);
  }
  if (r.recovery_pending > 0) lines.push("", t.email.recovery(r.recovery_pending));
  if (!r.journal_written) lines.push("", t.email.noJournal);
  lines.push("", `${t.email.open}: ${appUrl}/today`, "", "—", t.email.footer);
  const text = lines.join("\n");

  const serif = "Georgia, 'Times New Roman', serif";
  const sans = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const row = (p: ReminderPayload["pending"][number]) => {
    const d = detailOf(p, t);
    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e4e4e4;font:15px ${sans};color:#0a0a0a;">${escapeHtml(p.name)}</td>
        <td style="padding:12px 0;border-bottom:1px solid #e4e4e4;font:13px ${sans};color:#8c8c8c;text-align:right;">${d ? escapeHtml(d) : ""}</td>
      </tr>`;
  };

  const html = `<!doctype html>
<html lang="${t.intl}"><body style="margin:0;background:#ffffff;">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px;color:#0a0a0a;">
    <p style="margin:0;font:500 11px ${sans};letter-spacing:.14em;text-transform:uppercase;color:#8c8c8c;">${escapeHtml(formatLongDate(r.today, t.intl))}</p>
    <h1 style="margin:12px 0 0;font:400 30px/1.15 ${serif};">${escapeHtml(hello)}</h1>
    <p style="margin:12px 0 0;font:16px/1.5 ${sans};color:#4a4a4a;">${escapeHtml(n > 0 ? t.email.pending(n) : t.email.allDone)}</p>
    ${
      n > 0
        ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border-top:1px solid #e4e4e4;">${r.pending.map(row).join("")}</table>`
        : ""
    }
    ${
      r.recovery_pending > 0
        ? `<p style="margin:24px 0 0;padding:12px 16px;border:1px solid #0a0a0a;font:14px ${sans};">${escapeHtml(t.email.recovery(r.recovery_pending))}</p>`
        : ""
    }
    ${!r.journal_written ? `<p style="margin:24px 0 0;font:italic 17px ${serif};color:#4a4a4a;">${escapeHtml(t.email.noJournal)}</p>` : ""}
    <p style="margin:32px 0 0;">
      <a href="${appUrl}/today" style="display:inline-block;padding:12px 24px;border-radius:999px;background:#0a0a0a;color:#ffffff;font:500 14px ${sans};text-decoration:none;">${escapeHtml(t.email.open)}</a>
    </p>
    <p style="margin:40px 0 0;font:12px ${sans};color:#8c8c8c;">${escapeHtml(t.email.footer)}</p>
  </div>
</body></html>`;

  return { subject, text, html };
}
