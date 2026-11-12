import { useTranslations } from "next-intl";
import { AD_SPACE_TYPES, EMIRATES, UAE_CENTER } from "@/lib/constants";
import type { AdSpaceRow } from "@/lib/types";
import { Field, Input, Select, Textarea } from "./ui";
import { LocationPicker } from "./LocationPicker";

// Shared fields for creating and editing an ad space.
export function SpaceFields({ space }: { space?: AdSpaceRow }) {
  const t = useTranslations();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("spaceForm.titleEn")}>
          <Input name="title_en" defaultValue={space?.title_en} required />
        </Field>
        <Field label={t("spaceForm.titleAr")} optional={t("common.optional")}>
          <Input name="title_ar" dir="rtl" defaultValue={space?.title_ar ?? ""} />
        </Field>
      </div>
      <Field label={t("spaceForm.descriptionEn")}>
        <Textarea name="description_en" defaultValue={space?.description_en} required rows={4} />
      </Field>
      <Field label={t("spaceForm.descriptionAr")} optional={t("common.optional")}>
        <Textarea name="description_ar" dir="rtl" defaultValue={space?.description_ar ?? ""} rows={4} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("spaceForm.type")}>
          <Select name="type" defaultValue={space?.type ?? "billboard"}>
            {AD_SPACE_TYPES.map((c) => (
              <option key={c} value={c}>
                {t(`spaceTypes.${c}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("eventForm.emirate")}>
          <Select name="emirate" defaultValue={space?.emirate ?? "Dubai"}>
            {EMIRATES.map((e) => (
              <option key={e} value={e}>
                {t(`emirates.${e}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("spaceForm.area")} hint={t("spaceForm.areaHint")}>
          <Input name="area" defaultValue={space?.area ?? ""} />
        </Field>
      </div>
      <Field label={t("spaceForm.location")}>
        <LocationPicker
          lat={space ? Number(space.lat) : null}
          lng={space ? Number(space.lng) : null}
          fallback={UAE_CENTER}
          labels={{ hint: t("spaceForm.locationHint"), lat: t("spaceForm.lat"), lng: t("spaceForm.lng") }}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label={t("spaceForm.width")} optional={t("common.optional")}>
          <Input type="number" name="width_m" min={0} step="0.1" defaultValue={space?.width_m ?? ""} />
        </Field>
        <Field label={t("spaceForm.height")} optional={t("common.optional")}>
          <Input type="number" name="height_m" min={0} step="0.1" defaultValue={space?.height_m ?? ""} />
        </Field>
        <Field label={t("spaceForm.impressions")} optional={t("common.optional")}>
          <Input type="number" name="daily_impressions" min={0} step={100} defaultValue={space?.daily_impressions ?? ""} />
        </Field>
        <div className="space-y-2 pt-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_digital" defaultChecked={space?.is_digital} /> {t("spaces.digital")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="illuminated" defaultChecked={space?.illuminated} /> {t("spaces.illuminated")}
          </label>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("spaceForm.pricePerWeek")}>
          <Input type="number" name="price_per_week_aed" min={0} step={500} defaultValue={space?.price_per_week_aed ?? ""} required />
        </Field>
        <Field label={t("spaceForm.minWeeks")}>
          <Input type="number" name="min_weeks" min={1} max={52} defaultValue={space?.min_weeks ?? 1} required />
        </Field>
      </div>
      <Field label={t("spaceForm.audience")} optional={t("common.optional")}>
        <Input name="audience_description" defaultValue={space?.audience_description ?? ""} />
      </Field>
      <Field label={t("spaceForm.cover")} optional={t("common.optional")}>
        <div className="flex items-center gap-3">
          {space?.cover_image_url && <img src={space.cover_image_url} alt="" className="h-14 w-24 rounded object-cover" />}
          <Input type="file" name="cover" accept="image/*" />
        </div>
      </Field>
      <Field label={t("spaceForm.photos")} hint={t("spaceForm.photosHint")} optional={t("common.optional")}>
        <div className="space-y-2">
          {space?.photo_urls?.length ? (
            <div className="flex flex-wrap gap-2">
              {space.photo_urls.map((u) => (
                <img key={u} src={u} alt="" className="h-14 w-24 rounded object-cover" />
              ))}
            </div>
          ) : null}
          <Input type="file" name="photos" accept="image/*" multiple />
        </div>
      </Field>
    </div>
  );
}
