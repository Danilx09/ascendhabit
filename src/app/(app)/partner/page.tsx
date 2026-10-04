import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ConnectPartner } from "@/components/partner/ConnectPartner";
import { PartnerView } from "@/components/partner/PartnerView";
import type { PartnerInfo, RecoveryRequest, UserSummary } from "@/types/app";

export const metadata: Metadata = { title: "Socio · AscendHabit" };

export default async function PartnerPage() {
  const supabase = await createClient();
  const { data: info, error } = await supabase.rpc("get_partner_info");
  if (error) throw new Error(error.message);
  const partnerInfo = info as PartnerInfo;

  if (!partnerInfo.partner_id) {
    return (
      <div className="space-y-8">
        <header>
          <p className="eyebrow">Accountability</p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight">Socio</h1>
        </header>
        <ConnectPartner inviteCode={partnerInfo.invite_code} />
      </div>
    );
  }

  const [me, partner, requests] = await Promise.all([
    supabase.rpc("get_my_summary"),
    supabase.rpc("get_partner_summary"),
    supabase.rpc("get_recovery_requests"),
  ]);
  const failed = me.error ?? partner.error ?? requests.error;
  if (failed) throw new Error(failed.message);

  return (
    <PartnerView
      info={partnerInfo}
      me={me.data as UserSummary}
      partner={partner.data as UserSummary}
      requests={(requests.data ?? []) as RecoveryRequest[]}
    />
  );
}
