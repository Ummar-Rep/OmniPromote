import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { EMIRATES, INFLUENCER_NICHES, LANGUAGES, PLATFORMS } from "@/lib/constants";
import type { InfluencerRow } from "@/lib/types";
import { InfluencerCard, lowestPrice } from "@/components/InfluencerCard";
import { Input, PageHeader, Select, buttonClass } from "@/components/ui";

type Search = { q?: string; niche?: string; emirate?: string; platform?: string; min?: string; language?: string; max?: string };

export default async function BrowseInfluencersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const sp = await searchParams;
  const t = await getTranslations();
  const { supabase, user } = await getSession();

  let query = supabase.from("influencers").select("*").eq("status", "published").order("created_at", { ascending: false });
  if (sp.q) {
    const q = sp.q.replace(/[%,()]/g, " ");
    query = query.or(`name.ilike.%${q}%,bio_en.ilike.%${q}%,bio_ar.ilike.%${q}%,audience_description.ilike.%${q}%`);
  }
  if (sp.niche && (INFLUENCER_NICHES as readonly string[]).includes(sp.niche)) query = query.eq("niche", sp.niche);
  if (sp.emirate && (EMIRATES as readonly string[]).includes(sp.emirate)) query = query.eq("emirate", sp.emirate);
  if (sp.language && (LANGUAGES as readonly string[]).includes(sp.language)) query = query.contains("languages", [sp.language]);
  const platform = (PLATFORMS as readonly string[]).includes(sp.platform ?? "") ? sp.platform : null;
  if (platform) query = query.gte(`${platform}_followers`, Math.max(1, Number(sp.min) || 1));

  const { data } = await query.limit(100);
  let influencers = (data ?? []) as InfluencerRow[];
  const max = Number(sp.max);
  if (user && max > 0) influencers = influencers.filter((i) => (lowestPrice(i) ?? Infinity) <= max);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader title={t("influencers.title")} subtitle={t("influencers.subtitle")} />
      <form className="mb-8 grid gap-3 rounded-2xl border border-navy-100 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input name="q" defaultValue={sp.q} placeholder={t("influencers.search")} className="lg:col-span-2" />
        <Select name="niche" defaultValue={sp.niche ?? ""} aria-label={t("influencerForm.niche")}>
          <option value="">
            {t("influencerForm.niche")}: {t("browse.any")}
          </option>
          {INFLUENCER_NICHES.map((n) => (
            <option key={n} value={n}>
              {t(`niches.${n}`)}
            </option>
          ))}
        </Select>
        <Select name="emirate" defaultValue={sp.emirate ?? ""} aria-label={t("browse.emirate")}>
          <option value="">
            {t("browse.emirate")}: {t("browse.any")}
          </option>
          {EMIRATES.map((e) => (
            <option key={e} value={e}>
              {t(`emirates.${e}`)}
            </option>
          ))}
        </Select>
        <Select name="platform" defaultValue={sp.platform ?? ""} aria-label={t("influencers.platform")}>
          <option value="">
            {t("influencers.platform")}: {t("browse.any")}
          </option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {t(`platforms.${p}`)}
            </option>
          ))}
        </Select>
        <label className="text-xs text-navy-500">
          {t("influencers.minFollowers")}
          <Input type="number" min={0} step={10000} name="min" defaultValue={sp.min} />
        </label>
        <Select name="language" defaultValue={sp.language ?? ""} aria-label={t("influencerForm.languages")}>
          <option value="">
            {t("influencerForm.languages")}: {t("browse.any")}
          </option>
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {t(`languages.${l}`)}
            </option>
          ))}
        </Select>
        {user ? (
          <label className="text-xs text-navy-500">
            {t("browse.maxBudget")}
            <Input type="number" min={0} step={1000} name="max" defaultValue={sp.max} />
          </label>
        ) : (
          <span />
        )}
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
          <button className={buttonClass.dark}>{t("browse.apply")}</button>
          <Link href="/influencers" className={buttonClass.secondary}>
            {t("browse.reset")}
          </Link>
        </div>
      </form>
      <p className="mb-4 text-sm text-navy-500">{t("influencers.results", { count: influencers.length })}</p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {influencers.map((i) => (
          <InfluencerCard key={i.id} influencer={i} showPrice={!!user} />
        ))}
      </div>
    </div>
  );
}
