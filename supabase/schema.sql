-- Schema for claude-console's `projects` command group.
--
-- Idempotent: safe to run more than once against the same database (a
-- fresh project, a disposable project for test/integration/, or re-applying
-- after a change here) — `create policy` alone is not, since Postgres
-- rejects creating a policy that already exists by name, so every policy is
-- dropped first.
--
-- Run this in the Supabase SQL editor (or `supabase db execute`) before
-- using `claude-console projects ...`.

create table if not exists public.projects (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;

drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects
  for select using (auth.uid() = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
  for insert with check (auth.uid() = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects
  for update using (auth.uid() = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own" on public.projects
  for delete using (auth.uid() = user_id);
