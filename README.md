# OmniPromote

A UAE marketplace that connects **event organizers**, **billboard / screen owners** and **influencer agencies** with **sponsors and brands**, in English and Arabic.
Phases done: **1. Event sponsorship**, **2. Online payments**, **3. Billboards and screens** and **4. Influencers**.

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

## What Phase 2 adds

- **Card payments**: sponsors can pay their invoice online with Stripe (Visa, Mastercard, Apple Pay, Google Pay).
  The deal is marked paid automatically. Bank transfer still works.
- **Organizer payouts**: organizers add their bank account once through Stripe (on the **Payouts** page).
  For card-paid deals, admin pays them with one click (price minus commission). Otherwise admin pays by bank transfer.
- **Concerns (disputes)**: a sponsor who is not happy with the proof can raise a concern. The payout is paused until
  the admin approves the proof or asks the organizer for new proof.
- **Auto-approval**: if the sponsor does nothing for 7 days (changeable in Admin → Settings), the proof is approved
  automatically by a daily job.
- **Refunds**: cancelling a card-paid deal refunds the sponsor automatically.

## What Phase 3 adds

- **Media owners**: a third account type for billboard, screen, mall, airport and transit ad space owners.
- **Ad space listings** with a map pin (click the map or paste coordinates), size, daily impressions, weekly price,
  minimum weeks and photos. Admin reviews each listing before it goes live (**Admin → Ad spaces**).
- **Map search** (OpenStreetMap, no API key needed) with filters for emirate, type, digital only, max weekly price and
  free dates.
- **Booking requests**: a brand picks a start date and number of weeks, can offer a different total, and chats with the
  owner (contacts hidden). Dates that are already booked are blocked automatically.
- When the owner accepts, it becomes a normal **deal**: same invoice, card or bank payment, proof, approval and payout
  as event sponsorships. Founding Partner (0% on the first deal) applies to media owners too.
- Login now says clearly when an email address has not been confirmed yet.

## What Phase 4 adds

- **Agency accounts**: influencer agencies (like your partner company) list the influencers they manage, with niche,
  emirate, languages, followers per platform, engagement rate and rates per post, story and reel.
- **Private handles**: the real Instagram/TikTok/YouTube/Snapchat handles are stored separately. Only the agency and the
  admin see them, and a brand sees them only after paying its invoice, so brands cannot skip the platform.
  Admin checks the handles before approving a profile (**Admin → Influencers**).
- **Influencer search** with filters for niche, emirate, platform, minimum followers, language and budget.
- **Campaign briefs**: a brand sends deliverables, go-live date, brief and budget, then chats with the agency (contacts hidden).
  When the agency accepts, it becomes a normal **deal** with invoice, payment, proof and payout, and commission is
  taken from the agency like other providers.

## Set up (about 20 minutes)

### 1. Install tools
- [Node.js 20 or newer](https://nodejs.org)
- A free [Supabase](https://supabase.com) account

### 2. Create the database
1. In Supabase, create a new project (region: closest to UAE, e.g. Frankfurt or Mumbai).
2. Open **SQL Editor**, paste everything from `supabase/migrations/20261107000001_phase1_sponsorship.sql`, and run it.
   Then do the same with `supabase/migrations/20261107000002_phase2_payments.sql`, and then
   `supabase/migrations/20261112000003_phase3_ad_spaces.sql` and `supabase/migrations/20261112000004_phase4_influencers.sql`.
3. (Optional demo data) Paste and run `supabase/seed.sql`. It adds 10 sample UAE events, 8 ad spaces, 8 influencers and five demo logins
   (password `Demo1234!`): `organizer1@demo.omnipromote.ae`, `organizer2@demo.omnipromote.ae`, `sponsor@demo.omnipromote.ae`,
   `media@demo.omnipromote.ae`, `agency@demo.omnipromote.ae`.
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

### 6. Turn on card payments (optional)
1. Create a [Stripe](https://stripe.com) account for your UAE company and switch on **Connect** (Express accounts).
2. Copy the secret key into `STRIPE_SECRET_KEY`.
3. In Stripe → Developers → Webhooks, add the endpoint `https://yourdomain/api/stripe/webhook` with the events
   `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `account.updated`.
   Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
   For local testing use the Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
4. Set `CRON_SECRET` to a long random string (used by the daily auto-approve job in `vercel.json`).

Use Stripe **test mode** keys first and pay with card `4242 4242 4242 4242`.

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
  payouts/             Organizer payout account setup (Stripe Connect)
src/app/api/stripe/webhook/  Marks card payments as paid
src/app/api/cron/auto-approve/  Daily auto-approval of proof
src/lib/               Supabase clients, helpers, email
src/components/        Shared UI
```

## How the money flow works
| Step | Who | Status |
|---|---|---|
| Organizer accepts proposal | Organizer | Waiting for sponsor payment (invoice issued) |
| Sponsor pays by card (automatic) or bank transfer (admin confirms) | Sponsor / Admin | Paid; contact details now shared |
| Event happens, organizer uploads proof | Organizer | Proof uploaded |
| Sponsor approves proof, raises a concern, or 7 days pass | Sponsor / automatic | Proof approved (or concern raised) |
| Admin pays organizer via Stripe or bank transfer (price − commission) | Admin | Completed; payout statement issued |

Security rules live in the database (Row Level Security), so users cannot publish their own events,
change commission, see the other side's contacts early, or make themselves admin, even by calling the API directly.

## Next phases
5. Featured listings, subscriptions, reviews, analytics

> Legal pages (Terms, Privacy) are drafts. Have a UAE lawyer review them before launch.
