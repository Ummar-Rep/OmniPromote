"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { num, str } from "@/lib/site";
import { AD_SPACE_TYPES, EMIRATES } from "@/lib/constants";

type Supabase = Awaited<ReturnType<typeof getSession>>["supabase"];

async function ownerSession() {
  const locale = await getLocale();
  const session = await getSession();
  if (!session.user || session.profile?.role !== "media_owner") {
    redirect({ href: "/dashboard", locale });
  }
  return { ...session, user: session.user!, locale };
}

async function uploadImage(supabase: Supabase, userId: string, file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) return undefined;
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/spaces/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("public-media").upload(path, file);
  if (error) return undefined;
  return supabase.storage.from("public-media").getPublicUrl(path).data.publicUrl;
}

async function uploadPhotos(supabase: Supabase, userId: string, form: FormData) {
  const urls: string[] = [];
  for (const f of form.getAll("photos").slice(0, 8)) {
    const url = await uploadImage(supabase, userId, f);
    if (url) urls.push(url);
  }
  return urls;
}

function spaceFields(form: FormData) {
  const type = str(form, "type") ?? "billboard";
  const emirate = str(form, "emirate") ?? "Dubai";
  return {
    title_en: str(form, "title_en") ?? "",
    title_ar: str(form, "title_ar"),
    description_en: str(form, "description_en") ?? "",
    description_ar: str(form, "description_ar"),
    type: (AD_SPACE_TYPES as readonly string[]).includes(type) ? type : "other",
    emirate: (EMIRATES as readonly string[]).includes(emirate) ? emirate : "Dubai",
    area: str(form, "area"),
    lat: num(form, "lat"),
    lng: num(form, "lng"),
    width_m: num(form, "width_m"),
    height_m: num(form, "height_m"),
    daily_impressions: num(form, "daily_impressions"),
    is_digital: form.get("is_digital") === "on",
    illuminated: form.get("illuminated") === "on",
    price_per_week_aed: num(form, "price_per_week_aed") ?? 0,
    min_weeks: Math.min(52, Math.max(1, num(form, "min_weeks") ?? 1)),
    audience_description: str(form, "audience_description"),
  };
}

export async function createSpace(form: FormData) {
  const { supabase, user, locale } = await ownerSession();
  const fields = spaceFields(form);
  if (fields.lat === null || fields.lng === null) {
    return redirect({ href: { pathname: "/dashboard/spaces/new", query: { error: "needLocation" } }, locale });
  }
  const cover = await uploadImage(supabase, user.id, form.get("cover"));
  const photos = await uploadPhotos(supabase, user.id, form);
  const { data, error } = await supabase
    .from("ad_spaces")
    .insert({ ...fields, owner_id: user.id, cover_image_url: cover ?? photos[0] ?? null, photo_urls: photos, status: "draft" })
    .select("id")
    .single();
  if (error || !data) {
    return redirect({ href: { pathname: "/dashboard/spaces/new", query: { error: error?.message } }, locale });
  }
  redirect({ href: { pathname: `/dashboard/spaces/${data.id}`, query: { ok: "1" } }, locale });
}

export async function updateSpace(form: FormData) {
  const { supabase, user, locale } = await ownerSession();
  const id = str(form, "id")!;
  const intent = str(form, "intent");
  const back = `/dashboard/spaces/${id}`;
  const fail = (message: string) => redirect({ href: { pathname: back, query: { error: message } }, locale });

  if (intent === "delete") {
    const { error } = await supabase.from("ad_spaces").delete().eq("id", id);
    if (error) return fail(error.message);
    return redirect({ href: "/dashboard", locale });
  }
  if (intent === "close" || intent === "clearPhotos") {
    const update = intent === "close" ? { status: "closed" } : { photo_urls: [] };
    const { error } = await supabase.from("ad_spaces").update(update).eq("id", id);
    if (error) return fail(error.message);
    return redirect({ href: back, locale });
  }

  const update: Record<string, unknown> = spaceFields(form);
  if (update.lat === null || update.lng === null) return fail("needLocation");
  const cover = await uploadImage(supabase, user.id, form.get("cover"));
  if (cover) update.cover_image_url = cover;
  const photos = await uploadPhotos(supabase, user.id, form);
  if (photos.length) {
    const { data: current } = await supabase.from("ad_spaces").select("photo_urls, cover_image_url").eq("id", id).single();
    update.photo_urls = [...(current?.photo_urls ?? []), ...photos].slice(0, 12);
    if (!cover && !current?.cover_image_url) update.cover_image_url = photos[0];
  }
  if (intent === "submit") {
    update.status = "pending_review";
    update.rejection_reason = null;
  }
  const { error } = await supabase.from("ad_spaces").update(update).eq("id", id);
  revalidatePath(`/${locale}/spaces/${id}`);
  redirect({ href: { pathname: back, query: error ? { error: error.message } : { ok: "1" } }, locale });
}
