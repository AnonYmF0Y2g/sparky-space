drop policy if exists "Staff can moderate community posts" on public.community_posts;
create policy "Staff can moderate community posts"
on public.community_posts for update to authenticated
using ((select public.is_staff()))
with check (
  (select public.is_staff())
  and reviewed_by = (select auth.uid())
  and reviewed_at is not null
  and status in ('pending','approved','rejected','removed')
);
