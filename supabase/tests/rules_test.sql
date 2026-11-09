-- Exercises matching, hiding, caps and guards against the real migration.
-- Runs as superuser; `test.uid` impersonates a signed-in user for auth.uid().
-- Run: ./supabase/tests/run.sh
\set ON_ERROR_STOP on
\set QUIET on

-- ids: a = admin, c1 = acme (work domain), c2 = gmail company, d1/d2 = seekers
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'admin@daliapply.com', now()),
  ('00000000-0000-0000-0000-0000000000c1', 'hr@acme.ph', now()),
  ('00000000-0000-0000-0000-0000000000c2', 'boss@gmail.com', now()),
  ('00000000-0000-0000-0000-0000000000d1', 'orly@example.com', now()),
  ('00000000-0000-0000-0000-0000000000d2', 'ana@example.com', now());

insert into profiles (id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin'),
  ('00000000-0000-0000-0000-0000000000c1', 'company'),
  ('00000000-0000-0000-0000-0000000000c2', 'company'),
  ('00000000-0000-0000-0000-0000000000d1', 'seeker'),
  ('00000000-0000-0000-0000-0000000000d2', 'seeker');

-- Companies sign up as themselves so the domain guard runs.
set test.uid = '00000000-0000-0000-0000-0000000000c1';
insert into companies (id, name, domain, domain_verified) values ('00000000-0000-0000-0000-0000000000c1', 'Acme', 'fake.com', true);
set test.uid = '00000000-0000-0000-0000-0000000000c2';
insert into companies (id, name, domain, domain_verified) values ('00000000-0000-0000-0000-0000000000c2', 'Gmail Co', 'x', true);
reset test.uid;

do $$ begin
  assert (select domain from companies where name = 'Acme') = 'acme.ph', 'domain comes from work email';
  assert (select domain_verified from companies where name = 'Acme'), 'work domain verified';
  assert not (select domain_verified from companies where name = 'Gmail Co'), 'free mail domain not verified';
end $$;

insert into seekers (id, first_name, last_name, headline, total_years, salary_min, salary_max, country, languages, profile_confirmed)
values
  ('00000000-0000-0000-0000-0000000000d1', 'Orly', 'Bondoc', 'PHP programmer', 8, 60000, 90000, 'PH', '{english,filipino}', true),
  ('00000000-0000-0000-0000-0000000000d2', 'Ana', 'Cruz', 'PHP programmer', 4, 50000, 70000, 'PH', '{english}', true);
insert into seeker_skills (seeker_id, skill, years) values
  ('00000000-0000-0000-0000-0000000000d1', 'php', 6), ('00000000-0000-0000-0000-0000000000d1', 'management', 2),
  ('00000000-0000-0000-0000-0000000000d2', 'php', 4);

-- Company tries to self-activate a job: guard downgrades it to awaiting_payment.
set test.uid = '00000000-0000-0000-0000-0000000000c1';
insert into jobs (id, company_id, title, country, salary_min, salary_max, languages, status, paid_at)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'PHP Lead', 'PH', 70000, 100000, '{english}', 'active', now());
reset test.uid;
do $$ begin
  assert (select status from jobs where title = 'PHP Lead') = 'awaiting_payment', 'company cannot self-activate';
  assert (select paid_at from jobs where title = 'PHP Lead') is null, 'company cannot set paid_at';
end $$;
insert into job_skills values ('00000000-0000-0000-0000-0000000000b1', 'php', 'PHP', 5), ('00000000-0000-0000-0000-0000000000b1', 'management', null, 1);
-- Payment confirmed (service role / webhook): auth.uid() is null.
update jobs set status = 'active', paid_at = now() where title = 'PHP Lead';

-- Seeker feed and why-matched line
set test.uid = '00000000-0000-0000-0000-0000000000d1';
do $$ declare r record; begin
  select * into r from seeker_job_feed() limit 1;
  assert r.title = 'PHP Lead', 'job appears in feed';
  assert r.salary_badge = 'Within your range', 'salary badge';
  assert r.why = 'PHP 6 yrs ✓ · Management 2 yrs ✓', format('why line, got %s', r.why);
end $$;

-- Seeker cannot self-verify
do $$ begin
  begin
    update seekers set verification_status = 'verified' where id = auth.uid();
    assert false, 'self-verify should fail';
  exception when raise_exception then null; end;
end $$;
update seekers set id_document_path = 'd1/id.jpg', verification_status = 'pending' where id = auth.uid();
reset test.uid;
-- Admin approves d1 (d2 stays unverified)
set test.uid = '00000000-0000-0000-0000-00000000000a';
update seekers set verification_status = 'verified', verified_at = now() where id = '00000000-0000-0000-0000-0000000000d1';
reset test.uid;

-- Company candidates: masked names, near-miss ranks lower
set test.uid = '00000000-0000-0000-0000-0000000000c1';
do $$ declare names text[]; begin
  select array_agg(masked_name order by score desc) into names from company_candidates('00000000-0000-0000-0000-0000000000b1');
  assert names = array['O*** B*****', 'A*** C***'], format('masked + ranked, got %s', names);
end $$;
-- Search narrowing: management required -> only d1
do $$ begin
  assert (select count(*) from company_candidates('00000000-0000-0000-0000-0000000000b1', '[{"skill":"management","min_years":1}]')) = 1, 'search filter';
end $$;

-- Company swipes right on both: no match until the seeker also swipes right
insert into company_swipes values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', 'right');
insert into company_swipes values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d2', 'right');
reset test.uid;
do $$ begin
  assert (select count(*) from matches) = 0, 'no match yet';
end $$;

-- Seeker swipes right -> match
set test.uid = '00000000-0000-0000-0000-0000000000d1';
insert into seeker_swipes values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', 'right');
do $$ begin
  assert (select count(*) from matches) = 1, 'mutual right = match';
  assert (select first_name from matched_profile((select id from matches limit 1))) = 'Orly', 'match unlocks name';
  assert (select count(*) from seeker_job_feed()) = 0, 'swiped job leaves feed';
end $$;
reset test.uid;

-- Hide company: d2 no longer sees Acme jobs for 30 days
insert into jobs (id, company_id, title, country, salary_min, salary_max, languages, status, paid_at)
values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1', 'PHP Dev', 'PH', 50000, 70000, '{english}', 'active', now());
set test.uid = '00000000-0000-0000-0000-0000000000d2';
do $$ begin
  assert (select count(*) from seeker_job_feed() where title = 'PHP Dev') = 1, 'visible before hide';
end $$;
insert into hidden_companies values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', now() + interval '30 days');
do $$ begin
  assert (select count(*) from seeker_job_feed()) = 0, 'hidden company jobs gone';
end $$;
reset test.uid;

-- Daily right-swipe cap
update app_settings set value = '1' where key = 'seeker_daily_right_swipes';
insert into jobs (id, company_id, title, country, languages, status, paid_at)
values ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000c1', 'Other', 'PH', '{}', 'active', now());
do $$ begin
  begin
    insert into seeker_swipes values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b3', 'right');
    assert false, 'daily cap should block';
  exception when raise_exception then null; end;
end $$;

\echo ALL RULE TESTS PASSED
