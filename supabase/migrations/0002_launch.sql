-- Launch features: GCash payments with manual review, 30-day job posts,
-- "position filled", reports with takedowns, support messages, account deletion.

insert into app_settings (key, value) values ('job_live_days', '30'), ('job_post_price_php', '1998')
on conflict (key) do update set value = excluded.value where app_settings.key = 'job_post_price_php';
delete from app_settings where key = 'job_post_price_usd';

-- ---------------------------------------------------------------------------
-- Job lifecycle
-- ---------------------------------------------------------------------------
alter table jobs
  add column live_until timestamptz,
  add column filled_at timestamptz,
  add column taken_down_at timestamptz,
  add column takedown_note text,
  add column pay_status text not null default 'unpaid'
    check (pay_status in ('unpaid', 'submitted', 'rejected', 'approved'));

-- Seekers see a job only while it's paid, not filled, not taken down and inside its 30 days.
create or replace function job_is_live(p_job uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from jobs
    where id = p_job and status = 'active' and filled_at is null and taken_down_at is null
      and (live_until is null or live_until > now())
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
  join jobs j on j.status = 'active' and j.filled_at is null and j.taken_down_at is null
             and (j.live_until is null or j.live_until > now())
  join companies c on c.id = j.company_id
  where s.id = auth.uid()
    and passes_filters(s.id, j.id)
    and not exists (select 1 from seeker_swipes sw where sw.seeker_id = s.id and sw.job_id = j.id)
    and not exists (select 1 from company_swipes cw where cw.seeker_id = s.id and cw.job_id = j.id and cw.direction = 'left')
    and not exists (select 1 from hidden_companies h where h.seeker_id = s.id and h.company_id = c.id and h.hidden_until > now())
  order by skill_score(s.id, j.id) desc, j.created_at desc
  limit p_limit
$$;

-- Seekers can't swipe on a job that has closed.
create or replace function guard_live_job_swipe() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not job_is_live(new.job_id) then raise exception 'JOB_NOT_LIVE'; end if;
  return new;
end $$;
create trigger trg_live_job_seeker_swipe before insert on seeker_swipes
for each row execute function guard_live_job_swipe();
create trigger trg_live_job_company_swipe before insert on company_swipes
for each row execute function guard_live_job_swipe();

-- Companies may edit their posts and mark them filled, but never their payment
-- state, live window or a takedown. A post under payment review is locked.
create or replace function guard_job_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_admin() or auth.uid() is null or pg_trigger_depth() > 1 then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.paid_at := null;
    new.live_until := null;
    new.taken_down_at := null;
    new.takedown_note := null;
    new.pay_status := 'unpaid';
    if new.status = 'active' then new.status := 'awaiting_payment'; end if;
  else
    if old.pay_status = 'submitted'
       and (new.title, new.description, new.salary_min, new.salary_max, new.country, new.languages)
           is distinct from (old.title, old.description, old.salary_min, old.salary_max, old.country, old.languages) then
      raise exception 'JOB_LOCKED';
    end if;
    new.paid_at := old.paid_at;
    new.live_until := old.live_until;
    new.taken_down_at := old.taken_down_at;
    new.takedown_note := old.takedown_note;
    new.pay_status := old.pay_status;
    if new.status = 'active' and old.status <> 'active' then
      raise exception 'JOB_NOT_PAID';
    end if;
  end if;
  return new;
end $$;

-- Job skills can't change while a payment is being checked.
create or replace function guard_job_skills() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_job uuid := coalesce(new.job_id, old.job_id);
begin
  if is_admin() or auth.uid() is null or pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;
  if exists (select 1 from jobs where id = v_job and pay_status = 'submitted') then
    raise exception 'JOB_LOCKED';
  end if;
  return coalesce(new, old);
end $$;
create trigger trg_guard_job_skills before insert or update or delete on job_skills
for each row execute function guard_job_skills();

-- ---------------------------------------------------------------------------
-- Payments (GCash / InstaPay, checked by hand)
-- ---------------------------------------------------------------------------
create table payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs (id) on delete set null,
  company_id uuid references companies (id) on delete set null,
  company_name text not null,
  job_title text not null,
  amount_php int not null,
  reference text not null check (char_length(reference) between 3 and 64),
  subject text not null,
  body text not null check (char_length(body) <= 8000),
  proof_path text,
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid references profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table payments enable row level security;
create policy "company sends payment" on payments for insert with check (
  company_id = auth.uid() and status = 'submitted' and reviewed_at is null
  and exists (select 1 from jobs where id = job_id and company_id = auth.uid() and pay_status <> 'submitted')
);
create policy "company reads own payments" on payments for select using (company_id = auth.uid() or is_admin());
create policy "admin reviews payments" on payments for update using (is_admin());

-- The price comes from settings, not the client; sending a payment locks the post.
create or replace function before_payment_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.amount_php := setting_int('job_post_price_php');
  return new;
end $$;
create trigger trg_before_payment_insert before insert on payments
for each row execute function before_payment_insert();

create or replace function after_payment_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update jobs set pay_status = 'submitted' where id = new.job_id;
  return new;
end $$;
create trigger trg_after_payment_insert after insert on payments
for each row execute function after_payment_insert();

-- Admin decision: approve publishes (or renews) the job for 30 days; reject unlocks it.
create or replace function review_payment(p_payment uuid, p_approve boolean, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_job uuid;
begin
  if not is_admin() then raise exception 'ADMIN_ONLY'; end if;
  update payments
     set status = case when p_approve then 'approved' else 'rejected' end,
         review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_payment and status = 'submitted'
  returning job_id into v_job;
  if v_job is null then raise exception 'PAYMENT_NOT_PENDING'; end if;
  if p_approve then
    update jobs set status = 'active', paid_at = now(), filled_at = null, pay_status = 'approved',
                    live_until = now() + make_interval(days => setting_int('job_live_days'))
     where id = v_job;
  else
    update jobs set pay_status = 'rejected' where id = v_job;
  end if;
  return v_job;
end $$;

-- ---------------------------------------------------------------------------
-- Reports: keep them when accounts are deleted, add review fields
-- ---------------------------------------------------------------------------
alter table reports
  alter column reporter_id drop not null,
  drop constraint reports_reporter_id_fkey,
  add constraint reports_reporter_id_fkey foreign key (reporter_id) references profiles (id) on delete set null,
  drop constraint reports_job_id_fkey,
  add constraint reports_job_id_fkey foreign key (job_id) references jobs (id) on delete set null,
  drop constraint reports_seeker_id_fkey,
  add constraint reports_seeker_id_fkey foreign key (seeker_id) references seekers (id) on delete set null,
  drop constraint reports_message_id_fkey,
  add constraint reports_message_id_fkey foreign key (message_id) references messages (id) on delete set null,
  add column company_id uuid references companies (id) on delete set null,
  add column match_id uuid references matches (id) on delete set null,
  add column target_label text,
  add column note text check (char_length(note) <= 2000),
  add column status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  add column reviewed_at timestamptz;
create policy "admin reviews reports" on reports for update using (is_admin());

-- Messages outlive nothing: a deleted account takes its chats with it.
alter table messages
  drop constraint messages_sender_id_fkey,
  add constraint messages_sender_id_fkey foreign key (sender_id) references profiles (id) on delete cascade;

create or replace function take_down_job(p_report uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_job uuid;
begin
  if not is_admin() then raise exception 'ADMIN_ONLY'; end if;
  update reports set status = 'actioned', reviewed_at = now() where id = p_report returning job_id into v_job;
  if v_job is not null then
    update jobs set taken_down_at = now(), takedown_note = nullif(p_note, '') where id = v_job;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Support messages (anyone, signed in or not)
-- ---------------------------------------------------------------------------
create table support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles (id) on delete set null,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  topic text not null,
  body text not null check (char_length(body) between 10 and 5000),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);
alter table support_messages enable row level security;
create policy "anyone writes support" on support_messages for insert
  with check ((user_id is null or user_id = auth.uid()) and status = 'open');
create policy "admin reads support" on support_messages for select using (is_admin());
create policy "admin closes support" on support_messages for update using (is_admin());

-- ---------------------------------------------------------------------------
-- Storage: payment receipts (private; the company uploads, admins read)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict do nothing;
create policy "own receipt upload" on storage.objects for insert
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own receipt read" on storage.objects for select
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));
