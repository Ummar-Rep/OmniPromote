"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { str } from "@/lib/site";

export async function saveProfile(form: FormData) {
  const locale = await getLocale();
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) return redirect({ href: "/login", locale });

  let logoUrl = profile.logo_url;
  const logo = form.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const ext = logo.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${user.id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("public-media").upload(path, logo, { upsert: true });
    if (!error) logoUrl = supabase.storage.from("public-media").getPublicUrl(path).data.publicUrl;
  }

  const update: Record<string, unknown> = {
    company_name: str(form, "company_name"),
    company_type: str(form, "company_type"),
    emirate: str(form, "emirate"),
    about: str(form, "about"),
    trn: str(form, "trn"),
    logo_url: logoUrl,
    onboarded: true,
  };
  // Role can only be picked before the profile is completed (enforced in the database too).
  const role = str(form, "role");
  if (!profile.onboarded && (role === "organizer" || role === "sponsor")) update.role = role;

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) return redirect({ href: { pathname: "/profile", query: { error: error.message } }, locale });

  await supabase
    .from("profile_contacts")
    .update({
      contact_name: str(form, "contact_name"),
      phone: str(form, "phone"),
      website: str(form, "website"),
      email: str(form, "email") ?? user.email,
    })
    .eq("profile_id", user.id);

  if (!profile.onboarded) return redirect({ href: "/dashboard", locale });
  redirect({ href: { pathname: "/profile", query: { ok: "1" } }, locale });
}
