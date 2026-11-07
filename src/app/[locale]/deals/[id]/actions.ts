"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { notifyUser } from "@/lib/email";
import { str } from "@/lib/site";

export async function uploadProof(form: FormData) {
  const locale = await getLocale();
  const { supabase, user } = await getSession();
  const dealId = str(form, "deal_id")!;
  const back = `/deals/${dealId}`;
  if (!user) return redirect({ href: "/login", locale });

  const paths: string[] = [];
  for (const file of form.getAll("files")) {
    if (!(file instanceof File) || file.size === 0) continue;
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const path = `${dealId}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from("deal-proofs").upload(path, file);
    if (error) return redirect({ href: { pathname: back, query: { error: error.message } }, locale });
    paths.push(path);
  }

  const { error } = await supabase.rpc("submit_proof", {
    p_deal_id: dealId,
    p_paths: paths,
    p_notes: str(form, "notes"),
  });
  if (error) return redirect({ href: { pathname: back, query: { error: error.message } }, locale });

  const { data: deal } = await supabase.from("deals").select("sponsor_id").eq("id", dealId).single();
  if (deal) {
    await notifyUser(
      deal.sponsor_id,
      { en: "Proof of delivery uploaded", ar: "تم رفع إثبات التنفيذ" },
      {
        en: "The organizer uploaded proof that your sponsorship was delivered. Please review and approve it.",
        ar: "رفع المنظم إثبات تنفيذ رعايتك. يرجى المراجعة والموافقة.",
      },
      back,
    );
  }
  redirect({ href: back, locale });
}

export async function approveProof(form: FormData) {
  const locale = await getLocale();
  const { supabase } = await getSession();
  const dealId = str(form, "deal_id")!;
  const { error } = await supabase.rpc("approve_proof", { p_deal_id: dealId });
  if (!error) {
    const { data: deal } = await supabase.from("deals").select("organizer_id").eq("id", dealId).single();
    if (deal) {
      await notifyUser(
        deal.organizer_id,
        { en: "Sponsor approved your proof", ar: "وافق الراعي على الإثبات" },
        {
          en: "The sponsor approved your proof of delivery. Your payout is being processed.",
          ar: "وافق الراعي على إثبات التنفيذ. جارٍ تحويل مستحقاتك.",
        },
        `/deals/${dealId}`,
      );
    }
  }
  redirect({ href: { pathname: `/deals/${dealId}`, query: error ? { error: error.message } : {} }, locale });
}
