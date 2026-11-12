-- OmniPromote Phase 3: billboards, digital screens and other ad spaces.
-- Media owners list spaces; sponsors/brands request dates; accepted bookings become deals
-- and use the same invoice → payment → proof → payout flow as event sponsorships.

alter type public.user_role add value if not exists 'media_owner' after 'sponsor';

create type public.ad_space_type as enum (
  'billboard', 'digital_screen', 'mall_screen', 'transit', 'airport', 'street_furniture', 'venue_screen', 'other'
);
create type public.booking_status as enum ('requested', 'accepted', 'declined', 'withdrawn');

-- ───────────────────────── Tables ─────────────────────────
create table public.ad_spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title_en text not null,
  title_ar text,
  description_en text not null default '',
  description_ar text,
  type public.ad_space_type not null default 'billboard',
  emirate text not null,
  area text,
  lat numeric(9, 6) not null check (lat between -90 and 90),
  lng numeric(9, 6) not null check (lng between -180 and 180),
  width_m numeric(6, 2) check (width_m > 0),
  height_m numeric(6, 2) check (height_m > 0),
  illuminated boolean not null default false,
  is_digital boolean not null default false,
  daily_impressions integer check (daily_impressions >= 0),
  audience_description text,
  price_per_week_aed numeric(12, 2) not null check (price_per_week_aed >= 0),
  min_weeks integer not null default 1 check (min_weeks between 1 and 52),
  cover_image_url text,
  photo_urls text[] not null default '{}',
  status public.event_status not null default 'draft',
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ad_spaces_status_idx on public.ad_spaces (status, emirate);
create index ad_spaces_owner_idx on public.ad_spaces (owner_id);
create index ad_spaces_geo_idx on public.ad_spaces (lat, lng);

create table public.ad_bookings (
  id uuid primary key default gen_random_uuid(),
  ad_space_id uuid not null references public.ad_spaces (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  weeks integer not null check (weeks between 1 and 52),
  end_date date generated always as (start_date + weeks * 7 - 1) stored,
  message text not null default '',
  offered_price_aed numeric(12, 2) check (offered_price_aed >= 0),
  status public.booking_status not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ad_bookings_space_idx on public.ad_bookings (ad_space_id, start_date);
create index ad_bookings_buyer_idx on public.ad_bookings (buyer_id);
create index ad_bookings_owner_idx on public.ad_bookings (owner_id);

create trigger ad_spaces_touch before update on public.ad_spaces
  for each row execute function public.touch_updated_at();
create trigger ad_bookings_touch before update on public.ad_bookings
  for each row execute function public.touch_updated_at();

-- ───────────────────────── Deals and messages: support bookings ─────────────────────────
-- A deal comes from either an event proposal or an ad-space booking. `organizer_id` is the provider.
alter table public.deals
  alter column proposal_id drop not null,
  alter column package_id drop not null,
  alter column event_id drop not null,
  add column booking_id uuid unique references public.ad_bookings (id) on delete restrict,
  add column ad_space_id uuid references public.ad_spaces (id) on delete restrict,
  add constraint deals_one_source check ((proposal_id is not null) <> (booking_id is not null));

alter table public.messages
  alter column proposal_id drop not null,
  add column booking_id uuid references public.ad_bookings (id) on delete cascade,
  add constraint messages_one_thread check ((proposal_id is not null) <> (booking_id is not null));
create index messages_booking_idx on public.messages (booking_id, created_at);

create or replace function public.prepare_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  masked text := public.mask_contacts(new.body);
begin
  if masked <> new.body then
    perform public.log_contact_attempt(case when new.booking_id is null then 'message' else 'booking_message' end,
                                       coalesce(new.proposal_id, new.booking_id), new.body);
    new.body := masked;
    new.was_masked := true;
  else
    new.was_masked := false;
  end if;
  return new;
end;
$$;

-- ───────────────────────── Sign-up: allow the media owner role ─────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r text := coalesce(new.raw_user_meta_data ->> 'role', 'sponsor');
begin
  if r not in ('organizer', 'sponsor', 'media_owner') then r := 'sponsor'; end if;
  insert into public.profiles (id, role, company_name)
  values (new.id, r::public.user_role, nullif(new.raw_user_meta_data ->> 'company_name', ''));
  insert into public.profile_contacts (profile_id, email, contact_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));
  return new;
end;
$$;

-- ───────────────────────── Guards ─────────────────────────
create or replace function public.guard_ad_space_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  joined text;
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      if new.status not in ('draft', 'pending_review') then new.status := 'draft'; end if;
    else
      new.owner_id := old.owner_id;
      if new.status is distinct from old.status and new.status in ('published', 'rejected') then
        raise exception 'Only an admin can publish or reject a listing';
      end if;
    end if;
    joined := concat_ws(' | ', new.title_en, new.title_ar, new.description_en, new.description_ar,
                        new.audience_description, new.area);
    if joined <> public.mask_contacts(joined) then
      perform public.log_contact_attempt('ad_space', new.id, joined);
      new.title_en := public.mask_contacts(new.title_en);
      new.title_ar := public.mask_contacts(new.title_ar);
      new.description_en := public.mask_contacts(new.description_en);
      new.description_ar := public.mask_contacts(new.description_ar);
      new.audience_description := public.mask_contacts(new.audience_description);
      new.area := public.mask_contacts(new.area);
    end if;
  end if;
  return new;
end;
$$;
create trigger ad_spaces_guard before insert or update on public.ad_spaces
  for each row execute function public.guard_ad_space_write();

-- True when the dates clash with a booking that has an active (not cancelled) deal.
create or replace function public.ad_space_is_free(p_space uuid, p_start date, p_end date, p_ignore uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.ad_bookings b
      join public.deals d on d.booking_id = b.id
     where b.ad_space_id = p_space and b.status = 'accepted' and d.status <> 'cancelled'
       and b.id is distinct from p_ignore
       and daterange(b.start_date, b.end_date, '[]') && daterange(p_start, p_end, '[]'));
$$;

create or replace function public.prepare_booking()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s public.ad_spaces;
begin
  select * into s from public.ad_spaces where id = new.ad_space_id;
  if not found then raise exception 'Ad space not found'; end if;
  if s.status <> 'published' then raise exception 'This ad space is not available'; end if;
  if s.owner_id = new.buyer_id then raise exception 'You cannot book your own ad space'; end if;
  if new.weeks < s.min_weeks then raise exception 'Minimum booking is % weeks', s.min_weeks; end if;
  if new.start_date < current_date then raise exception 'Start date must be in the future'; end if;
  if not public.ad_space_is_free(new.ad_space_id, new.start_date, new.start_date + new.weeks * 7 - 1) then
    raise exception 'These dates are already booked';
  end if;
  if exists (select 1 from public.ad_bookings where ad_space_id = new.ad_space_id and buyer_id = new.buyer_id
              and status = 'requested') then
    raise exception 'You already have an open request for this ad space';
  end if;
  new.owner_id := s.owner_id;
  new.status := 'requested';
  if new.message <> public.mask_contacts(new.message) then
    perform public.log_contact_attempt('booking', new.id, new.message);
    new.message := public.mask_contacts(new.message);
  end if;
  return new;
end;
$$;
create trigger ad_bookings_prepare before insert on public.ad_bookings
  for each row execute function public.prepare_booking();

-- ───────────────────────── Booking workflow (RPC) ─────────────────────────
create or replace function public.accept_booking(p_booking_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  b public.ad_bookings;
  sp public.ad_spaces;
  s public.settings;
  d public.deals;
begin
  select * into b from public.ad_bookings where id = p_booking_id for update;
  if not found or b.owner_id <> auth.uid() then raise exception 'Not allowed'; end if;
  if b.status <> 'requested' then raise exception 'This request is no longer open'; end if;
  select * into sp from public.ad_spaces where id = b.ad_space_id for update;
  if not public.ad_space_is_free(b.ad_space_id, b.start_date, b.end_date, b.id) then
    raise exception 'These dates are already booked';
  end if;
  select * into s from public.settings where id = 1;

  update public.ad_bookings set status = 'accepted' where id = b.id;

  d.agreed_price_aed := coalesce(b.offered_price_aed, sp.price_per_week_aed * b.weeks);
  d.vat_rate := s.vat_rate;
  d.founding_partner_waiver := s.founding_partner_offer and not exists (
    select 1 from public.deals x where x.organizer_id = b.owner_id and x.status <> 'cancelled');
  d.commission_rate := case when d.founding_partner_waiver then 0 else s.default_commission_rate end;
  d := public.recalc_deal(d);

  insert into public.deals (
    booking_id, ad_space_id, sponsor_id, organizer_id, agreed_price_aed,
    commission_rate, commission_aed, organizer_payout_aed, vat_rate, vat_aed, total_due_aed,
    founding_partner_waiver, status
  ) values (
    b.id, sp.id, b.buyer_id, b.owner_id, d.agreed_price_aed,
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

create or replace function public.decline_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.ad_bookings set status = 'declined'
   where id = p_booking_id and owner_id = auth.uid() and status = 'requested';
  if not found then raise exception 'Not allowed'; end if;
end;
$$;

create or replace function public.withdraw_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.ad_bookings set status = 'withdrawn'
   where id = p_booking_id and buyer_id = auth.uid() and status = 'requested';
  if not found then raise exception 'Not allowed'; end if;
end;
$$;

-- Cancelling a booking deal frees its dates; event deals still free their package slot.
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
  if d.package_id is not null then
    update public.sponsorship_packages set slots_taken = greatest(slots_taken - 1, 0) where id = d.package_id;
  end if;
end;
$$;

-- Booked date ranges for the calendar on a space's page (no buyer details).
create or replace function public.ad_space_booked_ranges(p_space uuid)
returns table (start_date date, end_date date) language sql stable security definer set search_path = public as $$
  select b.start_date, b.end_date from public.ad_bookings b
    join public.deals d on d.booking_id = b.id
   where b.ad_space_id = p_space and b.status = 'accepted' and d.status <> 'cancelled' and b.end_date >= current_date
   order by b.start_date;
$$;

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.ad_spaces enable row level security;
alter table public.ad_bookings enable row level security;

create policy "ad spaces read" on public.ad_spaces for select
  using (status in ('published', 'closed') or owner_id = auth.uid() or public.is_admin());
create policy "ad spaces insert" on public.ad_spaces for insert
  with check (owner_id = auth.uid() and public.my_role()::text = 'media_owner');
create policy "ad spaces update" on public.ad_spaces for update
  using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy "ad spaces delete" on public.ad_spaces for delete
  using ((owner_id = auth.uid() and status in ('draft', 'rejected')) or public.is_admin());

create policy "bookings read" on public.ad_bookings for select
  using (auth.uid() in (buyer_id, owner_id) or public.is_admin());
create policy "bookings insert" on public.ad_bookings for insert
  with check (buyer_id = auth.uid() and public.my_role()::text = 'sponsor');

drop policy "messages read" on public.messages;
drop policy "messages insert" on public.messages;
create policy "messages read" on public.messages for select using (
  public.is_admin()
  or exists (select 1 from public.proposals p where p.id = proposal_id and auth.uid() in (p.sponsor_id, p.organizer_id))
  or exists (select 1 from public.ad_bookings b where b.id = booking_id and auth.uid() in (b.buyer_id, b.owner_id)));
create policy "messages insert" on public.messages for insert with check (
  sender_id = auth.uid() and (
    exists (select 1 from public.proposals p where p.id = proposal_id and auth.uid() in (p.sponsor_id, p.organizer_id))
    or exists (select 1 from public.ad_bookings b where b.id = booking_id and auth.uid() in (b.buyer_id, b.owner_id))));

revoke execute on function public.accept_booking(uuid), public.decline_booking(uuid), public.withdraw_booking(uuid),
  public.admin_cancel_deal(uuid, text) from public, anon;
grant execute on function public.accept_booking(uuid), public.decline_booking(uuid), public.withdraw_booking(uuid),
  public.admin_cancel_deal(uuid, text) to authenticated;
grant execute on function public.ad_space_booked_ranges(uuid), public.ad_space_is_free(uuid, date, date, uuid)
  to anon, authenticated;
