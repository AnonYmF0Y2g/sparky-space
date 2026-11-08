create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  caption text not null default '' check (char_length(caption) <= 500),
  tags text[] not null default '{}',
  storage_path text not null unique,
  status text not null default 'pending' check (status in ('pending','approved','rejected','removed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  constraint community_posts_storage_path_owner check (storage_path like user_id::text || '/%')
);
alter table public.community_posts enable row level security;
revoke all on public.community_posts from anon, authenticated;
grant select on public.community_posts to anon, authenticated;
grant insert, delete on public.community_posts to authenticated;
grant update (status, reviewed_at, reviewed_by) on public.community_posts to authenticated;
create policy "Approved community posts are public" on public.community_posts for select to anon, authenticated using (status = 'approved');
create policy "Members can view their own posts" on public.community_posts for select to authenticated using (user_id = (select auth.uid()));
create policy "Staff can review community posts" on public.community_posts for select to authenticated using ((select public.is_staff()));
create policy "Members can submit pending posts" on public.community_posts for insert to authenticated with check (
  user_id = (select auth.uid()) and status = 'pending' and reviewed_at is null and reviewed_by is null
  and storage_path like (select auth.uid())::text || '/%'
);
create policy "Members can delete their pending posts" on public.community_posts for delete to authenticated using (user_id = (select auth.uid()) and status = 'pending');
create policy "Staff can moderate community posts" on public.community_posts for update to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()) and status in ('pending','approved','rejected','removed'));
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-images', 'community-images', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
create policy "Community images are readable when approved or owned" on storage.objects for select to anon, authenticated
using (
  bucket_id = 'community-images' and (
    exists (select 1 from public.community_posts p where p.storage_path = storage.objects.name and p.status = 'approved')
    or ((select auth.uid()) is not null and (storage.foldername(name))[1] = (select auth.uid())::text)
    or ((select auth.uid()) is not null and (select public.is_staff()))
  )
);
create policy "Members upload community images to their folder" on storage.objects for insert to authenticated
with check (
  bucket_id = 'community-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(coalesce(metadata->>'mimetype','')) in ('image/jpeg','image/png','image/webp')
);
create policy "Members delete their own community images" on storage.objects for delete to authenticated
using (
  bucket_id = 'community-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (select 1 from public.community_posts p where p.storage_path = storage.objects.name and p.status = 'approved')
);
