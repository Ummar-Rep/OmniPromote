import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/email";

// Stripe calls this URL when a card payment completes or an organizer's payout account changes.
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const admin = createAdminClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !admin || !secret) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, request.headers.get("stripe-signature") ?? "", secret);
  } catch (err) {
    return NextResponse.json({ error: `Invalid signature: ${(err as Error).message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    const dealId = session.metadata?.deal_id;
    if (dealId && session.payment_status === "paid") {
      const paymentIntent =
        typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
      const { data: changed, error } = await admin.rpc("system_mark_sponsor_paid", {
        p_deal_id: dealId,
        p_payment_intent: paymentIntent,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      if (changed) {
        const { data: deal } = await admin.from("deals").select("sponsor_id, organizer_id").eq("id", dealId).single();
        for (const uid of deal ? [deal.sponsor_id, deal.organizer_id] : []) {
          await notifyUser(
            uid,
            { en: "Payment received", ar: "تم استلام الدفعة" },
            {
              en: "The sponsor's card payment was received. Contact details are now shared between both sides.",
              ar: "تم استلام دفعة الراعي بالبطاقة. أصبحت بيانات التواصل متاحة للطرفين.",
            },
            `/deals/${dealId}`,
          );
        }
      }
    }
  }

  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;
    await admin
      .from("payout_accounts")
      .update({
        details_submitted: account.details_submitted ?? false,
        payouts_enabled: account.payouts_enabled ?? false,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_account_id", account.id);
  }

  return NextResponse.json({ received: true });
}
