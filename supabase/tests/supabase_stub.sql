-- Minimal stand-ins for Supabase's auth and storage schemas, for local SQL tests only.
create schema if not exists auth;
create schema if not exists storage;
create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as
  $$ select string_to_array(name, '/') $$;
