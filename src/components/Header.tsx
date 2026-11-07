import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { signOut } from "@/app/[locale]/(auth)/actions";
import { LanguageSwitcher } from "./LanguageSwitcher";

export async function Header() {
  const t = await getTranslations("nav");
  const { profile } = await getSession();

  return (
    <header className="no-print sticky top-0 z-40 bg-navy-900 text-white shadow">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold-500 text-navy-900">M1</span>
          <span>
            Marketing<span className="text-gold-400">One</span>
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm sm:gap-2">
          <Link href="/events" className="rounded-lg px-3 py-1.5 hover:bg-white/10">
            {t("browse")}
          </Link>
          {profile ? (
            <>
              <Link href="/dashboard" className="rounded-lg px-3 py-1.5 hover:bg-white/10">
                {t("dashboard")}
              </Link>
              {profile.role === "admin" && (
                <Link href="/admin" className="rounded-lg px-3 py-1.5 text-gold-300 hover:bg-white/10">
                  {t("admin")}
                </Link>
              )}
              <Link href="/profile" className="rounded-lg px-3 py-1.5 hover:bg-white/10">
                {t("profile")}
              </Link>
              <form action={signOut}>
                <button className="rounded-lg px-3 py-1.5 text-white/80 hover:bg-white/10">{t("logout")}</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-3 py-1.5 hover:bg-white/10">
                {t("login")}
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-gold-500 px-3 py-1.5 font-semibold text-navy-900 hover:bg-gold-400"
              >
                {t("signup")}
              </Link>
            </>
          )}
          <Suspense>
            <LanguageSwitcher />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
