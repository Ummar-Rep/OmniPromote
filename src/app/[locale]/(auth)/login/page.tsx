import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { Flash } from "@/components/Flash";
import { signIn, signInWithGoogle } from "../actions";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const { error, ok } = await searchParams;
  const t = await getTranslations("auth");

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card>
        <h1 className="mb-6 text-2xl font-bold">{t("loginTitle")}</h1>
        <Flash
          error={error ? (error === "invalid" ? t("invalid") : error) : undefined}
          ok={ok === "checkEmail" ? t("checkEmail") : undefined}
        />
        <form action={signIn} className="space-y-4">
          <Field label={t("email")}>
            <Input name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label={t("password")}>
            <Input name="password" type="password" required autoComplete="current-password" />
          </Field>
          <SubmitButton className="w-full">{t("loginButton")}</SubmitButton>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs text-navy-500">
          <span className="h-px flex-1 bg-navy-100" />
          {t("or")}
          <span className="h-px flex-1 bg-navy-100" />
        </div>
        <form action={signInWithGoogle}>
          <SubmitButton variant="secondary" className="w-full">
            {t("google")}
          </SubmitButton>
        </form>
        <p className="mt-6 text-center text-sm text-navy-500">
          {t("noAccount")}{" "}
          <Link href="/signup" className="font-semibold text-navy-900 underline">
            {t("signupButton")}
          </Link>
        </p>
      </Card>
    </div>
  );
}
