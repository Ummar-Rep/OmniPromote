"use server";

import { getLocale } from "next-intl/server";
import { redirect as nextRedirect } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin, str } from "@/lib/site";

export async function signIn(form: FormData) {
  const locale = await getLocale();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: str(form, "email") ?? "",
    password: (form.get("password") as string) ?? "",
  });
  if (error) {
    // Supabase returns "email_not_confirmed" when the account exists but the email link was never clicked.
    const code = error.code === "email_not_confirmed" || /not confirmed/i.test(error.message) ? "unconfirmed" : "invalid";
    redirect({ href: { pathname: "/login", query: { error: code } }, locale });
  }
  redirect({ href: "/dashboard", locale });
}

export async function signUp(form: FormData) {
  const locale = await getLocale();
  const picked = str(form, "role");
  const role = picked === "organizer" || picked === "media_owner" || picked === "agency" ? picked : "sponsor";
  if (form.get("terms") !== "on") {
    redirect({ href: { pathname: "/signup", query: { error: "terms", role } }, locale });
  }
  const supabase = await createClient();
  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: str(form, "email") ?? "",
    password: (form.get("password") as string) ?? "",
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/${locale}/profile?welcome=1`,
      data: {
        role,
        company_name: str(form, "company_name"),
        full_name: str(form, "full_name"),
      },
    },
  });
  if (error) redirect({ href: { pathname: "/signup", query: { error: error.message, role } }, locale });
  // With email confirmation on, there is no session yet.
  if (!data.session) redirect({ href: { pathname: "/login", query: { ok: "checkEmail" } }, locale });
  redirect({ href: "/profile?welcome=1", locale });
}

export async function signInWithGoogle(form: FormData) {
  const locale = await getLocale();
  const role = str(form, "role");
  const supabase = await createClient();
  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=/${locale}/dashboard${role ? `&role=${role}` : ""}`,
    },
  });
  if (error || !data.url) redirect({ href: { pathname: "/login", query: { error: error?.message ?? "oauth" } }, locale });
  nextRedirect(data.url!);
}

export async function signOut() {
  const locale = await getLocale();
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect({ href: "/", locale });
}
