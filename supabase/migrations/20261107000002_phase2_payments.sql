-- OmniPromote Phase 2: online card payments, organizer payouts, disputes, auto-approval, refunds.
-- Run after the Phase 1 migration.

alter type public.deal_status add value if not exists 'disputed' after 'proof_uploaded';

-- ───────────────────────── Deal payment fields ─────────────────────────
alter table public.deals
  add column payment_method text check (payment_method in ('bank_transfer', 'card')),
  add column stripe_checkout_session_id text,
  add column stripe_payment_intent_id text,
  add column payout_method text check (payout_method in ('bank_transfer', 'stripe')),
  add column stripe_transfer_id text,
  add column stripe_refund_id text,
  add column refunded_at timestamptz,
  add column dispute_reason text,
  add column disputed_at timestamptz,
  add column auto_approved boolean not null default false;

-- Days a sponsor has to review proof before it is approved automatically.
alter table public.settings
  add column proof_review_days integer not null default 7 check (proof_review_days between 1 and 60);

-- ───────────────────────── Organizer payout accounts ─────────────────────────
-- Kept out of `profiles` because profiles are public. Written only by the server (service role).
create table public.payout_accounts (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  stripe_account_id text not null unique,
  details_submitted boolean not null default false,
  payouts_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.payout_accounts enable row level security;
create policy "payout account read own" on public.payout_accounts for select
  using (profile_id = auth.uid() or public.is_admin());

-- ───────────────────────── Workflow functions ─────────────────────────

-- Re-created with an explicit column list so new deal columns keep their defaults.
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

  d.agreed_price_aed := price;
  d.vat_rate := s.vat_rate;
  d.founding_partner_waiver := s.founding_partner_offer and not exists (
    select 1 from public.deals x where x.organizer_id = pr.organizer_id and x.status <> 'cancelled');
  d.commission_rate := case when d.founding_partner_waiver then 0 else s.default_commission_rate end;
  d := public.recalc_deal(d);

  insert into public.deals (
    proposal_id, package_id, event_id, sponsor_id, organizer_id, agreed_price_aed, in_kind_terms,
    commission_rate, commission_aed, organizer_payout_aed, vat_rate, vat_aed, total_due_aed,
    founding_partner_waiver, status
  ) values (
    pr.id, pkg.id, pr.event_id, pr.sponsor_id, pr.organizer_id, d.agreed_price_aed,
    case when pkg.price_type = 'in_kind' then coalesce(pr.in_kind_offer, pkg.in_kind_description) end,
    d.commission_rate, d.commission_aed, d.organizer_payout_aed, d.vat_rate, d.vat_aed, d.total_due_aed,
    d.founding_partner_waiver, 'awaiting_sponsor_payment'
  ) returning * into d;

  if d.total_due_aed > 0 then
    insert into public.invoices (deal_id, type, number, amount_aed, vat_aed, total_aed)
    values (d.id, 'sponsor_invoice', public.next_invoice_number(), d.agreed_price_aed, d.vat_aed, d.total_due_aed);
  end if;
  return d.id;
end;
$$;
-- Shared by the admin button (bank transfer) and the Stripe webhook (card).
create or replace function public.apply_sponsor_payment(p_deal_id uuid, p_method text, p_payment_intent text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.deals
     set status = 'sponsor_paid', sponsor_paid_at = now(), payment_method = p_method,
         stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id)
   where id = p_deal_id and status = 'awaiting_sponsor_payment';
  if not found then return false; end if;
  update public.invoices set paid_at = now() where deal_id = p_deal_id and type = 'sponsor_invoice';
  return true;
end;
$$;

create or replace function public.admin_mark_sponsor_paid(p_deal_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if not public.apply_sponsor_payment(p_deal_id, 'bank_transfer', null) then
    raise exception 'Deal is not awaiting payment';
  end if;
end;
$$;

-- Called by the Stripe webhook with the service key. Returns false if already paid (webhooks can repeat).
create or replace function public.system_mark_sponsor_paid(p_deal_id uuid, p_payment_intent text)
returns boolean language sql security definer set search_path = public as $$
  select public.apply_sponsor_payment(p_deal_id, 'card', p_payment_intent);
$$;

-- Server stores the Stripe Checkout session it created for the sponsor.
create or replace function public.system_set_checkout_session(p_deal_id uuid, p_session_id text)
returns void language sql security definer set search_path = public as $$
  update public.deals set stripe_checkout_session_id = p_session_id where id = p_deal_id;
$$;

-- Sponsor is not happy with the proof: pause the payout until the admin resolves it.
create or replace function public.raise_dispute(p_deal_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'Please describe the problem'; end if;
  update public.deals
     set status = 'disputed', dispute_reason = public.mask_contacts(p_reason), disputed_at = now()
   where id = p_deal_id and sponsor_id = auth.uid() and status = 'proof_uploaded';
  if not found then raise exception 'Not allowed'; end if;
end;
$$;

-- Admin resolves a dispute: ask the organizer for new proof, or approve the proof as it is.
create or replace function public.admin_resolve_dispute(p_deal_id uuid, p_outcome text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_outcome = 'reupload' then
    update public.deals set status = 'sponsor_paid' where id = p_deal_id and status = 'disputed';
  elsif p_outcome = 'approve' then
    update public.deals set status = 'proof_approved', proof_approved_at = now()
     where id = p_deal_id and status = 'disputed';
  else
    raise exception 'Unknown outcome';
  end if;
  if not found then raise exception 'Deal is not disputed'; end if;
end;
$$;

-- Organizer may upload new proof after a dispute was sent back.
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
  update public.deals set status = 'proof_uploaded', proof_uploaded_at = now(),
         dispute_reason = null, disputed_at = null
   where id = d.id;
end;
$$;

-- Daily job: approve proof the sponsor has not reviewed in time. Returns the approved deal ids.
create or replace function public.auto_approve_proofs()
returns setof uuid language sql security definer set search_path = public as $$
  update public.deals d
     set status = 'proof_approved', proof_approved_at = now(), auto_approved = true
   where d.status = 'proof_uploaded'
     and d.proof_uploaded_at < now() - make_interval(days => (select proof_review_days from public.settings where id = 1))
  returning d.id;
$$;

-- Record a payout. p_method 'stripe' needs the Stripe transfer id; 'bank_transfer' is a manual payment.
drop function if exists public.admin_mark_organizer_paid(uuid);
create or replace function public.admin_mark_organizer_paid(p_deal_id uuid, p_method text default 'bank_transfer', p_transfer_id text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.deals;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_method not in ('bank_transfer', 'stripe') then raise exception 'Unknown payout method'; end if;
  select * into d from public.deals where id = p_deal_id for update;
  if d.status not in ('proof_approved', 'proof_uploaded') then
    raise exception 'Proof must be uploaded before paying the organizer';
  end if;
  update public.deals
     set status = 'organizer_paid', organizer_paid_at = now(),
         proof_approved_at = coalesce(proof_approved_at, now()),
         payout_method = p_method, stripe_transfer_id = p_transfer_id
   where id = d.id;
  if d.organizer_payout_aed > 0 then
    insert into public.invoices (deal_id, type, number, amount_aed, vat_aed, total_aed, paid_at)
    values (d.id, 'organizer_statement', public.next_invoice_number(), d.organizer_payout_aed, 0, d.organizer_payout_aed, now());
  end if;
end;
$$;

-- Cancel a deal. If the sponsor already paid, the server refunds first and passes the refund id.
drop function if exists public.admin_cancel_deal(uuid);
create or replace function public.admin_cancel_deal(p_deal_id uuid, p_refund_id text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.deals;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  select * into d from public.deals where id = p_deal_id for update;
  if d.status in ('organizer_paid', 'cancelled') then raise exception 'Deal is closed'; end if;
  update public.deals
     set status = 'cancelled', cancelled_at = now(),
         stripe_refund_id = coalesce(p_refund_id, stripe_refund_id),
         refunded_at = case when d.sponsor_paid_at is not null then now() end
   where id = d.id;
  update public.sponsorship_packages set slots_taken = greatest(slots_taken - 1, 0) where id = d.package_id;
end;
$$;

-- Contacts stay visible during a dispute.
create or replace function public.can_see_contacts(p_profile uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_profile = auth.uid() or public.is_admin() or exists (
    select 1 from public.deals d
     where d.status::text in ('sponsor_paid', 'proof_uploaded', 'disputed', 'proof_approved', 'organizer_paid')
       and ((d.sponsor_id = auth.uid() and d.organizer_id = p_profile)
         or (d.organizer_id = auth.uid() and d.sponsor_id = p_profile)));
$$;

-- ───────────────────────── Permissions ─────────────────────────
-- Service-role-only functions (webhook, cron, server).
revoke execute on function public.apply_sponsor_payment(uuid, text, text),
  public.system_mark_sponsor_paid(uuid, text), public.system_set_checkout_session(uuid, text),
  public.auto_approve_proofs()
  from public, anon, authenticated;

revoke execute on function public.raise_dispute(uuid, text), public.admin_resolve_dispute(uuid, text),
  public.admin_mark_organizer_paid(uuid, text, text), public.admin_cancel_deal(uuid, text)
  from public, anon;
grant execute on function public.raise_dispute(uuid, text), public.admin_resolve_dispute(uuid, text),
  public.admin_mark_organizer_paid(uuid, text, text), public.admin_cancel_deal(uuid, text)
  to authenticated;
grant execute on function public.apply_sponsor_payment(uuid, text, text),
  public.system_mark_sponsor_paid(uuid, text), public.system_set_checkout_session(uuid, text),
  public.auto_approve_proofs()
  to service_role;
