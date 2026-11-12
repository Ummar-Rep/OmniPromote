"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { notifyUser } from "@/lib/email";
import { num, str } from "@/lib/site";

export async function requestBooking(form: FormData) {
  const locale = await getLocale();
  const { supabase, user, profile } = await getSession();
  const spaceId = str(form, "ad_space_id")!;
  if (!user || !profile) return redirect({ href: "/login", locale });
  if (!profile.onboarded) return redirect({ href: "/profile?welcome=1", locale });

  const { data, error } = await supabase
    .from("ad_bookings")
    .insert({
      ad_space_id: spaceId,
      buyer_id: user.id,
      // Set by the database from the ad space; given here only to satisfy the column type.
      owner_id: user.id,
      start_date: str(form, "start_date"),
      weeks: num(form, "weeks") ?? 1,
      message: str(form, "message") ?? "",
      offered_price_aed: num(form, "offered_price_aed"),
    })
    .select("id, owner_id")
    .single();

  if (error || !data) {
    return redirect({ href: { pathname: `/spaces/${spaceId}`, query: { error: error?.message ?? "error" } }, locale });
  }

  await notifyUser(
    data.owner_id,
    { en: "New booking request", ar: "طلب حجز جديد" },
    {
      en: `${profile.company_name ?? "A brand"} wants to book your ad space.`,
      ar: `يرغب ${profile.company_name ?? "أحد المعلنين"} في حجز مساحتك الإعلانية.`,
    },
    `/bookings/${data.id}`,
  );
  redirect({ href: `/bookings/${data.id}`, locale });
}
