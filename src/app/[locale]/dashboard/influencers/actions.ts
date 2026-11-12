"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { num, str } from "@/lib/site";
import { EMIRATES, INFLUENCER_NICHES, LANGUAGES, PLATFORMS } from "@/lib/constants";

type Supabase = Awaited<ReturnType<typeof getSession>>["supabase"];

async function agencySession() {
  const locale = await getLocale();
  const session = await getSession();
  if (!session.user || session.profile?.role !== "agency") {
    redirect({ href: "/dashboard", locale });
  }
  return { ...session, user: session.user!, locale };
}

async function uploadAvatar(supabase: Supabase, userId: string, form: FormData) {
  const file = form.get("avatar");
  if (!(file instanceof File) || file.size === 0) return undefined;
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/influencers/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("public-media").upload(path, file);
  if (error) return undefined;
  return supabase.storage.from("public-media").getPublicUrl(path).data.publicUrl;
}

function influencerFields(form: FormData) {
  const niche = str(form, "niche") ?? "lifestyle";
  const emirate = str(form, "emirate") ?? "Dubai";
  const fields: Record<string, unknown> = {
    name: str(form, "name") ?? "",
    bio_en: str(form, "bio_en") ?? "",
    bio_ar: str(form, "bio_ar"),
    niche: (INFLUENCER_NICHES as readonly string[]).includes(niche) ? niche : "other",
    emirate: (EMIRATES as readonly string[]).includes(emirate) ? emirate : "Dubai",
    languages: form
      .getAll("languages")
      .map(String)
      .filter((l) => (LANGUAGES as readonly string[]).includes(l)),
    engagement_rate: num(form, "engagement_rate"),
    price_post_aed: num(form, "price_post_aed"),
    price_story_aed: num(form, "price_story_aed"),
    price_video_aed: num(form, "price_video_aed"),
    audience_description: str(form, "audience_description"),
  };
  for (const p of PLATFORMS) fields[`${p}_followers`] = num(form, `${p}_followers`);
  return fields;
}

async function saveHandles(supabase: Supabase, influencerId: string, form: FormData) {
  const row: Record<string, string | null> = { influencer_id: influencerId };
  for (const p of PLATFORMS) row[p] = str(form, `handle_${p}`);
  return supabase.from("influencer_handles").upsert(row);
}

export async function createInfluencer(form: FormData) {
  const { supabase, user, locale } = await agencySession();
  const avatar = await uploadAvatar(supabase, user.id, form);
  const { data, error } = await supabase
    .from("influencers")
    .insert({ ...influencerFields(form), agency_id: user.id, avatar_url: avatar ?? null, status: "draft" })
    .select("id")
    .single();
  if (error || !data) {
    return redirect({ href: { pathname: "/dashboard/influencers/new", query: { error: error?.message } }, locale });
  }
  await saveHandles(supabase, data.id, form);
  redirect({ href: { pathname: `/dashboard/influencers/${data.id}`, query: { ok: "1" } }, locale });
}

export async function updateInfluencer(form: FormData) {
  const { supabase, user, locale } = await agencySession();
  const id = str(form, "id")!;
  const intent = str(form, "intent");
  const back = `/dashboard/influencers/${id}`;
  const fail = (message: string) => redirect({ href: { pathname: back, query: { error: message } }, locale });

  if (intent === "delete") {
    const { error } = await supabase.from("influencers").delete().eq("id", id);
    if (error) return fail(error.message);
    return redirect({ href: "/dashboard", locale });
  }
  if (intent === "close") {
    const { error } = await supabase.from("influencers").update({ status: "closed" }).eq("id", id);
    if (error) return fail(error.message);
    return redirect({ href: back, locale });
  }

  const update = influencerFields(form);
  const avatar = await uploadAvatar(supabase, user.id, form);
  if (avatar) update.avatar_url = avatar;
  if (intent === "submit") {
    update.status = "pending_review";
    update.rejection_reason = null;
  }
  const { error } = await supabase.from("influencers").update(update).eq("id", id);
  if (!error) await saveHandles(supabase, id, form);
  revalidatePath(`/${locale}/influencers/${id}`);
  redirect({ href: { pathname: back, query: error ? { error: error.message } : { ok: "1" } }, locale });
}
