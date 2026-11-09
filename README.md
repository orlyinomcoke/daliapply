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
- Make yourself an admin: see `supabase/seed.sql`. Admins approve IDs, mark $40 job posts as paid, and settle cash-outs at `/admin`.
- Reset the database: `npx supabase db reset`.

## Business rules (enforced in the database)

See `supabase/migrations/0001_init.sql`.

- $40 per job post; a post goes live only after payment is confirmed (by an admin for now).
- 30 paid right swipes per post: each verified seeker a company swipes right on earns PHP 20, once per job.
  Unverified seekers earn nothing and don't use up the 30.
- Verified = email OTP + a government ID approved in the admin queue.
- Seekers: daily right-swipe cap (25, in `app_settings`), left swipes unlimited, hide a company for 30 days.
- Cash-out from PHP 200 to GCash or Maya (sent by hand from the admin page for now).

Parser tests: `npm test`. Database rule tests: `PGHOST=... PGUSER=... ./supabase/tests/run.sh` (plain Postgres, no Supabase needed).
