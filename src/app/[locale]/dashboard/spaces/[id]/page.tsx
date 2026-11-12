import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import type { AdSpaceRow } from "@/lib/types";
import { Badge, Card, Notice, PageHeader, buttonClass } from "@/components/ui";
import { SpaceFields } from "@/components/SpaceForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Flash } from "@/components/Flash";
import { updateSpace } from "../actions";

const statusTone = { draft: "gray", pending_review: "blue", published: "green", rejected: "red", closed: "gray" } as const;

export default async function EditSpacePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const sp = await searchParams;
  const { supabase, user } = await requireUser(locale, ["media_owner"]);
  const t = await getTranslations();

  const { data: space } = await supabase
    .from("ad_spaces")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle<AdSpaceRow>();
  if (!space) notFound();

  const canSubmit = space.status === "draft" || space.status === "rejected";
  const editable = space.status !== "closed";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        title={t("spaceForm.editTitle")}
        action={
          <div className="flex items-center gap-3">
            <Badge tone={statusTone[space.status]}>{t(`eventStatus.${space.status}`)}</Badge>
            <Link href={`/spaces/${space.id}`} className={buttonClass.secondary}>
              {t("eventForm.viewPublic")}
            </Link>
          </div>
        }
      />
      <Flash
        error={sp.error ? (sp.error === "needLocation" ? t("spaceForm.needLocation") : sp.error) : undefined}
        ok={sp.ok ? t("common.saved") : undefined}
      />
      {space.status === "rejected" && space.rejection_reason && (
        <div className="mb-6">
          <Notice tone="error">
            {t("eventForm.rejectedReason")} {space.rejection_reason}
          </Notice>
        </div>
      )}
      {space.status === "pending_review" && (
        <div className="mb-6">
          <Notice>{t("eventForm.pendingNote")}</Notice>
        </div>
      )}
      {space.status === "draft" && (
        <div className="mb-6">
          <Notice>{t("spaceForm.draftNote")}</Notice>
        </div>
      )}

      <form action={updateSpace}>
        <input type="hidden" name="id" value={space.id} />
        <Card>
          <fieldset disabled={!editable}>
            <SpaceFields space={space} />
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
              {space.photo_urls.length > 0 && (
                <SubmitButton variant="secondary" name="intent" value="clearPhotos" formNoValidate>
                  {t("spaceForm.clearPhotos")}
                </SubmitButton>
              )}
              {space.status === "published" && (
                <SubmitButton variant="danger" name="intent" value="close" formNoValidate confirm={t("spaceForm.close") + "?"}>
                  {t("spaceForm.close")}
                </SubmitButton>
              )}
              {canSubmit && (
                <SubmitButton variant="danger" name="intent" value="delete" formNoValidate confirm={t("spaceForm.delete") + "?"}>
                  {t("spaceForm.delete")}
                </SubmitButton>
              )}
            </div>
          )}
        </Card>
      </form>
    </div>
  );
}
