import { useTranslations } from "next-intl";
import { EMIRATES, INFLUENCER_NICHES, LANGUAGES, PLATFORMS } from "@/lib/constants";
import type { InfluencerHandles, InfluencerRow } from "@/lib/types";
import { Field, Input, Select, Textarea } from "./ui";

// Shared fields for creating and editing an influencer profile (agency accounts).
export function InfluencerFields({ influencer, handles }: { influencer?: InfluencerRow; handles?: InfluencerHandles | null }) {
  const t = useTranslations();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("influencerForm.name")} hint={t("influencerForm.nameHint")}>
          <Input name="name" defaultValue={influencer?.name} required />
        </Field>
        <Field label={t("influencerForm.niche")}>
          <Select name="niche" defaultValue={influencer?.niche ?? "lifestyle"}>
            {INFLUENCER_NICHES.map((n) => (
              <option key={n} value={n}>
                {t(`niches.${n}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("eventForm.emirate")}>
          <Select name="emirate" defaultValue={influencer?.emirate ?? "Dubai"}>
            {EMIRATES.map((e) => (
              <option key={e} value={e}>
                {t(`emirates.${e}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t("influencerForm.bioEn")}>
        <Textarea name="bio_en" defaultValue={influencer?.bio_en} required rows={3} />
      </Field>
      <Field label={t("influencerForm.bioAr")} optional={t("common.optional")}>
        <Textarea name="bio_ar" dir="rtl" defaultValue={influencer?.bio_ar ?? ""} rows={3} />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-navy-800">{t("influencerForm.languages")}</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {LANGUAGES.map((l) => (
            <label key={l} className="flex items-center gap-2">
              <input type="checkbox" name="languages" value={l} defaultChecked={influencer?.languages.includes(l)} />
              {t(`languages.${l}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <p className="mb-2 text-sm font-medium text-navy-800">{t("influencerForm.followers")}</p>
        <div className="grid gap-4 sm:grid-cols-4">
          {PLATFORMS.map((p) => (
            <Field key={p} label={t(`platforms.${p}`)} optional={t("common.optional")}>
              <Input type="number" min={0} step={1000} name={`${p}_followers`} defaultValue={influencer?.[`${p}_followers`] ?? ""} />
            </Field>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-navy-800">{t("influencerForm.handles")}</p>
        <p className="mb-2 text-xs text-navy-500">{t("influencerForm.handlesHint")}</p>
        <div className="grid gap-4 sm:grid-cols-4">
          {PLATFORMS.map((p) => (
            <Field key={p} label={t(`platforms.${p}`)} optional={t("common.optional")}>
              <Input name={`handle_${p}`} dir="ltr" defaultValue={handles?.[p] ?? ""} placeholder="@" />
            </Field>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label={t("influencerForm.engagement")} optional={t("common.optional")}>
          <Input type="number" min={0} max={100} step="0.1" name="engagement_rate" defaultValue={influencer?.engagement_rate ?? ""} />
        </Field>
        <Field label={t("influencerForm.pricePost")} optional={t("common.optional")}>
          <Input type="number" min={0} step={500} name="price_post_aed" defaultValue={influencer?.price_post_aed ?? ""} />
        </Field>
        <Field label={t("influencerForm.priceStory")} optional={t("common.optional")}>
          <Input type="number" min={0} step={500} name="price_story_aed" defaultValue={influencer?.price_story_aed ?? ""} />
        </Field>
        <Field label={t("influencerForm.priceVideo")} optional={t("common.optional")}>
          <Input type="number" min={0} step={500} name="price_video_aed" defaultValue={influencer?.price_video_aed ?? ""} />
        </Field>
      </div>
      <Field label={t("spaceForm.audience")} optional={t("common.optional")}>
        <Input name="audience_description" defaultValue={influencer?.audience_description ?? ""} />
      </Field>
      <Field label={t("influencerForm.photo")} optional={t("common.optional")}>
        <div className="flex items-center gap-3">
          {influencer?.avatar_url && <img src={influencer.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover" />}
          <Input type="file" name="avatar" accept="image/*" />
        </div>
      </Field>
    </div>
  );
}
