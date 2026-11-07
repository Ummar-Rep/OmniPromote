import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventCard, type EventWithPackages } from "@/components/EventCard";
import { buttonClass } from "@/components/ui";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("home");
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: events }, { count }] = await Promise.all([
    supabase
      .from("events")
      .select("*, sponsorship_packages(price_aed, slots_total, slots_taken)")
      .eq("status", "published")
      .gte("end_date", today)
      .order("start_date")
      .limit(6),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "published"),
  ]);

  const steps = [
    { title: t("forOrganizers"), items: [t("org1"), t("org2"), t("org3"), t("org4")] },
    { title: t("forSponsors"), items: [t("sp1"), t("sp2"), t("sp3"), t("sp4")] },
  ];
  const why = [
    { title: t("why1Title"), body: t("why1") },
    { title: t("why2Title"), body: t("why2") },
    { title: t("why3Title"), body: t("why3") },
  ];

  return (
    <>
      <section className="relative overflow-hidden bg-navy-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(201,162,39,0.25),transparent_45%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-28">
          <span className="inline-block rounded-full border border-gold-500/40 px-3 py-1 text-xs font-medium text-gold-300">
            {t("badge")}
          </span>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">{t("title")}</h1>
          <p className="mt-5 max-w-2xl text-lg text-navy-100">{t("subtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/events" className={`${buttonClass.primary} px-6 py-3 text-base`}>
              {t("ctaSponsor")}
            </Link>
            <Link
              href="/signup?role=organizer"
              className="inline-flex items-center rounded-lg border border-white/30 px-6 py-3 text-base font-semibold hover:bg-white/10"
            >
              {t("ctaOrganizer")}
            </Link>
          </div>
          <p className="mt-6 text-sm text-gold-300">★ {t("foundingBanner")}</p>
          <dl className="mt-12 grid max-w-xl grid-cols-3 gap-6 border-t border-white/10 pt-8">
            <div>
              <dt className="text-xs text-navy-200">{t("statsEvents")}</dt>
              <dd className="text-2xl font-bold">{count ?? 0}</dd>
            </div>
            <div>
              <dt className="text-xs text-navy-200">{t("statsEmirates")}</dt>
              <dd className="text-2xl font-bold">7</dd>
            </div>
            <div>
              <dt className="text-xs text-navy-200">{t("statsSafe")}</dt>
              <dd className="text-2xl font-bold">100%</dd>
            </div>
          </dl>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-8 text-2xl font-bold">{t("howTitle")}</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {steps.map((s) => (
            <div key={s.title} className="rounded-2xl border border-navy-100 bg-white p-6">
              <h3 className="mb-4 font-semibold text-gold-600">{s.title}</h3>
              <ol className="space-y-3">
                {s.items.map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-navy-900 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="text-navy-700">{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-8 text-2xl font-bold">{t("whyTitle")}</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {why.map((w) => (
              <div key={w.title} className="rounded-2xl bg-navy-50 p-6">
                <div className="mb-3 h-1 w-10 rounded bg-gold-500" />
                <h3 className="font-semibold">{w.title}</h3>
                <p className="mt-2 text-sm text-navy-700">{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="text-2xl font-bold">{t("upcoming")}</h2>
          <Link href="/events" className="text-sm font-semibold text-navy-700 underline">
            {t("seeAll")}
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(events as EventWithPackages[] | null)?.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      </section>
    </>
  );
}
