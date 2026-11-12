"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { notifyUser } from "@/lib/email";
import { str } from "@/lib/site";

export async function sendBookingMessage(form: FormData) {
  const locale = await getLocale();
  const { supabase, user, profile } = await getSession();
  const bookingId = str(form, "booking_id")!;
  const body = str(form, "body");
  if (!user) return redirect({ href: "/login", locale });
  if (body) {
    const { error } = await supabase.from("messages").insert({ booking_id: bookingId, sender_id: user.id, body });
    if (error) return redirect({ href: { pathname: `/bookings/${bookingId}`, query: { error: error.message } }, locale });
    const { data: b } = await supabase.from("ad_bookings").select("buyer_id, owner_id").eq("id", bookingId).single();
    if (b) {
      await notifyUser(
        b.buyer_id === user.id ? b.owner_id : b.buyer_id,
        { en: "New message", ar: "رسالة جديدة" },
        {
          en: `${profile?.company_name ?? "Someone"} sent you a message about an ad space booking.`,
          ar: `أرسل لك ${profile?.company_name ?? "أحدهم"} رسالة بخصوص حجز مساحة إعلانية.`,
        },
        `/bookings/${bookingId}`,
      );
    }
  }
  redirect({ href: `/bookings/${bookingId}#chat-end`, locale });
}

export async function decideBooking(form: FormData) {
  const locale = await getLocale();
  const { supabase, user } = await getSession();
  const bookingId = str(form, "booking_id")!;
  const intent = str(form, "intent");
  if (!user) return redirect({ href: "/login", locale });

  if (intent === "accept") {
    const { data: dealId, error } = await supabase.rpc("accept_booking", { p_booking_id: bookingId });
    if (error) return redirect({ href: { pathname: `/bookings/${bookingId}`, query: { error: error.message } }, locale });
    const { data: b } = await supabase.from("ad_bookings").select("buyer_id").eq("id", bookingId).single();
    if (b) {
      await notifyUser(
        b.buyer_id,
        { en: "Your booking was accepted", ar: "تم قبول حجزك" },
        {
          en: "Good news! The media owner accepted your ad space booking. Your invoice is ready.",
          ar: "أخبار سارة! قبل مالك المساحة حجزك الإعلاني. فاتورتك جاهزة.",
        },
        `/deals/${dealId}`,
      );
    }
    return redirect({ href: `/deals/${dealId}`, locale });
  }

  const fn = intent === "withdraw" ? "withdraw_booking" : "decline_booking";
  const { error } = await supabase.rpc(fn, { p_booking_id: bookingId });
  redirect({ href: { pathname: `/bookings/${bookingId}`, query: error ? { error: error.message } : {} }, locale });
}
