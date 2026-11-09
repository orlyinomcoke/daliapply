-- Daliapply MVP schema
-- Privacy rule: companies never read seeker rows directly. They get masked
-- cards through security-definer functions until a match exists.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
create table app_settings (
  key text primary key,
  value jsonb not null
);

insert into app_settings (key, value) values
  ('seeker_daily_right_swipes', '25'),
  ('paid_right_swipes_per_post', '30'),
  ('reward_per_right_swipe_php', '20'),
  ('job_post_price_usd', '40'),
  ('hide_company_days', '30'),
  ('min_cashout_php', '200');

create or replace function setting_int(p_key text) returns int
language sql stable as $$
  select (value #>> '{}')::int from app_settings where key = p_key
$$;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
create type user_role as enum ('seeker', 'company', 'admin');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null,
  created_at timestamptz not null default now()
);

create type verification_status as enum ('unverified', 'pending', 'verified', 'rejected');

create table seekers (
  id uuid primary key references profiles (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  headline text,
  total_years numeric(4, 1) not null default 0,
  salary_min int,
  salary_max int,
  salary_currency text not null default 'PHP',
  country text,
  open_to_remote boolean not null default true,
  open_to_relocate boolean not null default false,
  languages text[] not null default '{}',
  availability text,
  recent_roles jsonb not null default '[]', -- [{title, employer, years}]
  resume_path text,          -- private storage bucket "resumes"
  resume_text text,          -- extracted plain text, never shown pre-match
  profile_confirmed boolean not null default false,
  -- verification: email OTP (auth.users.email_confirmed_at) + valid government ID
  id_document_path text,     -- private storage bucket "ids"
  id_document_type text,     -- passport, drivers_license, umid, philsys, ...
  verification_status verification_status not null default 'unverified',
  verification_note text,
  verified_at timestamptz,
  verified_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table seeker_skills (
  seeker_id uuid not null references seekers (id) on delete cascade,
  skill text not null,       -- normalised lower-case key, e.g. "php"
  label text,                -- display form, e.g. "PHP"
  years numeric(4, 1) not null default 0,
  primary key (seeker_id, skill)
);

create table companies (
  id uuid primary key references profiles (id) on delete cascade,
  name text not null,
  domain text not null,      -- taken from the work email
  domain_verified boolean not null default false,
  logo_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------
create type job_status as enum ('draft', 'awaiting_payment', 'active', 'closed');

create table jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  title text not null,
  description text not null default '',
  country text,
  remote boolean not null default false,
  relocation_offered boolean not null default false,
  salary_min int,
  salary_max int,
  salary_currency text not null default 'PHP',
  languages text[] not null default '{}',
  status job_status not null default 'draft',
  paid_at timestamptz,
  reward_swipes_used int not null default 0,
  created_at timestamptz not null default now()
);

create table job_skills (
  job_id uuid not null references jobs (id) on delete cascade,
  skill text not null,
  label text,
  min_years numeric(4, 1) not null default 0,
  primary key (job_id, skill)
);

-- ---------------------------------------------------------------------------
-- Swipes, hiding, matches
-- ---------------------------------------------------------------------------
create type swipe_direction as enum ('left', 'right');

create table seeker_swipes (
  seeker_id uuid not null references seekers (id) on delete cascade,
  job_id uuid not null references jobs (id) on delete cascade,
  direction swipe_direction not null,
  created_at timestamptz not null default now(),
  primary key (seeker_id, job_id)
);

create table company_swipes (
  job_id uuid not null references jobs (id) on delete cascade,
  seeker_id uuid not null references seekers (id) on delete cascade,
  direction swipe_direction not null,
  created_at timestamptz not null default now(),
  primary key (job_id, seeker_id)
);

create table hidden_companies (
  seeker_id uuid not null references seekers (id) on delete cascade,
  company_id uuid not null references companies (id) on delete cascade,
  hidden_until timestamptz not null,
  primary key (seeker_id, company_id)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs (id) on delete cascade,
  seeker_id uuid not null references seekers (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (job_id, seeker_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  sender_id uuid not null references profiles (id),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles (id),
  job_id uuid references jobs (id),
  seeker_id uuid references seekers (id),
  message_id uuid references messages (id),
  reason text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Rewards and payouts
-- ---------------------------------------------------------------------------
create table rewards (
  id uuid primary key default gen_random_uuid(),
  seeker_id uuid not null references seekers (id) on delete cascade,
  job_id uuid not null references jobs (id) on delete cascade,
  amount_php int not null,
  created_at timestamptz not null default now(),
  unique (seeker_id, job_id) -- paid once per job
);

create type payout_status as enum ('requested', 'paid', 'rejected');
create type payout_method as enum ('gcash', 'maya');

create table payouts (
  id uuid primary key default gen_random_uuid(),
  seeker_id uuid not null references seekers (id) on delete cascade,
  amount_php int not null check (amount_php > 0),
  method payout_method not null,
  account_number text not null,
  status payout_status not null default 'requested',
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create or replace view seeker_balances with (security_invoker = true) as
select s.id as seeker_id,
       coalesce((select sum(amount_php) from rewards r where r.seeker_id = s.id), 0)
     - coalesce((select sum(amount_php) from payouts p where p.seeker_id = s.id and p.status <> 'rejected'), 0)
       as balance_php
from seekers s;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function mask_name(first text, last text) returns text
language sql immutable as $$
  select trim(
    coalesce(left(first, 1) || repeat('*', greatest(char_length(first) - 1, 3)), '') || ' ' ||
    coalesce(left(last, 1) || repeat('*', greatest(char_length(last) - 1, 3)), '')
  )
$$;

-- Salary ranges overlap (null on either side counts as "open").
create or replace function ranges_overlap(a_min int, a_max int, b_min int, b_max int) returns boolean
language sql immutable as $$
  select coalesce(a_min, 0) <= coalesce(b_max, 2147483647)
     and coalesce(b_min, 0) <= coalesce(a_max, 2147483647)
$$;

-- ---------------------------------------------------------------------------
-- Swipe triggers: daily cap, rewards, match creation
-- ---------------------------------------------------------------------------
create or replace function before_seeker_swipe() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  used int;
begin
  if new.direction = 'right' then
    select count(*) into used from seeker_swipes
     where seeker_id = new.seeker_id and direction = 'right'
       and created_at > now() - interval '24 hours';
    if used >= setting_int('seeker_daily_right_swipes') then
      raise exception 'DAILY_RIGHT_SWIPE_CAP' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create trigger trg_before_seeker_swipe before insert on seeker_swipes
for each row execute function before_seeker_swipe();

create or replace function maybe_create_match(p_job uuid, p_seeker uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from seeker_swipes where job_id = p_job and seeker_id = p_seeker and direction = 'right')
     and exists (select 1 from company_swipes where job_id = p_job and seeker_id = p_seeker and direction = 'right') then
    insert into matches (job_id, seeker_id) values (p_job, p_seeker) on conflict do nothing;
  end if;
end $$;

create or replace function after_seeker_swipe() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.direction = 'right' then
    perform maybe_create_match(new.job_id, new.seeker_id);
  end if;
  return new;
end $$;

create trigger trg_after_seeker_swipe after insert on seeker_swipes
for each row execute function after_seeker_swipe();

create or replace function after_company_swipe() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_verified boolean;
  v_job jobs%rowtype;
begin
  if new.direction <> 'right' then
    return new;
  end if;

  -- Reward: verified seekers only, once per job, first N paid right swipes per post.
  select verification_status = 'verified' into v_verified from seekers where id = new.seeker_id;
  select * into v_job from jobs where id = new.job_id for update;

  if v_verified
     and v_job.paid_at is not null
     and v_job.reward_swipes_used < setting_int('paid_right_swipes_per_post')
     and not exists (select 1 from rewards where seeker_id = new.seeker_id and job_id = new.job_id) then
    insert into rewards (seeker_id, job_id, amount_php)
    values (new.seeker_id, new.job_id, setting_int('reward_per_right_swipe_php'));
    update jobs set reward_swipes_used = reward_swipes_used + 1 where id = new.job_id;
  end if;

  perform maybe_create_match(new.job_id, new.seeker_id);
  return new;
end $$;

create trigger trg_after_company_swipe after insert on company_swipes
for each row execute function after_company_swipe();

-- ---------------------------------------------------------------------------
-- Matching: job feed for a seeker, candidate cards for a company
-- ---------------------------------------------------------------------------

-- Skill score: each required skill contributes up to 1.0 (years / min_years, capped).
-- Near misses (4 of 5 yrs) still score 0.8 and rank lower instead of vanishing.
create or replace function skill_score(p_seeker uuid, p_job uuid) returns numeric
language sql stable as $$
  select coalesce(avg(least(coalesce(ss.years, 0) / greatest(js.min_years, 0.5), 1.0)), 1.0)
  from job_skills js
  left join seeker_skills ss on ss.seeker_id = p_seeker and ss.skill = js.skill
  where js.job_id = p_job
$$;

create or replace function why_matched(p_seeker uuid, p_job uuid) returns text
language sql stable as $$
  select string_agg(
    coalesce(js.label, initcap(js.skill)) || ' ' || trim_scale(coalesce(ss.years, 0))::text || ' yrs ' ||
    case when coalesce(ss.years, 0) >= js.min_years then '✓' else '~' end,
    ' · ' order by js.min_years desc)
  from job_skills js
  left join seeker_skills ss on ss.seeker_id = p_seeker and ss.skill = js.skill
  where js.job_id = p_job
$$;

-- Hard filters shared by both sides.
create or replace function passes_filters(p_seeker uuid, p_job uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from seekers s, jobs j
    where s.id = p_seeker and j.id = p_job
      and ranges_overlap(s.salary_min, s.salary_max, j.salary_min, j.salary_max)
      and (
        j.remote and s.open_to_remote
        or s.country is not distinct from j.country
        or (s.open_to_relocate and j.relocation_offered)
      )
      and j.languages <@ s.languages
  )
$$;

create or replace function seeker_job_feed(p_limit int default 20)
returns table (
  job_id uuid, company_id uuid, company_name text, company_logo text,
  title text, description text, country text, remote boolean, languages text[],
  salary_badge text, why text, score numeric
)
language sql stable security definer set search_path = public as $$
  select j.id, c.id, c.name, c.logo_url, j.title, j.description, j.country, j.remote, j.languages,
         case when ranges_overlap(s.salary_min, s.salary_max, j.salary_min, j.salary_max)
              then 'Within your range' else 'Below your range' end,
         why_matched(s.id, j.id),
         skill_score(s.id, j.id)
  from seekers s
  join jobs j on j.status = 'active'
  join companies c on c.id = j.company_id
  where s.id = auth.uid()
    and passes_filters(s.id, j.id)
    and not exists (select 1 from seeker_swipes sw where sw.seeker_id = s.id and sw.job_id = j.id)
    and not exists (select 1 from company_swipes cw where cw.seeker_id = s.id and cw.job_id = j.id and cw.direction = 'left')
    and not exists (select 1 from hidden_companies h where h.seeker_id = s.id and h.company_id = c.id and h.hidden_until > now())
  order by skill_score(s.id, j.id) desc, j.created_at desc
  limit p_limit
$$;

-- Masked candidate cards for one of the caller's jobs.
-- p_skills lets the one-textbox search narrow results: [{skill, min_years}].
create or replace function company_candidates(
  p_job uuid, p_skills jsonb default '[]', p_role text default null, p_limit int default 20
)
returns table (
  seeker_id uuid, masked_name text, headline text, total_years numeric,
  skills jsonb, recent_roles jsonb, country text, languages text[], availability text,
  salary_badge text, why text, score numeric, verified boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from jobs where id = p_job and company_id = auth.uid()) then
    raise exception 'NOT_YOUR_JOB';
  end if;

  return query
  select s.id,
         mask_name(s.first_name, s.last_name),
         s.headline, s.total_years,
         (select coalesce(jsonb_agg(jsonb_build_object('skill', sk.skill, 'years', sk.years) order by sk.years desc), '[]')
            from seeker_skills sk where sk.seeker_id = s.id),
         -- employer names are dropped pre-match
         (select coalesce(jsonb_agg(r - 'employer'), '[]') from jsonb_array_elements(s.recent_roles) r),
         s.country, s.languages, s.availability,
         'Within your budget'::text,
         why_matched(s.id, p_job),
         skill_score(s.id, p_job)
           + coalesce((
               select avg(least(coalesce(sk.years, 0) / greatest((q->>'min_years')::numeric, 0.5), 1.0))
               from jsonb_array_elements(p_skills) q
               left join seeker_skills sk on sk.seeker_id = s.id and sk.skill = lower(q->>'skill')
             ), 0),
         s.verification_status = 'verified'
  from seekers s
  join jobs j on j.id = p_job
  where s.profile_confirmed
    and passes_filters(s.id, p_job)
    and not exists (select 1 from company_swipes cw where cw.job_id = p_job and cw.seeker_id = s.id)
    and not exists (select 1 from seeker_swipes sw where sw.job_id = p_job and sw.seeker_id = s.id and sw.direction = 'left')
    and not exists (select 1 from hidden_companies h where h.seeker_id = s.id and h.company_id = j.company_id and h.hidden_until > now())
    and (p_role is null or s.headline ilike '%' || p_role || '%')
    -- every searched skill must be present (near misses allowed via score)
    and not exists (
      select 1 from jsonb_array_elements(p_skills) q
      where not exists (select 1 from seeker_skills sk where sk.seeker_id = s.id and sk.skill = lower(q->>'skill'))
    )
  order by 12 desc
  limit p_limit;
end $$;

-- Landing-page preview for companies who have not signed up: no names, no numbers.
create or replace function preview_candidates(p_skills text[], p_role text default null)
returns table (headline text, total_years numeric, skills jsonb)
language sql stable security definer set search_path = public as $$
  select s.headline, s.total_years,
         (select coalesce(jsonb_agg(jsonb_build_object('skill', coalesce(sk.label, sk.skill), 'years', sk.years) order by sk.years desc), '[]')
            from (select * from seeker_skills where seeker_id = s.id order by years desc limit 5) sk)
  from seekers s
  where s.profile_confirmed
    and (p_role is null or s.headline ilike '%' || p_role || '%')
    and (select count(*) from seeker_skills sk where sk.seeker_id = s.id and sk.skill = any (p_skills)) = cardinality(p_skills)
  order by s.total_years desc
  limit 3
$$;

-- Full profile, only after a match.
create or replace function matched_profile(p_match uuid)
returns table (
  first_name text, last_name text, headline text, salary_min int, salary_max int,
  salary_currency text, resume_text text, resume_path text, email text
)
language sql stable security definer set search_path = public as $$
  select s.first_name, s.last_name, s.headline, s.salary_min, s.salary_max, s.salary_currency,
         s.resume_text, s.resume_path, u.email
  from matches m
  join jobs j on j.id = m.job_id
  join seekers s on s.id = m.seeker_id
  join auth.users u on u.id = s.id
  where m.id = p_match and (j.company_id = auth.uid() or m.seeker_id = auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table app_settings enable row level security;
alter table profiles enable row level security;
alter table seekers enable row level security;
alter table seeker_skills enable row level security;
alter table companies enable row level security;
alter table jobs enable row level security;
alter table job_skills enable row level security;
alter table seeker_swipes enable row level security;
alter table company_swipes enable row level security;
alter table hidden_companies enable row level security;
alter table matches enable row level security;
alter table messages enable row level security;
alter table reports enable row level security;
alter table rewards enable row level security;
alter table payouts enable row level security;

create policy "settings readable" on app_settings for select using (true);

create policy "own profile" on profiles for select using (id = auth.uid() or is_admin());
create policy "create own profile" on profiles for insert with check (id = auth.uid() and role <> 'admin');

-- Seekers: only the seeker (and admins) read the raw row.
create policy "seeker reads self" on seekers for select using (id = auth.uid() or is_admin());
create policy "seeker inserts self" on seekers for insert with check (id = auth.uid());
create policy "seeker updates self" on seekers for update using (id = auth.uid()) with check (id = auth.uid());
create policy "admin reviews ids" on seekers for update using (is_admin());

create policy "seeker skills self" on seeker_skills for all using (seeker_id = auth.uid()) with check (seeker_id = auth.uid());

create policy "companies public" on companies for select using (true);
create policy "company inserts self" on companies for insert with check (id = auth.uid());
create policy "company updates self" on companies for update using (id = auth.uid());

create policy "active jobs public" on jobs for select using (status = 'active' or company_id = auth.uid() or is_admin());
create policy "company writes jobs" on jobs for insert with check (
  company_id = auth.uid() and exists (select 1 from companies where id = auth.uid() and domain_verified));
create policy "company updates jobs" on jobs for update using (company_id = auth.uid());
create policy "admin updates jobs" on jobs for update using (is_admin());

create policy "job skills readable" on job_skills for select using (true);
create policy "job skills write" on job_skills for all
  using (exists (select 1 from jobs where id = job_id and company_id = auth.uid()))
  with check (exists (select 1 from jobs where id = job_id and company_id = auth.uid()));

create policy "seeker swipes self" on seeker_swipes for select using (seeker_id = auth.uid());
create policy "seeker swipes insert" on seeker_swipes for insert with check (seeker_id = auth.uid());

create policy "company swipes own" on company_swipes for select
  using (exists (select 1 from jobs where id = job_id and company_id = auth.uid()));
create policy "company swipes insert" on company_swipes for insert
  with check (exists (select 1 from jobs where id = job_id and company_id = auth.uid() and status = 'active'));

create policy "hidden self" on hidden_companies for all using (seeker_id = auth.uid()) with check (seeker_id = auth.uid());

create policy "match parties" on matches for select
  using (seeker_id = auth.uid() or exists (select 1 from jobs where id = job_id and company_id = auth.uid()));

create policy "message parties read" on messages for select using (
  exists (select 1 from matches m join jobs j on j.id = m.job_id
          where m.id = match_id and (m.seeker_id = auth.uid() or j.company_id = auth.uid())));
create policy "message parties write" on messages for insert with check (
  sender_id = auth.uid() and
  exists (select 1 from matches m join jobs j on j.id = m.job_id
          where m.id = match_id and (m.seeker_id = auth.uid() or j.company_id = auth.uid())));

create policy "report insert" on reports for insert with check (reporter_id = auth.uid());
create policy "report admin" on reports for select using (is_admin());

create policy "rewards self" on rewards for select using (seeker_id = auth.uid() or is_admin());
create policy "payouts self" on payouts for select using (seeker_id = auth.uid() or is_admin());
create policy "payouts admin" on payouts for update using (is_admin());

-- Payout requests go through a function so the balance and minimum are enforced.
create or replace function request_payout(p_amount int, p_method payout_method, p_account text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_balance int;
  v_id uuid;
begin
  if coalesce((select verification_status from seekers where id = auth.uid()), 'unverified') <> 'verified' then
    raise exception 'NOT_VERIFIED';
  end if;
  if p_amount < setting_int('min_cashout_php') then
    raise exception 'BELOW_MINIMUM';
  end if;
  select balance_php into v_balance from seeker_balances where seeker_id = auth.uid();
  if p_amount > coalesce(v_balance, 0) then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;
  insert into payouts (seeker_id, amount_php, method, account_number)
  values (auth.uid(), p_amount, p_method, p_account) returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Storage buckets (private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('resumes', 'resumes', false), ('ids', 'ids', false)
on conflict do nothing;

create policy "own resume" on storage.objects for all
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own id upload" on storage.objects for insert
  with check (bucket_id = 'ids' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "admin reads ids" on storage.objects for select
  using (bucket_id = 'ids' and is_admin());

-- ---------------------------------------------------------------------------
-- Guards: users cannot verify themselves or mark their own posts as paid
-- ---------------------------------------------------------------------------
create or replace function guard_seeker_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- admin, service role (no uid) or our own triggers (nested) may write anything
  if is_admin() or auth.uid() is null or pg_trigger_depth() > 1 then
    return new;
  end if;
  -- A seeker may only move unverified/rejected -> pending (after uploading an ID).
  if new.verification_status is distinct from old.verification_status
     and not (new.verification_status = 'pending' and old.verification_status in ('unverified', 'rejected')
              and new.id_document_path is not null) then
    raise exception 'VERIFICATION_LOCKED';
  end if;
  new.verified_at := old.verified_at;
  new.verified_by := old.verified_by;
  new.updated_at := now();
  return new;
end $$;

create trigger trg_guard_seeker_update before update on seekers
for each row execute function guard_seeker_update();

create or replace function guard_job_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_admin() or auth.uid() is null or pg_trigger_depth() > 1 then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.paid_at := null;
    new.reward_swipes_used := 0;
    if new.status = 'active' then new.status := 'awaiting_payment'; end if;
  else
    new.paid_at := old.paid_at;
    new.reward_swipes_used := old.reward_swipes_used;
    if new.status = 'active' and old.paid_at is null then
      raise exception 'JOB_NOT_PAID';
    end if;
  end if;
  return new;
end $$;

create trigger trg_guard_job_write before insert or update on jobs
for each row execute function guard_job_write();

create or replace function guard_company_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_admin() or auth.uid() is null or pg_trigger_depth() > 1 then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- domain must match the signed-in work email
    -- Verified = confirmed email (OTP) on a non-free-mail domain.
    select lower(split_part(email, '@', 2)), email_confirmed_at is not null
      into new.domain, new.domain_verified
      from auth.users where id = auth.uid();
    if new.domain = any (array['gmail.com','yahoo.com','yahoo.com.ph','outlook.com','hotmail.com',
                               'live.com','icloud.com','proton.me','protonmail.com','aol.com','gmx.com','mail.com']) then
      new.domain_verified := false;
    end if;
  else
    new.domain := old.domain;
    new.domain_verified := old.domain_verified;
  end if;
  return new;
end $$;

create trigger trg_guard_company_write before insert or update on companies
for each row execute function guard_company_write();
