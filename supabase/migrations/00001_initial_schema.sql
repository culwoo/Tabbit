-- Tabbit Supabase DB 스키마
-- domain/types.ts 기반 물리 매핑
-- 실행 순서: 이 파일 전체를 Supabase SQL Editor에 한 번에 실행

-- ============================================================
-- 0. 확장 및 유틸
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. users
-- ============================================================
create table public.users (
  id            uuid primary key default uuid_generate_v4(),
  display_name  text not null,
  handle        text unique,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.users enable row level security;

-- 본인 행만 읽기/수정
create policy "users: 본인 읽기" on public.users
  for select using (auth.uid() = id);
create policy "users: 본인 수정" on public.users
  for update using (auth.uid() = id);
-- 회원가입 시 자동 insert는 트리거로 처리 (아래 참조)

-- ============================================================
-- 2. personal_tags
-- ============================================================
create table public.personal_tags (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.users(id) on delete cascade,
  label             text not null,
  normalized_label  text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, normalized_label)
);

alter table public.personal_tags enable row level security;

create policy "personal_tags: 본인 CRUD" on public.personal_tags
  for all using (auth.uid() = user_id);

-- ============================================================
-- 3. groups
-- ============================================================
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

alter table public.groups enable row level security;

-- 멤버만 읽기 가능
create policy "groups: 멤버 읽기" on public.groups
  for select using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = id and gm.user_id = auth.uid() and gm.status = 'active'
    )
  );

-- 생성자만 수정
create policy "groups: 생성자 수정" on public.groups
  for update using (auth.uid() = created_by);

-- 인증된 사용자 누구나 그룹 생성 가능
create policy "groups: 생성" on public.groups
  for insert with check (auth.uid() = created_by);

-- ============================================================
-- 4. group_members
-- ============================================================
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

alter table public.group_members enable row level security;

-- 같은 그룹 멤버끼리 읽기
create policy "group_members: 그룹 멤버 읽기" on public.group_members
  for select using (
    exists (
      select 1 from public.group_members gm2
      where gm2.group_id = group_id and gm2.user_id = auth.uid() and gm2.status = 'active'
    )
  );

-- 본인이 참여/탈퇴
create policy "group_members: 본인 참여" on public.group_members
  for insert with check (auth.uid() = user_id);
create policy "group_members: 본인 탈퇴" on public.group_members
  for update using (auth.uid() = user_id);

-- ============================================================
-- 5. group_tags
-- ============================================================
create table public.group_tags (
  id                uuid primary key default uuid_generate_v4(),
  group_id          uuid not null references public.groups(id) on delete cascade,
  label             text not null,
  normalized_label  text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (group_id, normalized_label)
);

alter table public.group_tags enable row level security;

create policy "group_tags: 그룹 멤버 읽기" on public.group_tags
  for select using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid() and gm.status = 'active'
    )
  );

create policy "group_tags: 그룹 멤버 생성" on public.group_tags
  for insert with check (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid() and gm.status = 'active'
    )
  );

-- ============================================================
-- 6. certifications
-- ============================================================
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

alter table public.certifications enable row level security;

-- 본인 인증 CRUD
create policy "certifications: 본인 전체 권한" on public.certifications
  for all using (auth.uid() = user_id);

-- 같은 그룹 멤버가 공유된 인증 읽기
create policy "certifications: 그룹 멤버 읽기" on public.certifications
  for select using (
    exists (
      select 1 from public.share_targets st
      join public.group_members gm on gm.group_id = st.group_id and gm.status = 'active'
      where st.certification_id = id and gm.user_id = auth.uid()
    )
  );

-- ============================================================
-- 7. share_targets (fan-out)
-- ============================================================
create table public.share_targets (
  id                uuid primary key default uuid_generate_v4(),
  certification_id  uuid not null references public.certifications(id) on delete cascade,
  kind              text not null check (kind in ('personal', 'group_tag')),
  lifestyle_date    date not null,
  created_at        timestamptz not null default now(),
  -- personal용
  personal_tag_ids  uuid[] default '{}',
  -- group_tag용
  group_id          uuid references public.groups(id),
  group_tag_id      uuid references public.group_tags(id)
);

create index idx_share_targets_group_date on public.share_targets (group_id, lifestyle_date)
  where kind = 'group_tag';

alter table public.share_targets enable row level security;

create policy "share_targets: 인증 소유자 전체 권한" on public.share_targets
  for all using (
    exists (
      select 1 from public.certifications c
      where c.id = certification_id and c.user_id = auth.uid()
    )
  );

create policy "share_targets: 그룹 멤버 읽기" on public.share_targets
  for select using (
    kind = 'group_tag' and exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid() and gm.status = 'active'
    )
  );

-- ============================================================
-- 8. certification_comments
-- ============================================================
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

alter table public.certification_comments enable row level security;

-- 같은 그룹 멤버가 읽기/작성
create policy "certification_comments: 그룹 멤버 읽기" on public.certification_comments
  for select using (
    exists (
      select 1 from public.certifications c
      join public.share_targets st on st.certification_id = c.id and st.kind = 'group_tag'
      join public.group_members gm on gm.group_id = st.group_id and gm.status = 'active'
      where c.id = certification_id and gm.user_id = auth.uid()
    )
  );

create policy "certification_comments: 본인 작성" on public.certification_comments
  for insert with check (auth.uid() = author_id);

create policy "certification_comments: 본인 수정/삭제" on public.certification_comments
  for update using (auth.uid() = author_id);

create policy "certification_comments: 본인 삭제" on public.certification_comments
  for delete using (auth.uid() = author_id);

-- ============================================================
-- 9. threshold_states
-- ============================================================
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

alter table public.threshold_states enable row level security;

create policy "threshold_states: 그룹 멤버 읽기" on public.threshold_states
  for select using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid() and gm.status = 'active'
    )
  );

-- ============================================================
-- 10. story_cards
-- ============================================================
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

alter table public.story_cards enable row level security;

create policy "story_cards: 그룹 멤버 읽기" on public.story_cards
  for select using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid() and gm.status = 'active'
    )
  );

-- ============================================================
-- 11. notifications
-- ============================================================
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

create index idx_notifications_user_unread on public.notifications (user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

create policy "notifications: 본인만" on public.notifications
  for all using (auth.uid() = user_id);

-- ============================================================
-- 12. chat_messages
-- ============================================================
create table public.chat_messages (
  id          uuid primary key default uuid_generate_v4(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  author_id   uuid not null references public.users(id),
  body        text not null,
  created_at  timestamptz not null default now()
);

create index idx_chat_messages_group_time on public.chat_messages (group_id, created_at desc);

alter table public.chat_messages enable row level security;

create policy "chat_messages: 그룹 멤버 읽기" on public.chat_messages
  for select using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid() and gm.status = 'active'
    )
  );

create policy "chat_messages: 그룹 멤버 전송" on public.chat_messages
  for insert with check (
    auth.uid() = author_id and exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid() and gm.status = 'active'
    )
  );

-- ============================================================
-- 13. 유틸리티 함수 & 트리거
-- ============================================================

-- 회원가입 시 users 테이블 자동 생성
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

-- updated_at 자동 갱신
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

-- ============================================================
-- 14. Storage 버킷
-- ============================================================
-- Supabase 대시보드에서 실행하거나 아래 SQL 사용:
-- insert into storage.buckets (id, name, public)
-- values ('certifications', 'certifications', false);
--
-- Storage RLS는 대시보드에서 설정 추천:
-- - INSERT: auth.uid()가 존재하면 허용
-- - SELECT: 같은 그룹 멤버면 허용
-- - DELETE: 본인 파일만 허용

-- ============================================================
-- 15. Realtime 구독 설정
-- ============================================================
-- Supabase 대시보드에서 다음 테이블의 Realtime을 켜세요:
-- - chat_messages
-- - certifications (+ share_targets)
-- - threshold_states
