import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { Flash } from "@/components/Flash";
import { signInWithGoogle, signUp } from "../actions";

export default async function SignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; role?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const { error, role } = await searchParams;
  const t = await getTranslations("auth");
  const defaultRole = role === "organizer" || role === "media_owner" || role === "agency" ? role : "sponsor";

  const roles = [
    { value: "sponsor", label: t("roleSponsor"), hint: t("roleSponsorHint") },
    { value: "organizer", label: t("roleOrganizer"), hint: t("roleOrganizerHint") },
    { value: "media_owner", label: t("roleMediaOwner"), hint: t("roleMediaOwnerHint") },
    { value: "agency", label: t("roleAgency"), hint: t("roleAgencyHint") },
  ];

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card>
        <h1 className="mb-6 text-2xl font-bold">{t("signupTitle")}</h1>
        <Flash error={error ? (error === "terms" ? t("acceptTerms") : error) : undefined} />
        <form action={signUp} className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t("iAm")}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {roles.map((r) => (
                <label
                  key={r.value}
                  className="flex cursor-pointer gap-3 rounded-xl border border-navy-100 p-4 has-[:checked]:border-gold-500 has-[:checked]:bg-gold-100/40"
                >
                  <input type="radio" name="role" value={r.value} defaultChecked={r.value === defaultRole} className="mt-1" />
                  <span>
                    <span className="block font-semibold">{r.label}</span>
                    <span className="text-xs text-navy-500">{r.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label={t("companyName")}>
            <Input name="company_name" required />
          </Field>
          <Field label={t("fullName")}>
            <Input name="full_name" required autoComplete="name" />
          </Field>
          <Field label={t("email")}>
            <Input name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label={t("password")} hint={t("passwordHint")}>
            <Input name="password" type="password" minLength={8} required autoComplete="new-password" />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="terms" required className="mt-1" />
            <span>
              <Link href="/terms" className="underline" target="_blank">
                {t("acceptTerms")}
              </Link>
            </span>
          </label>
          <SubmitButton className="w-full">{t("signupButton")}</SubmitButton>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs text-navy-500">
          <span className="h-px flex-1 bg-navy-100" />
          {t("or")}
          <span className="h-px flex-1 bg-navy-100" />
        </div>
        <form action={signInWithGoogle}>
          <input type="hidden" name="role" value={defaultRole} />
          <SubmitButton variant="secondary" className="w-full">
            {t("google")}
          </SubmitButton>
        </form>
        <p className="mt-6 text-center text-sm text-navy-500">
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-semibold text-navy-900 underline">
            {t("loginButton")}
          </Link>
        </p>
      </Card>
    </div>
  );
}
