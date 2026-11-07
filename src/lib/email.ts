import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Sends a bilingual email via Resend. Does nothing if RESEND_API_KEY or the service key is not set.
export async function notifyUser(
  userId: string,
  subject: { en: string; ar: string },
  body: { en: string; ar: string },
  path: string,
) {
  const apiKey = process.env.RESEND_API_KEY;
  const admin = createAdminClient();
  if (!apiKey || !admin) return;

  const { data } = await admin.from("profile_contacts").select("email").eq("profile_id", userId).single();
  const to = data?.email;
  if (!to) return;

  const link = `${SITE_URL}/en${path}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0b1a36">
      <p>${body.en}</p>
      <p><a href="${link}" style="background:#c9a227;color:#0b1a36;padding:10px 16px;border-radius:6px;text-decoration:none">Open OmniPromote</a></p>
      <hr style="border:none;border-top:1px solid #ddd;margin:24px 0" />
      <p dir="rtl" style="text-align:right">${body.ar}</p>
    </div>`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "OmniPromote <notifications@example.com>",
        to,
        subject: `${subject.en} | ${subject.ar}`,
        html,
      }),
    });
  } catch (err) {
    console.error("Email failed", err);
  }
}
