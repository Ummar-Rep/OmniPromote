import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import type { InfluencerHandles, InfluencerRow } from "@/lib/types";
import { Badge, Card, Notice, PageHeader, buttonClass } from "@/components/ui";
import { InfluencerFields } from "@/components/InfluencerForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Flash } from "@/components/Flash";
import { updateInfluencer } from "../actions";

const statusTone = { draft: "gray", pending_review: "blue", published: "green", rejected: "red", closed: "gray" } as const;

export default async function EditInfluencerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const sp = await searchParams;
  const { supabase, user } = await requireUser(locale, ["agency"]);
  const t = await getTranslations();

  const [{ data: influencer }, { data: handles }] = await Promise.all([
    supabase.from("influencers").select("*").eq("id", id).eq("agency_id", user.id).maybeSingle<InfluencerRow>(),
    supabase.from("influencer_handles").select("*").eq("influencer_id", id).maybeSingle<InfluencerHandles>(),
  ]);
  if (!influencer) notFound();

  const canSubmit = influencer.status === "draft" || influencer.status === "rejected";
  const editable = influencer.status !== "closed";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        title={t("influencerForm.editTitle")}
        action={
          <div className="flex items-center gap-3">
            <Badge tone={statusTone[influencer.status]}>{t(`eventStatus.${influencer.status}`)}</Badge>
            <Link href={`/influencers/${influencer.id}`} className={buttonClass.secondary}>
              {t("eventForm.viewPublic")}
            </Link>
          </div>
        }
      />
      <Flash error={sp.error} ok={sp.ok ? t("common.saved") : undefined} />
      {influencer.status === "rejected" && influencer.rejection_reason && (
        <div className="mb-6">
          <Notice tone="error">
            {t("eventForm.rejectedReason")} {influencer.rejection_reason}
          </Notice>
        </div>
      )}
      {influencer.status === "pending_review" && (
        <div className="mb-6">
          <Notice>{t("eventForm.pendingNote")}</Notice>
        </div>
      )}
      {influencer.status === "draft" && (
        <div className="mb-6">
          <Notice>{t("spaceForm.draftNote")}</Notice>
        </div>
      )}

      <form action={updateInfluencer}>
        <input type="hidden" name="id" value={influencer.id} />
        <Card>
          <fieldset disabled={!editable}>
            <InfluencerFields influencer={influencer} handles={handles} />
          </fieldset>
          {editable && (
            <div className="mt-6 flex flex-wrap gap-2">
              <SubmitButton variant="secondary" name="intent" value="save" pendingText={t("common.saving")}>
                {t("common.save")}
              </SubmitButton>
              {canSubmit && (
                <SubmitButton name="intent" value="submit">
                  {t("eventForm.submitReview")}
                </SubmitButton>
              )}
              {influencer.status === "published" && (
                <SubmitButton variant="danger" name="intent" value="close" formNoValidate confirm={t("influencerForm.close") + "?"}>
                  {t("influencerForm.close")}
                </SubmitButton>
              )}
              {canSubmit && (
                <SubmitButton variant="danger" name="intent" value="delete" formNoValidate confirm={t("influencerForm.delete") + "?"}>
                  {t("influencerForm.delete")}
                </SubmitButton>
              )}
            </div>
          )}
        </Card>
      </form>
    </div>
  );
}
