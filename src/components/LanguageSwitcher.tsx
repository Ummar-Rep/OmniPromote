"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LanguageSwitcher() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams();
  const next = locale === "ar" ? "en" : "ar";
  const query = search.toString();
  return (
    <button
      type="button"
      onClick={() => router.replace(query ? `${pathname}?${query}` : pathname, { locale: next })}
      className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/10"
    >
      {t("language")}
    </button>
  );
}
