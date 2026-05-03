-- ============================================================
-- PULSESHIP — supabase_setup.sql
-- Run this ONCE in Supabase → SQL Editor → Run Query
-- Safe to re-run (all statements use IF NOT EXISTS / try/catch)
-- ============================================================

-- ── 1. PROFILES ──────────────────────────────────────────────
create table if not exists profiles (
  id               uuid references auth.users on delete cascade primary key,
  name             text not null default '',
  middle_name      text,
  surname          text not null default '',
  bio              text,
  avatar_seed      text not null default 'Felix',
  avatar_style     text not null default 'adventurer-neutral',
  avatar_url       text,
  user_types       text[] default '{}',
  border_style     text default 'none',
  badge            text default 'none',
  popularity       int default 0,
  user_code        text unique,
  name_changed_at  timestamptz,
  created_at       timestamptz default now()
);

-- Add missing columns to existing tables safely
do $$ begin alter table profiles add column if not exists middle_name text; exception when others then null; end $$;
do $$ begin alter table profiles add column if not exists surname text not null default ''; exception when others then null; end $$;
do $$ begin alter table profiles add column if not exists bio text; exception when others then null; end $$;
do $$ begin alter table profiles add column if not exists avatar_style text not null default 'adventurer-neutral'; exception when others then null; end $$;
do $$ begin alter table profiles add column if not exists avatar_url text; exception when others then null; end $$;
do $$ begin alter table profiles add column if not exists user_types text[] default '{}'; exception when others then null; end $$;
do $$ begin alter table profiles add column if not exists border_style text default 'none'; exception when others then null; end $$;
do $$ begin alter table profiles add column if not exists badge text default 'none'; exception when others then null; end $$;
do $$ begin alter table profiles add column if not exists popularity int default 0; exception when others then null; end $$;
do $$ begin alter table profiles add column if not exists user_code text unique; exception when others then null; end $$;
do $$ begin alter table profiles add column if not exists name_changed_at timestamptz; exception when others then null; end $$;

-- Auto-generate user_code for any profiles that don't have one yet
update profiles
set user_code = lpad(((extract(epoch from created_at)::bigint % 999000) + 1)::text, 6, '0')
where user_code is null;

-- ── 2. WORLD MESSAGES ────────────────────────────────────────
create table if not exists world_messages (
  id         bigint generated always as identity primary key,
  user_id    uuid references profiles(id) on delete cascade not null,
  content    text,
  image_url  text,
  created_at timestamptz default now(),
  constraint wm_has_content check (content is not null or image_url is not null)
);
do $$ begin alter table world_messages add column if not exists image_url text; exception when others then null; end $$;
do $$ begin alter table world_messages alter column content drop not null; exception when others then null; end $$;

-- ── 3. PRIVATE MESSAGES ──────────────────────────────────────
create table if not exists private_messages (
  id          bigint generated always as identity primary key,
  sender_id   uuid references profiles(id) on delete cascade not null,
  receiver_id uuid references profiles(id) on delete cascade not null,
  content     text,
  image_url   text,
  is_read     boolean default false,
  seen_at     timestamptz,
  deleted_by  uuid[],
  created_at  timestamptz default now()
);
do $$ begin alter table private_messages add column if not exists image_url text; exception when others then null; end $$;
do $$ begin alter table private_messages add column if not exists seen_at timestamptz; exception when others then null; end $$;
do $$ begin alter table private_messages add column if not exists deleted_by uuid[]; exception when others then null; end $$;
do $$ begin alter table private_messages alter column content drop not null; exception when others then null; end $$;

-- ── 4. POSTS ─────────────────────────────────────────────────
create table if not exists posts (
  id         bigint generated always as identity primary key,
  user_id    uuid references profiles(id) on delete cascade not null,
  content    text,
  image_url  text,
  created_at timestamptz default now()
);

-- ── 5. GROUP CHATS ───────────────────────────────────────────
create table if not exists group_chats (
  id         bigint generated always as identity primary key,
  name       text not null,
  created_by uuid references profiles(id) on delete cascade,
  expires_at timestamptz,
  created_at timestamptz default now()
);
do $$ begin alter table group_chats add column if not exists expires_at timestamptz; exception when others then null; end $$;

create table if not exists group_members (
  group_id bigint references group_chats(id) on delete cascade,
  user_id  uuid references profiles(id) on delete cascade,
  primary key (group_id, user_id)
);

create table if not exists group_messages (
  id         bigint generated always as identity primary key,
  group_id   bigint references group_chats(id) on delete cascade not null,
  sender_id  uuid references profiles(id) on delete cascade not null,
  content    text,
  image_url  text,
  deleted_by uuid[],
  created_at timestamptz default now()
);
do $$ begin alter table group_messages add column if not exists image_url text; exception when others then null; end $$;
do $$ begin alter table group_messages add column if not exists deleted_by uuid[]; exception when others then null; end $$;
do $$ begin alter table group_messages alter column content drop not null; exception when others then null; end $$;

-- ── 6. PROFILE LIKES ─────────────────────────────────────────
create table if not exists profile_likes (
  liker_id   uuid references profiles(id) on delete cascade,
  liked_id   uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (liker_id, liked_id)
);

-- ── 7. ANON MATCHING ─────────────────────────────────────────
create table if not exists anon_queue (
  user_id   uuid references profiles(id) on delete cascade primary key,
  joined_at timestamptz default now()
);

create table if not exists anon_matches (
  id          bigint generated always as identity primary key,
  user1_id    uuid references profiles(id) on delete cascade,
  user2_id    uuid references profiles(id) on delete cascade,
  user1_heart bool default false,
  user2_heart bool default false,
  connected   bool default false,
  ended_at    timestamptz,
  created_at  timestamptz default now()
);

create table if not exists anon_messages (
  id         bigint generated always as identity primary key,
  match_id   bigint references anon_matches(id) on delete cascade not null,
  slot       int not null,
  content    text not null,
  created_at timestamptz default now()
);

create table if not exists anon_daily (
  user_id uuid references profiles(id) on delete cascade,
  date    text not null,
  count   int default 0,
  primary key (user_id, date)
);

-- ── 8. LEADERBOARD ───────────────────────────────────────────
create table if not exists leaderboard (
  user_id    uuid references profiles(id) on delete cascade primary key,
  user_name  text,
  score      bigint default 0,
  updated_at timestamptz default now()
);

-- ── 9. BRAINLY QUESTIONS ─────────────────────────────────────
create table if not exists brainly_questions (
  id               bigint generated always as identity primary key,
  user_id          uuid references profiles(id) on delete cascade not null,
  subject          text not null,
  question         text not null,
  image_url        text,
  answered         bool default false,
  correct_answerer uuid references profiles(id),
  created_at       timestamptz default now()
);

-- ── 10. NOTIFICATIONS ────────────────────────────────────────
create table if not exists notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid references profiles(id) on delete cascade not null,
  sender_id  uuid references profiles(id) on delete set null,
  type       text not null default 'message',
  message    text not null,
  ref_id     text,
  is_read    bool default false,
  created_at timestamptz default now()
);

-- ── 11. DRAW BATTLES (optional, for future) ──────────────────
create table if not exists draw_battles (
  id            bigint generated always as identity primary key,
  user_id       uuid references profiles(id) on delete cascade not null,
  image_url     text not null,
  prompt        text,
  category      text,
  avg_rating    numeric(3,1) default 0,
  comment_count int default 0,
  created_at    timestamptz default now()
);

create table if not exists draw_ratings (
  draw_id bigint references draw_battles(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  rating  int check (rating between 1 and 5) not null,
  primary key (draw_id, user_id)
);

create table if not exists draw_comments (
  id         bigint generated always as identity primary key,
  draw_id    bigint references draw_battles(id) on delete cascade not null,
  user_id    uuid references profiles(id) on delete cascade not null,
  content    text not null,
  created_at timestamptz default now()
);

-- ══════════════════════════════════════════════════════════════
-- RLS (Row Level Security)
-- ══════════════════════════════════════════════════════════════

alter table profiles         enable row level security;
alter table world_messages   enable row level security;
alter table private_messages enable row level security;
alter table posts             enable row level security;
alter table group_chats      enable row level security;
alter table group_members    enable row level security;
alter table group_messages   enable row level security;
alter table profile_likes    enable row level security;
alter table anon_queue       enable row level security;
alter table anon_matches     enable row level security;
alter table anon_messages    enable row level security;
alter table anon_daily       enable row level security;
alter table leaderboard      enable row level security;
alter table brainly_questions enable row level security;
alter table notifications    enable row level security;
alter table draw_battles     enable row level security;
alter table draw_ratings     enable row level security;
alter table draw_comments    enable row level security;

-- Drop all existing policies (clean slate)
do $$ declare r record; begin
  for r in
    select policyname, tablename from pg_policies
    where tablename in (
      'profiles','world_messages','private_messages','posts',
      'group_chats','group_members','group_messages','profile_likes',
      'anon_queue','anon_matches','anon_messages','anon_daily',
      'leaderboard','brainly_questions','notifications',
      'draw_battles','draw_ratings','draw_comments'
    )
  loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- profiles
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_insert" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on profiles for update using (auth.uid() = id);
create policy "profiles_delete" on profiles for delete using (auth.uid() = id);

-- world_messages
create policy "world_select" on world_messages for select using (auth.role() = 'authenticated');
create policy "world_insert" on world_messages for insert with check (auth.uid() = user_id);
create policy "world_delete" on world_messages for delete using (auth.uid() = user_id);

-- private_messages
create policy "pm_select" on private_messages for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "pm_insert" on private_messages for insert with check (auth.uid() = sender_id);
create policy "pm_update" on private_messages for update using (auth.uid() = receiver_id or auth.uid() = sender_id);
create policy "pm_delete" on private_messages for delete using (auth.uid() = sender_id);

-- posts
create policy "posts_select" on posts for select using (true);
create policy "posts_insert" on posts for insert with check (auth.uid() = user_id);
create policy "posts_delete" on posts for delete using (auth.uid() = user_id);

-- group_chats
create policy "gc_select" on group_chats for select using (true);
create policy "gc_insert" on group_chats for insert with check (auth.uid() = created_by);
create policy "gc_update" on group_chats for update using (auth.uid() = created_by);
create policy "gc_delete" on group_chats for delete using (auth.uid() = created_by);

-- group_members
create policy "gm_select" on group_members for select using (true);
create policy "gm_insert" on group_members for insert with check (true);
create policy "gm_delete" on group_members for delete using (auth.uid() = user_id);

-- group_messages
create policy "gmsg_select" on group_messages for select using (true);
create policy "gmsg_insert" on group_messages for insert with check (auth.uid() = sender_id);
create policy "gmsg_update" on group_messages for update using (auth.uid() = sender_id);
create policy "gmsg_delete" on group_messages for delete using (auth.uid() = sender_id);

-- profile_likes
create policy "pl_select" on profile_likes for select using (true);
create policy "pl_insert" on profile_likes for insert with check (auth.uid() = liker_id);
create policy "pl_delete" on profile_likes for delete using (auth.uid() = liker_id);

-- anon
create policy "aq_all"  on anon_queue    for all to authenticated using (true) with check (auth.uid() = user_id);
create policy "am_sel"  on anon_matches  for select using (auth.uid() = user1_id or auth.uid() = user2_id);
create policy "am_ins"  on anon_matches  for insert with check (auth.uid() = user1_id);
create policy "am_upd"  on anon_matches  for update using (auth.uid() = user1_id or auth.uid() = user2_id);
create policy "amsg_all" on anon_messages for all to authenticated using (true) with check (true);
create policy "ad_all"  on anon_daily    for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- leaderboard
create policy "lb_select" on leaderboard for select using (true);
create policy "lb_insert" on leaderboard for insert with check (auth.uid() = user_id);
create policy "lb_update" on leaderboard for update using (auth.uid() = user_id);

-- brainly_questions
create policy "bq_select" on brainly_questions for select using (true);
create policy "bq_insert" on brainly_questions for insert with check (auth.uid() = user_id);
create policy "bq_update" on brainly_questions for update using (true);

-- notifications
create policy "notif_select" on notifications for select using (auth.uid() = user_id);
create policy "notif_insert" on notifications for insert with check (true);
create policy "notif_update" on notifications for update using (auth.uid() = user_id);
create policy "notif_delete" on notifications for delete using (auth.uid() = user_id);

-- draw_battles
create policy "db_select" on draw_battles for select using (true);
create policy "db_insert" on draw_battles for insert with check (auth.uid() = user_id);
create policy "db_update" on draw_battles for update using (true);
create policy "db_delete" on draw_battles for delete using (auth.uid() = user_id);

create policy "dr_all" on draw_ratings  for all to authenticated using (true) with check (auth.uid() = user_id);
create policy "dc_all" on draw_comments for all to authenticated using (true) with check (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════
-- STORAGE BUCKETS
-- ══════════════════════════════════════════════════════════════

-- Avatars bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Chat images bucket
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do update set public = true;

-- Storage RLS (drop + recreate)
drop policy if exists "avatars_select" on storage.objects;
drop policy if exists "avatars_insert" on storage.objects;
drop policy if exists "avatars_update" on storage.objects;
drop policy if exists "avatars_delete" on storage.objects;
drop policy if exists "chat_images_select" on storage.objects;
drop policy if exists "chat_images_insert" on storage.objects;

create policy "avatars_select" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars_insert" on storage.objects for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
create policy "avatars_update" on storage.objects for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "avatars_delete" on storage.objects for delete using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "chat_images_select" on storage.objects for select using (bucket_id = 'chat-images');
create policy "chat_images_insert" on storage.objects for insert with check (bucket_id = 'chat-images' and auth.role() = 'authenticated');

-- ══════════════════════════════════════════════════════════════
-- REALTIME
-- ══════════════════════════════════════════════════════════════
do $$ begin alter publication supabase_realtime add table world_messages;   exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table private_messages; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table group_messages;   exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table anon_matches;     exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table anon_messages;    exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table anon_queue;       exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table notifications;    exception when others then null; end $$;

-- ══════════════════════════════════════════════════════════════
-- INDEXES (performance)
-- ══════════════════════════════════════════════════════════════
create index if not exists idx_world_created  on world_messages   (created_at desc);
create index if not exists idx_pm_sender      on private_messages (sender_id, created_at desc);
create index if not exists idx_pm_receiver    on private_messages (receiver_id, created_at desc);
create index if not exists idx_gm_group       on group_messages   (group_id, created_at);
create index if not exists idx_posts_user     on posts            (user_id, created_at desc);
create index if not exists idx_notif_user     on notifications    (user_id, created_at desc);
create index if not exists idx_lb_score       on leaderboard      (score desc);

-- ══════════════════════════════════════════════════════════════
-- CLEANUP FUNCTION (auto-delete old world messages > 24h)
-- ══════════════════════════════════════════════════════════════
create or replace function cleanup_world_messages()
returns void language plpgsql security definer as $$
begin
  delete from world_messages where created_at < now() - interval '24 hours';
end;
$$;

-- Done! ✅
-- After running this SQL:
-- 1. Go to Supabase → Storage → create 'avatars' and 'chat-images' buckets (public)
-- 2. Deploy your files to Netlify
-- 3. Register/login at your app URL