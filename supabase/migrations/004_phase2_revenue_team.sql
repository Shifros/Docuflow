-- Phase 2: Revenue, Team Labor, True Margin

alter table public.projects
  add column if not exists billing_type text not null default 'fixed'
    check (billing_type in ('fixed', 'hourly', 'retainer')),
  add column if not exists target_margin_percent numeric not null default 40;

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  role text not null default 'employee'
    check (role in ('admin', 'manager', 'employee')),
  hourly_cost numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  team_member_id uuid not null references public.team_members (id) on delete cascade,
  hours numeric not null check (hours > 0),
  date date not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.revenue_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  amount numeric not null check (amount >= 0),
  date date not null,
  status text not null default 'expected'
    check (status in ('expected', 'paid')),
  type text not null default 'one_off'
    check (type in ('one_off', 'retainer_monthly')),
  created_at timestamptz not null default now()
);

create index if not exists team_members_org_id_idx on public.team_members (org_id);
create index if not exists time_entries_org_id_idx on public.time_entries (org_id);
create index if not exists time_entries_project_id_idx on public.time_entries (project_id);
create index if not exists time_entries_date_idx on public.time_entries (date desc);
create index if not exists revenue_entries_org_id_idx on public.revenue_entries (org_id);
create index if not exists revenue_entries_project_id_idx on public.revenue_entries (project_id);
create index if not exists revenue_entries_date_idx on public.revenue_entries (date desc);

alter table public.team_members enable row level security;
alter table public.time_entries enable row level security;
alter table public.revenue_entries enable row level security;

create policy "Users can view org team members"
  on public.team_members for select
  using (org_id = public.current_user_org_id());

create policy "Users can insert org team members"
  on public.team_members for insert
  with check (org_id = public.current_user_org_id());

create policy "Users can update org team members"
  on public.team_members for update
  using (org_id = public.current_user_org_id());

create policy "Users can delete org team members"
  on public.team_members for delete
  using (org_id = public.current_user_org_id());

create policy "Users can view org time entries"
  on public.time_entries for select
  using (org_id = public.current_user_org_id());

create policy "Users can insert org time entries"
  on public.time_entries for insert
  with check (org_id = public.current_user_org_id());

create policy "Users can update org time entries"
  on public.time_entries for update
  using (org_id = public.current_user_org_id());

create policy "Users can delete org time entries"
  on public.time_entries for delete
  using (org_id = public.current_user_org_id());

create policy "Users can view org revenue entries"
  on public.revenue_entries for select
  using (org_id = public.current_user_org_id());

create policy "Users can insert org revenue entries"
  on public.revenue_entries for insert
  with check (org_id = public.current_user_org_id());

create policy "Users can update org revenue entries"
  on public.revenue_entries for update
  using (org_id = public.current_user_org_id());

create policy "Users can delete org revenue entries"
  on public.revenue_entries for delete
  using (org_id = public.current_user_org_id());

-- Seed demo team members for existing organizations
do $$
declare
  org_rec record;
begin
  for org_rec in select id from public.organizations loop
    insert into public.team_members (org_id, name, role, hourly_cost)
    values
      (org_rec.id, 'Alex Rivera', 'manager', 55),
      (org_rec.id, 'Sarah Chen', 'employee', 45),
      (org_rec.id, 'Marcus Johnson', 'employee', 50)
    on conflict do nothing;
  end loop;
end $$;
