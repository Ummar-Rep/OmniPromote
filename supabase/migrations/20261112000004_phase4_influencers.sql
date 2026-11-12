-- OmniPromote Phase 4: influencer marketing through partner agencies.
-- Agencies list the influencers they manage; brands send campaign requests; an accepted request becomes a deal
-- with the same invoice → payment → proof → payout flow. Influencer handles stay private until the brand pays,
-- so brands cannot contact influencers directly and skip the platform.

alter type public.user_role add value if not exists 'agency' after 'media_owner';

create type public.influencer_niche as enum (
  'lifestyle', 'fashion', 'beauty', 'food', 'travel', 'fitness', 'family', 'tech', 'gaming', 'auto', 'business',
  'health', 'education', 'other'
);

-- ───────────────────────── Tables ─────────────────────────
create table public.influencers (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  bio_en text not null default '',
  bio_ar text,
  niche public.influencer_niche not null default 'lifestyle',
  emirate text not null,
  languages text[] not null default '{}',
  instagram_followers integer check (instagram_followers >= 0),
  tiktok_followers integer check (tiktok_followers >= 0),
  youtube_followers integer check (youtube_followers >= 0),
  snapchat_followers integer check (snapchat_followers >= 0),
  engagement_rate numeric(5, 2) check (engagement_rate between 0 and 100),
  audience_description text,
  price_post_aed numeric(12, 2) check (price_post_aed >= 0),
  price_story_aed numeric(12, 2) check (price_story_aed >= 0),
  price_video_aed numeric(12, 2) check (price_video_aed >= 0),
  avatar_url text,
  status public.event_status not null default 'draft',
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index influencers_status_idx on public.influencers (status, niche);
create index influencers_agency_idx on public.influencers (agency_id);

-- Real social handles: only the agency, the admin, and brands with a paid deal can read them.
create table public.influencer_handles (
  influencer_id uuid primary key references public.influencers (id) on delete cascade,
  instagram text,
  tiktok text,
  youtube text,
  snapchat text
);

create table public.campaign_requests (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.influencers (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  agency_id uuid not null references public.profiles (id) on delete cascade,
  deliverables text not null,
  go_live_date date not null,
  brief text not null default '',
  offered_price_aed numeric(12, 2) not null check (offered_price_aed >= 0),
  status public.booking_status not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaign_requests_influencer_idx on public.campaign_requests (influencer_id);
create index campaign_requests_buyer_idx on public.campaign_requests (buyer_id);
create index campaign_requests_agency_idx on public.campaign_requests (agency_id);

create trigger influencers_touch before update on public.influencers
  for each row execute function public.touch_updated_at();
create trigger campaign_requests_touch before update on public.campaign_requests
  for each row execute function public.touch_updated_at();

-- ───────────────────────── Deals and messages: support campaigns ─────────────────────────
alter table public.deals
  drop constraint deals_one_source,
  add column campaign_id uuid unique references public.campaign_requests (id) on delete restrict,
  add column influencer_id uuid references public.influencers (id) on delete restrict,
  add constraint deals_one_source check (num_nonnulls(proposal_id, booking_id, campaign_id) = 1);

alter table public.messages
  drop constraint messages_one_thread,
  add column campaign_id uuid references public.campaign_requests (id) on delete cascade,
  add constraint messages_one_thread check (num_nonnulls(proposal_id, booking_id, campaign_id) = 1);
create index messages_campaign_idx on public.messages (campaign_id, created_at);

create or replace function public.prepare_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  masked text := public.mask_contacts(new.body);
begin
  if masked <> new.body then
    perform public.log_contact_attempt(
      case when new.booking_id is not null then 'booking_message'
           when new.campaign_id is not null then 'campaign_message' else 'message' end,
      coalesce(new.proposal_id, new.booking_id, new.campaign_id), new.body);
    new.body := masked;
    new.was_masked := true;
  else
    new.was_masked := false;
  end if;
  return new;
end;
$$;

-- ───────────────────────── Sign-up: allow the agency role ─────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r text := coalesce(new.raw_user_meta_data ->> 'role', 'sponsor');
begin
  if r not in ('organizer', 'sponsor', 'media_owner', 'agency') then r := 'sponsor'; end if;
  insert into public.profiles (id, role, company_name)
  values (new.id, r::public.user_role, nullif(new.raw_user_meta_data ->> 'company_name', ''));
  insert into public.profile_contacts (profile_id, email, contact_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));
  return new;
end;
$$;

-- ───────────────────────── Guards ─────────────────────────
create or replace function public.guard_influencer_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  joined text;
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      if new.status not in ('draft', 'pending_review') then new.status := 'draft'; end if;
    else
      new.agency_id := old.agency_id;
      if new.status is distinct from old.status and new.status in ('published', 'rejected') then
        raise exception 'Only an admin can publish or reject a listing';
      end if;
    end if;
    joined := concat_ws(' | ', new.name, new.bio_en, new.bio_ar, new.audience_description);
    if joined <> public.mask_contacts(joined) then
      perform public.log_contact_attempt('influencer', new.id, joined);
      new.name := public.mask_contacts(new.name);
      new.bio_en := public.mask_contacts(new.bio_en);
      new.bio_ar := public.mask_contacts(new.bio_ar);
      new.audience_description := public.mask_contacts(new.audience_description);
    end if;
  end if;
  return new;
end;
$$;
create trigger influencers_guard before insert or update on public.influencers
  for each row execute function public.guard_influencer_write();

create or replace function public.prepare_campaign()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  i public.influencers;
  joined text;
begin
  select * into i from public.influencers where id = new.influencer_id;
  if not found then raise exception 'Influencer not found'; end if;
  if i.status <> 'published' then raise exception 'This influencer is not available'; end if;
  if i.agency_id = new.buyer_id then raise exception 'You cannot book your own influencer'; end if;
  if new.go_live_date < current_date then raise exception 'Go-live date must be in the future'; end if;
  if exists (select 1 from public.campaign_requests where influencer_id = new.influencer_id
              and buyer_id = new.buyer_id and status = 'requested') then
    raise exception 'You already have an open request for this influencer';
  end if;
  new.agency_id := i.agency_id;
  new.status := 'requested';
  joined := concat_ws(' | ', new.deliverables, new.brief);
  if joined <> public.mask_contacts(joined) then
    perform public.log_contact_attempt('campaign', new.id, joined);
    new.deliverables := public.mask_contacts(new.deliverables);
    new.brief := public.mask_contacts(new.brief);
  end if;
  return new;
end;
$$;
create trigger campaign_requests_prepare before insert on public.campaign_requests
  for each row execute function public.prepare_campaign();

-- ───────────────────────── Campaign workflow (RPC) ─────────────────────────
create or replace function public.accept_campaign(p_campaign_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c public.campaign_requests;
  s public.settings;
  d public.deals;
begin
  select * into c from public.campaign_requests where id = p_campaign_id for update;
  if not found or c.agency_id <> auth.uid() then raise exception 'Not allowed'; end if;
  if c.status <> 'requested' then raise exception 'This request is no longer open'; end if;
  select * into s from public.settings where id = 1;

  update public.campaign_requests set status = 'accepted' where id = c.id;

  d.agreed_price_aed := c.offered_price_aed;
  d.vat_rate := s.vat_rate;
  d.founding_partner_waiver := s.founding_partner_offer and not exists (
    select 1 from public.deals x where x.organizer_id = c.agency_id and x.status <> 'cancelled');
  d.commission_rate := case when d.founding_partner_waiver then 0 else s.default_commission_rate end;
  d := public.recalc_deal(d);

  insert into public.deals (
    campaign_id, influencer_id, sponsor_id, organizer_id, agreed_price_aed,
    commission_rate, commission_aed, organizer_payout_aed, vat_rate, vat_aed, total_due_aed,
    founding_partner_waiver, status
  ) values (
    c.id, c.influencer_id, c.buyer_id, c.agency_id, d.agreed_price_aed,
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

create or replace function public.decline_campaign(p_campaign_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.campaign_requests set status = 'declined'
   where id = p_campaign_id and agency_id = auth.uid() and status = 'requested';
  if not found then raise exception 'Not allowed'; end if;
end;
$$;

create or replace function public.withdraw_campaign(p_campaign_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.campaign_requests set status = 'withdrawn'
   where id = p_campaign_id and buyer_id = auth.uid() and status = 'requested';
  if not found then raise exception 'Not allowed'; end if;
end;
$$;

-- True when the current user is a brand with a paid (not cancelled) deal for this influencer.
create or replace function public.can_see_handles(p_influencer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.influencers i where i.id = p_influencer and i.agency_id = auth.uid())
      or exists (select 1 from public.deals d where d.influencer_id = p_influencer and d.sponsor_id = auth.uid()
                  and d.sponsor_paid_at is not null and d.status <> 'cancelled');
$$;

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.influencers enable row level security;
alter table public.influencer_handles enable row level security;
alter table public.campaign_requests enable row level security;

create policy "influencers read" on public.influencers for select
  using (status in ('published', 'closed') or agency_id = auth.uid() or public.is_admin());
create policy "influencers insert" on public.influencers for insert
  with check (agency_id = auth.uid() and public.my_role()::text = 'agency');
create policy "influencers update" on public.influencers for update
  using (agency_id = auth.uid() or public.is_admin()) with check (agency_id = auth.uid() or public.is_admin());
create policy "influencers delete" on public.influencers for delete
  using ((agency_id = auth.uid() and status in ('draft', 'rejected')) or public.is_admin());

create policy "handles read" on public.influencer_handles for select using (public.can_see_handles(influencer_id));
create policy "handles write" on public.influencer_handles for all
  using (exists (select 1 from public.influencers i where i.id = influencer_id and i.agency_id = auth.uid()) or public.is_admin())
  with check (exists (select 1 from public.influencers i where i.id = influencer_id and i.agency_id = auth.uid()) or public.is_admin());

create policy "campaigns read" on public.campaign_requests for select
  using (auth.uid() in (buyer_id, agency_id) or public.is_admin());
create policy "campaigns insert" on public.campaign_requests for insert
  with check (buyer_id = auth.uid() and public.my_role()::text = 'sponsor');

drop policy "messages read" on public.messages;
drop policy "messages insert" on public.messages;
create policy "messages read" on public.messages for select using (
  public.is_admin()
  or exists (select 1 from public.proposals p where p.id = proposal_id and auth.uid() in (p.sponsor_id, p.organizer_id))
  or exists (select 1 from public.ad_bookings b where b.id = booking_id and auth.uid() in (b.buyer_id, b.owner_id))
  or exists (select 1 from public.campaign_requests c where c.id = campaign_id and auth.uid() in (c.buyer_id, c.agency_id)));
create policy "messages insert" on public.messages for insert with check (
  sender_id = auth.uid() and (
    exists (select 1 from public.proposals p where p.id = proposal_id and auth.uid() in (p.sponsor_id, p.organizer_id))
    or exists (select 1 from public.ad_bookings b where b.id = booking_id and auth.uid() in (b.buyer_id, b.owner_id))
    or exists (select 1 from public.campaign_requests c where c.id = campaign_id and auth.uid() in (c.buyer_id, c.agency_id))));

revoke execute on function public.accept_campaign(uuid), public.decline_campaign(uuid), public.withdraw_campaign(uuid)
  from public, anon;
grant execute on function public.accept_campaign(uuid), public.decline_campaign(uuid), public.withdraw_campaign(uuid)
  to authenticated;
grant execute on function public.can_see_handles(uuid) to anon, authenticated;
