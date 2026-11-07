import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { formatAed, formatDate, formatNumber, pick } from "@/lib/format";
import type { EventRow, PackageRow } from "@/lib/types";
import { Badge, Card, Field, Input, Notice, Textarea, buttonClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { MaskedText } from "@/components/MaskedText";
import { Flash } from "@/components/Flash";
import { sendProposal } from "./actions";

type EventWithOrganizer = EventRow & {
  organizer: { company_name: string | null; verified: boolean; logo_url: string | null; about: string | null } | null;
};

export default async function EventDetailPage({
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

  const { data: event } = await supabase
    .from("events")
    .select("*, organizer:profiles!events_organizer_id_fkey(company_name, verified, logo_url, about)")
    .eq("id", id)
    .maybeSingle<EventWithOrganizer>();
  if (!event) notFound();

  const { data: packages } = await supabase
    .from("sponsorship_packages")
    .select("*")
    .eq("event_id", id)
    .order("sort_order")
    .returns<PackageRow[]>();

  const isOwner = user?.id === event.organizer_id;
  const isSponsor = profile?.role === "sponsor";
  const canPropose = event.status === "published" && isSponsor;
  const description = pick(event, "description", locale);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Flash error={error} />
      <div className="overflow-hidden rounded-3xl bg-navy-900 text-white">
        <div className="grid md:grid-cols-2">
          <div className="aspect-[16/10] bg-navy-800 md:aspect-auto">
            {event.cover_image_url && <img src={event.cover_image_url} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="flex flex-col gap-4 p-8">
            <div className="flex flex-wrap gap-2">
              <Badge tone="gold">{t(`categories.${event.category}`)}</Badge>
              {event.status !== "published" && <Badge>{t(`eventStatus.${event.status}`)}</Badge>}
            </div>
            <h1 className="text-3xl font-bold leading-tight">
              <MaskedText text={pick(event, "title", locale)} />
            </h1>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-navy-200">{t("event.dates")}</dt>
                <dd className="font-medium">
                  {formatDate(event.start_date, locale)}
                  {event.end_date !== event.start_date && ` – ${formatDate(event.end_date, locale)}`}
                </dd>
              </div>
              <div>
                <dt className="text-navy-200">{t("event.venue")}</dt>
                <dd className="font-medium">
                  {event.venue && <MaskedText text={event.venue} />}
                  {event.venue ? ", " : ""}
                  {t(`emirates.${event.emirate as "Dubai"}`)}
                </dd>
              </div>
              {event.expected_attendance ? (
                <div>
                  <dt className="text-navy-200">{t("browse.minAttendance")}</dt>
                  <dd className="font-medium">
                    {t("common.attendees", { count: formatNumber(event.expected_attendance, locale) })}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-navy-200">{t("event.organizer")}</dt>
                <dd className="font-medium">
                  {event.organizer?.company_name}{" "}
                  {event.organizer?.verified && <span className="text-gold-300">✓ {t("common.verified")}</span>}
                </dd>
              </div>
            </dl>
            {isOwner && (
              <Link href={`/dashboard/events/${event.id}`} className={`${buttonClass.primary} mt-auto self-start`}>
                {t("common.edit")}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-1">
          <section>
            <h2 className="mb-3 text-lg font-bold">{t("event.about")}</h2>
            <p className="whitespace-pre-line text-navy-700">
              <MaskedText text={description} />
            </p>
          </section>
          {event.audience_description && (
            <section>
              <h2 className="mb-3 text-lg font-bold">{t("event.audience")}</h2>
              <p className="text-navy-700">
                <MaskedText text={event.audience_description} />
              </p>
            </section>
          )}
        </div>

        <section className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-bold">{t("event.packages")}</h2>
          {!user ? (
            <Card>
              <p className="mb-4 text-navy-700">{t("common.loginToSee")}</p>
              <div className="flex gap-3">
                <Link href="/login" className={buttonClass.dark}>
                  {t("nav.login")}
                </Link>
                <Link href="/signup" className={buttonClass.primary}>
                  {t("nav.signup")}
                </Link>
              </div>
            </Card>
          ) : (
            <div className="space-y-5">
              {isOwner && <Notice>{t("event.ownEvent")}</Notice>}
              {!isOwner && !isSponsor && <Notice>{t("event.onlySponsors")}</Notice>}
              {(packages ?? []).map((p) => {
                const left = p.slots_total - p.slots_taken;
                return (
                  <Card key={p.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">
                          <MaskedText text={p.tier_name} />
                        </h3>
                        <p className="text-sm text-navy-500">{t(`priceTypes.${p.price_type}`)}</p>
                      </div>
                      <div className="text-end">
                        {p.price_aed !== null && (
                          <p className="text-xl font-bold text-navy-900">{formatAed(p.price_aed, locale)}</p>
                        )}
                        <Badge tone={left > 0 ? "gold" : "red"}>{t("common.slotsLeft", { count: left })}</Badge>
                      </div>
                    </div>
                    {p.in_kind_description && (
                      <p className="mt-3 text-sm">
                        <span className="font-medium">{t("event.inKind")}: </span>
                        <MaskedText text={p.in_kind_description} />
                      </p>
                    )}
                    {p.benefits.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-sm font-medium">{t("event.benefits")}</p>
                        <ul className="grid gap-1.5 text-sm text-navy-700 sm:grid-cols-2">
                          {p.benefits.map((b, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-gold-500">✓</span>
                              <MaskedText text={b} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {p.deliverables_proof && (
                      <p className="mt-3 text-sm text-navy-500">
                        {t("event.proof")}: <MaskedText text={p.deliverables_proof} />
                      </p>
                    )}
                    {canPropose && left > 0 && (
                      <details className="mt-5 rounded-xl border border-navy-100 p-4 open:bg-navy-50/50">
                        <summary className="cursor-pointer font-semibold text-navy-900">{t("event.sendProposal")}</summary>
                        <form action={sendProposal} className="mt-4 space-y-4">
                          <input type="hidden" name="event_id" value={event.id} />
                          <input type="hidden" name="package_id" value={p.id} />
                          <Field label={t("event.yourMessage")} hint={t("event.messageHint")}>
                            <Textarea name="message" required minLength={20} />
                          </Field>
                          {p.price_type === "in_kind" ? (
                            <>
                              <Field label={t("event.inKindOffer")}>
                                <Textarea name="in_kind_offer" rows={2} required />
                              </Field>
                              <Field label={t("event.offerPrice")} optional={t("common.optional")}>
                                <Input name="offered_price_aed" type="number" min={0} step={500} />
                              </Field>
                            </>
                          ) : (
                            <Field
                              label={t("event.offerPrice")}
                              hint={p.price_type === "fixed" ? t("event.offerPriceHint") : undefined}
                              optional={p.price_type === "fixed" ? t("common.optional") : undefined}
                            >
                              <Input
                                name="offered_price_aed"
                                type="number"
                                min={0}
                                step={500}
                                required={p.price_type === "open_offer"}
                                placeholder={p.price_aed ? String(p.price_aed) : undefined}
                              />
                            </Field>
                          )}
                          <SubmitButton pendingText={t("common.saving")}>{t("event.sendProposal")}</SubmitButton>
                        </form>
                      </details>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
