import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { InfluencerFields } from "@/components/InfluencerForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Flash } from "@/components/Flash";
import { createInfluencer } from "../actions";

export default async function NewInfluencerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requireUser(locale, ["agency"]);
  const { error } = await searchParams;
  const t = await getTranslations();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader title={t("influencerForm.newTitle")} subtitle={t("influencerForm.newSubtitle")} />
      <Flash error={error} />
      <form action={createInfluencer}>
        <Card>
          <InfluencerFields />
          <div className="mt-6">
            <SubmitButton pendingText={t("common.saving")}>{t("eventForm.saveDraft")}</SubmitButton>
          </div>
        </Card>
      </form>
    </div>
  );
}
