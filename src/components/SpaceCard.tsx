import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatAed, formatNumber, pick } from "@/lib/format";
import type { AdSpaceRow } from "@/lib/types";
import { Badge } from "./ui";

export function SpaceCard({ space, showPrice }: { space: AdSpaceRow; showPrice: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <Link
      href={`/spaces/${space.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[16/9] bg-navy-100">
        {space.cover_image_url && (
          <img src={space.cover_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
        <span className="absolute start-3 top-3 rounded-full bg-navy-900/85 px-2.5 py-1 text-xs font-medium text-white">
          {t(`spaceTypes.${space.type}`)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-semibold leading-snug text-navy-900 group-hover:text-navy-700">{pick(space, "title", locale)}</h3>
        <p className="text-sm text-navy-500">
          {space.area ? `${space.area}, ` : ""}
          {t(`emirates.${space.emirate as "Dubai"}`)}
        </p>
        {space.daily_impressions ? (
          <p className="text-sm text-navy-500">
            {t("spaces.impressions", { count: formatNumber(space.daily_impressions, locale) })}
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between pt-2">
          {showPrice ? (
            <span className="text-sm font-semibold text-navy-900">
              {t("spaces.perWeek", { price: formatAed(space.price_per_week_aed, locale) })}
            </span>
          ) : (
            <span className="text-xs text-navy-500">{t("spaces.loginForPrice")}</span>
          )}
          {space.is_digital && <Badge tone="blue">{t("spaces.digital")}</Badge>}
        </div>
      </div>
    </Link>
  );
}
