# OmniPromote

A UAE marketplace that connects **event organizers** with **sponsors**, in English and Arabic.
This is **Phase 1: event sponsorship**.

Built with Next.js 15, Tailwind CSS, Supabase (database, login, file storage) and next-intl (English/Arabic).

## What Phase 1 does

- **Organizers** list events and sponsorship packages (fixed price, open to offers, or in-kind).
- **Admin** reviews every event before it goes live, and can verify companies.
- **Sponsors** browse and filter events (emirate, category, dates, budget, audience size) and send proposals.
- **Chat** between both sides. Phone numbers, emails, links and social handles (English and Arabic) are hidden automatically, and every attempt is logged for the admin.
- **Deals**: when an organizer accepts, the sponsor gets an invoice (with 5% VAT) to pay OmniPromote by bank transfer.
  Admin marks it paid, then contact details are shared between the two sides.
- **Proof of delivery**: organizer uploads photos/videos/reports, sponsor approves, admin pays the organizer
  the price minus commission (default 15%). The organizer's first deal is commission-free (Founding Partner offer).
- Printable bilingual invoices and payout statements.
- Optional email notifications (Resend).

## Set up (about 20 minutes)

### 1. Install tools
- [Node.js 20 or newer](https://nodejs.org)
- A free [Supabase](https://supabase.com) account

### 2. Create the database
1. In Supabase, create a new project (region: closest to UAE, e.g. Frankfurt or Mumbai).
2. Open **SQL Editor**, paste everything from `supabase/migrations/20261107000001_phase1_sponsorship.sql`, and run it.
3. (Optional demo data) Paste and run `supabase/seed.sql`. It adds 10 sample UAE events and three demo logins
   (password `Demo1234!`): `organizer1@demo.omnipromote.ae`, `organizer2@demo.omnipromote.ae`, `sponsor@demo.omnipromote.ae`.
4. In **Authentication → URL Configuration**, set Site URL to `http://localhost:3000` and add
   `http://localhost:3000/auth/callback` to Redirect URLs (add your real domain later too).
5. (Optional) Turn on Google login in **Authentication → Providers → Google**.

### 3. Configure the app
```bash
cp .env.example .env.local
```
Fill in the values from Supabase **Project Settings → API**.

### 4. Run it
```bash
npm install
npm run dev
```
Open http://localhost:3000.

### 5. Make yourself admin
Sign up on the site with your own email, then run this in the Supabase SQL Editor:
```sql
update public.profiles set role = 'admin', onboarded = true
where id = (select id from auth.users where email = 'you@example.com');
```
Then go to **Admin → Settings** and enter your company name, TRN and bank details (they appear on invoices).

## Deploy
Push to GitHub, import the repo in [Vercel](https://vercel.com), add the same environment variables,
and set `NEXT_PUBLIC_SITE_URL` to your domain. Add `https://yourdomain/auth/callback` to Supabase redirect URLs.

## Project layout
```
messages/              English and Arabic text (en.json, ar.json)
supabase/migrations/   Database tables, security rules, deal workflow
supabase/seed.sql      Demo data
src/app/[locale]/      Pages (every page works at /en/... and /ar/...)
  events/              Browse + event detail + send proposal
  dashboard/           Organizer and sponsor dashboards, event editor
  proposals/[id]/      Proposal chat, accept/decline
  deals/[id]/          Deal progress, proof upload, approval
  invoices/[id]/       Printable invoice / payout statement
  admin/               Approvals, companies, deals, contact attempts, settings
src/lib/               Supabase clients, helpers, email
src/components/        Shared UI
```

## How the money flow works
| Step | Who | Status |
|---|---|---|
| Organizer accepts proposal | Organizer | Waiting for sponsor payment (invoice issued) |
| Sponsor pays by bank transfer, admin confirms | Admin | Paid; contact details now shared |
| Event happens, organizer uploads proof | Organizer | Proof uploaded |
| Sponsor approves proof | Sponsor | Proof approved |
| Admin transfers payout (price − commission) | Admin | Completed; payout statement issued |

Security rules live in the database (Row Level Security), so users cannot publish their own events,
change commission, see the other side's contacts early, or make themselves admin, even by calling the API directly.

## Next phases
2. Online card payments and automatic payouts (Stripe Connect or a UAE gateway)
3. Billboards and digital screens with map search
4. Influencer marketing through partner agencies
5. Featured listings, subscriptions, reviews, analytics

> Legal pages (Terms, Privacy) are drafts. Have a UAE lawyer review them before launch.
