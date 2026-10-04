import { timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import { buildReminderEmail, type ReminderPayload } from "@/lib/reminder-email";

// La llama la base de datos (pg_cron + pg_net) cada hora con los recordatorios pendientes.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(header: string | null, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header ?? "");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export async function POST(request: Request) {
  const secret = process.env.REMINDER_SECRET;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!secret || !user || !pass) {
    return Response.json({ error: "Faltan variables de entorno del servidor" }, { status: 500 });
  }
  if (!authorized(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  let reminders: ReminderPayload[];
  try {
    const body = (await request.json()) as { reminders?: ReminderPayload[] };
    reminders = Array.isArray(body.reminders) ? body.reminders.filter((r) => r?.email) : [];
  } catch {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (reminders.length === 0) return Response.json({ sent: 0, failed: 0 });

  const appUrl = (process.env.APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  const results = await Promise.allSettled(
    reminders.map((r) => {
      const { subject, text, html } = buildReminderEmail(r, appUrl);
      return transporter.sendMail({ from: `"AscendHabit" <${user}>`, to: r.email, subject, text, html });
    }),
  );

  const failed = results.filter((r) => r.status === "rejected");
  failed.forEach((f) => console.error("[reminders] envío fallido:", (f as PromiseRejectedResult).reason));
  return Response.json({ sent: results.length - failed.length, failed: failed.length });
}
