-- Tabbit Supabase DB 스키마 (v3 - 모호한 컬럼 참조 수정)
-- Supabase SQL Editor에 전체 복붙 후 Run

-- ============================================================
-- 0. 확장
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- PART A: 테이블 생성
-- ============================================================

create table public.users (
  id            uuid primary key default uuid_generate_v4(),
  display_name  text not null,
  handle        text unique,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.personal_tags (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.users(id) on delete cascade,
  label             text not null,
  normalized_label  text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, normalized_label)
);

create table public.groups (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  description     text,
  member_limit    int not null default 12,
  threshold_rule  text not null default 'ALL'
    check (threshold_rule in ('ALL', 'N_MINUS_1', 'N_MINUS_2')),
  invite_code     text unique default encode(gen_random_bytes(6), 'hex'),
  created_by      uuid not null references public.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.group_members (
  id        uuid primary key default uuid_generate_v4(),
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.users(id) on delete cascade,
  role      text not null default 'member'
    check (role in ('owner', 'member')),
  status    text not null default 'active'
    check (status in ('active', 'left')),
  joined_at timestamptz not null default now(),
  left_at   timestamptz,
  unique (group_id, user_id)
);

create table public.group_tags (
  id                uuid primary key default uuid_generate_v4(),
  group_id          uuid not null references public.groups(id) on delete cascade,
  label             text not null,
  normalized_label  text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (group_id, normalized_label)
);

create table public.certifications (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id),
  image_url       text not null,
  image_width     int not null,
  image_height    int not null,
  caption         text not null default '',
  uploaded_at     timestamptz not null default now(),
  lifestyle_date  date not null,
  editable_until  timestamptz not null,
  status          text not null default 'active'
    check (status in ('active', 'deleted'))
);

create table public.share_targets (
  id                uuid primary key default uuid_generate_v4(),
  certification_id  uuid not null references public.certifications(id) on delete cascade,
  kind              text not null check (kind in ('personal', 'group_tag')),
  lifestyle_date    date not null,
  created_at        timestamptz not null default now(),
  personal_tag_ids  uuid[] default '{}',
  group_id          uuid references public.groups(id),
  group_tag_id      uuid references public.group_tags(id)
);

create table public.certification_comments (
  id                uuid primary key default uuid_generate_v4(),
  certification_id  uuid not null references public.certifications(id) on delete cascade,
  author_id         uuid not null references public.users(id),
  body              text not null,
  x_ratio           real not null,
  y_ratio           real not null,
  text_color        text not null default 'white'
    check (text_color in ('black', 'white')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.threshold_states (
  id                      uuid primary key default uuid_generate_v4(),
  group_id                uuid not null references public.groups(id) on delete cascade,
  group_tag_id            uuid not null references public.group_tags(id) on delete cascade,
  lifestyle_date          date not null,
  eligible_member_count   int not null default 0,
  effective_threshold     int not null default 0,
  certified_member_count  int not null default 0,
  status                  text not null default 'locked'
    check (status in ('locked', 'provisional_unlocked', 'finalized', 'expired')),
  unlocked_at             timestamptz,
  finalized_at            timestamptz,
  unique (group_id, group_tag_id, lifestyle_date)
);

create table public.story_cards (
  id              uuid primary key default uuid_generate_v4(),
  group_id        uuid not null references public.groups(id) on delete cascade,
  group_tag_id    uuid not null references public.group_tags(id) on delete cascade,
  lifestyle_date  date not null,
  status          text not null default 'locked'
    check (status in ('locked', 'provisional', 'finalized', 'revoked')),
  version         int not null default 1,
  unlocked_at     timestamptz,
  finalized_at    timestamptz,
  unique (group_id, group_tag_id, lifestyle_date)
);

create table public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,
  type        text not null
    check (type in (
      'group_invite', 'new_certification', 'certification_comment',
      'group_chat', 'threshold_unlocked', 'story_card_finalized'
    )),
  payload     jsonb not null default '{}',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create table public.chat_messages (
  id          uuid primary key default uuid_generate_v4(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  author_id   uuid not null references public.users(id),
  body        text not null,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- PART B: 인덱스
-- ============================================================
create index idx_share_targets_group_date on public.share_targets (group_id, lifestyle_date)
  where kind = 'group_tag';
create index idx_notifications_user_unread on public.notifications (user_id, created_at desc)
  where read_at is null;
create index idx_chat_messages_group_time on public.chat_messages (group_id, created_at desc);

-- ============================================================
-- PART C: RLS 활성화
-- ============================================================
alter table public.users enable row level security;
alter table public.personal_tags enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_tags enable row level security;
alter table public.certifications enable row level security;
alter table public.share_targets enable row level security;
alter table public.certification_comments enable row level security;
alter table public.threshold_states enable row level security;
alter table public.story_cards enable row level security;
alter table public.notifications enable row level security;
alter table public.chat_messages enable row level security;

-- ============================================================
-- PART D: RLS 정책
-- 모든 컬럼 참조에 테이블명을 명시해서 모호성 제거
-- ============================================================

-- users
create policy "users_select_own" on public.users
  for select using (auth.uid() = users.id);
create policy "users_update_own" on public.users
  for update using (auth.uid() = users.id);

-- personal_tags
create policy "personal_tags_all_own" on public.personal_tags
  for all using (auth.uid() = personal_tags.user_id);

-- groups (서브쿼리에서 group_members 참조)
create policy "groups_select_member" on public.groups
  for select using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = groups.id and gm.user_id = auth.uid() and gm.status = 'active'
    )
  );
create policy "groups_update_owner" on public.groups
  for update using (auth.uid() = groups.created_by);
create policy "groups_insert_auth" on public.groups
  for insert with check (auth.uid() = groups.created_by);

-- group_members (서브쿼리에서 같은 테이블 참조 → 명시적 구분)
create policy "group_members_select_peer" on public.group_members
  for select using (
    exists (
      select 1 from public.group_members gm2
      where gm2.group_id = group_members.group_id
        and gm2.user_id = auth.uid()
        and gm2.status = 'active'
    )
  );
create policy "group_members_insert_self" on public.group_members
  for insert with check (auth.uid() = group_members.user_id);
create policy "group_members_update_self" on public.group_members
  for update using (auth.uid() = group_members.user_id);

-- group_tags
create policy "group_tags_select_member" on public.group_tags
  for select using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_tags.group_id and gm.user_id = auth.uid() and gm.status = 'active'
    )
  );
create policy "group_tags_insert_member" on public.group_tags
  for insert with check (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_tags.group_id and gm.user_id = auth.uid() and gm.status = 'active'
    )
  );

-- certifications
create policy "certifications_all_own" on public.certifications
  for all using (auth.uid() = certifications.user_id);
create policy "certifications_select_group" on public.certifications
  for select using (
    exists (
      select 1 from public.share_targets st
      join public.group_members gm on gm.group_id = st.group_id and gm.status = 'active'
      where st.certification_id = certifications.id and gm.user_id = auth.uid()
    )
  );

-- share_targets
create policy "share_targets_all_owner" on public.share_targets
  for all using (
    exists (
      select 1 from public.certifications c
      where c.id = share_targets.certification_id and c.user_id = auth.uid()
    )
  );
create policy "share_targets_select_group" on public.share_targets
  for select using (
    share_targets.kind = 'group_tag' and exists (
      select 1 from public.group_members gm
      where gm.group_id = share_targets.group_id and gm.user_id = auth.uid() and gm.status = 'active'
    )
  );

-- certification_comments
create policy "cert_comments_select_group" on public.certification_comments
  for select using (
    exists (
      select 1 from public.certifications c
      join public.share_targets st on st.certification_id = c.id and st.kind = 'group_tag'
      join public.group_members gm on gm.group_id = st.group_id and gm.status = 'active'
      where c.id = certification_comments.certification_id and gm.user_id = auth.uid()
    )
  );
create policy "cert_comments_insert_self" on public.certification_comments
  for insert with check (auth.uid() = certification_comments.author_id);
create policy "cert_comments_update_self" on public.certification_comments
  for update using (auth.uid() = certification_comments.author_id);
create policy "cert_comments_delete_self" on public.certification_comments
  for delete using (auth.uid() = certification_comments.author_id);

-- threshold_states
create policy "threshold_states_select_member" on public.threshold_states
  for select using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = threshold_states.group_id and gm.user_id = auth.uid() and gm.status = 'active'
    )
  );

-- story_cards
create policy "story_cards_select_member" on public.story_cards
  for select using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = story_cards.group_id and gm.user_id = auth.uid() and gm.status = 'active'
    )
  );

-- notifications
create policy "notifications_all_own" on public.notifications
  for all using (auth.uid() = notifications.user_id);

-- chat_messages
create policy "chat_select_member" on public.chat_messages
  for select using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = chat_messages.group_id and gm.user_id = auth.uid() and gm.status = 'active'
    )
  );
create policy "chat_insert_member" on public.chat_messages
  for insert with check (
    auth.uid() = chat_messages.author_id and exists (
      select 1 from public.group_members gm
      where gm.group_id = chat_messages.group_id and gm.user_id = auth.uid() and gm.status = 'active'
    )
  );

-- ============================================================
-- PART E: 트리거 & 함수
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'Tabbit 사용자'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.personal_tags
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.groups
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.group_tags
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.certification_comments
  for each row execute function public.set_updated_at();
