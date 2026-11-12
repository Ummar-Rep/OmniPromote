"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getSession } from "@/lib/auth";
import { notifyUser } from "@/lib/email";
import { num, str } from "@/lib/site";
import { getStripe, toFils } from "@/lib/stripe";

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

export async function reviewSpace(form: FormData) {
  const { supabase, locale } = await adminSession();
  const id = str(form, "id")!;
  const approve = str(form, "intent") === "approve";
  const { data, error } = await supabase
    .from("ad_spaces")
    .update(
      approve
        ? { status: "published", rejection_reason: null }
        : { status: "rejected", rejection_reason: str(form, "reason") ?? "Please review your listing." },
    )
    .eq("id", id)
    .select("owner_id, title_en")
    .single();
  if (data) {
    await notifyUser(
      data.owner_id,
      approve
        ? { en: "Your ad space is live", ar: "مساحتك الإعلانية منشورة الآن" }
        : { en: "Your ad space needs changes", ar: "مساحتك الإعلانية تحتاج إلى تعديلات" },
      approve
        ? { en: `"${data.title_en}" is now visible to brands.`, ar: `أصبحت "${data.title_en}" مرئية للمعلنين.` }
        : { en: `Please update "${data.title_en}" and submit again.`, ar: `يرجى تعديل "${data.title_en}" وإرسالها مجددًا.` },
      `/dashboard/spaces/${id}`,
    );
  }
  back(locale, "spaces", error?.message);
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
    ({ error } = await supabase.rpc("admin_mark_organizer_paid", { p_deal_id: id, p_method: "bank_transfer" }));
  } else if (intent === "payout_stripe") {
    error = await payoutWithStripe(supabase, id);
  } else if (intent === "cancel") {
    error = await cancelWithRefund(supabase, id);
  } else if (intent === "dispute_reupload" || intent === "dispute_approve") {
    ({ error } = await supabase.rpc("admin_resolve_dispute", {
      p_deal_id: id,
      p_outcome: intent === "dispute_reupload" ? "reupload" : "approve",
    }));
  } else if (intent === "commission") {
    const pct = num(form, "rate");
    if (pct !== null) ({ error } = await supabase.rpc("admin_set_commission", { p_deal_id: id, p_rate: pct / 100 }));
  }

  if (!error && (intent === "paid" || intent === "payout" || intent === "payout_stripe")) {
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
    if (d && (intent === "payout" || intent === "payout_stripe")) {
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
      proof_review_days: Math.min(60, Math.max(1, num(form, "proof_review_days") ?? 7)),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  back(locale, "settings", error?.message);
}

type Db = Awaited<ReturnType<typeof getSession>>["supabase"];
type Failure = { message: string } | null;

// Sends the organizer's share from the sponsor's card payment to their Stripe account.
async function payoutWithStripe(supabase: Db, dealId: string): Promise<Failure> {
  const stripe = getStripe();
  if (!stripe) return { message: "Stripe is not configured" };
  const { data: d } = await supabase
    .from("deals")
    .select("organizer_id, organizer_payout_aed, payment_method, stripe_payment_intent_id, status")
    .eq("id", dealId)
    .single();
  if (!d) return { message: "Deal not found" };
  if (d.payment_method !== "card" || !d.stripe_payment_intent_id) {
    return { message: "This deal was not paid by card. Pay the organizer by bank transfer instead." };
  }
  if (!["proof_approved", "proof_uploaded"].includes(d.status)) {
    return { message: "Proof must be uploaded before paying the organizer" };
  }
  const { data: account } = await supabase
    .from("payout_accounts")
    .select("stripe_account_id, payouts_enabled")
    .eq("profile_id", d.organizer_id)
    .maybeSingle();
  if (!account?.payouts_enabled) return { message: "The organizer has not finished setting up payouts." };

  let transferId: string | null = null;
  if (Number(d.organizer_payout_aed) > 0) {
    const pi = await stripe.paymentIntents.retrieve(d.stripe_payment_intent_id);
    const charge = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id;
    try {
      const transfer = await stripe.transfers.create(
        {
          amount: toFils(d.organizer_payout_aed),
          currency: "aed",
          destination: account.stripe_account_id,
          source_transaction: charge ?? undefined,
          transfer_group: `deal_${dealId}`,
          metadata: { deal_id: dealId },
        },
        { idempotencyKey: `payout_${dealId}` },
      );
      transferId = transfer.id;
    } catch (err) {
      return { message: (err as Error).message };
    }
  }
  const { error } = await supabase.rpc("admin_mark_organizer_paid", {
    p_deal_id: dealId,
    p_method: "stripe",
    p_transfer_id: transferId,
  });
  return error;
}

// Cancels a deal. Card payments are refunded automatically; bank transfers must be refunded by hand.
async function cancelWithRefund(supabase: Db, dealId: string): Promise<Failure> {
  const { data: d } = await supabase
    .from("deals")
    .select("payment_method, stripe_payment_intent_id, sponsor_paid_at")
    .eq("id", dealId)
    .single();
  let refundId: string | null = null;
  if (d?.payment_method === "card" && d.stripe_payment_intent_id) {
    const stripe = getStripe();
    if (!stripe) return { message: "Stripe is not configured, so the card payment cannot be refunded" };
    try {
      const refund = await stripe.refunds.create(
        { payment_intent: d.stripe_payment_intent_id, metadata: { deal_id: dealId } },
        { idempotencyKey: `refund_${dealId}` },
      );
      refundId = refund.id;
    } catch (err) {
      return { message: (err as Error).message };
    }
  }
  const { error } = await supabase.rpc("admin_cancel_deal", { p_deal_id: dealId, p_refund_id: refundId });
  return error;
}
