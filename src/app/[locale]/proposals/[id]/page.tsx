import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { formatAed, formatDateTime, pick } from "@/lib/format";
import { PROPOSAL_SELECT, type ProposalJoined } from "@/lib/queries";
import type { MessageRow } from "@/lib/types";
import { Card, Notice, Textarea, buttonClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { MaskedText } from "@/components/MaskedText";
import { ProposalBadge } from "@/components/StatusBadges";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Flash } from "@/components/Flash";
import { decideProposal, sendMessage } from "./actions";

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const { error } = await searchParams;
  const { supabase, user, profile } = await requireUser(locale);
  const t = await getTranslations();

  const { data: proposal } = await supabase
    .from("proposals")
    .select(PROPOSAL_SELECT)
    .eq("id", id)
    .maybeSingle<ProposalJoined>();
  if (!proposal) notFound();

  const [{ data: messages }, { data: deal }] = await Promise.all([
    supabase.from("messages").select("*").eq("proposal_id", id).order("created_at").returns<MessageRow[]>(),
    supabase.from("deals").select("id").eq("proposal_id", id).maybeSingle(),
  ]);

  const isOrganizer = user.id === proposal.organizer_id;
  const isSponsor = user.id === proposal.sponsor_id;
  const names: Record<string, string> = {
    [proposal.sponsor_id]: proposal.sponsor?.company_name ?? t("proposal.sponsor"),
    [proposal.organizer_id]: proposal.organizer?.company_name ?? t("proposal.organizer"),
  };
  const canChat = (isOrganizer || isSponsor) && proposal.status !== "withdrawn";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <AutoRefresh />
      <Flash error={error} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-navy-500">{t("proposal.title")}</p>
          <h1 className="text-2xl font-bold">
            {t("proposal.for", {
              package: proposal.package?.tier_name ?? "",
              event: proposal.event ? pick(proposal.event, "title", locale) : "",
            })}
          </h1>
        </div>
        <ProposalBadge status={proposal.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card className="space-y-3 text-sm">
            <p>
              <span className="text-navy-500">{t("proposal.sponsor")}: </span>
              <span className="font-semibold">{proposal.sponsor?.company_name}</span>
            </p>
            <p>
              <span className="text-navy-500">{t("proposal.organizer")}: </span>
              <span className="font-semibold">{proposal.organizer?.company_name}</span>
            </p>
            {proposal.package?.price_aed != null && (
              <p>
                <span className="text-navy-500">{t("proposal.listedPrice")}: </span>
                {formatAed(proposal.package.price_aed, locale)}
              </p>
            )}
            {proposal.offered_price_aed != null && (
              <p>
                <span className="text-navy-500">{t("proposal.offer")}: </span>
                <span className="font-semibold">{formatAed(proposal.offered_price_aed, locale)}</span>
              </p>
            )}
            {proposal.in_kind_offer && (
              <p>
                <span className="text-navy-500">{t("proposal.inKindOffer")}: </span>
                <MaskedText text={proposal.in_kind_offer} />
              </p>
            )}
            <p className="whitespace-pre-line border-t border-navy-50 pt-3 text-navy-700">
              <MaskedText text={proposal.message} />
            </p>
            {proposal.event && (
              <Link href={`/events/${proposal.event.id}`} className="block text-navy-700 underline">
                {t("eventForm.viewPublic")}
              </Link>
            )}
          </Card>

          {proposal.status === "sent" && isOrganizer && (
            <Card className="space-y-3">
              <p className="text-sm text-navy-500">{t("proposal.acceptConfirm")}</p>
              <form action={decideProposal} className="flex flex-wrap gap-2">
                <input type="hidden" name="proposal_id" value={proposal.id} />
                <SubmitButton name="intent" value="accept" confirm={t("proposal.acceptConfirm")}>
                  {t("proposal.accept")}
                </SubmitButton>
                <SubmitButton variant="danger" name="intent" value="reject">
                  {t("proposal.reject")}
                </SubmitButton>
              </form>
            </Card>
          )}
          {proposal.status === "sent" && isSponsor && (
            <form action={decideProposal}>
              <input type="hidden" name="proposal_id" value={proposal.id} />
              <SubmitButton variant="danger" name="intent" value="withdraw">
                {t("proposal.withdraw")}
              </SubmitButton>
            </form>
          )}
          {deal && (
            <Link href={`/deals/${deal.id}`} className={`${buttonClass.primary} w-full`}>
              {t("proposal.goToDeal")}
            </Link>
          )}
        </div>

        <Card className="flex flex-col lg:col-span-2">
          <h2 className="font-semibold">{t("proposal.chat")}</h2>
          <p className="mb-4 text-xs text-navy-500">{t("proposal.chatHint")}</p>
          <div className="flex max-h-[28rem] flex-1 flex-col gap-3 overflow-y-auto rounded-xl bg-navy-50/60 p-4">
            {(messages ?? []).length === 0 && <p className="text-sm text-navy-500">{t("common.none")}</p>}
            {(messages ?? []).map((m) => {
              const mine = m.sender_id === user.id;
              return (
                <div key={m.id} className={`max-w-[80%] ${mine ? "self-end" : "self-start"}`}>
                  <div
                    className={`whitespace-pre-line rounded-2xl px-4 py-2 text-sm ${
                      mine ? "bg-navy-900 text-white" : "bg-white text-navy-900 shadow-sm"
                    }`}
                  >
                    <MaskedText text={m.body} />
                  </div>
                  <p className={`mt-1 text-[11px] text-navy-500 ${mine ? "text-end" : ""}`}>
                    {names[m.sender_id] ?? (profile.role === "admin" ? "Admin" : "")} · {formatDateTime(m.created_at, locale)}
                  </p>
                  {mine && m.was_masked && <p className="text-[11px] text-gold-600">{t("proposal.maskedNote")}</p>}
                </div>
              );
            })}
            <span id="chat-end" />
          </div>
          {canChat ? (
            <form action={sendMessage} className="mt-4 flex gap-2">
              <input type="hidden" name="proposal_id" value={proposal.id} />
              <Textarea name="body" rows={2} required placeholder={t("proposal.placeholder")} className="flex-1" />
              <SubmitButton className="self-end">{t("proposal.send")}</SubmitButton>
            </form>
          ) : (
            profile.role === "admin" && (
              <div className="mt-4">
                <Notice>Admin view</Notice>
              </div>
            )
          )}
        </Card>
      </div>
    </div>
  );
}
