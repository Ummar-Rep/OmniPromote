"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { notifyUser } from "@/lib/email";
import { str } from "@/lib/site";

export async function sendMessage(form: FormData) {
  const locale = await getLocale();
  const { supabase, user, profile } = await getSession();
  const proposalId = str(form, "proposal_id")!;
  const body = str(form, "body");
  if (!user) return redirect({ href: "/login", locale });
  if (body) {
    const { error } = await supabase.from("messages").insert({ proposal_id: proposalId, sender_id: user.id, body });
    if (error) return redirect({ href: { pathname: `/proposals/${proposalId}`, query: { error: error.message } }, locale });
    const { data: p } = await supabase.from("proposals").select("sponsor_id, organizer_id").eq("id", proposalId).single();
    if (p) {
      const other = p.sponsor_id === user.id ? p.organizer_id : p.sponsor_id;
      await notifyUser(
        other,
        { en: "New message", ar: "رسالة جديدة" },
        {
          en: `${profile?.company_name ?? "Someone"} sent you a message about a sponsorship.`,
          ar: `أرسل لك ${profile?.company_name ?? "أحدهم"} رسالة بخصوص رعاية.`,
        },
        `/proposals/${proposalId}`,
      );
    }
  }
  redirect({ href: `/proposals/${proposalId}#chat-end`, locale });
}

export async function decideProposal(form: FormData) {
  const locale = await getLocale();
  const { supabase, user } = await getSession();
  const proposalId = str(form, "proposal_id")!;
  const intent = str(form, "intent");
  if (!user) return redirect({ href: "/login", locale });

  if (intent === "accept") {
    const { data: dealId, error } = await supabase.rpc("accept_proposal", { p_proposal_id: proposalId });
    if (error) return redirect({ href: { pathname: `/proposals/${proposalId}`, query: { error: error.message } }, locale });
    const { data: p } = await supabase.from("proposals").select("sponsor_id").eq("id", proposalId).single();
    if (p) {
      await notifyUser(
        p.sponsor_id,
        { en: "Your proposal was accepted", ar: "تم قبول عرضك" },
        {
          en: "Good news! The organizer accepted your sponsorship proposal. Your invoice is ready.",
          ar: "أخبار سارة! قبل المنظم عرض الرعاية الخاص بك. فاتورتك جاهزة.",
        },
        `/deals/${dealId}`,
      );
    }
    return redirect({ href: `/deals/${dealId}`, locale });
  }

  const fn = intent === "withdraw" ? "withdraw_proposal" : "reject_proposal";
  const { error } = await supabase.rpc(fn, { p_proposal_id: proposalId });
  redirect({
    href: { pathname: `/proposals/${proposalId}`, query: error ? { error: error.message } : {} },
    locale,
  });
}
