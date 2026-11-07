import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { EMIRATES, EVENT_CATEGORIES } from "@/lib/constants";
import { EventCard, type EventWithPackages } from "@/components/EventCard";
import { Input, PageHeader, Select, buttonClass } from "@/components/ui";

type Search = {
  q?: string;
  emirate?: string;
  category?: string;
  from?: string;
  to?: string;
  budget?: string;
  attendance?: string;
};

export default async function BrowseEventsPage({
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
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  let query = supabase
    .from("events")
    .select("*, sponsorship_packages(price_aed, slots_total, slots_taken)")
    .eq("status", "published")
    .gte("end_date", sp.from || today)
    .order("start_date");

  if (sp.q) {
    const q = sp.q.replace(/[%,()]/g, " ");
    query = query.or(`title_en.ilike.%${q}%,title_ar.ilike.%${q}%,description_en.ilike.%${q}%,audience_description.ilike.%${q}%`);
  }
  if (sp.emirate && (EMIRATES as readonly string[]).includes(sp.emirate)) query = query.eq("emirate", sp.emirate);
  if (sp.category && (EVENT_CATEGORIES as readonly string[]).includes(sp.category))
    query = query.eq("category", sp.category);
  if (sp.to) query = query.lte("start_date", sp.to);
  if (sp.attendance && Number(sp.attendance) > 0) query = query.gte("expected_attendance", Number(sp.attendance));

  const { data } = await query.limit(60);
  let events = (data ?? []) as EventWithPackages[];

  // Budget filter: keep events with at least one package at or under the budget (needs login to see prices).
  const budget = Number(sp.budget);
  if (budget > 0) {
    events = events.filter((e) =>
      (e.sponsorship_packages ?? []).some((p) => p.price_aed === null || Number(p.price_aed) <= budget),
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader title={t("browse.title")} subtitle={t("browse.subtitle")} />
      <form className="mb-8 grid gap-3 rounded-2xl border border-navy-100 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input name="q" defaultValue={sp.q} placeholder={t("browse.search")} className="lg:col-span-2" />
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
        <Select name="category" defaultValue={sp.category ?? ""} aria-label={t("browse.category")}>
          <option value="">
            {t("browse.category")}: {t("browse.any")}
          </option>
          {EVENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </Select>
        <label className="text-xs text-navy-500">
          {t("browse.from")}
          <Input type="date" name="from" defaultValue={sp.from} />
        </label>
        <label className="text-xs text-navy-500">
          {t("browse.to")}
          <Input type="date" name="to" defaultValue={sp.to} />
        </label>
        <label className="text-xs text-navy-500">
          {t("browse.maxBudget")}
          <Input type="number" min={0} step={1000} name="budget" defaultValue={sp.budget} />
        </label>
        <label className="text-xs text-navy-500">
          {t("browse.minAttendance")}
          <Input type="number" min={0} step={100} name="attendance" defaultValue={sp.attendance} />
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
          <button className={buttonClass.dark}>{t("browse.apply")}</button>
          <Link href="/events" className={buttonClass.secondary}>
            {t("browse.reset")}
          </Link>
        </div>
      </form>
      <p className="mb-4 text-sm text-navy-500">{t("browse.results", { count: events.length })}</p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
    </div>
  );
}
