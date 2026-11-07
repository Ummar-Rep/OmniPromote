export type UserRole = "organizer" | "sponsor" | "admin";
export type EventCategory =
  | "conference" | "exhibition" | "sports" | "concert" | "festival" | "community" | "corporate" | "education" | "other";
export type EventStatus = "draft" | "pending_review" | "published" | "rejected" | "closed";
export type PriceType = "fixed" | "open_offer" | "in_kind";
export type ProposalStatus = "sent" | "accepted" | "rejected" | "withdrawn";
export type DealStatus =
  | "awaiting_sponsor_payment" | "sponsor_paid" | "proof_uploaded" | "proof_approved" | "organizer_paid" | "cancelled";

export interface Profile {
  id: string;
  role: UserRole;
  company_name: string | null;
  company_type: string | null;
  emirate: string | null;
  about: string | null;
  logo_url: string | null;
  trn: string | null;
  verified: boolean;
  onboarded: boolean;
  created_at: string;
}

export interface ProfileContacts {
  profile_id: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
}

export interface EventRow {
  id: string;
  organizer_id: string;
  title_en: string;
  title_ar: string | null;
  description_en: string;
  description_ar: string | null;
  category: EventCategory;
  emirate: string;
  venue: string | null;
  start_date: string;
  end_date: string;
  expected_attendance: number | null;
  audience_description: string | null;
  cover_image_url: string | null;
  status: EventStatus;
  rejection_reason: string | null;
  created_at: string;
}

export interface PackageRow {
  id: string;
  event_id: string;
  tier_name: string;
  price_type: PriceType;
  price_aed: number | null;
  in_kind_description: string | null;
  slots_total: number;
  slots_taken: number;
  benefits: string[];
  deliverables_proof: string | null;
  sort_order: number;
}

export interface ProposalRow {
  id: string;
  package_id: string;
  event_id: string;
  sponsor_id: string;
  organizer_id: string;
  message: string;
  offered_price_aed: number | null;
  in_kind_offer: string | null;
  status: ProposalStatus;
  created_at: string;
}

export interface MessageRow {
  id: string;
  proposal_id: string;
  sender_id: string;
  body: string;
  was_masked: boolean;
  created_at: string;
}

export interface DealRow {
  id: string;
  proposal_id: string;
  package_id: string;
  event_id: string;
  sponsor_id: string;
  organizer_id: string;
  agreed_price_aed: number;
  in_kind_terms: string | null;
  commission_rate: number;
  commission_aed: number;
  organizer_payout_aed: number;
  vat_rate: number;
  vat_aed: number;
  total_due_aed: number;
  founding_partner_waiver: boolean;
  status: DealStatus;
  admin_notes: string | null;
  created_at: string;
  sponsor_paid_at: string | null;
  proof_uploaded_at: string | null;
  proof_approved_at: string | null;
  organizer_paid_at: string | null;
  cancelled_at: string | null;
}

export interface InvoiceRow {
  id: string;
  deal_id: string;
  type: "sponsor_invoice" | "organizer_statement";
  number: string;
  amount_aed: number;
  vat_aed: number;
  total_aed: number;
  issued_at: string;
  paid_at: string | null;
}

export interface SettingsRow {
  legal_name: string;
  address: string;
  trn: string | null;
  bank_name: string | null;
  account_name: string | null;
  iban: string | null;
  swift: string | null;
  default_commission_rate: number;
  vat_rate: number;
  invoice_prefix: string;
  founding_partner_offer: boolean;
}
