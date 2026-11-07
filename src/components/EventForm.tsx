import { useTranslations } from "next-intl";
import { EMIRATES, EVENT_CATEGORIES } from "@/lib/constants";
import type { EventRow } from "@/lib/types";
import { Field, Input, Select, Textarea } from "./ui";

// Shared fields for creating and editing an event.
export function EventFields({ event }: { event?: EventRow }) {
  const t = useTranslations();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("eventForm.titleEn")}>
          <Input name="title_en" defaultValue={event?.title_en} required />
        </Field>
        <Field label={t("eventForm.titleAr")} optional={t("common.optional")}>
          <Input name="title_ar" dir="rtl" defaultValue={event?.title_ar ?? ""} />
        </Field>
      </div>
      <Field label={t("eventForm.descriptionEn")}>
        <Textarea name="description_en" defaultValue={event?.description_en} required rows={5} />
      </Field>
      <Field label={t("eventForm.descriptionAr")} optional={t("common.optional")}>
        <Textarea name="description_ar" dir="rtl" defaultValue={event?.description_ar ?? ""} rows={5} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("eventForm.category")}>
          <Select name="category" defaultValue={event?.category ?? "conference"}>
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("eventForm.emirate")}>
          <Select name="emirate" defaultValue={event?.emirate ?? "Dubai"}>
            {EMIRATES.map((e) => (
              <option key={e} value={e}>
                {t(`emirates.${e}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("eventForm.venue")}>
          <Input name="venue" defaultValue={event?.venue ?? ""} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("eventForm.startDate")}>
          <Input type="date" name="start_date" defaultValue={event?.start_date} required />
        </Field>
        <Field label={t("eventForm.endDate")}>
          <Input type="date" name="end_date" defaultValue={event?.end_date} required />
        </Field>
        <Field label={t("eventForm.attendance")}>
          <Input type="number" min={0} name="expected_attendance" defaultValue={event?.expected_attendance ?? ""} />
        </Field>
      </div>
      <Field label={t("eventForm.audience")}>
        <Input name="audience_description" defaultValue={event?.audience_description ?? ""} />
      </Field>
      <Field label={t("eventForm.cover")} optional={t("common.optional")}>
        <div className="flex items-center gap-3">
          {event?.cover_image_url && (
            <img src={event.cover_image_url} alt="" className="h-14 w-24 rounded object-cover" />
          )}
          <Input type="file" name="cover" accept="image/*" />
        </div>
      </Field>
    </div>
  );
}
