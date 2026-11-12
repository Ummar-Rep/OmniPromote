import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { formatAed, formatDate, pick } from "@/lib/format";
import {
  BOOKING_SELECT,
  DEAL_SELECT,
  PROPOSAL_SELECT,
  dealSubtitle,
  dealTitle,
  type BookingJoined,
  type DealJoined,
  type ProposalJoined,
} from "@/lib/queries";
import type { AdSpaceRow, EventRow } from "@/lib/types";
import { Badge, Card, Notice, PageHeader, buttonClass } from "@/components/ui";
import { BookingBadge, DealBadge, ProposalBadge } from "@/components/StatusBadges";

const statusTone = { draft: "gray", pending_review: "blue", published: "green", rejected: "red", closed: "gray" } as const;

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const { supabase, user, profile } = await requireUser(locale);
  if (profile.role === "admin") return redirect({ href: "/admin", locale: locale as Locale });
  const t = await getTranslations();
  const isOrganizer = profile.role === "organizer";
  const isMediaOwner = profile.role === "media_owner";
  const isProvider = isOrganizer || isMediaOwner;
  const roleColumn = isProvider ? "organizer_id" : "sponsor_id";

  const [{ data: events }, { data: spaces }, { data: proposals }, { data: bookings }, { data: deals }] = await Promise.all([
    isOrganizer
      ? supabase.from("events").select("*").eq("organizer_id", user.id).order("start_date").returns<EventRow[]>()
      : Promise.resolve({ data: [] as EventRow[] }),
    isMediaOwner
      ? supabase.from("ad_spaces").select("*").eq("owner_id", user.id).order("created_at").returns<AdSpaceRow[]>()
      : Promise.resolve({ data: [] as AdSpaceRow[] }),
    isMediaOwner
      ? Promise.resolve({ data: [] as ProposalJoined[] })
      : supabase
          .from("proposals")
          .select(PROPOSAL_SELECT)
          .eq(roleColumn, user.id)
          .order("created_at", { ascending: false })
          .returns<ProposalJoined[]>(),
    isOrganizer
      ? Promise.resolve({ data: [] as BookingJoined[] })
      : supabase
          .from("ad_bookings")
          .select(BOOKING_SELECT)
          .eq(isMediaOwner ? "owner_id" : "buyer_id", user.id)
          .order("created_at", { ascending: false })
          .returns<BookingJoined[]>(),
    supabase
      .from("deals")
      .select(DEAL_SELECT)
      .eq(roleColumn, user.id)
      .order("created_at", { ascending: false })
      .returns<DealJoined[]>(),
  ]);
  const weeksLabel = (n: number) => t("spaces.weeks", { count: n });

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10">
      <PageHeader
        title={isOrganizer ? t("dashboard.organizerTitle") : isMediaOwner ? t("dashboard.mediaOwnerTitle") : t("dashboard.sponsorTitle")}
        subtitle={profile.company_name ?? undefined}
        action={
          isOrganizer ? (
            <Link href="/dashboard/events/new" className={buttonClass.primary}>
              + {t("dashboard.newEvent")}
            </Link>
          ) : isMediaOwner ? (
            <Link href="/dashboard/spaces/new" className={buttonClass.primary}>
              + {t("dashboard.newSpace")}
            </Link>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Link href="/events" className={buttonClass.primary}>
                {t("dashboard.browseCta")}
              </Link>
              <Link href="/spaces" className={buttonClass.secondary}>
                {t("dashboard.browseSpacesCta")}
              </Link>
            </div>
          )
        }
      />
      {isProvider && !profile.verified && <Notice>{t("dashboard.pendingNotice")}</Notice>}

      {isOrganizer && (
        <section>
          <h2 className="mb-4 text-lg font-bold">{t("dashboard.myEvents")}</h2>
          {events?.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((e) => (
                <Link
                  key={e.id}
                  href={`/dashboard/events/${e.id}`}
                  className="rounded-2xl border border-navy-100 bg-white p-5 transition hover:shadow-md"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge tone={statusTone[e.status]}>{t(`eventStatus.${e.status}`)}</Badge>
                    <span className="text-xs text-navy-500">{formatDate(e.start_date, locale)}</span>
                  </div>
                  <p className="font-semibold">{pick(e, "title", locale)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <p className="text-navy-500">{t("dashboard.noEvents")}</p>
            </Card>
          )}
        </section>
      )}

      {isMediaOwner && (
        <section>
          <h2 className="mb-4 text-lg font-bold">{t("dashboard.mySpaces")}</h2>
          {spaces?.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {spaces.map((s) => (
                <Link
                  key={s.id}
                  href={`/dashboard/spaces/${s.id}`}
                  className="rounded-2xl border border-navy-100 bg-white p-5 transition hover:shadow-md"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge tone={statusTone[s.status]}>{t(`eventStatus.${s.status}`)}</Badge>
                    <span className="text-xs text-navy-500">{t(`spaceTypes.${s.type}`)}</span>
                  </div>
                  <p className="font-semibold">{pick(s, "title", locale)}</p>
                  <p className="text-xs text-navy-500">{t(`emirates.${s.emirate as "Dubai"}`)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <p className="text-navy-500">{t("dashboard.noSpaces")}</p>
            </Card>
          )}
        </section>
      )}

      {!isOrganizer && (
        <section>
          <h2 className="mb-4 text-lg font-bold">
            {isMediaOwner ? t("dashboard.bookingsReceived") : t("dashboard.bookingsSent")}
          </h2>
          {bookings?.length ? (
            <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-navy-50 text-xs uppercase text-navy-500">
                  <tr>
                    <th className="px-4 py-3 text-start">{t("dashboard.space")}</th>
                    <th className="px-4 py-3 text-start">{t("common.date")}</th>
                    <th className="px-4 py-3 text-start">{isMediaOwner ? t("dashboard.from") : t("dashboard.to")}</th>
                    <th className="px-4 py-3 text-start">{t("common.status")}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td className="px-4 py-3 font-medium">{b.space ? pick(b.space, "title", locale) : ""}</td>
                      <td className="px-4 py-3">
                        {formatDate(b.start_date, locale)} · {weeksLabel(b.weeks)}
                      </td>
                      <td className="px-4 py-3">{isMediaOwner ? b.buyer?.company_name : b.owner?.company_name}</td>
                      <td className="px-4 py-3">
                        <BookingBadge status={b.status} />
                      </td>
                      <td className="px-4 py-3 text-end">
                        <Link href={`/bookings/${b.id}`} className="font-semibold text-navy-700 underline">
                          {t("dashboard.open")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Card>
              <p className="text-navy-500">{t("dashboard.noBookings")}</p>
            </Card>
          )}
        </section>
      )}

      {!isMediaOwner && (
      <section>
        <h2 className="mb-4 text-lg font-bold">
          {isOrganizer ? t("dashboard.proposalsReceived") : t("dashboard.proposalsSent")}
        </h2>
        {proposals?.length ? (
          <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-navy-50 text-start text-xs uppercase text-navy-500">
                <tr>
                  <th className="px-4 py-3 text-start">{t("dashboard.event")}</th>
                  <th className="px-4 py-3 text-start">{t("dashboard.package")}</th>
                  <th className="px-4 py-3 text-start">{isOrganizer ? t("dashboard.from") : t("dashboard.to")}</th>
                  <th className="px-4 py-3 text-start">{t("proposal.offer")}</th>
                  <th className="px-4 py-3 text-start">{t("common.status")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {proposals.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium">{p.event ? pick(p.event, "title", locale) : ""}</td>
                    <td className="px-4 py-3">{p.package?.tier_name}</td>
                    <td className="px-4 py-3">{isOrganizer ? p.sponsor?.company_name : p.organizer?.company_name}</td>
                    <td className="px-4 py-3">
                      {formatAed(p.offered_price_aed ?? p.package?.price_aed, locale) || t("priceTypes.in_kind")}
                    </td>
                    <td className="px-4 py-3">
                      <ProposalBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Link href={`/proposals/${p.id}`} className="font-semibold text-navy-700 underline">
                        {t("dashboard.open")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Card>
            <p className="text-navy-500">{t("dashboard.noProposals")}</p>
          </Card>
        )}
      </section>

      )}

      <section>
        <h2 className="mb-4 text-lg font-bold">{t("dashboard.deals")}</h2>
        {deals?.length ? (
          <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-navy-50 text-xs uppercase text-navy-500">
                <tr>
                  <th className="px-4 py-3 text-start">{t("dashboard.listing")}</th>
                  <th className="px-4 py-3 text-start">{t("dashboard.details")}</th>
                  <th className="px-4 py-3 text-start">{isProvider ? t("dashboard.payout") : t("dashboard.total")}</th>
                  <th className="px-4 py-3 text-start">{t("common.status")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {deals.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3 font-medium">{dealTitle(d, locale)}</td>
                    <td className="px-4 py-3">{dealSubtitle(d, weeksLabel)}</td>
                    <td className="px-4 py-3">
                      {formatAed(isProvider ? d.organizer_payout_aed : d.total_due_aed, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <DealBadge status={d.status} />
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Link href={`/deals/${d.id}`} className="font-semibold text-navy-700 underline">
                        {t("dashboard.open")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Card>
            <p className="text-navy-500">{t("dashboard.noDeals")}</p>
          </Card>
        )}
      </section>
    </div>
  );
}
