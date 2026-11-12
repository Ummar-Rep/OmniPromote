"use server";

import { getLocale } from "next-intl/server";
import { redirect as nextRedirect } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/site";

// Sends the organizer to Stripe to add their bank account for payouts.
export async function startPayoutSetup() {
  const locale = await getLocale();
  const { supabase, user, profile } = await getSession();
  if (!user || (profile?.role !== "organizer" && profile?.role !== "media_owner")) return redirect({ href: "/dashboard", locale });

  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return redirect({ href: { pathname: "/payouts", query: { error: "unavailable" } }, locale });

  const { data: existing } = await supabase
    .from("payout_accounts")
    .select("stripe_account_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  let accountId = existing?.stripe_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "AE",
      email: user.email,
      business_type: "company",
      business_profile: { name: profile.company_name ?? undefined },
      capabilities: { transfers: { requested: true } },
      metadata: { profile_id: user.id },
    });
    accountId = account.id;
    await admin.from("payout_accounts").insert({ profile_id: user.id, stripe_account_id: accountId });
  }

  const origin = await siteOrigin();
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${origin}/${locale}/payouts`,
    return_url: `${origin}/${locale}/payouts?return=1`,
  });
  nextRedirect(link.url);
}

// Opens the organizer's Stripe Express dashboard (payout history, bank details).
export async function openPayoutDashboard() {
  const locale = await getLocale();
  const { supabase, user } = await getSession();
  const stripe = getStripe();
  if (!user || !stripe) return redirect({ href: "/payouts", locale });
  const { data } = await supabase.from("payout_accounts").select("stripe_account_id").eq("profile_id", user.id).single();
  if (!data) return redirect({ href: "/payouts", locale });
  const login = await stripe.accounts.createLoginLink(data.stripe_account_id);
  nextRedirect(login.url);
}
