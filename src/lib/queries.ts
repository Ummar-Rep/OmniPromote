// Shared select strings with the joins used by dashboards and admin pages.
export const PROPOSAL_SELECT =
  "*, event:events(id, title_en, title_ar), package:sponsorship_packages(tier_name, price_aed, price_type), sponsor:profiles!proposals_sponsor_id_fkey(company_name, verified), organizer:profiles!proposals_organizer_id_fkey(company_name, verified)";

export const DEAL_SELECT =
  "*, event:events(id, title_en, title_ar, start_date, end_date), package:sponsorship_packages(tier_name), space:ad_spaces(id, title_en, title_ar), booking:ad_bookings(start_date, end_date, weeks), influencer:influencers(id, name), campaign:campaign_requests(deliverables, go_live_date), sponsor:profiles!deals_sponsor_id_fkey(id, company_name, trn, emirate), organizer:profiles!deals_organizer_id_fkey(id, company_name, trn, emirate)";

export const CAMPAIGN_SELECT =
  "*, influencer:influencers(id, name, niche, avatar_url, price_post_aed), buyer:profiles!campaign_requests_buyer_id_fkey(company_name, verified), agency:profiles!campaign_requests_agency_id_fkey(company_name, verified)";

export const BOOKING_SELECT =
  "*, space:ad_spaces(id, title_en, title_ar, price_per_week_aed, emirate, cover_image_url), buyer:profiles!ad_bookings_buyer_id_fkey(company_name, verified), owner:profiles!ad_bookings_owner_id_fkey(company_name, verified)";

type Named = { company_name: string | null };
type EventRef = { id: string; title_en: string; title_ar: string | null };

export type ProposalJoined = import("./types").ProposalRow & {
  event: EventRef | null;
  package: { tier_name: string; price_aed: number | null; price_type: import("./types").PriceType } | null;
  sponsor: (Named & { verified: boolean }) | null;
  organizer: (Named & { verified: boolean }) | null;
};

export type DealJoined = import("./types").DealRow & {
  event: (EventRef & { start_date: string; end_date: string }) | null;
  package: { tier_name: string } | null;
  space: EventRef | null;
  booking: { start_date: string; end_date: string; weeks: number } | null;
  influencer: { id: string; name: string } | null;
  campaign: { deliverables: string; go_live_date: string } | null;
  sponsor: (Named & { id: string; trn: string | null; emirate: string | null }) | null;
  organizer: (Named & { id: string; trn: string | null; emirate: string | null }) | null;
};

export type BookingJoined = import("./types").BookingRow & {
  space: (EventRef & { price_per_week_aed: number; emirate: string; cover_image_url: string | null }) | null;
  buyer: (Named & { verified: boolean }) | null;
  owner: (Named & { verified: boolean }) | null;
};

export type CampaignJoined = import("./types").CampaignRow & {
  influencer: { id: string; name: string; niche: import("./types").InfluencerNiche; avatar_url: string | null; price_post_aed: number | null } | null;
  buyer: (Named & { verified: boolean }) | null;
  agency: (Named & { verified: boolean }) | null;
};

// A deal comes from an event package or an ad-space booking; these give one title for both.
export function dealTitle(d: Pick<DealJoined, "event" | "space" | "influencer">, locale: string) {
  if (d.influencer) return d.influencer.name;
  const ref = d.event ?? d.space;
  if (!ref) return "";
  return locale === "ar" && ref.title_ar ? ref.title_ar : ref.title_en;
}

export function dealSubtitle(d: Pick<DealJoined, "package" | "booking" | "campaign">, weeksLabel: (n: number) => string) {
  if (d.package) return d.package.tier_name;
  if (d.campaign) return d.campaign.deliverables;
  if (d.booking) return weeksLabel(d.booking.weeks);
  return "";
}

export function dealStartDate(d: Pick<DealJoined, "event" | "booking" | "campaign">) {
  return d.event?.start_date ?? d.booking?.start_date ?? d.campaign?.go_live_date ?? null;
}
