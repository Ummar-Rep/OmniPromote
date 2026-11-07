import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { formatAed, formatDate, pick } from "@/lib/format";
import { DEAL_SELECT, type DealJoined } from "@/lib/queries";
import type { InvoiceRow, SettingsRow } from "@/lib/types";
import { PrintButton } from "@/components/PrintButton";

export default async function InvoicePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const { supabase } = await requireUser(locale);
  const t = await getTranslations("invoice");

  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle<InvoiceRow>();
  if (!invoice) notFound();
  const [{ data: deal }, { data: settings }] = await Promise.all([
    supabase.from("deals").select(DEAL_SELECT).eq("id", invoice.deal_id).single<DealJoined>(),
    supabase.from("settings").select("*").eq("id", 1).single<SettingsRow>(),
  ]);
  if (!deal || !settings) notFound();

  const isStatement = invoice.type === "organizer_statement";
  const party = isStatement ? deal.organizer : deal.sponsor;
  const eventName = deal.event ? pick(deal.event, "title", locale) : "";
  const description = isStatement
    ? t("payoutFor", { package: deal.package?.tier_name ?? "", event: eventName })
    : t("sponsorshipOf", { package: deal.package?.tier_name ?? "", event: eventName });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-4 flex justify-end">
        <PrintButton label={t("print")} />
      </div>
      <div className="relative rounded-2xl border border-navy-100 bg-white p-10 shadow-sm print:border-0 print:shadow-none">
        {invoice.paid_at && (
          <span className="absolute end-10 top-10 rotate-[-8deg] rounded-lg border-4 border-emerald-600 px-4 py-1 text-xl font-black text-emerald-600">
            {t("paid")}
          </span>
        )}
        <div className="flex flex-wrap justify-between gap-6 border-b border-navy-100 pb-6">
          <div>
            <p className="text-2xl font-bold">
              Omni<span className="text-gold-500">Promote</span>
            </p>
            <p className="mt-2 text-sm text-navy-700">{settings.legal_name}</p>
            <p className="text-sm text-navy-500">{settings.address}</p>
            {settings.trn && (
              <p className="text-sm text-navy-500">
                {t("trn")}: {settings.trn}
              </p>
            )}
          </div>
          <div className="text-end">
            <h1 className="text-xl font-bold uppercase tracking-wide text-navy-900">
              {isStatement ? t("statement") : t("taxInvoice")}
            </h1>
            <p className="mt-2 text-sm">
              {t("number")}: <span className="font-semibold">{invoice.number}</span>
            </p>
            <p className="text-sm">
              {t("issued")}: {formatDate(invoice.issued_at, locale)}
            </p>
          </div>
        </div>

        <div className="py-6">
          <p className="text-xs uppercase text-navy-500">{isStatement ? t("payTo") : t("billTo")}</p>
          <p className="font-semibold">{party?.company_name}</p>
          {party?.emirate && <p className="text-sm text-navy-500">{party.emirate}, UAE</p>}
          {party?.trn && (
            <p className="text-sm text-navy-500">
              {t("trn")}: {party.trn}
            </p>
          )}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-navy-100 text-navy-500">
              <th className="py-2 text-start font-medium">{t("description")}</th>
              <th className="py-2 text-end font-medium">{t("total")}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-navy-50">
              <td className="py-3">{description}</td>
              <td className="py-3 text-end">{formatAed(invoice.amount_aed, locale)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-4 text-end text-navy-500">{t("subtotal")}</td>
              <td className="pt-4 text-end">{formatAed(invoice.amount_aed, locale)}</td>
            </tr>
            {!isStatement && (
              <tr>
                <td className="text-end text-navy-500">
                  {t("vat")} ({Math.round(deal.vat_rate * 100)}%)
                </td>
                <td className="text-end">{formatAed(invoice.vat_aed, locale)}</td>
              </tr>
            )}
            <tr>
              <td className="pt-2 text-end font-bold">{t("total")}</td>
              <td className="pt-2 text-end text-lg font-bold">{formatAed(invoice.total_aed, locale)}</td>
            </tr>
          </tfoot>
        </table>

        {!isStatement && (
          <div className="mt-8 rounded-xl bg-navy-50 p-5 text-sm">
            <p className="mb-2 font-semibold">{t("bank")}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-navy-500">{t("bankName")}</dt>
              <dd>{settings.bank_name ?? "—"}</dd>
              <dt className="text-navy-500">{t("accountName")}</dt>
              <dd>{settings.account_name ?? settings.legal_name}</dd>
              <dt className="text-navy-500">{t("iban")}</dt>
              <dd dir="ltr" className="font-mono">
                {settings.iban ?? "—"}
              </dd>
              {settings.swift && (
                <>
                  <dt className="text-navy-500">{t("swift")}</dt>
                  <dd className="font-mono">{settings.swift}</dd>
                </>
              )}
              <dt className="text-navy-500">{t("reference")}</dt>
              <dd className="font-semibold">{invoice.number}</dd>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
