import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { COMPANY_TYPES, EMIRATES } from "@/lib/constants";
import type { ProfileContacts } from "@/lib/types";
import { Card, Field, Input, Notice, PageHeader, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { Flash } from "@/components/Flash";
import { saveProfile } from "./actions";

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ welcome?: string; error?: string; ok?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const sp = await searchParams;
  const t = await getTranslations();
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) return redirect({ href: "/login", locale: locale as Locale });

  const { data: contacts } = await supabase
    .from("profile_contacts")
    .select("*")
    .eq("profile_id", user.id)
    .maybeSingle<ProfileContacts>();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader title={t("profile.title")} />
      {(sp.welcome || !profile.onboarded) && (
        <div className="mb-6">
          <Notice>{t("profile.welcome")}</Notice>
        </div>
      )}
      <Flash error={sp.error} ok={sp.ok ? t("common.saved") : undefined} />
      <form action={saveProfile} className="space-y-6">
        <Card className="space-y-4">
          {!profile.onboarded && (
            <Field label={t("profile.role")}>
              <Select name="role" defaultValue={profile.role}>
                <option value="sponsor">{t("auth.roleSponsor")}</option>
                <option value="organizer">{t("auth.roleOrganizer")}</option>
              </Select>
            </Field>
          )}
          <Field label={t("auth.companyName")}>
            <Input name="company_name" defaultValue={profile.company_name ?? ""} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("profile.companyType")}>
              <Select name="company_type" defaultValue={profile.company_type ?? ""} required>
                <option value="" disabled>
                  —
                </option>
                {COMPANY_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {t(`companyTypes.${c}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("profile.emirate")}>
              <Select name="emirate" defaultValue={profile.emirate ?? ""} required>
                <option value="" disabled>
                  —
                </option>
                {EMIRATES.map((e) => (
                  <option key={e} value={e}>
                    {t(`emirates.${e}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={t("profile.about")} optional={t("common.optional")}>
            <Textarea name="about" defaultValue={profile.about ?? ""} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("profile.logo")} optional={t("common.optional")}>
              <div className="flex items-center gap-3">
                {profile.logo_url && <img src={profile.logo_url} alt="" className="h-10 w-10 rounded object-cover" />}
                <Input name="logo" type="file" accept="image/*" />
              </div>
            </Field>
            <Field label={t("profile.trn")} optional={t("common.optional")}>
              <Input name="trn" defaultValue={profile.trn ?? ""} />
            </Field>
          </div>
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="font-semibold">{t("profile.privateTitle")}</h2>
            <p className="text-sm text-navy-500">{t("profile.privateHint")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("profile.contactName")}>
              <Input name="contact_name" defaultValue={contacts?.contact_name ?? ""} required />
            </Field>
            <Field label={t("profile.phone")}>
              <Input name="phone" type="tel" defaultValue={contacts?.phone ?? ""} required placeholder="+971" />
            </Field>
            <Field label={t("auth.email")}>
              <Input name="email" type="email" defaultValue={contacts?.email ?? user.email ?? ""} required />
            </Field>
            <Field label={t("profile.website")} optional={t("common.optional")}>
              <Input name="website" defaultValue={contacts?.website ?? ""} />
            </Field>
          </div>
        </Card>
        <SubmitButton pendingText={t("common.saving")}>
          {profile.onboarded ? t("common.save") : t("profile.continue")}
        </SubmitButton>
      </form>
    </div>
  );
}
