-- Sparky's Space: community announcements
-- Review this migration before running it in the Supabase SQL Editor.
-- Public visitors can read published announcements only. Staff access is enforced by public.is_staff().

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 120),
  body text not null check (char_length(trim(body)) between 1 and 5000),
  is_published boolean not null default false,
  is_pinned boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists announcements_public_feed_idx
  on public.announcements (is_published, is_pinned desc, published_at desc);

alter table public.announcements enable row level security;

drop policy if exists "Published announcements are readable by everyone" on public.announcements;
create policy "Published announcements are readable by everyone"
  on public.announcements
  for select
  to anon, authenticated
  using (is_published = true);

drop policy if exists "Staff can read all announcements" on public.announcements;
create policy "Staff can read all announcements"
  on public.announcements
  for select
  to authenticated
  using ((select public.is_staff()));

drop policy if exists "Staff can create announcements" on public.announcements;
create policy "Staff can create announcements"
  on public.announcements
  for insert
  to authenticated
  with check (
    (select public.is_staff())
    and created_by = (select auth.uid())
  );

drop policy if exists "Staff can update announcements" on public.announcements;
create policy "Staff can update announcements"
  on public.announcements
  for update
  to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

drop policy if exists "Staff can delete announcements" on public.announcements;
create policy "Staff can delete announcements"
  on public.announcements
  for delete
  to authenticated
  using ((select public.is_staff()));

grant select on public.announcements to anon, authenticated;
grant insert, update, delete on public.announcements to authenticated;

create or replace function public.set_announcement_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := now();

  if tg_op = 'INSERT' then
    if new.is_published then
      new.published_at := coalesce(new.published_at, now());
    else
      new.published_at := null;
    end if;
  else
    if new.is_published and not old.is_published then
      new.published_at := coalesce(new.published_at, now());
    elsif not new.is_published then
      new.published_at := null;
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists set_announcement_timestamps on public.announcements;
create trigger set_announcement_timestamps
  before insert or update on public.announcements
  for each row
  execute function public.set_announcement_timestamps();

comment on table public.announcements is
  'Staff-managed public community announcements. Drafts are visible only to authorized staff.';
comment on column public.announcements.body is
  'Plain text only; public UI must render this value as text, not HTML.';
