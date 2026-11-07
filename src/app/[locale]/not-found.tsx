import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  const t = useTranslations();
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-6xl font-bold text-gold-500">404</p>
      <p className="mt-4 text-navy-700">{t("event.notFound")}</p>
      <Link href="/events" className={`${buttonClass.primary} mt-6`}>
        {t("nav.browse")}
      </Link>
    </div>
  );
}
