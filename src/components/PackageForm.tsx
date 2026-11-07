import { useTranslations } from "next-intl";
import { PRICE_TYPES } from "@/lib/constants";
import type { PackageRow } from "@/lib/types";
import { Field, Input, Select, Textarea } from "./ui";
import { SubmitButton } from "./SubmitButton";

export function PackageForm({
  eventId,
  pkg,
  action,
}: {
  eventId: string;
  pkg?: PackageRow;
  action: (form: FormData) => Promise<void>;
}) {
  const t = useTranslations();
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="event_id" value={eventId} />
      {pkg && <input type="hidden" name="package_id" value={pkg.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("eventForm.tierName")}>
          <Input name="tier_name" defaultValue={pkg?.tier_name} required />
        </Field>
        <Field label={t("eventForm.priceType")}>
          <Select name="price_type" defaultValue={pkg?.price_type ?? "fixed"}>
            {PRICE_TYPES.map((p) => (
              <option key={p} value={p}>
                {t(`priceTypes.${p}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("eventForm.price")} hint={t("priceTypes.fixed") + " / " + t("priceTypes.open_offer")}>
          <Input name="price_aed" type="number" min={0} step={500} defaultValue={pkg?.price_aed ?? ""} />
        </Field>
        <Field label={t("eventForm.slots")}>
          <Input name="slots_total" type="number" min={1} defaultValue={pkg?.slots_total ?? 1} required />
        </Field>
      </div>
      <Field label={t("eventForm.inKindDescription")} hint={t("priceTypes.in_kind")}>
        <Input name="in_kind_description" defaultValue={pkg?.in_kind_description ?? ""} />
      </Field>
      <Field label={t("eventForm.benefits")}>
        <Textarea name="benefits" rows={4} defaultValue={pkg?.benefits.join("\n")} required />
      </Field>
      <Field label={t("eventForm.deliverables")}>
        <Input name="deliverables_proof" defaultValue={pkg?.deliverables_proof ?? ""} />
      </Field>
      <input type="hidden" name="sort_order" value={pkg?.sort_order ?? 0} />
      <div className="flex gap-2">
        <SubmitButton pendingText={t("common.saving")}>{pkg ? t("common.save") : t("eventForm.addPackage")}</SubmitButton>
        {pkg && pkg.slots_taken === 0 && (
          <SubmitButton variant="danger" name="intent" value="delete">
            {t("eventForm.removePackage")}
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
