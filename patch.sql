-- ============================================================
-- PULSESHIP — patch.sql  (Ultra-safe. Each block self-contained)
-- Run in: Supabase → SQL Editor → Run
-- ============================================================

-- 1. profiles columns
do $$ begin alter table profiles add column surname text default ''; exception when others then null; end $$;
do $$ begin alter table profiles add column bio text; exception when others then null; end $$;
do $$ begin alter table profiles add column user_types text[] default '{}'; exception when others then null; end $$;
do $$ begin alter table profiles add column avatar_url text; exception when others then null; end $$;
do $$ begin alter table profiles add column border_style text default 'none'; exception when others then null; end $$;
do $$ begin alter table profiles add column badge text default 'none'; exception when others then null; end $$;
do $$ begin alter table profiles add column name_changed_at timestamptz; exception when others then null; end $$;

-- 2. world_messages
do $$ begin alter table world_messages alter column content drop not null; exception when others then null; end $$;
do $$ begin alter table world_messages add column image_url text; exception when others then null; end $$;
do $$ begin alter table world_messages drop constraint content_or_image; exception when others then null; end $$;
do $$ begin alter table world_messages drop constraint wm_content; exception when others then null; end $$;
do $$ begin alter table world_messages add constraint wm_content check (content is not null or image_url is not null); exception when others then null; end $$;

-- 3. private_messages
do $$ begin alter table private_messages alter column content drop not null; exception when others then null; end $$;
do $$ begin alter table private_messages add column image_url text; exception when others then null; end $$;
do $$ begin alter table private_messages add column seen_at timestamptz; exception when others then null; end $$;
do $$ begin alter table private_messages add column deleted_by uuid[]; exception when others then null; end $$;
do $$ begin alter table private_messages drop constraint pm_content; exception when others then null; end $$;
do $$ begin alter table private_messages drop constraint content_or_image; exception when others then null; end $$;
do $$ begin alter table private_messages add constraint pm_content check (content is not null or image_url is not null); exception when others then null; end $$;

-- 4. user_code trigger
create sequence if not exists user_code_seq start 1;
create or replace function assign_user_code() returns trigger language plpgsql as $fn$
begin
  if new.user_code is null then
    new.user_code := lpad(nextval('user_code_seq')::text, 6, '0');
  end if;
  return new;
end;
$fn$;
drop trigger if exists trg_user_code on profiles;
create trigger trg_user_code before insert on profiles for each row execute function assign_user_code();
do $$
declare r record;
begin
  for r in select id from profiles where user_code is null loop
    update profiles set user_code = lpad(nextval('user_code_seq')::text,6,'0') where id = r.id;
  end loop;
end $$;

-- 5. new tables
create table if not exists posts (id bigint generated always as identity primary key, user_id uuid references profiles(id) on delete cascade not null, content text, image_url text, created_at timestamptz default now());
create table if not exists group_chats (id bigint generated always as identity primary key, name text not null, created_by uuid references profiles(id) on delete cascade not null, created_at timestamptz default now());
create table if not exists group_members (group_id bigint references group_chats(id) on delete cascade not null, user_id uuid references profiles(id) on delete cascade not null, joined_at timestamptz default now(), primary key (group_id, user_id));
create table if not exists group_messages (id bigint generated always as identity primary key, group_id bigint references group_chats(id) on delete cascade not null, sender_id uuid references profiles(id) on delete cascade not null, content text, image_url text, deleted_by uuid[], created_at timestamptz default now());
create table if not exists anon_queue (user_id uuid references profiles(id) on delete cascade primary key, joined_at timestamptz default now());
create table if not exists anon_matches (id bigint generated always as identity primary key, user1_id uuid references profiles(id) on delete cascade not null, user2_id uuid references profiles(id) on delete cascade not null, started_at timestamptz default now(), ended_at timestamptz, user1_heart boolean default false, user2_heart boolean default false, connected boolean default false);
create table if not exists anon_messages (id bigint generated always as identity primary key, match_id bigint references anon_matches(id) on delete cascade not null, slot int not null, content text not null, created_at timestamptz default now());
create table if not exists anon_daily (user_id uuid not null, date date not null default current_date, count int default 0, primary key (user_id, date));
create table if not exists leaderboard (user_id uuid references profiles(id) on delete cascade primary key, user_name text, score bigint default 0, updated_at timestamptz default now());
create table if not exists draw_strokes (id bigint generated always as identity primary key, room_id text not null default 'world', user_id uuid references profiles(id) on delete cascade not null, data jsonb not null, created_at timestamptz default now());

-- 6. RLS enable
do $$ begin alter table posts enable row level security; exception when others then null; end $$;
do $$ begin alter table group_chats enable row level security; exception when others then null; end $$;
do $$ begin alter table group_members enable row level security; exception when others then null; end $$;
do $$ begin alter table group_messages enable row level security; exception when others then null; end $$;
do $$ begin alter table anon_queue enable row level security; exception when others then null; end $$;
do $$ begin alter table anon_matches enable row level security; exception when others then null; end $$;
do $$ begin alter table anon_messages enable row level security; exception when others then null; end $$;
do $$ begin alter table anon_daily enable row level security; exception when others then null; end $$;
do $$ begin alter table leaderboard enable row level security; exception when others then null; end $$;
do $$ begin alter table draw_strokes enable row level security; exception when others then null; end $$;

-- 7. Drop & recreate policies
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where tablename in ('profiles','world_messages','private_messages','posts','group_chats','group_members','group_messages','anon_queue','anon_matches','anon_messages','anon_daily','leaderboard','draw_strokes') loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

create policy "p_sel"    on profiles        for select  to authenticated using (true);
create policy "p_ins"    on profiles        for insert  to authenticated with check (auth.uid()=id);
create policy "p_upd"    on profiles        for update  to authenticated using (auth.uid()=id);
create policy "wm_sel"   on world_messages  for select  to authenticated using (true);
create policy "wm_ins"   on world_messages  for insert  to authenticated with check (auth.uid()=user_id);
create policy "wm_del"   on world_messages  for delete  to authenticated using (true);
create policy "pm_sel"   on private_messages for select to authenticated using (auth.uid()=sender_id or auth.uid()=receiver_id);
create policy "pm_ins"   on private_messages for insert to authenticated with check (auth.uid()=sender_id);
create policy "pm_upd"   on private_messages for update to authenticated using (auth.uid()=sender_id or auth.uid()=receiver_id);
create policy "post_sel" on posts for select to authenticated using (true);
create policy "post_ins" on posts for insert to authenticated with check (auth.uid()=user_id);
create policy "post_del" on posts for delete to authenticated using (auth.uid()=user_id);
create policy "gc_sel"   on group_chats for select to authenticated using (exists(select 1 from group_members where group_id=group_chats.id and user_id=auth.uid()) or created_by=auth.uid());
create policy "gc_ins"   on group_chats for insert to authenticated with check (auth.uid()=created_by);
create policy "gm_sel"   on group_members for select to authenticated using (true);
create policy "gm_ins"   on group_members for insert to authenticated with check (user_id=auth.uid() or exists(select 1 from group_chats where id=group_id and created_by=auth.uid()) or exists(select 1 from group_members g2 where g2.group_id=group_members.group_id and g2.user_id=auth.uid()));
create policy "gmsg_sel" on group_messages for select to authenticated using (exists(select 1 from group_members where group_id=group_messages.group_id and user_id=auth.uid()));
create policy "gmsg_ins" on group_messages for insert to authenticated with check (auth.uid()=sender_id and exists(select 1 from group_members where group_id=group_messages.group_id and user_id=auth.uid()));
create policy "gmsg_upd" on group_messages for update to authenticated using (true);
create policy "aq_all"   on anon_queue    for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "am_sel"   on anon_matches  for select to authenticated using (auth.uid()=user1_id or auth.uid()=user2_id);
create policy "am_ins"   on anon_matches  for insert to authenticated with check (true);
create policy "am_upd"   on anon_matches  for update to authenticated using (auth.uid()=user1_id or auth.uid()=user2_id);
create policy "amsg_sel" on anon_messages for select to authenticated using (exists(select 1 from anon_matches where id=match_id and (user1_id=auth.uid() or user2_id=auth.uid())));
create policy "amsg_ins" on anon_messages for insert to authenticated with check (true);
create policy "ad_all"   on anon_daily for all to authenticated using (true) with check (true);
create policy "lb_sel"   on leaderboard for select to authenticated using (true);
create policy "lb_ins"   on leaderboard for insert to authenticated with check (auth.uid()=user_id);
create policy "lb_upd"   on leaderboard for update to authenticated using (auth.uid()=user_id);
create policy "dr_sel"   on draw_strokes for select to authenticated using (true);
create policy "dr_ins"   on draw_strokes for insert to authenticated with check (auth.uid()=user_id);
create policy "dr_del"   on draw_strokes for delete to authenticated using (true);

-- 8. Storage
insert into storage.buckets(id,name,public) values('chat-images','chat-images',true) on conflict do nothing;
insert into storage.buckets(id,name,public) values('avatars','avatars',true) on conflict do nothing;
do $$ declare r record; begin for r in select policyname from pg_policies where tablename='objects' and schemaname='storage' loop execute 'drop policy if exists "' || r.policyname || '" on storage.objects'; end loop; end $$;
create policy "s_sel" on storage.objects for select using (bucket_id in ('chat-images','avatars'));
create policy "s_ins" on storage.objects for insert to authenticated with check (bucket_id in ('chat-images','avatars'));
create policy "s_del" on storage.objects for delete to authenticated using (bucket_id in ('chat-images','avatars'));

-- 9. Realtime (safe)
do $$ begin alter publication supabase_realtime add table world_messages;   exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table private_messages; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table group_messages;   exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table anon_messages;    exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table anon_matches;     exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table anon_queue;       exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table draw_strokes;     exception when others then null; end $$;

-- 10. World cleanup
create or replace function cleanup_world_messages() returns void language plpgsql security definer as $$ begin delete from world_messages where created_at < now() - interval '8 hours'; end; $$;

-- 11. Indexes
create index if not exists idx_wm_created  on world_messages(created_at desc);
create index if not exists idx_pm_sender   on private_messages(sender_id, created_at desc);
create index if not exists idx_pm_receiver on private_messages(receiver_id, created_at desc);
create index if not exists idx_user_code   on profiles(user_code);
create index if not exists idx_draw_room   on draw_strokes(room_id, created_at desc);