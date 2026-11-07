import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatAed, formatDate, formatNumber, pick } from "@/lib/format";
import type { EventRow, PackageRow } from "@/lib/types";
import { Badge } from "./ui";

export type EventWithPackages = EventRow & {
  sponsorship_packages?: Pick<PackageRow, "price_aed" | "slots_total" | "slots_taken">[];
  organizer?: { company_name: string | null; verified: boolean } | null;
};

export function EventCard({ event }: { event: EventWithPackages }) {
  const t = useTranslations();
  const locale = useLocale();
  const pkgs = event.sponsorship_packages ?? [];
  const prices = pkgs.map((p) => p.price_aed).filter((p): p is number => p !== null);
  const minPrice = prices.length ? Math.min(...prices.map(Number)) : null;
  const slotsLeft = pkgs.reduce((sum, p) => sum + Math.max(p.slots_total - p.slots_taken, 0), 0);

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[16/9] bg-navy-100">
        {event.cover_image_url && (
          <img src={event.cover_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
        <span className="absolute start-3 top-3 rounded-full bg-navy-900/85 px-2.5 py-1 text-xs font-medium text-white">
          {t(`categories.${event.category}`)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-semibold leading-snug text-navy-900 group-hover:text-navy-700">
          {pick(event, "title", locale)}
        </h3>
        <p className="text-sm text-navy-500">
          {t(`emirates.${event.emirate as "Dubai"}`)} · {formatDate(event.start_date, locale)}
        </p>
        {event.expected_attendance ? (
          <p className="text-sm text-navy-500">
            {t("common.attendees", { count: formatNumber(event.expected_attendance, locale) })}
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between pt-2">
          {minPrice !== null ? (
            <span className="text-sm font-semibold text-navy-900">
              {t("common.from", { price: formatAed(minPrice, locale) })}
            </span>
          ) : (
            <span />
          )}
          {pkgs.length > 0 && (
            <Badge tone={slotsLeft > 0 ? "gold" : "red"}>{t("common.slotsLeft", { count: slotsLeft })}</Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
