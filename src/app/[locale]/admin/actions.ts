"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getSession } from "@/lib/auth";
import { notifyUser } from "@/lib/email";
import { num, str } from "@/lib/site";

async function adminSession() {
  const locale = await getLocale();
  const session = await getSession();
  if (session.profile?.role !== "admin") redirect({ href: "/", locale });
  return { ...session, locale };
}

function back(locale: Locale, tab: string, error?: string) {
  redirect({ href: { pathname: "/admin", query: error ? { tab, error } : { tab, ok: "1" } }, locale });
}

export async function reviewEvent(form: FormData) {
  const { supabase, locale } = await adminSession();
  const id = str(form, "id")!;
  const approve = str(form, "intent") === "approve";
  const { data, error } = await supabase
    .from("events")
    .update(
      approve
        ? { status: "published", rejection_reason: null }
        : { status: "rejected", rejection_reason: str(form, "reason") ?? "Please review your listing." },
    )
    .eq("id", id)
    .select("organizer_id, title_en")
    .single();
  if (data) {
    await notifyUser(
      data.organizer_id,
      approve
        ? { en: "Your event is live", ar: "فعاليتك منشورة الآن" }
        : { en: "Your event needs changes", ar: "فعاليتك تحتاج إلى تعديلات" },
      approve
        ? { en: `"${data.title_en}" is now visible to sponsors.`, ar: `أصبحت "${data.title_en}" مرئية للرعاة.` }
        : { en: `Please update "${data.title_en}" and submit again.`, ar: `يرجى تعديل "${data.title_en}" وإرسالها مجددًا.` },
      `/dashboard/events/${id}`,
    );
  }
  back(locale, "events", error?.message);
}

export async function setVerified(form: FormData) {
  const { supabase, locale } = await adminSession();
  const { error } = await supabase
    .from("profiles")
    .update({ verified: str(form, "verified") === "true" })
    .eq("id", str(form, "id")!);
  back(locale, "companies", error?.message);
}

export async function dealAction(form: FormData) {
  const { supabase, locale } = await adminSession();
  const id = str(form, "id")!;
  const intent = str(form, "intent");
  let error;
  if (intent === "paid") {
    ({ error } = await supabase.rpc("admin_mark_sponsor_paid", { p_deal_id: id }));
  } else if (intent === "payout") {
    ({ error } = await supabase.rpc("admin_mark_organizer_paid", { p_deal_id: id }));
  } else if (intent === "cancel") {
    ({ error } = await supabase.rpc("admin_cancel_deal", { p_deal_id: id }));
  } else if (intent === "commission") {
    const pct = num(form, "rate");
    if (pct !== null) ({ error } = await supabase.rpc("admin_set_commission", { p_deal_id: id, p_rate: pct / 100 }));
  }

  if (!error && (intent === "paid" || intent === "payout")) {
    const { data: d } = await supabase.from("deals").select("sponsor_id, organizer_id").eq("id", id).single();
    if (d && intent === "paid") {
      for (const uid of [d.sponsor_id, d.organizer_id]) {
        await notifyUser(
          uid,
          { en: "Payment received", ar: "تم استلام الدفعة" },
          {
            en: "We received the sponsor's payment. Contact details are now shared between both sides.",
            ar: "استلمنا دفعة الراعي. أصبحت بيانات التواصل متاحة للطرفين.",
          },
          `/deals/${id}`,
        );
      }
    }
    if (d && intent === "payout") {
      await notifyUser(
        d.organizer_id,
        { en: "Payout sent", ar: "تم تحويل مستحقاتك" },
        { en: "We have sent your sponsorship payout.", ar: "قمنا بتحويل مستحقات الرعاية الخاصة بك." },
        `/deals/${id}`,
      );
    }
  }
  back(locale, "deals", error?.message);
}

export async function saveSettings(form: FormData) {
  const { supabase, locale } = await adminSession();
  const { error } = await supabase
    .from("settings")
    .update({
      legal_name: str(form, "legal_name") ?? "OmniPromote FZE",
      address: str(form, "address") ?? "United Arab Emirates",
      trn: str(form, "trn"),
      bank_name: str(form, "bank_name"),
      account_name: str(form, "account_name"),
      iban: str(form, "iban"),
      swift: str(form, "swift"),
      default_commission_rate: (num(form, "default_commission") ?? 15) / 100,
      vat_rate: (num(form, "vat_rate") ?? 5) / 100,
      invoice_prefix: str(form, "invoice_prefix") ?? "OP",
      founding_partner_offer: form.get("founding_partner_offer") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  back(locale, "settings", error?.message);
}
