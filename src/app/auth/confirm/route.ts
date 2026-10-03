import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Alternativa al código: el enlace del email trae token_hash y llega aquí.
// (En el iPhone con la app instalada es mejor el código; el enlace abre Safari.)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/today";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/today";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(safeNext);
  }

  redirect("/login?error=link");
}
