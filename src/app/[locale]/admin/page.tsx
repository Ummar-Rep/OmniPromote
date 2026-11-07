import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { formatAed, formatDate, formatDateTime, pick } from "@/lib/format";
import { DEAL_SELECT, type DealJoined } from "@/lib/queries";
import type { EventRow, Profile, SettingsRow } from "@/lib/types";
import { Badge, Card, Field, Input, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { DealBadge } from "@/components/StatusBadges";
import { Flash } from "@/components/Flash";
import { dealAction, reviewEvent, saveSettings, setVerified } from "./actions";

const TABS = ["overview", "events", "companies", "deals", "attempts", "settings"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL = {
  overview: "tabOverview",
  events: "tabEvents",
  companies: "tabCompanies",
  deals: "tabDeals",
  attempts: "tabAttempts",
  settings: "tabSettings",
} as const;

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; error?: string; ok?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const sp = await searchParams;
  const { supabase } = await requireUser(locale, ["admin"]);
  const t = await getTranslations();
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "overview";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader title={t("admin.title")} />
      <nav className="mb-6 flex flex-wrap gap-2">
        {TABS.map((k) => (
          <Link
            key={k}
            href={{ pathname: "/admin", query: { tab: k } }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === k ? "bg-navy-900 text-white" : "bg-white text-navy-700 hover:bg-navy-50"
            }`}
          >
            {t(`admin.${TAB_LABEL[k]}`)}
          </Link>
        ))}
      </nav>
      <Flash error={sp.error} ok={sp.ok ? t("common.saved") : undefined} />
      {tab === "overview" && <Overview supabase={supabase} locale={locale} />}
      {tab === "events" && <EventsTab supabase={supabase} locale={locale} />}
      {tab === "companies" && <CompaniesTab supabase={supabase} locale={locale} />}
      {tab === "deals" && <DealsTab supabase={supabase} locale={locale} />}
      {tab === "attempts" && <AttemptsTab supabase={supabase} locale={locale} />}
      {tab === "settings" && <SettingsTab supabase={supabase} />}
    </div>
  );
}

type Props = {
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"];
  locale: string;
};

async function Overview({ supabase, locale }: Props) {
  const t = await getTranslations();
  const [{ data: deals }, { count: pending }] = await Promise.all([
    supabase.from("deals").select("status, agreed_price_aed, commission_aed"),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
  ]);
  const live = (deals ?? []).filter((d) => d.status !== "cancelled");
  const sum = (rows: typeof live, key: "agreed_price_aed" | "commission_aed") =>
    rows.reduce((s, d) => s + Number(d[key]), 0);
  const stats = [
    { label: t("admin.gmv"), value: formatAed(sum(live, "agreed_price_aed"), locale) },
    {
      label: t("admin.revenue"),
      value: formatAed(sum(live.filter((d) => d.status === "organizer_paid"), "commission_aed"), locale),
    },
    {
      label: t("admin.pendingRevenue"),
      value: formatAed(sum(live.filter((d) => d.status !== "organizer_paid"), "commission_aed"), locale),
    },
    { label: t("admin.openDeals"), value: String(live.filter((d) => d.status !== "organizer_paid").length) },
    { label: t("admin.pendingEvents"), value: String(pending ?? 0) },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {stats.map((s) => (
        <Card key={s.label}>
          <p className="text-xs text-navy-500">{s.label}</p>
          <p className="mt-1 text-2xl font-bold">{s.value}</p>
        </Card>
      ))}
    </div>
  );
}

async function EventsTab({ supabase, locale }: Props) {
  const t = await getTranslations();
  const { data: events } = await supabase
    .from("events")
    .select("*, organizer:profiles!events_organizer_id_fkey(company_name, verified)")
    .eq("status", "pending_review")
    .order("created_at")
    .returns<(EventRow & { organizer: { company_name: string | null; verified: boolean } | null })[]>();
  if (!events?.length) return <Card>{t("admin.nothingPending")}</Card>;
  return (
    <div className="space-y-4">
      {events.map((e) => (
        <Card key={e.id} className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href={`/events/${e.id}`} className="text-lg font-semibold underline">
              {pick(e, "title", locale)}
            </Link>
            <p className="text-sm text-navy-500">
              {e.organizer?.company_name} {e.organizer?.verified ? "✓" : `(${t("admin.verify")}?)`} ·{" "}
              {t(`emirates.${e.emirate as "Dubai"}`)} · {formatDate(e.start_date, locale)}
            </p>
          </div>
          <form action={reviewEvent} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={e.id} />
            <Input name="reason" placeholder={t("admin.rejectReason")} className="w-56" />
            <SubmitButton variant="danger" name="intent" value="reject">
              {t("admin.reject")}
            </SubmitButton>
            <SubmitButton name="intent" value="approve">
              {t("admin.approve")}
            </SubmitButton>
          </form>
        </Card>
      ))}
    </div>
  );
}

async function CompaniesTab({ supabase, locale }: Props) {
  const t = await getTranslations();
  const { data: companies } = await supabase
    .from("profiles")
    .select("*")
    .neq("role", "admin")
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<Profile[]>();
  return (
    <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-navy-50 text-xs uppercase text-navy-500">
          <tr>
            <th className="px-4 py-3 text-start">{t("auth.companyName")}</th>
            <th className="px-4 py-3 text-start">{t("profile.role")}</th>
            <th className="px-4 py-3 text-start">{t("profile.companyType")}</th>
            <th className="px-4 py-3 text-start">{t("common.date")}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-50">
          {(companies ?? []).map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-3 font-medium">
                {c.company_name ?? "—"} {c.verified && <Badge tone="green">{t("common.verified")}</Badge>}
              </td>
              <td className="px-4 py-3">{c.role === "organizer" ? t("auth.roleOrganizer") : t("auth.roleSponsor")}</td>
              <td className="px-4 py-3">{c.company_type ? t(`companyTypes.${c.company_type as "other"}`) : "—"}</td>
              <td className="px-4 py-3">{formatDate(c.created_at, locale)}</td>
              <td className="px-4 py-3 text-end">
                <form action={setVerified}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="verified" value={String(!c.verified)} />
                  <SubmitButton variant={c.verified ? "secondary" : "primary"}>
                    {c.verified ? t("admin.unverify") : t("admin.verify")}
                  </SubmitButton>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function DealsTab({ supabase, locale }: Props) {
  const t = await getTranslations();
  const { data: deals } = await supabase
    .from("deals")
    .select(DEAL_SELECT)
    .order("created_at", { ascending: false })
    .returns<DealJoined[]>();
  if (!deals?.length) return <Card>{t("dashboard.noDeals")}</Card>;
  const { data: accounts } = await supabase.from("payout_accounts").select("profile_id, payouts_enabled");
  const payoutReady = new Set((accounts ?? []).filter((a) => a.payouts_enabled).map((a) => a.profile_id));
  return (
    <div className="space-y-4">
      {deals.map((d) => {
        const closed = d.status === "organizer_paid" || d.status === "cancelled";
        return (
          <Card key={d.id} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link href={`/deals/${d.id}`} className="font-semibold underline">
                  {d.package?.tier_name} · {d.event ? pick(d.event, "title", locale) : ""}
                </Link>
                <p className="text-sm text-navy-500">
                  {d.sponsor?.company_name} → {d.organizer?.company_name} · {formatDateTime(d.created_at, locale)}
                </p>
              </div>
              <DealBadge status={d.status} />
            </div>
            <p className="text-sm">
              {formatAed(d.agreed_price_aed, locale)} · {t("deal.commission", { rate: String(d.commission_rate * 100) })}:{" "}
              <strong>{formatAed(d.commission_aed, locale)}</strong> · {t("deal.payout")}:{" "}
              {formatAed(d.organizer_payout_aed, locale)}
              {d.payment_method && <> · {t("deal.paidBy")}: {t(`deal.method_${d.payment_method}`)}</>}
              {d.payout_method && <> · {t("admin.payoutVia")}: {t(`admin.payout_${d.payout_method}`)}</>}
              {d.refunded_at && <> · {t("deal.refunded")}</>}
            </p>
            {d.status === "disputed" && d.dispute_reason && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{d.dispute_reason}</p>
            )}
            {!closed && (
              <form action={dealAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={d.id} />
                {d.status === "awaiting_sponsor_payment" && (
                  <SubmitButton name="intent" value="paid" confirm={t("admin.markPaid") + "?"}>
                    {t("admin.markPaid")}
                  </SubmitButton>
                )}
                {(d.status === "proof_approved" || d.status === "proof_uploaded") && (
                  <>
                    {d.payment_method === "card" && payoutReady.has(d.organizer_id) && (
                      <SubmitButton name="intent" value="payout_stripe" confirm={t("admin.payStripe") + "?"}>
                        {t("admin.payStripe")}
                      </SubmitButton>
                    )}
                    <SubmitButton variant="secondary" name="intent" value="payout" confirm={t("admin.markPayout") + "?"}>
                      {t("admin.markPayout")}
                    </SubmitButton>
                  </>
                )}
                {d.status === "disputed" && (
                  <>
                    <SubmitButton name="intent" value="dispute_approve">
                      {t("admin.disputeApprove")}
                    </SubmitButton>
                    <SubmitButton variant="secondary" name="intent" value="dispute_reupload">
                      {t("admin.disputeReupload")}
                    </SubmitButton>
                  </>
                )}
                <Input
                  name="rate"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  defaultValue={Number(d.commission_rate) * 100}
                  className="w-24"
                  aria-label={t("admin.setCommission")}
                />
                <SubmitButton variant="secondary" name="intent" value="commission">
                  {t("admin.setCommission")}
                </SubmitButton>
                <SubmitButton
                  variant="danger"
                  name="intent"
                  value="cancel"
                  confirm={d.payment_method === "card" ? t("admin.cancelRefundConfirm") : t("admin.cancelDeal") + "?"}
                >
                  {t("admin.cancelDeal")}
                </SubmitButton>
              </form>
            )}
          </Card>
        );
      })}
    </div>
  );
}

async function AttemptsTab({ supabase, locale }: Props) {
  const t = await getTranslations();
  const { data: rows } = await supabase
    .from("contact_attempts")
    .select("*, user:profiles(company_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (!rows?.length) return <Card>{t("common.none")}</Card>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-navy-50 text-xs uppercase text-navy-500">
          <tr>
            <th className="px-4 py-3 text-start">{t("common.date")}</th>
            <th className="px-4 py-3 text-start">{t("admin.user")}</th>
            <th className="px-4 py-3 text-start">{t("admin.source")}</th>
            <th className="px-4 py-3 text-start">{t("admin.original")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-50">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap px-4 py-3">{formatDateTime(r.created_at, locale)}</td>
              <td className="px-4 py-3">{(r.user as { company_name: string | null } | null)?.company_name ?? "—"}</td>
              <td className="px-4 py-3">{r.source}</td>
              <td className="px-4 py-3 text-navy-700">{r.original_text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function SettingsTab({ supabase }: Omit<Props, "locale">) {
  const t = await getTranslations();
  const { data: s } = await supabase.from("settings").select("*").eq("id", 1).single<SettingsRow>();
  if (!s) return null;
  return (
    <form action={saveSettings}>
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("admin.legalName")}>
            <Input name="legal_name" defaultValue={s.legal_name} required />
          </Field>
          <Field label={t("admin.trn")}>
            <Input name="trn" defaultValue={s.trn ?? ""} />
          </Field>
        </div>
        <Field label={t("admin.address")}>
          <Input name="address" defaultValue={s.address} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("admin.bankName")}>
            <Input name="bank_name" defaultValue={s.bank_name ?? ""} />
          </Field>
          <Field label={t("admin.accountName")}>
            <Input name="account_name" defaultValue={s.account_name ?? ""} />
          </Field>
          <Field label={t("admin.iban")}>
            <Input name="iban" defaultValue={s.iban ?? ""} dir="ltr" />
          </Field>
          <Field label={t("admin.swift")}>
            <Input name="swift" defaultValue={s.swift ?? ""} dir="ltr" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("admin.defaultCommission")}>
            <Input name="default_commission" type="number" step={0.5} min={0} max={100} defaultValue={s.default_commission_rate * 100} />
          </Field>
          <Field label={t("admin.vatRate")}>
            <Input name="vat_rate" type="number" step={0.5} min={0} max={100} defaultValue={s.vat_rate * 100} />
          </Field>
          <Field label={t("admin.invoicePrefix")}>
            <Input name="invoice_prefix" defaultValue={s.invoice_prefix} />
          </Field>
          <Field label={t("admin.proofReviewDays")}>
            <Input name="proof_review_days" type="number" min={1} max={60} defaultValue={s.proof_review_days} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="founding_partner_offer" defaultChecked={s.founding_partner_offer} />
          {t("admin.foundingOffer")}
        </label>
        <SubmitButton>{t("common.save")}</SubmitButton>
      </Card>
    </form>
  );
}
