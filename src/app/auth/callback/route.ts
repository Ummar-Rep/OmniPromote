import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles Google sign-in and email-confirmation links from Supabase.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/en/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/en/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // New Google users choose organizer/sponsor on the signup page before continuing.
      const role = searchParams.get("role");
      if (role === "organizer" || role === "sponsor" || role === "media_owner" || role === "agency") {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) await supabase.from("profiles").update({ role }).eq("id", user.id).eq("onboarded", false);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/en/login?error=oauth`);
}
