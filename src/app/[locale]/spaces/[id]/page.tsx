import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { formatAed, formatDate, formatNumber, pick } from "@/lib/format";
import type { AdSpaceRow } from "@/lib/types";
import { Badge, Card, Field, Input, Notice, Textarea, buttonClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { MaskedText } from "@/components/MaskedText";
import { SpacesMap } from "@/components/SpacesMap";
import { Flash } from "@/components/Flash";
import { requestBooking } from "./actions";

type SpaceWithOwner = AdSpaceRow & { owner: { company_name: string | null; verified: boolean } | null };

export default async function SpaceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const { error } = await searchParams;
  const t = await getTranslations();
  const { supabase, user, profile } = await getSession();

  const { data: space } = await supabase
    .from("ad_spaces")
    .select("*, owner:profiles!ad_spaces_owner_id_fkey(company_name, verified)")
    .eq("id", id)
    .maybeSingle<SpaceWithOwner>();
  if (!space) notFound();

  const [{ data: bookedRaw }, { data: openRequest }] = await Promise.all([
    supabase.rpc("ad_space_booked_ranges", { p_space: id }),
    user
      ? supabase
          .from("ad_bookings")
          .select("id")
          .eq("ad_space_id", id)
          .eq("buyer_id", user.id)
          .eq("status", "requested")
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const booked = (bookedRaw ?? []) as { start_date: string; end_date: string }[];
  const isOwner = user?.id === space.owner_id;
  const isSponsor = profile?.role === "sponsor";
  const canBook = space.status === "published" && isSponsor && !openRequest;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const size = space.width_m && space.height_m ? `${Number(space.width_m)} × ${Number(space.height_m)} m` : null;
  const photos = space.photo_urls.filter((u) => u !== space.cover_image_url);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Flash error={error} />
      <div className="overflow-hidden rounded-3xl bg-navy-900 text-white">
        <div className="grid md:grid-cols-2">
          <div className="aspect-[16/10] bg-navy-800 md:aspect-auto">
            {space.cover_image_url && <img src={space.cover_image_url} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="flex flex-col gap-4 p-8">
            <div className="flex flex-wrap gap-2">
              <Badge tone="gold">{t(`spaceTypes.${space.type}`)}</Badge>
              {space.is_digital && <Badge tone="blue">{t("spaces.digital")}</Badge>}
              {space.illuminated && <Badge>{t("spaces.illuminated")}</Badge>}
              {space.status !== "published" && <Badge>{t(`eventStatus.${space.status}`)}</Badge>}
            </div>
            <h1 className="text-3xl font-bold leading-tight">
              <MaskedText text={pick(space, "title", locale)} />
            </h1>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-navy-200">{t("spaces.location")}</dt>
                <dd className="font-medium">
                  {space.area ? `${space.area}, ` : ""}
                  {t(`emirates.${space.emirate as "Dubai"}`)}
                </dd>
              </div>
              {size && (
                <div>
                  <dt className="text-navy-200">{t("spaces.size")}</dt>
                  <dd className="font-medium" dir="ltr">
                    {size}
                  </dd>
                </div>
              )}
              {space.daily_impressions ? (
                <div>
                  <dt className="text-navy-200">{t("spaceForm.impressions")}</dt>
                  <dd className="font-medium">{formatNumber(space.daily_impressions, locale)}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-navy-200">{t("spaces.minBooking")}</dt>
                <dd className="font-medium">{t("spaces.weeks", { count: space.min_weeks })}</dd>
              </div>
              <div>
                <dt className="text-navy-200">{t("spaces.owner")}</dt>
                <dd className="font-medium">
                  {space.owner?.company_name}{" "}
                  {space.owner?.verified && <span className="text-gold-300">✓ {t("common.verified")}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-navy-200">{t("spaces.price")}</dt>
                <dd className="text-lg font-bold text-gold-300">
                  {user ? t("spaces.perWeek", { price: formatAed(space.price_per_week_aed, locale) }) : t("spaces.loginForPrice")}
                </dd>
              </div>
            </dl>
            {isOwner && (
              <Link href={`/dashboard/spaces/${space.id}`} className={`${buttonClass.primary} mt-auto self-start`}>
                {t("common.edit")}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section>
            <h2 className="mb-3 text-lg font-bold">{t("event.about")}</h2>
            <p className="whitespace-pre-line text-navy-700">
              <MaskedText text={pick(space, "description", locale)} />
            </p>
          </section>
          {space.audience_description && (
            <section>
              <h2 className="mb-3 text-lg font-bold">{t("event.audience")}</h2>
              <p className="text-navy-700">
                <MaskedText text={space.audience_description} />
              </p>
            </section>
          )}
          {photos.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold">{t("spaces.photos")}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer">
                    <img src={u} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            </section>
          )}
          <section>
            <h2 className="mb-3 text-lg font-bold">{t("spaces.onMap")}</h2>
            <SpacesMap
              pins={[{ id: space.id, lat: Number(space.lat), lng: Number(space.lng), title: pick(space, "title", locale) }]}
              center={[Number(space.lat), Number(space.lng)]}
              zoom={15}
              className="h-80"
            />
          </section>
        </div>

        <aside className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold">{t("spaces.bookedDates")}</h2>
            {booked.length ? (
              <ul className="space-y-1 text-sm text-navy-700">
                {booked.map((b) => (
                  <li key={b.start_date}>
                    {formatDate(b.start_date, locale)} – {formatDate(b.end_date, locale)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-navy-500">{t("spaces.allFree")}</p>
            )}
          </Card>

          {!user ? (
            <Card>
              <p className="mb-4 text-navy-700">{t("spaces.loginToBook")}</p>
              <div className="flex gap-3">
                <Link href="/login" className={buttonClass.dark}>
                  {t("nav.login")}
                </Link>
                <Link href="/signup" className={buttonClass.primary}>
                  {t("nav.signup")}
                </Link>
              </div>
            </Card>
          ) : isOwner ? (
            <Notice>{t("spaces.ownSpace")}</Notice>
          ) : !isSponsor ? (
            <Notice>{t("spaces.onlySponsors")}</Notice>
          ) : openRequest ? (
            <Link href={`/bookings/${openRequest.id}`} className={`${buttonClass.primary} w-full`}>
              {t("spaces.viewRequest")}
            </Link>
          ) : canBook ? (
            <Card>
              <h2 className="mb-1 font-semibold">{t("spaces.requestTitle")}</h2>
              <p className="mb-4 text-xs text-navy-500">{t("spaces.requestHint")}</p>
              <form action={requestBooking} className="space-y-4">
                <input type="hidden" name="ad_space_id" value={space.id} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("spaces.startDate")}>
                    <Input type="date" name="start_date" min={tomorrow} required />
                  </Field>
                  <Field label={t("spaces.numWeeks")}>
                    <Input type="number" name="weeks" min={space.min_weeks} max={52} defaultValue={Math.max(2, space.min_weeks)} required />
                  </Field>
                </div>
                <Field label={t("event.yourMessage")} hint={t("spaces.messageHint")}>
                  <Textarea name="message" required minLength={20} rows={3} />
                </Field>
                <Field label={t("spaces.offerTotal")} hint={t("spaces.offerTotalHint")} optional={t("common.optional")}>
                  <Input name="offered_price_aed" type="number" min={0} step={500} />
                </Field>
                <SubmitButton pendingText={t("common.saving")} className="w-full">
                  {t("spaces.sendRequest")}
                </SubmitButton>
              </form>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
