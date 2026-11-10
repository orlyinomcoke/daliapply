# Daliapply

A Tinder-style job matching app. Seekers upload a resume once; companies post jobs; both sides swipe. Names,
exact salary and the full resume unlock only on a mutual match.

Stack: Next.js 15 (App Router, TypeScript, Tailwind) · Supabase (Postgres, email OTP, private storage).

Resume reading and the one-box search use free built-in rules (`src/lib/parse.ts`). Setting `ANTHROPIC_API_KEY`
switches both to Claude for better accuracy (paid per use); nothing else changes.

## Run locally

Needs Node 20+ and Docker Desktop running.

```bash
npm install
npx supabase start          # local Postgres, auth, storage and an email inbox (first run downloads images)
cp .env.example .env.local  # then fill in the keys printed by `npx supabase status`
npm run dev                 # http://localhost:3000
```

- Sign-in codes are emailed to the local inbox at http://127.0.0.1:54324 (Mailpit), not a real mailbox.
- Supabase Studio (tables, SQL editor) is at http://127.0.0.1:54323.
- Company sign-up needs a work-domain email (e.g. `hr@acme.ph`); Gmail/Yahoo-style domains can't post jobs.
- Make yourself an admin: see `supabase/seed.sql`. Admins approve IDs, and mark ₱1,998 job posts as paid at `/admin`.
- Reset the database: `npx supabase db reset`.

## Hosted Supabase (already set up)

Run each migration once in the SQL Editor, in order: `0001_init.sql`, then `0002_launch.sql` (payments with
receipts, 30-day job expiry and renewal, "position filled", reports and takedowns, support messages, account
deletion). 0002 also creates the private `receipts` storage bucket.

## Email

Emails (new match, new message, payment approved or rejected, takedown, sales and support inboxes) go through
[Resend](https://resend.com) (free: 3,000 a month). Without `RESEND_API_KEY` they're printed to the server log.
Set `NEXT_PUBLIC_SITE_URL`, `EMAIL_FROM`, `SALES_EMAIL` and `SUPPORT_EMAIL` in `.env.local` (see `.env.example`),
and verify your sending domain in Resend.

## Business rules (enforced in the database)

See `supabase/migrations/0001_init.sql` and `0002_launch.sql`.

- ₱1,998 per job post (GCash / InstaPay); a post goes live only after payment is confirmed (by an admin for now), and stays live 30 days.
- Companies can mark a post filled, reopen it, or renew it after it expires (renewal is another payment).
- Verified seekers (email OTP + a government ID approved in the admin queue) get a Verified badge on their card.
- Seekers: daily right-swipe cap (25, in `app_settings`), left swipes unlimited, hide a company for 30 days.

Parser tests: `npm test`. Database rule tests: `PGHOST=... PGUSER=... ./supabase/tests/run.sh` (plain Postgres, no Supabase needed).
