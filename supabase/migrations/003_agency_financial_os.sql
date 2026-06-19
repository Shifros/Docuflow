-- Drop the old documents table (and its policies/indexes)
drop table if exists public.documents cascade;

-- Create clients table
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- Create projects table
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  name text not null,
  fixed_budget numeric not null default 0,
  status text not null default 'active' check (status in ('active', 'completed', 'on_hold')),
  created_at timestamptz not null default now()
);

-- Create expenses table
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  vendor_name text,
  total_amount numeric,
  expense_type text not null default 'unknown' check (expense_type in ('overhead', 'project_direct', 'unknown')),
  category text not null default 'Misc' check (category in ('Software', 'Contractor', 'Payroll', 'Hosting', 'Misc')),
  project_id uuid references public.projects (id) on delete set null,
  receipt_url text not null,
  file_name text,
  status text not null default 'pending_approval' check (status in ('pending_approval', 'approved', 'failed')),
  raw_extracted_data jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists clients_org_id_idx on public.clients (org_id);
create index if not exists projects_org_id_idx on public.projects (org_id);
create index if not exists projects_client_id_idx on public.projects (client_id);
create index if not exists expenses_org_id_idx on public.expenses (org_id);
create index if not exists expenses_project_id_idx on public.expenses (project_id);
create index if not exists expenses_created_at_idx on public.expenses (created_at desc);

-- Enable Row Level Security
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.expenses enable row level security;

-- Helper: current user's org_id (already exists, but let's ensure it's there or just use it)
-- RLS Policies for clients
create policy "Users can view org clients"
  on public.clients for select
  using (org_id = public.current_user_org_id());

create policy "Users can insert org clients"
  on public.clients for insert
  with check (org_id = public.current_user_org_id());

create policy "Users can update org clients"
  on public.clients for update
  using (org_id = public.current_user_org_id());

create policy "Users can delete org clients"
  on public.clients for delete
  using (org_id = public.current_user_org_id());

-- RLS Policies for projects
create policy "Users can view org projects"
  on public.projects for select
  using (org_id = public.current_user_org_id());

create policy "Users can insert org projects"
  on public.projects for insert
  with check (org_id = public.current_user_org_id());

create policy "Users can update org projects"
  on public.projects for update
  using (org_id = public.current_user_org_id());

create policy "Users can delete org projects"
  on public.projects for delete
  using (org_id = public.current_user_org_id());

-- RLS Policies for expenses
create policy "Users can view org expenses"
  on public.expenses for select
  using (org_id = public.current_user_org_id());

create policy "Users can insert org expenses"
  on public.expenses for insert
  with check (org_id = public.current_user_org_id());

create policy "Users can update org expenses"
  on public.expenses for update
  using (org_id = public.current_user_org_id());

create policy "Users can delete org expenses"
  on public.expenses for delete
  using (org_id = public.current_user_org_id());

-- Seed some demo clients and projects for existing organizations
do $$
declare
  org_rec record;
  client1_id uuid;
  client2_id uuid;
begin
  for org_rec in select id from public.organizations loop
    -- Insert Clients
    insert into public.clients (org_id, name)
    values 
      (org_rec.id, 'Acme Corp'),
      (org_rec.id, 'Stark Industries'),
      (org_rec.id, 'Wayne Enterprises')
    on conflict do nothing;

    -- Get client IDs to reference
    select id into client1_id from public.clients where org_id = org_rec.id and name = 'Acme Corp' limit 1;
    select id into client2_id from public.clients where org_id = org_rec.id and name = 'Stark Industries' limit 1;

    -- Insert Projects
    insert into public.projects (org_id, client_id, name, fixed_budget, status)
    values
      (org_rec.id, client1_id, 'Acme Website Redesign', 15000, 'active'),
      (org_rec.id, client1_id, 'Acme SEO Optimization', 5000, 'active'),
      (org_rec.id, client2_id, 'Stark Portal Development', 50000, 'active'),
      (org_rec.id, null, 'Internal R&D', 0, 'active')
    on conflict do nothing;
  end loop;
end $$;
