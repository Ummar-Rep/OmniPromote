import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/email";

// Runs daily (see vercel.json). Approves proof that sponsors did not review in time.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Service key missing" }, { status: 503 });

  const { data, error } = await admin.rpc("auto_approve_proofs");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (data ?? []) as string[];
  for (const id of ids) {
    const { data: deal } = await admin.from("deals").select("organizer_id").eq("id", id).single();
    if (deal) {
      await notifyUser(
        deal.organizer_id,
        { en: "Proof approved", ar: "تمت الموافقة على الإثبات" },
        {
          en: "Your proof of delivery was approved automatically. Your payout is being processed.",
          ar: "تمت الموافقة على إثبات التنفيذ تلقائيًا. جارٍ تحويل مستحقاتك.",
        },
        `/deals/${id}`,
      );
    }
  }
  return NextResponse.json({ approved: ids.length });
}
