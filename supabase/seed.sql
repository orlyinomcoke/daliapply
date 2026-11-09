-- To make yourself an admin (ID review queue, job payments), sign in once
-- through the app, then run this in Supabase Studio (http://127.0.0.1:54323 > SQL editor):
--   update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
select 1;
