"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { notifyUser } from "@/lib/email";
import { num, str } from "@/lib/site";

export async function requestCampaign(form: FormData) {
  const locale = await getLocale();
  const { supabase, user, profile } = await getSession();
  const influencerId = str(form, "influencer_id")!;
  if (!user || !profile) return redirect({ href: "/login", locale });
  if (!profile.onboarded) return redirect({ href: "/profile?welcome=1", locale });

  const { data, error } = await supabase
    .from("campaign_requests")
    .insert({
      influencer_id: influencerId,
      buyer_id: user.id,
      // Set by the database from the influencer's agency; given here only to satisfy the column type.
      agency_id: user.id,
      deliverables: str(form, "deliverables") ?? "",
      go_live_date: str(form, "go_live_date"),
      brief: str(form, "brief") ?? "",
      offered_price_aed: num(form, "offered_price_aed") ?? 0,
    })
    .select("id, agency_id")
    .single();

  if (error || !data) {
    return redirect({ href: { pathname: `/influencers/${influencerId}`, query: { error: error?.message ?? "error" } }, locale });
  }

  await notifyUser(
    data.agency_id,
    { en: "New influencer campaign request", ar: "طلب حملة مؤثرين جديد" },
    {
      en: `${profile.company_name ?? "A brand"} sent a campaign request for one of your influencers.`,
      ar: `أرسل ${profile.company_name ?? "أحد المعلنين"} طلب حملة لأحد المؤثرين لديك.`,
    },
    `/campaigns/${data.id}`,
  );
  redirect({ href: `/campaigns/${data.id}`, locale });
}
