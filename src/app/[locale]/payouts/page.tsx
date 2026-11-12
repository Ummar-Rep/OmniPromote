import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge, Card, Notice, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { Flash } from "@/components/Flash";
import { openPayoutDashboard, startPayoutSetup } from "./actions";

export default async function PayoutsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const { error } = await searchParams;
  const { supabase, user } = await requireUser(locale, ["organizer", "media_owner"]);
  const t = await getTranslations("payouts");
  const stripe = getStripe();

  let { data: account } = await supabase
    .from("payout_accounts")
    .select("*")
    .eq("profile_id", user.id)
    .maybeSingle();

  // Refresh status from Stripe when the organizer comes back from onboarding.
  const admin = createAdminClient();
  if (account && stripe && admin && !account.payouts_enabled) {
    const live = await stripe.accounts.retrieve(account.stripe_account_id);
    const update = {
      details_submitted: live.details_submitted ?? false,
      payouts_enabled: live.payouts_enabled ?? false,
      updated_at: new Date().toISOString(),
    };
    await admin.from("payout_accounts").update(update).eq("profile_id", user.id);
    account = { ...account, ...update };
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Flash error={error ? (error === "unavailable" ? t("unavailable") : error) : undefined} />
      {!stripe ? (
        <Notice>{t("unavailable")}</Notice>
      ) : (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{t("status")}</span>
            {account?.payouts_enabled ? (
              <Badge tone="green">{t("ready")}</Badge>
            ) : account ? (
              <Badge tone="gold">{t("incomplete")}</Badge>
            ) : (
              <Badge>{t("notSetUp")}</Badge>
            )}
          </div>
          <p className="text-sm text-navy-700">{account?.payouts_enabled ? t("readyHint") : t("setupHint")}</p>
          <div className="flex flex-wrap gap-2">
            {!account?.payouts_enabled && (
              <form action={startPayoutSetup}>
                <SubmitButton>{account ? t("continue") : t("setup")}</SubmitButton>
              </form>
            )}
            {account?.details_submitted && (
              <form action={openPayoutDashboard}>
                <SubmitButton variant="secondary">{t("dashboard")}</SubmitButton>
              </form>
            )}
          </div>
          <p className="text-xs text-navy-500">{t("bankFallback")}</p>
        </Card>
      )}
    </div>
  );
}
