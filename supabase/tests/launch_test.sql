-- Payments, 30-day posts, filled, takedowns, support and account deletion (0002_launch.sql).
-- Runs after rules_test.sql, as superuser; `test.uid` impersonates a signed-in user.
\set ON_ERROR_STOP on
\set QUIET on

update app_settings set value = '25' where key = 'seeker_daily_right_swipes';

-- e1 = company Beta, e2 = seeker Neo
insert into auth.users values
  ('00000000-0000-0000-0000-0000000000e1', 'hr@beta.ph', now()),
  ('00000000-0000-0000-0000-0000000000e2', 'neo@example.com', now());
insert into profiles (id, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'company'),
  ('00000000-0000-0000-0000-0000000000e2', 'seeker');
set test.uid = '00000000-0000-0000-0000-0000000000e1';
insert into companies (id, name, domain, domain_verified) values ('00000000-0000-0000-0000-0000000000e1', 'Beta', 'x', true);
insert into jobs (id, company_id, title, country, salary_min, salary_max, languages, status)
values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', 'Go Dev', 'PH', 60000, 90000, '{english}', 'awaiting_payment');
insert into job_skills values ('00000000-0000-0000-0000-0000000000f1', 'go', 'Go', 3);
reset test.uid;
insert into seekers (id, first_name, last_name, headline, total_years, salary_min, salary_max, country, languages, profile_confirmed)
values ('00000000-0000-0000-0000-0000000000e2', 'Neo', 'Reyes', 'Go developer', 5, 70000, 80000, 'PH', '{english}', true);
insert into seeker_skills values ('00000000-0000-0000-0000-0000000000e2', 'go', 4);

-- Company sends a payment: the price comes from settings and the post locks.
set test.uid = '00000000-0000-0000-0000-0000000000e1';
insert into payments (id, job_id, company_id, company_name, job_title, amount_php, reference, subject, body, proof_path)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1',
        'Beta', 'Go Dev', 1, '1234567', 'Job post payment', 'Hi', 'e1/receipt.jpg');
do $$ begin
  assert (select amount_php from payments where id = '00000000-0000-0000-0000-0000000000a1') = 1998, 'price from settings';
  assert (select pay_status from jobs where title = 'Go Dev') = 'submitted', 'payment locks post';
end $$;
do $$ begin
  begin
    update jobs set title = 'Changed' where title = 'Go Dev';
    assert false, 'locked post should not change';
  exception when raise_exception then null; end;
  begin
    update job_skills set min_years = 1 where job_id = '00000000-0000-0000-0000-0000000000f1';
    assert false, 'locked skills should not change';
  exception when raise_exception then null; end;
  begin
    perform review_payment('00000000-0000-0000-0000-0000000000a1', true);
    assert false, 'company cannot approve its own payment';
  exception when raise_exception then null; end;
end $$;
update jobs set live_until = now() + interval '1 year', filled_at = now(), takedown_note = 'x' where title = 'Go Dev';
do $$ begin
  assert (select live_until is null and takedown_note is null and pay_status = 'submitted' from jobs where title = 'Go Dev'),
    'company cannot set live window, takedown or payment state';
  assert (select filled_at is not null from jobs where title = 'Go Dev'), 'company can mark filled';
end $$;
update jobs set filled_at = null where title = 'Go Dev';
reset test.uid;

-- Admin approves: live for 30 days.
set test.uid = '00000000-0000-0000-0000-00000000000a';
select review_payment('00000000-0000-0000-0000-0000000000a1', true) \g /dev/null
reset test.uid;
do $$ begin
  assert (select status = 'active' and pay_status = 'approved' and paid_at is not null
                 and live_until between now() + interval '29 days' and now() + interval '31 days'
          from jobs where title = 'Go Dev'), 'approved post is live for 30 days';
  assert (select status from payments where id = '00000000-0000-0000-0000-0000000000a1') = 'approved', 'payment approved';
end $$;

set test.uid = '00000000-0000-0000-0000-0000000000e2';
do $$ begin
  assert (select count(*) from seeker_job_feed() where title = 'Go Dev') = 1, 'live job in feed';
end $$;
reset test.uid;

-- Expired: gone from the feed, no swipes.
update jobs set live_until = now() - interval '1 minute' where title = 'Go Dev';
set test.uid = '00000000-0000-0000-0000-0000000000e2';
do $$ begin
  assert (select count(*) from seeker_job_feed() where title = 'Go Dev') = 0, 'expired job leaves feed';
  begin
    insert into seeker_swipes values ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000f1', 'right');
    assert false, 'cannot swipe an expired job';
  exception when raise_exception then null; end;
end $$;
reset test.uid;

-- Renewal: a new payment, approved, gives another 30 days.
set test.uid = '00000000-0000-0000-0000-0000000000e1';
insert into payments (id, job_id, company_id, company_name, job_title, amount_php, reference, subject, body)
values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1',
        'Beta', 'Go Dev', 1998, '7654321', 'Renewal', 'Hi');
reset test.uid;
set test.uid = '00000000-0000-0000-0000-00000000000a';
select review_payment('00000000-0000-0000-0000-0000000000a2', true) \g /dev/null
reset test.uid;
set test.uid = '00000000-0000-0000-0000-0000000000e2';
do $$ begin
  assert (select count(*) from seeker_job_feed() where title = 'Go Dev') = 1, 'renewed job back in feed';
end $$;
reset test.uid;

-- Filled: gone from the feed.
update jobs set filled_at = now() where title = 'Go Dev';
set test.uid = '00000000-0000-0000-0000-0000000000e2';
do $$ begin
  assert (select count(*) from seeker_job_feed() where title = 'Go Dev') = 0, 'filled job leaves feed';
end $$;
reset test.uid;
update jobs set filled_at = null where title = 'Go Dev';

-- Report and takedown.
set test.uid = '00000000-0000-0000-0000-0000000000e2';
insert into reports (id, reporter_id, job_id, company_id, reason, target_label)
values ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000f1',
        '00000000-0000-0000-0000-0000000000e1', 'Asks seekers to pay', 'Go Dev at Beta');
reset test.uid;
set test.uid = '00000000-0000-0000-0000-00000000000a';
select take_down_job('00000000-0000-0000-0000-0000000000b9', 'Placement fee') \g /dev/null
reset test.uid;
set test.uid = '00000000-0000-0000-0000-0000000000e2';
do $$ begin
  assert (select count(*) from seeker_job_feed() where title = 'Go Dev') = 0, 'taken-down job leaves feed';
  assert (select status from reports where id = '00000000-0000-0000-0000-0000000000b9') = 'actioned', 'report actioned';
end $$;
reset test.uid;

-- Support: visitors can write; bad emails are refused.
insert into support_messages (email, topic, body) values ('visitor@example.com', 'Login', 'I did not get my code.');
do $$ begin
  begin
    insert into support_messages (email, topic, body) values ('nope', 'Login', 'I did not get my code.');
    assert false, 'bad email refused';
  exception when check_violation then null; end;
end $$;

-- Account deletion: the seeker's data goes, the report stays without a reporter;
-- deleting the company keeps its payment records for tax.
delete from auth.users where id = '00000000-0000-0000-0000-0000000000e2';
delete from auth.users where id = '00000000-0000-0000-0000-0000000000e1';
do $$ begin
  assert not exists (select 1 from seekers where id = '00000000-0000-0000-0000-0000000000e2'), 'seeker deleted';
  assert (select reporter_id is null from reports where id = '00000000-0000-0000-0000-0000000000b9'), 'report kept, reporter removed';
  assert (select count(*) from payments where company_name = 'Beta' and company_id is null and job_id is null) = 2, 'payments kept for tax';
end $$;

\echo ALL LAUNCH TESTS PASSED
