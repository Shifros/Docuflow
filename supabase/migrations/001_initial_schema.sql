-- DocuFlow AI — initial schema
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Extensions
create extension if not exists "pgcrypto";

-- 1. organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- 2. users (profile table linked to auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  role text not null default 'editor' check (role in ('admin', 'editor')),
  created_at timestamptz not null default now()
);

-- 3. documents
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  file_name text not null,
  file_url text not null,
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'completed', 'failed')
  ),
  extracted_data jsonb,
  created_at timestamptz not null default now()
);

-- 4. keep_alive (prevents free-tier project pause)
create table if not exists public.keep_alive (
  id uuid primary key default gen_random_uuid(),
  pinged_at timestamptz not null default now()
);

-- Indexes
create index if not exists documents_org_id_idx on public.documents (org_id);
create index if not exists documents_created_at_idx on public.documents (created_at desc);
create index if not exists users_org_id_idx on public.users (org_id);

-- Row Level Security
alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.documents enable row level security;
alter table public.keep_alive enable row level security;

-- Helper: current user's org_id
create or replace function public.current_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.users where id = auth.uid();
$$;

-- organizations policies
create policy "Users can view their organization"
  on public.organizations for select
  using (id = public.current_user_org_id());

-- users policies
create policy "Users can view org members"
  on public.users for select
  using (org_id = public.current_user_org_id());

create policy "Users can update own profile"
  on public.users for update
  using (id = auth.uid());

-- documents policies
create policy "Users can view org documents"
  on public.documents for select
  using (org_id = public.current_user_org_id());

create policy "Users can insert org documents"
  on public.documents for insert
  with check (org_id = public.current_user_org_id());

create policy "Users can update org documents"
  on public.documents for update
  using (org_id = public.current_user_org_id());

create policy "Users can delete org documents"
  on public.documents for delete
  using (org_id = public.current_user_org_id());

-- keep_alive: service role only (no anon/authenticated access)
create policy "No public access to keep_alive"
  on public.keep_alive for all
  using (false)
  with check (false);

-- Storage bucket for PDFs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800,
  array['application/pdf']::text[]
)
on conflict (id) do nothing;

-- Storage policies: org-scoped paths as {org_id}/{filename}
create policy "Users can upload PDFs to their org folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

create policy "Users can read PDFs from their org folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

create policy "Users can delete PDFs from their org folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_user_org_id()::text
  );
