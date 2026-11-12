"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { notifyUser } from "@/lib/email";
import { str } from "@/lib/site";

export async function sendCampaignMessage(form: FormData) {
  const locale = await getLocale();
  const { supabase, user, profile } = await getSession();
  const campaignId = str(form, "campaign_id")!;
  const body = str(form, "body");
  if (!user) return redirect({ href: "/login", locale });
  if (body) {
    const { error } = await supabase.from("messages").insert({ campaign_id: campaignId, sender_id: user.id, body });
    if (error) return redirect({ href: { pathname: `/campaigns/${campaignId}`, query: { error: error.message } }, locale });
    const { data: b } = await supabase.from("campaign_requests").select("buyer_id, agency_id").eq("id", campaignId).single();
    if (b) {
      await notifyUser(
        b.buyer_id === user.id ? b.agency_id : b.buyer_id,
        { en: "New message", ar: "رسالة جديدة" },
        {
          en: `${profile?.company_name ?? "Someone"} sent you a message about an influencer campaign.`,
          ar: `أرسل لك ${profile?.company_name ?? "أحدهم"} رسالة بخصوص حملة مؤثرين.`,
        },
        `/campaigns/${campaignId}`,
      );
    }
  }
  redirect({ href: `/campaigns/${campaignId}#chat-end`, locale });
}

export async function decideCampaign(form: FormData) {
  const locale = await getLocale();
  const { supabase, user } = await getSession();
  const campaignId = str(form, "campaign_id")!;
  const intent = str(form, "intent");
  if (!user) return redirect({ href: "/login", locale });

  if (intent === "accept") {
    const { data: dealId, error } = await supabase.rpc("accept_campaign", { p_campaign_id: campaignId });
    if (error) return redirect({ href: { pathname: `/campaigns/${campaignId}`, query: { error: error.message } }, locale });
    const { data: b } = await supabase.from("campaign_requests").select("buyer_id").eq("id", campaignId).single();
    if (b) {
      await notifyUser(
        b.buyer_id,
        { en: "Your campaign was accepted", ar: "تم قبول حملتك" },
        {
          en: "Good news! The agency accepted your influencer campaign. Your invoice is ready.",
          ar: "أخبار سارة! قبلت الوكالة حملة المؤثرين الخاصة بك. فاتورتك جاهزة.",
        },
        `/deals/${dealId}`,
      );
    }
    return redirect({ href: `/deals/${dealId}`, locale });
  }

  const fn = intent === "withdraw" ? "withdraw_campaign" : "decline_campaign";
  const { error } = await supabase.rpc(fn, { p_campaign_id: campaignId });
  redirect({ href: { pathname: `/campaigns/${campaignId}`, query: error ? { error: error.message } : {} }, locale });
}
