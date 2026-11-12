import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { formatAed, formatCompact, formatNumber, pick } from "@/lib/format";
import type { InfluencerRow } from "@/lib/types";
import { Badge, Card, Field, Input, Notice, Textarea, buttonClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { MaskedText } from "@/components/MaskedText";
import { Flash } from "@/components/Flash";
import { followersOf } from "@/components/InfluencerCard";
import { requestCampaign } from "./actions";

type WithAgency = InfluencerRow & { agency: { company_name: string | null; verified: boolean } | null };

export default async function InfluencerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const { error } = await searchParams;
  const t = await getTranslations();
  const { supabase, user, profile } = await getSession();

  const { data: influencer } = await supabase
    .from("influencers")
    .select("*, agency:profiles!influencers_agency_id_fkey(company_name, verified)")
    .eq("id", id)
    .maybeSingle<WithAgency>();
  if (!influencer) notFound();

  const { data: openRequest } = user
    ? await supabase
        .from("campaign_requests")
        .select("id")
        .eq("influencer_id", id)
        .eq("buyer_id", user.id)
        .eq("status", "requested")
        .maybeSingle()
    : { data: null };

  const isAgency = user?.id === influencer.agency_id;
  const isSponsor = profile?.role === "sponsor";
  const canRequest = influencer.status === "published" && isSponsor && !openRequest;
  const reach = followersOf(influencer);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const prices = [
    { label: t("influencerForm.pricePost"), value: influencer.price_post_aed },
    { label: t("influencerForm.priceStory"), value: influencer.price_story_aed },
    { label: t("influencerForm.priceVideo"), value: influencer.price_video_aed },
  ].filter((p) => p.value !== null);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Flash error={error} />
      <div className="rounded-3xl bg-navy-900 p-8 text-white">
        <div className="flex flex-wrap items-center gap-6">
          <div className="grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-full bg-navy-700 text-4xl font-bold">
            {influencer.avatar_url ? (
              <img src={influencer.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              influencer.name.slice(0, 1)
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge tone="gold">{t(`niches.${influencer.niche}`)}</Badge>
              {influencer.status !== "published" && <Badge>{t(`eventStatus.${influencer.status}`)}</Badge>}
            </div>
            <h1 className="text-3xl font-bold">
              <MaskedText text={influencer.name} />
            </h1>
            <p className="text-sm text-navy-200">
              {t(`emirates.${influencer.emirate as "Dubai"}`)}
              {influencer.languages.length > 0 &&
                ` · ${influencer.languages.map((l) => t(`languages.${l as "Arabic"}`)).join(", ")}`}
            </p>
            <p className="text-sm text-navy-200">
              {t("influencers.managedBy")}: <span className="font-medium text-white">{influencer.agency?.company_name}</span>{" "}
              {influencer.agency?.verified && <span className="text-gold-300">✓ {t("common.verified")}</span>}
            </p>
          </div>
          {isAgency && (
            <Link href={`/dashboard/influencers/${influencer.id}`} className={buttonClass.primary}>
              {t("common.edit")}
            </Link>
          )}
        </div>
        <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-white/10 pt-6 sm:grid-cols-5">
          {reach.map((r) => (
            <div key={r.platform}>
              <dt className="text-xs text-navy-200">{t(`platforms.${r.platform}`)}</dt>
              <dd className="text-2xl font-bold">{formatCompact(r.count, locale)}</dd>
            </div>
          ))}
          {influencer.engagement_rate !== null && (
            <div>
              <dt className="text-xs text-navy-200">{t("influencerForm.engagement")}</dt>
              <dd className="text-2xl font-bold">{formatNumber(influencer.engagement_rate, locale)}%</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section>
            <h2 className="mb-3 text-lg font-bold">{t("event.about")}</h2>
            <p className="whitespace-pre-line text-navy-700">
              <MaskedText text={pick(influencer, "bio", locale)} />
            </p>
          </section>
          {influencer.audience_description && (
            <section>
              <h2 className="mb-3 text-lg font-bold">{t("event.audience")}</h2>
              <p className="text-navy-700">
                <MaskedText text={influencer.audience_description} />
              </p>
            </section>
          )}
          <Notice>{t("influencers.handlesHidden")}</Notice>
        </div>

        <aside className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold">{t("influencers.rates")}</h2>
            {user ? (
              prices.length ? (
                <dl className="space-y-2 text-sm">
                  {prices.map((p) => (
                    <div key={p.label} className="flex justify-between gap-3">
                      <dt className="text-navy-500">{p.label}</dt>
                      <dd className="font-semibold">{formatAed(p.value, locale)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-navy-500">{t("influencers.ratesOnRequest")}</p>
              )
            ) : (
              <p className="text-sm text-navy-500">{t("spaces.loginForPrice")}</p>
            )}
          </Card>

          {!user ? (
            <Card>
              <p className="mb-4 text-navy-700">{t("influencers.loginToBook")}</p>
              <div className="flex gap-3">
                <Link href="/login" className={buttonClass.dark}>
                  {t("nav.login")}
                </Link>
                <Link href="/signup" className={buttonClass.primary}>
                  {t("nav.signup")}
                </Link>
              </div>
            </Card>
          ) : isAgency ? (
            <Notice>{t("influencers.ownInfluencer")}</Notice>
          ) : !isSponsor ? (
            <Notice>{t("influencers.onlySponsors")}</Notice>
          ) : openRequest ? (
            <Link href={`/campaigns/${openRequest.id}`} className={`${buttonClass.primary} w-full`}>
              {t("spaces.viewRequest")}
            </Link>
          ) : canRequest ? (
            <Card>
              <h2 className="mb-1 font-semibold">{t("influencers.requestTitle")}</h2>
              <p className="mb-4 text-xs text-navy-500">{t("influencers.requestHint")}</p>
              <form action={requestCampaign} className="space-y-4">
                <input type="hidden" name="influencer_id" value={influencer.id} />
                <Field label={t("influencers.deliverables")} hint={t("influencers.deliverablesHint")}>
                  <Input name="deliverables" required maxLength={200} />
                </Field>
                <Field label={t("influencers.goLive")}>
                  <Input type="date" name="go_live_date" min={tomorrow} required />
                </Field>
                <Field label={t("influencers.brief")} hint={t("spaces.messageHint")}>
                  <Textarea name="brief" required minLength={20} rows={4} />
                </Field>
                <Field label={t("influencers.budget")}>
                  <Input name="offered_price_aed" type="number" min={0} step={500} required />
                </Field>
                <SubmitButton pendingText={t("common.saving")} className="w-full">
                  {t("influencers.sendRequest")}
                </SubmitButton>
              </form>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
