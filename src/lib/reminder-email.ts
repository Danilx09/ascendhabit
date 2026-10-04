/** Datos que envía la base de datos (private.reminder_payload) */
export interface ReminderPayload {
  email: string;
  name: string | null;
  today: string;
  pending: { name: string; icon: string | null; detail: string | null }[];
  journal_written: boolean;
  recovery_pending: number;
  test: boolean;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function longDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  );
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Correo monocromo y editorial, igual que la app. Nunca incluye nada del diario. */
export function buildReminderEmail(r: ReminderPayload, appUrl: string) {
  const n = r.pending.length;
  const hello = r.name ? `Hola, ${r.name}.` : "Hola.";
  const subject =
    (r.test ? "[Prueba] " : "") +
    (n > 0
      ? `Te ${n === 1 ? "queda 1 hábito" : `quedan ${n} hábitos`} hoy`
      : r.recovery_pending > 0
        ? "Tu socio te pidió un rescate"
        : "Tu día en AscendHabit");

  const lines: string[] = [hello, ""];
  if (n > 0) {
    lines.push(n === 1 ? "Te queda un hábito por hoy:" : `Te quedan ${n} hábitos por hoy:`);
    r.pending.forEach((p) => lines.push(`  · ${p.name}${p.detail ? ` (${p.detail})` : ""}`));
  } else {
    lines.push("Hoy ya completaste todos tus hábitos.");
  }
  if (r.recovery_pending > 0) {
    lines.push("", `Tu socio espera tu respuesta a ${r.recovery_pending === 1 ? "1 solicitud" : `${r.recovery_pending} solicitudes`} de rescate.`);
  }
  if (!r.journal_written) lines.push("", "Aún no has escrito en tu diario hoy.");
  lines.push("", `Abrir AscendHabit: ${appUrl}/today`, "", "—", "Puedes cambiar la hora o desactivar estos correos en Ajustes.");
  const text = lines.join("\n");

  const serif = "Georgia, 'Times New Roman', serif";
  const sans = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const row = (p: ReminderPayload["pending"][number]) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e4e4e4;font:15px ${sans};color:#0a0a0a;">${escapeHtml(p.name)}</td>
        <td style="padding:12px 0;border-bottom:1px solid #e4e4e4;font:13px ${sans};color:#8c8c8c;text-align:right;">${p.detail ? escapeHtml(p.detail) : ""}</td>
      </tr>`;

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#ffffff;">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px;color:#0a0a0a;">
    <p style="margin:0;font:500 11px ${sans};letter-spacing:.14em;text-transform:uppercase;color:#8c8c8c;">${escapeHtml(longDate(r.today))}</p>
    <h1 style="margin:12px 0 0;font:400 30px/1.15 ${serif};">${escapeHtml(hello)}</h1>
    <p style="margin:12px 0 0;font:16px/1.5 ${sans};color:#4a4a4a;">
      ${n > 0 ? (n === 1 ? "Te queda un hábito por hoy." : `Te quedan ${n} hábitos por hoy.`) : "Hoy ya completaste todos tus hábitos."}
    </p>
    ${
      n > 0
        ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border-top:1px solid #e4e4e4;">${r.pending.map(row).join("")}</table>`
        : ""
    }
    ${
      r.recovery_pending > 0
        ? `<p style="margin:24px 0 0;padding:12px 16px;border:1px solid #0a0a0a;font:14px ${sans};">Tu socio espera tu respuesta a ${
            r.recovery_pending === 1 ? "1 solicitud" : `${r.recovery_pending} solicitudes`
          } de rescate.</p>`
        : ""
    }
    ${!r.journal_written ? `<p style="margin:24px 0 0;font:italic 17px ${serif};color:#4a4a4a;">Aún no has escrito en tu diario hoy.</p>` : ""}
    <p style="margin:32px 0 0;">
      <a href="${appUrl}/today" style="display:inline-block;padding:12px 24px;border-radius:999px;background:#0a0a0a;color:#ffffff;font:500 14px ${sans};text-decoration:none;">Abrir AscendHabit</a>
    </p>
    <p style="margin:40px 0 0;font:12px ${sans};color:#8c8c8c;">Puedes cambiar la hora o desactivar estos correos en Ajustes.</p>
  </div>
</body></html>`;

  return { subject, text, html };
}
