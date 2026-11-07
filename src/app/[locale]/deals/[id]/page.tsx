import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { formatAed, formatDate, formatDateTime, pick } from "@/lib/format";
import { DEAL_SELECT, type DealJoined } from "@/lib/queries";
import type { InvoiceRow, ProfileContacts, SettingsRow } from "@/lib/types";
import { Card, Field, Input, Notice, Textarea, buttonClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { MaskedText } from "@/components/MaskedText";
import { DealBadge } from "@/components/StatusBadges";
import { Flash } from "@/components/Flash";
import { approveProof, payByCard, raiseDispute, uploadProof } from "./actions";
import { getStripe } from "@/lib/stripe";

const ORDER = ["awaiting_sponsor_payment", "sponsor_paid", "proof_uploaded", "proof_approved", "organizer_paid"];

export default async function DealPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ error?: string; paid?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const { error, paid } = await searchParams;
  const { supabase, user, profile } = await requireUser(locale);
  const t = await getTranslations();

  const { data: deal } = await supabase.from("deals").select(DEAL_SELECT).eq("id", id).maybeSingle<DealJoined>();
  if (!deal) notFound();

  const isOrganizer = user.id === deal.organizer_id;
  const isSponsor = user.id === deal.sponsor_id;
  const isAdmin = profile.role === "admin";
  const otherId = isOrganizer ? deal.sponsor_id : deal.organizer_id;

  const [{ data: invoices }, { data: proofs }, { data: contacts }, { data: settings }] = await Promise.all([
    supabase.from("invoices").select("*").eq("deal_id", id).returns<InvoiceRow[]>(),
    supabase.from("deal_proofs").select("*").eq("deal_id", id).order("created_at"),
    supabase.from("profile_contacts").select("*").eq("profile_id", otherId).maybeSingle<ProfileContacts>(),
    supabase.from("settings").select("proof_review_days").eq("id", 1).maybeSingle<Pick<SettingsRow, "proof_review_days">>(),
  ]);
  const cardEnabled = getStripe() !== null;
  const autoApproveOn =
    deal.status === "proof_uploaded" && deal.proof_uploaded_at
      ? new Date(new Date(deal.proof_uploaded_at).getTime() + (settings?.proof_review_days ?? 7) * 86400000).toISOString()
      : null;

  // Signed links for private proof files (valid for 1 hour).
  const proofLinks: { name: string; url: string }[] = [];
  for (const p of proofs ?? []) {
    for (const path of p.file_paths as string[]) {
      const { data } = await supabase.storage.from("deal-proofs").createSignedUrl(path, 3600);
      if (data) proofLinks.push({ name: path.split("/").pop() ?? path, url: data.signedUrl });
    }
  }

  const stepIndex = ORDER.indexOf(deal.status === "disputed" ? "proof_uploaded" : deal.status);
  const steps = [t("deal.step1"), t("deal.step2"), t("deal.step3"), t("deal.step4"), t("deal.step5")];
  const sponsorInvoice = invoices?.find((i) => i.type === "sponsor_invoice");
  const statement = invoices?.find((i) => i.type === "organizer_statement");
  const pct = (n: number) => String(Math.round(Number(n) * 10000) / 100);
  const showCommission = isOrganizer || isAdmin;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Flash
        error={
          error
            ? error === "cardUnavailable" || error === "notPayable"
              ? t(`deal.${error}`)
              : error
            : undefined
        }
      />
      {paid && deal.status === "awaiting_sponsor_payment" && (
        <div className="mb-6">
          <Notice tone="success">{t("deal.paymentProcessing")}</Notice>
        </div>
      )}
      {deal.status === "disputed" && (
        <div className="mb-6">
          <Notice tone="error">
            {t("deal.disputeOpen")} {deal.dispute_reason && <MaskedText text={deal.dispute_reason} />}
          </Notice>
        </div>
      )}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-navy-500">{t("deal.title")}</p>
          <h1 className="text-2xl font-bold">
            {deal.package?.tier_name} · {deal.event ? pick(deal.event, "title", locale) : ""}
          </h1>
          <p className="text-sm text-navy-500">
            {deal.sponsor?.company_name} → {deal.organizer?.company_name}
            {deal.event && ` · ${formatDate(deal.event.start_date, locale)}`}
          </p>
        </div>
        <DealBadge status={deal.status} />
      </div>
      {deal.status === "cancelled" && (
        <div className="mb-6">
          <Notice tone="error">{t("deal.cancelled")}</Notice>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="mb-4 font-semibold">{t("deal.timeline")}</h2>
            <ol className="space-y-3">
              {steps.map((s, i) => {
                const done = deal.status !== "cancelled" && (i <= stepIndex || deal.status === "organizer_paid");
                const current = i === stepIndex + 1 && deal.status !== "cancelled";
                return (
                  <li key={i} className="flex items-center gap-3">
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                        done ? "bg-emerald-600 text-white" : current ? "bg-gold-500 text-navy-900" : "bg-navy-100 text-navy-500"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <span className={done ? "text-navy-900" : current ? "font-semibold" : "text-navy-500"}>{s}</span>
                  </li>
                );
              })}
            </ol>
          </Card>

          {isSponsor && deal.status === "awaiting_sponsor_payment" && (
            <Card className="space-y-4">
              <h2 className="font-semibold">{t("deal.payTitle")}</h2>
              {cardEnabled && (
                <form action={payByCard} className="space-y-2">
                  <input type="hidden" name="deal_id" value={deal.id} />
                  <SubmitButton pendingText={t("common.saving")}>
                    {t("deal.payCard", { amount: formatAed(deal.total_due_aed, locale) })}
                  </SubmitButton>
                  <p className="text-xs text-navy-500">{t("deal.payCardHint")}</p>
                </form>
              )}
              <div className="rounded-lg bg-navy-50 p-4 text-sm text-navy-700">
                <p className="mb-1 font-medium">{t("deal.payBank")}</p>
                {t("deal.payInstructions")}
              </div>
            </Card>
          )}

          {isOrganizer && ["sponsor_paid", "proof_uploaded"].includes(deal.status) && (
            <Card>
              <h2 className="mb-4 font-semibold">{t("deal.uploadProof")}</h2>
              <form action={uploadProof} className="space-y-4">
                <input type="hidden" name="deal_id" value={deal.id} />
                <Field label={t("deal.proofFiles")}>
                  <Input type="file" name="files" multiple accept="image/*,video/*,application/pdf" required />
                </Field>
                <Field label={t("deal.proofNotes")}>
                  <Textarea name="notes" rows={3} />
                </Field>
                <SubmitButton pendingText={t("common.saving")}>{t("deal.uploadProof")}</SubmitButton>
              </form>
            </Card>
          )}

          {(proofs?.length ?? 0) > 0 && (
            <Card>
              <h2 className="mb-4 font-semibold">{t("deal.proofs")}</h2>
              <ul className="space-y-2 text-sm">
                {proofLinks.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noreferrer" className="text-navy-700 underline">
                      {l.name}
                    </a>
                  </li>
                ))}
              </ul>
              {proofs?.map((p) =>
                p.notes ? (
                  <p key={p.id} className="mt-3 whitespace-pre-line rounded-lg bg-navy-50 p-3 text-sm">
                    <MaskedText text={p.notes} />
                    <span className="mt-1 block text-[11px] text-navy-500">{formatDateTime(p.created_at, locale)}</span>
                  </p>
                ) : null,
              )}
              {autoApproveOn && (
                <p className="mt-4 text-xs text-navy-500">
                  {t("deal.autoApproveOn", { date: formatDate(autoApproveOn, locale) })}
                </p>
              )}
              {deal.auto_approved && <p className="mt-4 text-xs text-navy-500">{t("deal.autoApproved")}</p>}
              {isSponsor && deal.status === "proof_uploaded" && (
                <div className="mt-5 space-y-4">
                  <form action={approveProof} className="space-y-2">
                    <input type="hidden" name="deal_id" value={deal.id} />
                    <p className="text-sm text-navy-500">{t("deal.approveHint")}</p>
                    <SubmitButton>{t("deal.approveProof")}</SubmitButton>
                  </form>
                  <details className="rounded-xl border border-navy-100 p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-red-700">{t("deal.raiseConcern")}</summary>
                    <form action={raiseDispute} className="mt-3 space-y-3">
                      <input type="hidden" name="deal_id" value={deal.id} />
                      <Textarea name="reason" rows={3} required placeholder={t("deal.concernPlaceholder")} />
                      <SubmitButton variant="danger">{t("deal.sendConcern")}</SubmitButton>
                    </form>
                  </details>
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="space-y-2 text-sm">
            <h2 className="mb-2 font-semibold">{t("deal.summary")}</h2>
            <Row label={t("deal.agreedPrice")} value={formatAed(deal.agreed_price_aed, locale)} />
            {deal.payment_method && (
              <Row label={t("deal.paidBy")} value={t(`deal.method_${deal.payment_method}`)} />
            )}
            {deal.refunded_at && <p className="text-xs text-red-700">{t("deal.refunded")}</p>}
            {isSponsor || isAdmin ? (
              <>
                <Row label={t("deal.vat", { rate: pct(deal.vat_rate) })} value={formatAed(deal.vat_aed, locale)} />
                <Row label={t("deal.totalDue")} value={formatAed(deal.total_due_aed, locale)} strong />
              </>
            ) : null}
            {showCommission && (
              <>
                <Row
                  label={t("deal.commission", { rate: pct(deal.commission_rate) })}
                  value={`− ${formatAed(deal.commission_aed, locale)}`}
                />
                <Row label={t("deal.payout")} value={formatAed(deal.organizer_payout_aed, locale)} strong />
                {deal.founding_partner_waiver && <p className="text-xs text-gold-600">★ {t("deal.foundingWaiver")}</p>}
              </>
            )}
            {deal.in_kind_terms && (
              <p className="border-t border-navy-50 pt-2">
                <span className="text-navy-500">{t("deal.inKindTerms")}: </span>
                <MaskedText text={deal.in_kind_terms} />
              </p>
            )}
            <div className="flex flex-col gap-2 pt-3">
              {sponsorInvoice && (
                <Link href={`/invoices/${sponsorInvoice.id}`} className={buttonClass.secondary}>
                  {t("deal.invoice")} · {sponsorInvoice.number}
                </Link>
              )}
              {statement && (
                <Link href={`/invoices/${statement.id}`} className={buttonClass.secondary}>
                  {t("deal.statement")} · {statement.number}
                </Link>
              )}
              <Link href={`/proposals/${deal.proposal_id}`} className="text-center text-navy-700 underline">
                {t("proposal.chat")}
              </Link>
            </div>
          </Card>

          <Card className="text-sm">
            <h2 className="mb-2 font-semibold">{t("deal.contacts")}</h2>
            {contacts && !isAdmin ? (
              <dl className="space-y-1">
                <dd className="font-semibold">{isOrganizer ? deal.sponsor?.company_name : deal.organizer?.company_name}</dd>
                {contacts.contact_name && <dd>{contacts.contact_name}</dd>}
                {contacts.phone && <dd dir="ltr">{contacts.phone}</dd>}
                {contacts.email && <dd>{contacts.email}</dd>}
                {contacts.website && <dd>{contacts.website}</dd>}
              </dl>
            ) : isAdmin ? (
              <p className="text-navy-500">—</p>
            ) : (
              <p className="text-navy-500">{t("deal.contactsLocked")}</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-navy-500">{label}</span>
      <span className={strong ? "font-bold" : ""}>{value}</span>
    </div>
  );
}
