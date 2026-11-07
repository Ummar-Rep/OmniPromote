import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import type { Profile, UserRole } from "@/lib/types";
import type { Locale } from "@/i18n/routing";

export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null as Profile | null };
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  return { supabase, user, profile };
});

// Sends visitors to login, and new users to finish their profile first.
export async function requireUser(locale: string, roles?: UserRole[]) {
  const session = await getSession();
  if (!session.user || !session.profile) {
    redirect({ href: "/login", locale: locale as Locale });
    throw new Error("unreachable");
  }
  if (!session.profile.onboarded) {
    redirect({ href: "/profile?welcome=1", locale: locale as Locale });
  }
  if (roles && !roles.includes(session.profile.role)) {
    redirect({ href: "/dashboard", locale: locale as Locale });
  }
  return session as typeof session & { user: NonNullable<typeof session.user>; profile: Profile };
}
