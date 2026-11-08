revoke insert on public.community_posts from authenticated;
drop policy if exists "Members can submit pending posts" on public.community_posts;
drop policy if exists "Approved community posts are public" on public.community_posts;
drop policy if exists "Members can view their own posts" on public.community_posts;
drop policy if exists "Staff can review community posts" on public.community_posts;
create policy "Community posts visible to public owners and staff"
on public.community_posts for select to anon, authenticated
using (
  status = 'approved'
  or ((select auth.uid()) is not null and user_id = (select auth.uid()))
  or ((select auth.uid()) is not null and (select public.is_staff()))
);
create index if not exists community_posts_user_created_idx on public.community_posts (user_id, created_at desc);
create index if not exists community_posts_status_created_idx on public.community_posts (status, created_at asc);
create index if not exists community_posts_reviewed_by_idx on public.community_posts (reviewed_by);
