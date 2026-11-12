import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatAed, formatCompact } from "@/lib/format";
import { PLATFORMS } from "@/lib/constants";
import type { InfluencerRow } from "@/lib/types";
import { Badge } from "./ui";

export function followersOf(i: InfluencerRow) {
  return PLATFORMS.map((p) => ({ platform: p, count: i[`${p}_followers`] })).filter(
    (x): x is { platform: (typeof PLATFORMS)[number]; count: number } => !!x.count,
  );
}

export function lowestPrice(i: InfluencerRow) {
  const prices = [i.price_story_aed, i.price_post_aed, i.price_video_aed].filter((p): p is number => p !== null);
  return prices.length ? Math.min(...prices.map(Number)) : null;
}

export function InfluencerCard({ influencer, showPrice }: { influencer: InfluencerRow; showPrice: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const reach = followersOf(influencer);
  const total = reach.reduce((s, r) => s + r.count, 0);
  const from = lowestPrice(influencer);
  return (
    <Link
      href={`/influencers/${influencer.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-navy-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-navy-100 text-lg font-bold text-navy-700">
          {influencer.avatar_url ? (
            <img src={influencer.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            influencer.name.slice(0, 1)
          )}
        </div>
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-navy-900 group-hover:text-navy-700">{influencer.name}</h3>
          <p className="text-sm text-navy-500">
            {t(`niches.${influencer.niche}`)} · {t(`emirates.${influencer.emirate as "Dubai"}`)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {reach.map((r) => (
          <Badge key={r.platform}>
            {t(`platforms.${r.platform}`)} {formatCompact(r.count, locale)}
          </Badge>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between pt-1 text-sm">
        <span className="text-navy-500">{t("influencers.totalReach", { count: formatCompact(total, locale) })}</span>
        {showPrice ? (
          from !== null && <span className="font-semibold text-navy-900">{t("common.from", { price: formatAed(from, locale) })}</span>
        ) : (
          <span className="text-xs text-navy-500">{t("spaces.loginForPrice")}</span>
        )}
      </div>
    </Link>
  );
}
