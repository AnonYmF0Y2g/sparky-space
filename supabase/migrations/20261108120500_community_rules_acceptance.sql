alter table public.community_posts
  add column if not exists rules_version text not null default '2026-11-08';
alter table public.community_posts
  add column if not exists rules_accepted_at timestamptz not null default now();
