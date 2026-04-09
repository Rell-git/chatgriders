-- ============================================================
-- LUMI CHAT — Supabase SQL Setup
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── PROFILES ──────────────────────────────────────────────
create table if not exists profiles (
  id               uuid references auth.users on delete cascade primary key,
  phone            text,
  name             text not null,
  middle_name      text,
  surname          text,
  gender           text,
  avatar_category  text not null default 'boy',
  avatar_seed      text not null default 'Felix',
  created_at       timestamptz default now()
);

-- ── WORLD MESSAGES ────────────────────────────────────────
create table if not exists world_messages (
  id         bigint generated always as identity primary key,
  user_id    uuid references profiles(id) on delete cascade not null,
  content    text not null check (char_length(content) <= 500),
  created_at timestamptz default now()
);

-- ── PRIVATE MESSAGES ──────────────────────────────────────
create table if not exists private_messages (
  id          bigint generated always as identity primary key,
  sender_id   uuid references profiles(id) on delete cascade not null,
  receiver_id uuid references profiles(id) on delete cascade not null,
  content     text not null check (char_length(content) <= 500),
  is_read     boolean default false,
  created_at  timestamptz default now()
);

-- ── RLS (Row Level Security) ───────────────────────────────
alter table profiles         enable row level security;
alter table world_messages   enable row level security;
alter table private_messages enable row level security;

-- Profiles: anyone can read, only owner can write
create policy "profiles_select" on profiles
  for select using (true);

create policy "profiles_insert" on profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update" on profiles
  for update using (auth.uid() = id);

-- World messages: authenticated users can read + insert own
create policy "world_select" on world_messages
  for select using (auth.role() = 'authenticated');

create policy "world_insert" on world_messages
  for insert with check (auth.uid() = user_id);

-- Private messages: only sender or receiver can access
create policy "pm_select" on private_messages
  for select using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "pm_insert" on private_messages
  for insert with check (auth.uid() = sender_id);

create policy "pm_update" on private_messages
  for update using (auth.uid() = receiver_id);

-- ── REALTIME ──────────────────────────────────────────────
-- Enable realtime on these tables
alter publication supabase_realtime add table world_messages;
alter publication supabase_realtime add table private_messages;

-- ── OPTIONAL: Index for performance ───────────────────────
create index if not exists idx_world_messages_created on world_messages (created_at desc);
create index if not exists idx_pm_sender   on private_messages (sender_id, created_at desc);
create index if not exists idx_pm_receiver on private_messages (receiver_id, created_at desc);