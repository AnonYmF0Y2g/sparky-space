-- Allow signed-in members to track only reports they submitted.
-- Staff access remains governed by the existing staff policy.
drop policy if exists "Members view own reports" on public.reports;
create policy "Members view own reports"
on public.reports
for select
to authenticated
using (reporter_id = (select auth.uid()));

grant select on public.reports to authenticated;
