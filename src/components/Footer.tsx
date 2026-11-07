import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function Footer() {
  const t = await getTranslations("footer");
  return (
    <footer className="no-print mt-20 border-t border-navy-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-navy-500">
        <p>
          <span className="font-semibold text-navy-900">OmniPromote</span> · {t("tagline")}
        </p>
        <div className="flex gap-4">
          <Link href="/terms" className="hover:text-navy-900">
            {t("terms")}
          </Link>
          <Link href="/privacy" className="hover:text-navy-900">
            {t("privacy")}
          </Link>
          <span>
            © {new Date().getFullYear()} {t("rights")}
          </span>
        </div>
      </div>
    </footer>
  );
}
