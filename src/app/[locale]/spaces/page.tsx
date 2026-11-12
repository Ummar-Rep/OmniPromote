import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { AD_SPACE_TYPES, EMIRATES, EMIRATE_CENTERS, UAE_CENTER } from "@/lib/constants";
import { formatAed, pick } from "@/lib/format";
import type { AdSpaceRow } from "@/lib/types";
import { SpaceCard } from "@/components/SpaceCard";
import { SpacesMap } from "@/components/SpacesMap";
import { Input, PageHeader, Select, buttonClass } from "@/components/ui";

type Search = { q?: string; emirate?: string; type?: string; max?: string; digital?: string; from?: string; weeks?: string };

export default async function BrowseSpacesPage({
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

  let query = supabase.from("ad_spaces").select("*").eq("status", "published").order("created_at", { ascending: false });
  if (sp.q) {
    const q = sp.q.replace(/[%,()]/g, " ");
    query = query.or(`title_en.ilike.%${q}%,title_ar.ilike.%${q}%,area.ilike.%${q}%,description_en.ilike.%${q}%`);
  }
  const emirate = sp.emirate && (EMIRATES as readonly string[]).includes(sp.emirate) ? sp.emirate : null;
  if (emirate) query = query.eq("emirate", emirate);
  if (sp.type && (AD_SPACE_TYPES as readonly string[]).includes(sp.type)) query = query.eq("type", sp.type);
  if (sp.digital === "1") query = query.eq("is_digital", true);
  if (user && Number(sp.max) > 0) query = query.lte("price_per_week_aed", Number(sp.max));

  const { data } = await query.limit(100);
  let spaces = (data ?? []) as AdSpaceRow[];

  // Availability filter: keep spaces that are free for the chosen start date and number of weeks.
  if (sp.from) {
    const weeks = Math.min(52, Math.max(1, Number(sp.weeks) || 1));
    const end = new Date(new Date(sp.from + "T00:00:00Z").getTime() + (weeks * 7 - 1) * 86400000).toISOString().slice(0, 10);
    const checks = await Promise.all(
      spaces.map((s) => supabase.rpc("ad_space_is_free", { p_space: s.id, p_start: sp.from, p_end: end })),
    );
    spaces = spaces.filter((s, i) => checks[i].data === true && weeks >= s.min_weeks);
  }

  const pins = spaces.map((s) => ({
    id: s.id,
    lat: Number(s.lat),
    lng: Number(s.lng),
    title: pick(s, "title", locale),
    subtitle: user ? t("spaces.perWeek", { price: formatAed(s.price_per_week_aed, locale) }) : t(`spaceTypes.${s.type}`),
    href: `/${locale}/spaces/${s.id}`,
  }));
  const center = emirate ? EMIRATE_CENTERS[emirate] : UAE_CENTER;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader title={t("spaces.title")} subtitle={t("spaces.subtitle")} />
      <form className="mb-6 grid gap-3 rounded-2xl border border-navy-100 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input name="q" defaultValue={sp.q} placeholder={t("spaces.search")} className="lg:col-span-2" />
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
        <Select name="type" defaultValue={sp.type ?? ""} aria-label={t("spaceForm.type")}>
          <option value="">
            {t("spaceForm.type")}: {t("browse.any")}
          </option>
          {AD_SPACE_TYPES.map((c) => (
            <option key={c} value={c}>
              {t(`spaceTypes.${c}`)}
            </option>
          ))}
        </Select>
        <label className="text-xs text-navy-500">
          {t("spaces.availableFrom")}
          <Input type="date" name="from" defaultValue={sp.from} />
        </label>
        <label className="text-xs text-navy-500">
          {t("spaces.forWeeks")}
          <Input type="number" min={1} max={52} name="weeks" defaultValue={sp.weeks ?? "2"} />
        </label>
        {user ? (
          <label className="text-xs text-navy-500">
            {t("spaces.maxPerWeek")}
            <Input type="number" min={0} step={1000} name="max" defaultValue={sp.max} />
          </label>
        ) : (
          <span />
        )}
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-navy-700">
          <input type="checkbox" name="digital" value="1" defaultChecked={sp.digital === "1"} /> {t("spaces.digitalOnly")}
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
          <button className={buttonClass.dark}>{t("browse.apply")}</button>
          <Link href="/spaces" className={buttonClass.secondary}>
            {t("browse.reset")}
          </Link>
        </div>
      </form>

      <SpacesMap pins={pins} center={center} zoom={emirate ? 11 : 7} className="mb-8 h-[26rem]" />

      <p className="mb-4 text-sm text-navy-500">{t("spaces.results", { count: spaces.length })}</p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {spaces.map((s) => (
          <SpaceCard key={s.id} space={s} showPrice={!!user} />
        ))}
      </div>
    </div>
  );
}
