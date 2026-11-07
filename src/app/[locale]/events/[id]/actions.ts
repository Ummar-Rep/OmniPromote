"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { notifyUser } from "@/lib/email";
import { num, str } from "@/lib/site";

export async function sendProposal(form: FormData) {
  const locale = await getLocale();
  const { supabase, user, profile } = await getSession();
  const eventId = str(form, "event_id")!;
  if (!user || !profile) return redirect({ href: "/login", locale });
  if (!profile.onboarded) return redirect({ href: "/profile?welcome=1", locale });

  const { data, error } = await supabase
    .from("proposals")
    .insert({
      package_id: str(form, "package_id"),
      sponsor_id: user.id,
      // Filled in by the database from the package; set here only to satisfy the column types.
      organizer_id: user.id,
      event_id: eventId,
      message: str(form, "message") ?? "",
      offered_price_aed: num(form, "offered_price_aed"),
      in_kind_offer: str(form, "in_kind_offer"),
    })
    .select("id, organizer_id")
    .single();

  if (error || !data) {
    return redirect({ href: { pathname: `/events/${eventId}`, query: { error: error?.message ?? "error" } }, locale });
  }

  await notifyUser(
    data.organizer_id,
    { en: "New sponsorship proposal", ar: "عرض رعاية جديد" },
    {
      en: `${profile.company_name ?? "A sponsor"} sent a proposal for your event.`,
      ar: `أرسل ${profile.company_name ?? "راعٍ"} عرضًا لفعاليتك.`,
    },
    `/proposals/${data.id}`,
  );
  redirect({ href: `/proposals/${data.id}`, locale });
}
