-- OmniPromote Phase 1: event sponsorship marketplace
-- Run in the Supabase SQL editor or with `supabase db push`.

create extension if not exists pgcrypto;

-- ───────────────────────── Types ─────────────────────────
create type public.user_role as enum ('organizer', 'sponsor', 'admin');
create type public.event_category as enum (
  'conference', 'exhibition', 'sports', 'concert', 'festival', 'community', 'corporate', 'education', 'other'
);
create type public.event_status as enum ('draft', 'pending_review', 'published', 'rejected', 'closed');
create type public.price_type as enum ('fixed', 'open_offer', 'in_kind');
create type public.proposal_status as enum ('sent', 'accepted', 'rejected', 'withdrawn');
create type public.deal_status as enum (
  'awaiting_sponsor_payment', 'sponsor_paid', 'proof_uploaded', 'proof_approved', 'organizer_paid', 'cancelled'
);
create type public.invoice_type as enum ('sponsor_invoice', 'organizer_statement');

-- ───────────────────────── Tables ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'sponsor',
  company_name text,
  company_type text check (company_type in (
    'hospital', 'university', 'school', 'bank', 'real_estate', 'retail', 'tech', 'hospitality',
    'government', 'event_company', 'community', 'other'
  )),
  emirate text,
  about text,
  logo_url text,
  trn text,
  verified boolean not null default false,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

-- Private contact details, hidden until a deal is paid.
create table public.profile_contacts (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  contact_name text,
  phone text,
  email text,
  website text
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles (id) on delete cascade,
  title_en text not null,
  title_ar text,
  description_en text not null default '',
  description_ar text,
  category public.event_category not null default 'other',
  emirate text not null,
  venue text,
  start_date date not null,
  end_date date not null,
  expected_attendance integer check (expected_attendance >= 0),
  audience_description text,
  cover_image_url text,
  status public.event_status not null default 'draft',
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index events_status_idx on public.events (status, start_date);
create index events_organizer_idx on public.events (organizer_id);

create table public.sponsorship_packages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  tier_name text not null,
  price_type public.price_type not null default 'fixed',
  price_aed numeric(12, 2) check (price_aed >= 0),
  in_kind_description text,
  slots_total integer not null default 1 check (slots_total >= 1),
  slots_taken integer not null default 0 check (slots_taken >= 0),
  benefits text[] not null default '{}',
  deliverables_proof text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (price_type <> 'fixed' or price_aed is not null)
);
create index packages_event_idx on public.sponsorship_packages (event_id);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.sponsorship_packages (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  sponsor_id uuid not null references public.profiles (id) on delete cascade,
  organizer_id uuid not null references public.profiles (id) on delete cascade,
  message text not null default '',
  offered_price_aed numeric(12, 2) check (offered_price_aed >= 0),
  in_kind_offer text,
  status public.proposal_status not null default 'sent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index proposals_sponsor_idx on public.proposals (sponsor_id);
create index proposals_organizer_idx on public.proposals (organizer_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  was_masked boolean not null default false,
  created_at timestamptz not null default now()
);
create index messages_proposal_idx on public.messages (proposal_id, created_at);

-- Every time someone tries to share contact details on the platform.
create table public.contact_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  source text not null,
  source_id uuid,
  original_text text not null,
  created_at timestamptz not null default now()
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null unique references public.proposals (id) on delete restrict,
  package_id uuid not null references public.sponsorship_packages (id) on delete restrict,
  event_id uuid not null references public.events (id) on delete restrict,
  sponsor_id uuid not null references public.profiles (id) on delete restrict,
  organizer_id uuid not null references public.profiles (id) on delete restrict,
  agreed_price_aed numeric(12, 2) not null default 0,
  in_kind_terms text,
  commission_rate numeric(5, 4) not null default 0.15 check (commission_rate between 0 and 1),
  commission_aed numeric(12, 2) not null default 0,
  organizer_payout_aed numeric(12, 2) not null default 0,
  vat_rate numeric(5, 4) not null default 0.05,
  vat_aed numeric(12, 2) not null default 0,
  total_due_aed numeric(12, 2) not null default 0,
  founding_partner_waiver boolean not null default false,
  status public.deal_status not null default 'awaiting_sponsor_payment',
  admin_notes text,
  created_at timestamptz not null default now(),
  sponsor_paid_at timestamptz,
  proof_uploaded_at timestamptz,
  proof_approved_at timestamptz,
  organizer_paid_at timestamptz,
  cancelled_at timestamptz
);
create index deals_sponsor_idx on public.deals (sponsor_id);
create index deals_organizer_idx on public.deals (organizer_id);

create sequence public.invoice_seq;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  type public.invoice_type not null,
  number text not null unique,
  amount_aed numeric(12, 2) not null,
  vat_aed numeric(12, 2) not null default 0,
  total_aed numeric(12, 2) not null,
  issued_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (deal_id, type)
);

create table public.deal_proofs (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id),
  file_paths text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

-- Single-row company settings used on invoices.
create table public.settings (
  id integer primary key default 1 check (id = 1),
  legal_name text not null default 'OmniPromote FZE',
  address text not null default 'United Arab Emirates',
  trn text,
  bank_name text,
  account_name text,
  iban text,
  swift text,
  default_commission_rate numeric(5, 4) not null default 0.15,
  vat_rate numeric(5, 4) not null default 0.05,
  invoice_prefix text not null default 'OP',
  founding_partner_offer boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1);

-- ───────────────────────── Helpers ─────────────────────────
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.my_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Masks phone numbers, emails, links, social handles and "contact me" phrases (English + Arabic).
create or replace function public.mask_contacts(input text)
returns text language plpgsql immutable as $$
declare
  t text := input;
  d text := '[0-9٠-٩۰-۹]';
begin
  if t is null then return null; end if;
  -- emails
  t := regexp_replace(t, '[A-Za-z0-9._%+-]+\s*(@|\(at\)|\[at\])\s*[A-Za-z0-9.-]+\s*(\.|\(dot\)|\[dot\])\s*[A-Za-z]{2,}', '[contact hidden]', 'gi');
  -- links and bare domains
  t := regexp_replace(t, '(https?://|www\.)\S+', '[contact hidden]', 'gi');
  t := regexp_replace(t, '\m[A-Za-z0-9-]+\.(com|ae|net|org|io|co|sa|qa|me|info|biz|app|link|ly)\M(/\S*)?', '[contact hidden]', 'gi');
  -- phone numbers: 9+ digits, allowing spaces, dashes, dots and brackets between them
  t := regexp_replace(t, '\+?' || d || '([\s().-]*' || d || '){8,}', '[contact hidden]', 'g');
  -- social handles
  t := regexp_replace(t, '(^|\s)@[A-Za-z0-9_.]{3,}', '\1[contact hidden]', 'g');
  -- off-platform contact phrases
  t := regexp_replace(t,
    '(whats\s*app|watsapp|wa\.me|telegram|t\.me|instagram|insta\M|snap\s*chat|wechat|signal app|call me|text me|ring me|my number|my mobile|my email|email me|dm me|reach me at|'
    || 'واتساب|واتس اب|واتس|تلغرام|تيليجرام|تليجرام|انستغرام|انستقرام|سناب|رقمي|رقم جوالي|اتصل بي|اتصل علي|راسلني|ايميلي|بريدي)',
    '[contact hidden]', 'gi');
  return t;
end;
$$;

create or replace function public.log_contact_attempt(p_source text, p_source_id uuid, p_text text)
returns void language sql security definer set search_path = public as $$
  insert into public.contact_attempts (user_id, source, source_id, original_text)
  values (auth.uid(), p_source, p_source_id, p_text);
$$;

-- ───────────────────────── Triggers ─────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();
create trigger proposals_touch before update on public.proposals
  for each row execute function public.touch_updated_at();

-- New sign-up → profile + private contact row. Role comes from sign-up form (never admin).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r text := coalesce(new.raw_user_meta_data ->> 'role', 'sponsor');
begin
  if r not in ('organizer', 'sponsor') then r := 'sponsor'; end if;
  insert into public.profiles (id, role, company_name)
  values (new.id, r::public.user_role, nullif(new.raw_user_meta_data ->> 'company_name', ''));
  insert into public.profile_contacts (profile_id, email, contact_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users can't make themselves admin or verified. Role may change only during onboarding.
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  new.verified := old.verified;
  if new.role is distinct from old.role then
    if old.onboarded or new.role = 'admin' then
      new.role := old.role;
    end if;
  end if;
  if new.about is distinct from old.about and new.about <> public.mask_contacts(new.about) then
    perform public.log_contact_attempt('profile', new.id, new.about);
    new.about := public.mask_contacts(new.about);
  end if;
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Organizers can't publish their own events; only admins approve. Contact details are masked.
create or replace function public.guard_event_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  joined text;
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      if new.status not in ('draft', 'pending_review') then new.status := 'draft'; end if;
    else
      new.organizer_id := old.organizer_id;
      if new.status is distinct from old.status and new.status in ('published', 'rejected') then
        raise exception 'Only an admin can publish or reject an event';
      end if;
      if new.status is distinct from old.status and old.status = 'closed' then
        raise exception 'A closed event cannot be reopened';
      end if;
    end if;
    joined := concat_ws(' | ', new.title_en, new.title_ar, new.description_en, new.description_ar, new.audience_description, new.venue);
    if joined <> public.mask_contacts(joined) then
      perform public.log_contact_attempt('event', new.id, joined);
      new.title_en := public.mask_contacts(new.title_en);
      new.title_ar := public.mask_contacts(new.title_ar);
      new.description_en := public.mask_contacts(new.description_en);
      new.description_ar := public.mask_contacts(new.description_ar);
      new.audience_description := public.mask_contacts(new.audience_description);
      new.venue := public.mask_contacts(new.venue);
    end if;
  end if;
  return new;
end;
$$;

create trigger events_guard before insert or update on public.events
  for each row execute function public.guard_event_write();

create or replace function public.guard_package_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  joined text;
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'UPDATE' then
      new.slots_taken := old.slots_taken;
      new.event_id := old.event_id;
    else
      new.slots_taken := 0;
    end if;
    joined := concat_ws(' | ', new.tier_name, new.in_kind_description, new.deliverables_proof, array_to_string(new.benefits, ' | '));
    if joined <> public.mask_contacts(joined) then
      perform public.log_contact_attempt('package', new.id, joined);
      new.tier_name := public.mask_contacts(new.tier_name);
      new.in_kind_description := public.mask_contacts(new.in_kind_description);
      new.deliverables_proof := public.mask_contacts(new.deliverables_proof);
      new.benefits := (select coalesce(array_agg(public.mask_contacts(b)), '{}') from unnest(new.benefits) b);
    end if;
  end if;
  return new;
end;
$$;

create trigger packages_guard before insert or update on public.sponsorship_packages
  for each row execute function public.guard_package_write();

-- Proposals: fill event/organizer from the package, check availability, mask contacts.
create or replace function public.prepare_proposal()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pkg record;
  joined text;
begin
  select p.*, e.organizer_id, e.status as event_status
    into pkg
    from public.sponsorship_packages p join public.events e on e.id = p.event_id
   where p.id = new.package_id;
  if not found then raise exception 'Package not found'; end if;
  if pkg.event_status <> 'published' then raise exception 'This event is not open for sponsorship'; end if;
  if pkg.slots_taken >= pkg.slots_total then raise exception 'This package is sold out'; end if;
  if pkg.organizer_id = new.sponsor_id then raise exception 'You cannot sponsor your own event'; end if;
  if exists (select 1 from public.proposals where package_id = new.package_id and sponsor_id = new.sponsor_id and status = 'sent') then
    raise exception 'You already have an open proposal for this package';
  end if;
  new.event_id := pkg.event_id;
  new.organizer_id := pkg.organizer_id;
  new.status := 'sent';
  joined := concat_ws(' | ', new.message, new.in_kind_offer);
  if joined <> public.mask_contacts(joined) then
    perform public.log_contact_attempt('proposal', new.id, joined);
    new.message := public.mask_contacts(new.message);
    new.in_kind_offer := public.mask_contacts(new.in_kind_offer);
  end if;
  return new;
end;
$$;

create trigger proposals_prepare before insert on public.proposals
  for each row execute function public.prepare_proposal();

create or replace function public.prepare_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  masked text := public.mask_contacts(new.body);
begin
  if masked <> new.body then
    perform public.log_contact_attempt('message', new.proposal_id, new.body);
    new.body := masked;
    new.was_masked := true;
  else
    new.was_masked := false;
  end if;
  return new;
end;
$$;

create trigger messages_prepare before insert on public.messages
  for each row execute function public.prepare_message();

-- ───────────────────────── Deal workflow (RPC) ─────────────────────────
create or replace function public.next_invoice_number()
returns text language sql security definer set search_path = public as $$
  select (select invoice_prefix from public.settings where id = 1) || '-' || to_char(now(), 'YYYY') || '-'
         || lpad(nextval('public.invoice_seq')::text, 4, '0');
$$;

create or replace function public.recalc_deal(d public.deals)
returns public.deals language plpgsql immutable as $$
begin
  d.commission_aed := round(d.agreed_price_aed * d.commission_rate, 2);
  d.organizer_payout_aed := d.agreed_price_aed - d.commission_aed;
  d.vat_aed := round(d.agreed_price_aed * d.vat_rate, 2);
  d.total_due_aed := d.agreed_price_aed + d.vat_aed;
  return d;
end;
$$;

-- Organizer accepts a proposal → deal + sponsor invoice. First deal for an organizer is commission-free.
create or replace function public.accept_proposal(p_proposal_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  pr public.proposals;
  pkg public.sponsorship_packages;
  s public.settings;
  d public.deals;
  price numeric(12, 2);
begin
  select * into pr from public.proposals where id = p_proposal_id for update;
  if not found or pr.organizer_id <> auth.uid() then raise exception 'Not allowed'; end if;
  if pr.status <> 'sent' then raise exception 'This proposal is no longer open'; end if;
  select * into pkg from public.sponsorship_packages where id = pr.package_id for update;
  if pkg.slots_taken >= pkg.slots_total then raise exception 'This package is sold out'; end if;
  select * into s from public.settings where id = 1;

  price := case
    when pkg.price_type = 'in_kind' then coalesce(pr.offered_price_aed, 0)
    when pkg.price_type = 'open_offer' then coalesce(pr.offered_price_aed, pkg.price_aed, 0)
    else coalesce(pr.offered_price_aed, pkg.price_aed)
  end;

  update public.proposals set status = 'accepted' where id = pr.id;
  update public.sponsorship_packages set slots_taken = slots_taken + 1 where id = pkg.id;

  d.id := gen_random_uuid();
  d.proposal_id := pr.id;
  d.package_id := pkg.id;
  d.event_id := pr.event_id;
  d.sponsor_id := pr.sponsor_id;
  d.organizer_id := pr.organizer_id;
  d.agreed_price_aed := price;
  d.in_kind_terms := case when pkg.price_type = 'in_kind' then coalesce(pr.in_kind_offer, pkg.in_kind_description) end;
  d.vat_rate := s.vat_rate;
  d.founding_partner_waiver := s.founding_partner_offer and not exists (
    select 1 from public.deals x where x.organizer_id = pr.organizer_id and x.status <> 'cancelled');
  d.commission_rate := case when d.founding_partner_waiver then 0 else s.default_commission_rate end;
  d.status := 'awaiting_sponsor_payment';
  d.created_at := now();
  d := public.recalc_deal(d);
  insert into public.deals select d.*;

  if d.total_due_aed > 0 then
    insert into public.invoices (deal_id, type, number, amount_aed, vat_aed, total_aed)
    values (d.id, 'sponsor_invoice', public.next_invoice_number(), d.agreed_price_aed, d.vat_aed, d.total_due_aed);
  end if;
  return d.id;
end;
$$;

create or replace function public.reject_proposal(p_proposal_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.proposals set status = 'rejected'
   where id = p_proposal_id and organizer_id = auth.uid() and status = 'sent';
  if not found then raise exception 'Not allowed'; end if;
end;
$$;

create or replace function public.withdraw_proposal(p_proposal_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.proposals set status = 'withdrawn'
   where id = p_proposal_id and sponsor_id = auth.uid() and status = 'sent';
  if not found then raise exception 'Not allowed'; end if;
end;
$$;

create or replace function public.submit_proof(p_deal_id uuid, p_paths text[], p_notes text)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.deals;
begin
  select * into d from public.deals where id = p_deal_id for update;
  if not found or d.organizer_id <> auth.uid() then raise exception 'Not allowed'; end if;
  if d.status not in ('sponsor_paid', 'proof_uploaded') then
    raise exception 'Proof can be uploaded once the sponsor has paid';
  end if;
  insert into public.deal_proofs (deal_id, uploaded_by, file_paths, notes)
  values (d.id, auth.uid(), coalesce(p_paths, '{}'), public.mask_contacts(p_notes));
  update public.deals set status = 'proof_uploaded', proof_uploaded_at = now() where id = d.id;
end;
$$;

create or replace function public.approve_proof(p_deal_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.deals set status = 'proof_approved', proof_approved_at = now()
   where id = p_deal_id and sponsor_id = auth.uid() and status = 'proof_uploaded';
  if not found then raise exception 'Not allowed'; end if;
end;
$$;

create or replace function public.admin_mark_sponsor_paid(p_deal_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  update public.deals set status = 'sponsor_paid', sponsor_paid_at = now()
   where id = p_deal_id and status = 'awaiting_sponsor_payment';
  if not found then raise exception 'Deal is not awaiting payment'; end if;
  update public.invoices set paid_at = now() where deal_id = p_deal_id and type = 'sponsor_invoice';
end;
$$;

-- Admin can release a payout once proof is approved (or approve on the sponsor's behalf after 7 days).
create or replace function public.admin_mark_organizer_paid(p_deal_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.deals;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  select * into d from public.deals where id = p_deal_id for update;
  if d.status not in ('proof_approved', 'proof_uploaded') then
    raise exception 'Proof must be uploaded before paying the organizer';
  end if;
  update public.deals
     set status = 'organizer_paid', organizer_paid_at = now(),
         proof_approved_at = coalesce(proof_approved_at, now())
   where id = d.id;
  if d.organizer_payout_aed > 0 then
    insert into public.invoices (deal_id, type, number, amount_aed, vat_aed, total_aed, paid_at)
    values (d.id, 'organizer_statement', public.next_invoice_number(), d.organizer_payout_aed, 0, d.organizer_payout_aed, now());
  end if;
end;
$$;

create or replace function public.admin_set_commission(p_deal_id uuid, p_rate numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.deals;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_rate < 0 or p_rate > 1 then raise exception 'Rate must be between 0 and 1'; end if;
  select * into d from public.deals where id = p_deal_id for update;
  if d.status in ('organizer_paid', 'cancelled') then raise exception 'Deal is closed'; end if;
  d.commission_rate := p_rate;
  d := public.recalc_deal(d);
  update public.deals
     set commission_rate = d.commission_rate, commission_aed = d.commission_aed,
         organizer_payout_aed = d.organizer_payout_aed
   where id = d.id;
end;
$$;

create or replace function public.admin_cancel_deal(p_deal_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.deals;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  select * into d from public.deals where id = p_deal_id for update;
  if d.status in ('organizer_paid', 'cancelled') then raise exception 'Deal is closed'; end if;
  update public.deals set status = 'cancelled', cancelled_at = now() where id = d.id;
  update public.sponsorship_packages set slots_taken = greatest(slots_taken - 1, 0) where id = d.package_id;
end;
$$;

-- Contact details are visible once the sponsor has paid.
create or replace function public.can_see_contacts(p_profile uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_profile = auth.uid() or public.is_admin() or exists (
    select 1 from public.deals d
     where d.status in ('sponsor_paid', 'proof_uploaded', 'proof_approved', 'organizer_paid')
       and ((d.sponsor_id = auth.uid() and d.organizer_id = p_profile)
         or (d.organizer_id = auth.uid() and d.sponsor_id = p_profile)));
$$;

create or replace function public.is_deal_party(p_deal uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.deals d where d.id = p_deal and auth.uid() in (d.sponsor_id, d.organizer_id));
$$;

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.profiles enable row level security;
alter table public.profile_contacts enable row level security;
alter table public.events enable row level security;
alter table public.sponsorship_packages enable row level security;
alter table public.proposals enable row level security;
alter table public.messages enable row level security;
alter table public.contact_attempts enable row level security;
alter table public.deals enable row level security;
alter table public.invoices enable row level security;
alter table public.deal_proofs enable row level security;
alter table public.settings enable row level security;

-- profiles: company name/logo are public; edit your own.
create policy "profiles readable" on public.profiles for select using (true);
create policy "profiles update own" on public.profiles for update
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- contacts: owner, admin, or the other side of a paid deal.
create policy "contacts read" on public.profile_contacts for select using (public.can_see_contacts(profile_id));
create policy "contacts write own" on public.profile_contacts for update
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "contacts insert own" on public.profile_contacts for insert with check (profile_id = auth.uid());

-- events
create policy "events read" on public.events for select
  using (status in ('published', 'closed') or organizer_id = auth.uid() or public.is_admin());
create policy "events insert" on public.events for insert
  with check (organizer_id = auth.uid() and public.my_role() = 'organizer');
create policy "events update" on public.events for update
  using (organizer_id = auth.uid() or public.is_admin())
  with check (organizer_id = auth.uid() or public.is_admin());
create policy "events delete draft" on public.events for delete
  using ((organizer_id = auth.uid() and status in ('draft', 'rejected')) or public.is_admin());

-- packages: prices only for logged-in users.
create policy "packages read" on public.sponsorship_packages for select using (
  auth.uid() is not null and exists (
    select 1 from public.events e where e.id = event_id
       and (e.status in ('published', 'closed') or e.organizer_id = auth.uid() or public.is_admin())));
create policy "packages write" on public.sponsorship_packages for all using (
  exists (select 1 from public.events e where e.id = event_id and (e.organizer_id = auth.uid() or public.is_admin()))
) with check (
  exists (select 1 from public.events e where e.id = event_id and (e.organizer_id = auth.uid() or public.is_admin())));

-- proposals: only the two sides and admin.
create policy "proposals read" on public.proposals for select
  using (auth.uid() in (sponsor_id, organizer_id) or public.is_admin());
create policy "proposals insert" on public.proposals for insert
  with check (sponsor_id = auth.uid() and public.my_role() = 'sponsor');

-- messages
create policy "messages read" on public.messages for select using (
  exists (select 1 from public.proposals p where p.id = proposal_id
           and (auth.uid() in (p.sponsor_id, p.organizer_id) or public.is_admin())));
create policy "messages insert" on public.messages for insert with check (
  sender_id = auth.uid() and exists (
    select 1 from public.proposals p where p.id = proposal_id and auth.uid() in (p.sponsor_id, p.organizer_id)));

create policy "contact attempts admin" on public.contact_attempts for select using (public.is_admin());

create policy "deals read" on public.deals for select
  using (auth.uid() in (sponsor_id, organizer_id) or public.is_admin());
create policy "deals admin update" on public.deals for update using (public.is_admin()) with check (public.is_admin());

-- Sponsors see their invoice; organizers see their payout statement.
create policy "invoices read" on public.invoices for select using (
  public.is_admin() or exists (
    select 1 from public.deals d where d.id = deal_id and (
      (type = 'sponsor_invoice' and d.sponsor_id = auth.uid())
      or (type = 'organizer_statement' and d.organizer_id = auth.uid()))));

create policy "proofs read" on public.deal_proofs for select using (public.is_deal_party(deal_id));

create policy "settings read" on public.settings for select using (auth.uid() is not null);
create policy "settings admin" on public.settings for update using (public.is_admin()) with check (public.is_admin());

-- RPCs are for signed-in users only.
revoke execute on function public.accept_proposal(uuid), public.reject_proposal(uuid), public.withdraw_proposal(uuid),
  public.submit_proof(uuid, text[], text), public.approve_proof(uuid), public.admin_mark_sponsor_paid(uuid),
  public.admin_mark_organizer_paid(uuid), public.admin_set_commission(uuid, numeric), public.admin_cancel_deal(uuid),
  public.log_contact_attempt(text, uuid, text), public.next_invoice_number()
  from public, anon;
grant execute on function public.accept_proposal(uuid), public.reject_proposal(uuid), public.withdraw_proposal(uuid),
  public.submit_proof(uuid, text[], text), public.approve_proof(uuid), public.admin_mark_sponsor_paid(uuid),
  public.admin_mark_organizer_paid(uuid), public.admin_set_commission(uuid, numeric), public.admin_cancel_deal(uuid)
  to authenticated;

-- ───────────────────────── Storage ─────────────────────────
insert into storage.buckets (id, name, public) values ('public-media', 'public-media', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('deal-proofs', 'deal-proofs', false)
  on conflict (id) do nothing;

-- public-media: anyone can view; users upload into a folder named after their user id.
create policy "media read" on storage.objects for select using (bucket_id = 'public-media');
create policy "media upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'public-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- deal-proofs: files live under <deal id>/...; organizer uploads, both sides + admin can view.
create policy "proofs upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'deal-proofs' and exists (
    select 1 from public.deals d where d.id::text = (storage.foldername(name))[1] and d.organizer_id = auth.uid()));
create policy "proofs view" on storage.objects for select to authenticated using (
  bucket_id = 'deal-proofs' and public.is_deal_party(((storage.foldername(name))[1])::uuid));
