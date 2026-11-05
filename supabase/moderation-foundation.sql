-- Sparky's Space moderation foundation (safe migration)
-- Run in Supabase SQL Editor. This does not automatically disable banned accounts.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete set null,
  category text not null check (char_length(category) between 2 and 40),
  details text not null check (char_length(details) between 10 and 2000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  staff_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  target_user_id uuid not null references auth.users(id),
  action_type text not null check (action_type in ('warning','temporary_ban','permanent_ban','note','lift_ban')),
  reason text not null check (char_length(reason) between 3 and 1000),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.appeals (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.moderation_actions(id) on delete cascade,
  appellant_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  staff_response text,
  created_at timestamptz not null default now(),
  unique(action_id, appellant_id)
);

alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.appeals enable row level security;

drop policy if exists "Members submit own reports" on public.reports;
create policy "Members submit own reports" on public.reports
for insert to authenticated with check (reporter_id = (select auth.uid()));

drop policy if exists "Staff view reports" on public.reports;
create policy "Staff view reports" on public.reports
for select to authenticated using ((select public.is_staff()));

drop policy if exists "Staff update reports" on public.reports;
create policy "Staff update reports" on public.reports
for update to authenticated using ((select public.is_staff()))
with check ((select public.is_staff()));

drop policy if exists "Staff view moderation records" on public.moderation_actions;
create policy "Staff view moderation records" on public.moderation_actions
for select to authenticated using ((select public.is_staff()));

drop policy if exists "Members view own moderation records" on public.moderation_actions;
create policy "Members view own moderation records" on public.moderation_actions
for select to authenticated using (target_user_id = (select auth.uid()));

drop policy if exists "Members view own appeals" on public.appeals;
create policy "Members view own appeals" on public.appeals
for select to authenticated using (
  appellant_id = (select auth.uid()) or (select public.is_staff())
);

drop policy if exists "Members submit own appeals" on public.appeals;
create policy "Members submit own appeals" on public.appeals
for insert to authenticated with check (appellant_id = (select auth.uid()));

drop policy if exists "Staff review appeals" on public.appeals;
create policy "Staff review appeals" on public.appeals
for update to authenticated using ((select public.is_staff()))
with check ((select public.is_staff()));

-- Only staff can create a moderation record; actor identity comes from the signed-in session.
create or replace function public.record_moderation_action(
  p_target_user_id uuid,
  p_action_type text,
  p_reason text,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare new_id uuid;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Not authorized';
  end if;
  if p_action_type not in ('warning','temporary_ban','permanent_ban','note','lift_ban') then
    raise exception 'Invalid moderation action';
  end if;
  if p_action_type = 'temporary_ban' and p_expires_at is null then
    raise exception 'Temporary bans require an expiry time';
  end if;
  if p_action_type <> 'temporary_ban' and p_expires_at is not null then
    raise exception 'Expiry is only valid for temporary bans';
  end if;
  insert into public.moderation_actions(actor_id,target_user_id,action_type,reason,expires_at)
  values(auth.uid(),p_target_user_id,p_action_type,p_reason,p_expires_at)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.record_moderation_action(uuid,text,text,timestamptz) from public, anon;
grant execute on function public.record_moderation_action(uuid,text,text,timestamptz) to authenticated;

grant insert on public.reports to authenticated;
grant select, update on public.reports to authenticated;
grant select on public.moderation_actions to authenticated;
grant select, insert, update on public.appeals to authenticated;
