"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { notifyUser } from "@/lib/email";
import { siteOrigin, str } from "@/lib/site";
import { redirect as nextRedirect } from "next/navigation";
import { getStripe, toFils } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

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
        en: "The provider uploaded proof that your sponsorship or ad campaign was delivered. Please review and approve it.",
        ar: "رفع مقدم الخدمة إثبات تنفيذ رعايتك أو حملتك الإعلانية. يرجى المراجعة والموافقة.",
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

export async function payByCard(form: FormData) {
  const locale = await getLocale();
  const { supabase, user } = await getSession();
  const dealId = str(form, "deal_id")!;
  const back = `/deals/${dealId}`;
  if (!user) return redirect({ href: "/login", locale });

  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return redirect({ href: { pathname: back, query: { error: "cardUnavailable" } }, locale });

  const { data: deal } = await supabase
    .from("deals")
    .select(
      "id, sponsor_id, status, total_due_aed, booking_id, event:events(title_en), package:sponsorship_packages(tier_name), space:ad_spaces(title_en), booking:ad_bookings(weeks)",
    )
    .eq("id", dealId)
    .single<{
      id: string;
      sponsor_id: string;
      status: string;
      total_due_aed: number;
      event: { title_en: string } | null;
      package: { tier_name: string } | null;
      booking_id: string | null;
      space: { title_en: string } | null;
      booking: { weeks: number } | null;
    }>();
  if (!deal || deal.sponsor_id !== user.id || deal.status !== "awaiting_sponsor_payment") {
    return redirect({ href: { pathname: back, query: { error: "notPayable" } }, locale });
  }
  const { data: invoice } = await supabase
    .from("invoices")
    .select("number")
    .eq("deal_id", dealId)
    .eq("type", "sponsor_invoice")
    .single();

  const origin = await siteOrigin();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    client_reference_id: dealId,
    metadata: { deal_id: dealId, invoice: invoice?.number ?? "" },
    payment_intent_data: { metadata: { deal_id: dealId }, transfer_group: `deal_${dealId}` },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "aed",
          unit_amount: toFils(deal.total_due_aed),
          product_data: {
            name: (deal.booking_id
              ? `Ad space booking: ${deal.space?.title_en ?? ""} (${deal.booking?.weeks ?? ""} weeks)`
              : `Sponsorship: ${deal.package?.tier_name ?? ""} – ${deal.event?.title_en ?? ""}`
            ).slice(0, 250),
            description: invoice ? `Invoice ${invoice.number} (incl. VAT)` : undefined,
          },
        },
      },
    ],
    success_url: `${origin}/${locale}${back}?paid=1`,
    cancel_url: `${origin}/${locale}${back}`,
  });
  await admin.rpc("system_set_checkout_session", { p_deal_id: dealId, p_session_id: session.id });
  nextRedirect(session.url!);
}

export async function raiseDispute(form: FormData) {
  const locale = await getLocale();
  const { supabase } = await getSession();
  const dealId = str(form, "deal_id")!;
  const { error } = await supabase.rpc("raise_dispute", { p_deal_id: dealId, p_reason: str(form, "reason") });
  if (!error) {
    const { data: deal } = await supabase.from("deals").select("organizer_id").eq("id", dealId).single();
    if (deal) {
      await notifyUser(
        deal.organizer_id,
        { en: "The sponsor raised a concern", ar: "رفع الراعي ملاحظة" },
        {
          en: "The sponsor raised a concern about your proof of delivery. Our team will review it and contact you.",
          ar: "رفع الراعي ملاحظة على إثبات التنفيذ. سيراجعها فريقنا ويتواصل معك.",
        },
        `/deals/${dealId}`,
      );
    }
  }
  redirect({ href: { pathname: `/deals/${dealId}`, query: error ? { error: error.message } : {} }, locale });
}
