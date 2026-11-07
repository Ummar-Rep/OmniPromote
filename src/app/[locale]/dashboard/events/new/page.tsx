import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { EventFields } from "@/components/EventForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Flash } from "@/components/Flash";
import { createEvent } from "../actions";

export default async function NewEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requireUser(locale, ["organizer"]);
  const { error } = await searchParams;
  const t = await getTranslations();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader title={t("eventForm.newTitle")} />
      <Flash error={error} />
      <form action={createEvent}>
        <Card>
          <EventFields />
          <div className="mt-6">
            <SubmitButton pendingText={t("common.saving")}>{t("eventForm.saveDraft")}</SubmitButton>
          </div>
        </Card>
      </form>
    </div>
  );
}
