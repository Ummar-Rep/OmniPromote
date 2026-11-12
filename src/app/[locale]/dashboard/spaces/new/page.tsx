import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { SpaceFields } from "@/components/SpaceForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Flash } from "@/components/Flash";
import { createSpace } from "../actions";

export default async function NewSpacePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requireUser(locale, ["media_owner"]);
  const { error } = await searchParams;
  const t = await getTranslations();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader title={t("spaceForm.newTitle")} subtitle={t("spaceForm.newSubtitle")} />
      <Flash error={error === "needLocation" ? t("spaceForm.needLocation") : error} />
      <form action={createSpace}>
        <Card>
          <SpaceFields />
          <div className="mt-6">
            <SubmitButton pendingText={t("common.saving")}>{t("eventForm.saveDraft")}</SubmitButton>
          </div>
        </Card>
      </form>
    </div>
  );
}
