"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { num, str } from "@/lib/site";
import type { PriceType } from "@/lib/types";

async function organizerSession() {
  const locale = await getLocale();
  const session = await getSession();
  if (!session.user || session.profile?.role !== "organizer") {
    redirect({ href: "/dashboard", locale });
  }
  return { ...session, user: session.user!, locale };
}

async function uploadCover(
  supabase: Awaited<ReturnType<typeof getSession>>["supabase"],
  userId: string,
  form: FormData,
) {
  const file = form.get("cover");
  if (!(file instanceof File) || file.size === 0) return undefined;
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/events/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("public-media").upload(path, file);
  if (error) return undefined;
  return supabase.storage.from("public-media").getPublicUrl(path).data.publicUrl;
}

function eventFields(form: FormData) {
  return {
    title_en: str(form, "title_en") ?? "",
    title_ar: str(form, "title_ar"),
    description_en: str(form, "description_en") ?? "",
    description_ar: str(form, "description_ar"),
    category: str(form, "category") ?? "other",
    emirate: str(form, "emirate") ?? "Dubai",
    venue: str(form, "venue"),
    start_date: str(form, "start_date"),
    end_date: str(form, "end_date") ?? str(form, "start_date"),
    expected_attendance: num(form, "expected_attendance"),
    audience_description: str(form, "audience_description"),
  };
}

export async function createEvent(form: FormData) {
  const { supabase, user, locale } = await organizerSession();
  const cover = await uploadCover(supabase, user.id, form);
  const { data, error } = await supabase
    .from("events")
    .insert({ ...eventFields(form), organizer_id: user.id, cover_image_url: cover ?? null, status: "draft" })
    .select("id")
    .single();
  if (error || !data) {
    return redirect({ href: { pathname: "/dashboard/events/new", query: { error: error?.message } }, locale });
  }
  redirect({ href: `/dashboard/events/${data.id}`, locale });
}

export async function updateEvent(form: FormData) {
  const { supabase, user, locale } = await organizerSession();
  const id = str(form, "id")!;
  const intent = str(form, "intent");
  const back = `/dashboard/events/${id}`;

  if (intent === "delete") {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) return redirect({ href: { pathname: back, query: { error: error.message } }, locale });
    return redirect({ href: "/dashboard", locale });
  }
  if (intent === "close") {
    const { error } = await supabase.from("events").update({ status: "closed" }).eq("id", id);
    if (error) return redirect({ href: { pathname: back, query: { error: error.message } }, locale });
    return redirect({ href: back, locale });
  }

  const cover = await uploadCover(supabase, user.id, form);
  const update: Record<string, unknown> = { ...eventFields(form) };
  if (cover) update.cover_image_url = cover;

  if (intent === "submit") {
    const { count } = await supabase
      .from("sponsorship_packages")
      .select("id", { count: "exact", head: true })
      .eq("event_id", id);
    if (!count) return redirect({ href: { pathname: back, query: { error: "needPackage" } }, locale });
    update.status = "pending_review";
    update.rejection_reason = null;
  }

  const { error } = await supabase.from("events").update(update).eq("id", id);
  revalidatePath(`/${locale}/events/${id}`);
  redirect({ href: { pathname: back, query: error ? { error: error.message } : { ok: "1" } }, locale });
}

function packageFields(form: FormData) {
  const priceType = (str(form, "price_type") ?? "fixed") as PriceType;
  return {
    tier_name: str(form, "tier_name") ?? "Sponsor",
    price_type: priceType,
    price_aed: priceType === "in_kind" ? null : num(form, "price_aed"),
    in_kind_description: priceType === "in_kind" ? str(form, "in_kind_description") : null,
    slots_total: Math.max(1, num(form, "slots_total") ?? 1),
    benefits: (str(form, "benefits") ?? "")
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean),
    deliverables_proof: str(form, "deliverables_proof"),
    sort_order: num(form, "sort_order") ?? 0,
  };
}

export async function savePackage(form: FormData) {
  const { supabase, locale } = await organizerSession();
  const eventId = str(form, "event_id")!;
  const packageId = str(form, "package_id");
  const back = `/dashboard/events/${eventId}`;

  let error;
  if (str(form, "intent") === "delete" && packageId) {
    ({ error } = await supabase.from("sponsorship_packages").delete().eq("id", packageId));
  } else if (packageId) {
    ({ error } = await supabase.from("sponsorship_packages").update(packageFields(form)).eq("id", packageId));
  } else {
    ({ error } = await supabase.from("sponsorship_packages").insert({ ...packageFields(form), event_id: eventId }));
  }
  redirect({ href: { pathname: back, query: error ? { error: error.message } : { ok: "1" } }, locale });
}
