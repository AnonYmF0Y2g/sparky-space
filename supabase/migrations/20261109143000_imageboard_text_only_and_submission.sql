-- Text-only imageboard threads are supported by the current submission UI.
-- A NULL storage_path represents a thread with no attached image.
alter table public.community_posts
  alter column storage_path drop not null;
