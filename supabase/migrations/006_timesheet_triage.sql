-- Phase 3b: timesheet triage queue

create type public.timesheet_import_status as enum (
  'pending_approval',
  'approved',
  'failed'
);

create table public.timesheet_imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  source_file_url text,
  file_name text,
  status public.timesheet_import_status not null default 'pending_approval',
  extracted_data jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index timesheet_imports_org_status_idx
  on public.timesheet_imports (org_id, status);
