import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client. Server only, used for looking up email addresses for notifications.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
