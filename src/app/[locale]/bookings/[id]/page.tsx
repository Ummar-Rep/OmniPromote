import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { formatAed, formatDate, formatDateTime, pick } from "@/lib/format";
import { BOOKING_SELECT, type BookingJoined } from "@/lib/queries";
import type { MessageRow } from "@/lib/types";
import { Card, Notice, Textarea, buttonClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { MaskedText } from "@/components/MaskedText";
import { BookingBadge } from "@/components/StatusBadges";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Flash } from "@/components/Flash";
import { decideBooking, sendBookingMessage } from "./actions";

export default async function BookingPage({
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

  const { data: booking } = await supabase.from("ad_bookings").select(BOOKING_SELECT).eq("id", id).maybeSingle<BookingJoined>();
  if (!booking) notFound();

  const [{ data: messages }, { data: deal }] = await Promise.all([
    supabase.from("messages").select("*").eq("booking_id", id).order("created_at").returns<MessageRow[]>(),
    supabase.from("deals").select("id").eq("booking_id", id).maybeSingle(),
  ]);

  const isOwner = user.id === booking.owner_id;
  const isBuyer = user.id === booking.buyer_id;
  const names: Record<string, string> = {
    [booking.buyer_id]: booking.buyer?.company_name ?? t("booking.buyer"),
    [booking.owner_id]: booking.owner?.company_name ?? t("booking.owner"),
  };
  const canChat = (isOwner || isBuyer) && booking.status !== "withdrawn";
  const listTotal = booking.space ? Number(booking.space.price_per_week_aed) * booking.weeks : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <AutoRefresh />
      <Flash error={error} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-navy-500">{t("booking.title")}</p>
          <h1 className="text-2xl font-bold">{booking.space ? pick(booking.space, "title", locale) : ""}</h1>
          <p className="text-sm text-navy-500">
            {formatDate(booking.start_date, locale)} – {formatDate(booking.end_date, locale)} ·{" "}
            {t("spaces.weeks", { count: booking.weeks })}
          </p>
        </div>
        <BookingBadge status={booking.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card className="space-y-3 text-sm">
            <p>
              <span className="text-navy-500">{t("booking.buyer")}: </span>
              <span className="font-semibold">{booking.buyer?.company_name}</span>
            </p>
            <p>
              <span className="text-navy-500">{t("booking.owner")}: </span>
              <span className="font-semibold">{booking.owner?.company_name}</span>
            </p>
            {listTotal !== null && (
              <p>
                <span className="text-navy-500">{t("booking.listTotal")}: </span>
                {formatAed(listTotal, locale)}
              </p>
            )}
            {booking.offered_price_aed != null && (
              <p>
                <span className="text-navy-500">{t("proposal.offer")}: </span>
                <span className="font-semibold">{formatAed(booking.offered_price_aed, locale)}</span>
              </p>
            )}
            <p className="whitespace-pre-line border-t border-navy-50 pt-3 text-navy-700">
              <MaskedText text={booking.message} />
            </p>
            {booking.space && (
              <Link href={`/spaces/${booking.space.id}`} className="block text-navy-700 underline">
                {t("eventForm.viewPublic")}
              </Link>
            )}
          </Card>

          {booking.status === "requested" && isOwner && (
            <Card className="space-y-3">
              <p className="text-sm text-navy-500">{t("booking.acceptConfirm")}</p>
              <form action={decideBooking} className="flex flex-wrap gap-2">
                <input type="hidden" name="booking_id" value={booking.id} />
                <SubmitButton name="intent" value="accept" confirm={t("booking.acceptConfirm")}>
                  {t("proposal.accept")}
                </SubmitButton>
                <SubmitButton variant="danger" name="intent" value="decline">
                  {t("booking.decline")}
                </SubmitButton>
              </form>
            </Card>
          )}
          {booking.status === "requested" && isBuyer && (
            <form action={decideBooking}>
              <input type="hidden" name="booking_id" value={booking.id} />
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
            <form action={sendBookingMessage} className="mt-4 flex gap-2">
              <input type="hidden" name="booking_id" value={booking.id} />
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
