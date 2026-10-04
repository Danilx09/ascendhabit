import { createClient } from "@/lib/supabase/server";
import { ConnectPartner } from "@/components/partner/ConnectPartner";
import { PartnerView } from "@/components/partner/PartnerView";
import { getT } from "@/lib/i18n/server";
import { pageTitle } from "@/lib/i18n/metadata";
import type { PartnerInfo, RecoveryRequest, UserSummary } from "@/types/app";

export const generateMetadata = pageTitle("partner");

export default async function PartnerPage() {
  const supabase = await createClient();
  const t = await getT();
  const { data: info, error } = await supabase.rpc("get_partner_info");
  if (error) throw new Error(error.message);
  const partnerInfo = info as PartnerInfo;

  if (!partnerInfo.partner_id) {
    return (
      <div className="space-y-8">
        <header>
          <p className="eyebrow">{t.partner.eyebrow}</p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight">{t.partner.title}</h1>
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
