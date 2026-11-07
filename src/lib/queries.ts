// Shared select strings with the joins used by dashboards and admin pages.
export const PROPOSAL_SELECT =
  "*, event:events(id, title_en, title_ar), package:sponsorship_packages(tier_name, price_aed, price_type), sponsor:profiles!proposals_sponsor_id_fkey(company_name, verified), organizer:profiles!proposals_organizer_id_fkey(company_name, verified)";

export const DEAL_SELECT =
  "*, event:events(id, title_en, title_ar, start_date, end_date), package:sponsorship_packages(tier_name), sponsor:profiles!deals_sponsor_id_fkey(id, company_name, trn, emirate), organizer:profiles!deals_organizer_id_fkey(id, company_name, trn, emirate)";

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
  sponsor: (Named & { id: string; trn: string | null; emirate: string | null }) | null;
  organizer: (Named & { id: string; trn: string | null; emirate: string | null }) | null;
};
