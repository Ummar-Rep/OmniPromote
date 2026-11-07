import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import type { EventRow, PackageRow } from "@/lib/types";
import { Badge, Card, Notice, PageHeader, buttonClass } from "@/components/ui";
import { EventFields } from "@/components/EventForm";
import { PackageForm } from "@/components/PackageForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Flash } from "@/components/Flash";
import { savePackage, updateEvent } from "../actions";

const statusTone = { draft: "gray", pending_review: "blue", published: "green", rejected: "red", closed: "gray" } as const;

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const sp = await searchParams;
  const { supabase, user } = await requireUser(locale, ["organizer"]);
  const t = await getTranslations();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("organizer_id", user.id)
    .maybeSingle<EventRow>();
  if (!event) notFound();

  const { data: packages } = await supabase
    .from("sponsorship_packages")
    .select("*")
    .eq("event_id", id)
    .order("sort_order")
    .returns<PackageRow[]>();

  const canSubmit = event.status === "draft" || event.status === "rejected";
  const editable = event.status !== "closed";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        title={t("eventForm.editTitle")}
        action={
          <div className="flex items-center gap-3">
            <Badge tone={statusTone[event.status]}>{t(`eventStatus.${event.status}`)}</Badge>
            <Link href={`/events/${event.id}`} className={buttonClass.secondary}>
              {t("eventForm.viewPublic")}
            </Link>
          </div>
        }
      />
      <Flash
        error={sp.error ? (sp.error === "needPackage" ? t("eventForm.needPackage") : sp.error) : undefined}
        ok={sp.ok ? t("common.saved") : undefined}
      />
      {event.status === "rejected" && event.rejection_reason && (
        <div className="mb-6">
          <Notice tone="error">
            {t("eventForm.rejectedReason")} {event.rejection_reason}
          </Notice>
        </div>
      )}
      {event.status === "pending_review" && (
        <div className="mb-6">
          <Notice>{t("eventForm.pendingNote")}</Notice>
        </div>
      )}

      <form action={updateEvent}>
        <input type="hidden" name="id" value={event.id} />
        <Card>
          <fieldset disabled={!editable}>
            <EventFields event={event} />
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
              {event.status === "published" && (
                <SubmitButton variant="danger" name="intent" value="close" confirm={t("eventForm.closeEvent") + "?"}>
                  {t("eventForm.closeEvent")}
                </SubmitButton>
              )}
              {canSubmit && (
                <SubmitButton variant="danger" name="intent" value="delete" confirm={t("eventForm.deleteEvent") + "?"}>
                  {t("eventForm.deleteEvent")}
                </SubmitButton>
              )}
            </div>
          )}
        </Card>
      </form>

      <section className="mt-10">
        <h2 className="text-xl font-bold">{t("eventForm.packagesTitle")}</h2>
        <p className="mb-4 text-sm text-navy-500">{t("eventForm.packagesHint")}</p>
        <div className="space-y-4">
          {(packages ?? []).map((p) => (
            <Card key={p.id}>
              <p className="mb-3 text-sm text-navy-500">{t("common.slotsLeft", { count: p.slots_total - p.slots_taken })}</p>
              <PackageForm eventId={event.id} pkg={p} action={savePackage} />
            </Card>
          ))}
          {editable && (
            <Card className="border-dashed">
              <h3 className="mb-4 font-semibold">{t("eventForm.addPackage")}</h3>
              <PackageForm eventId={event.id} action={savePackage} />
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
