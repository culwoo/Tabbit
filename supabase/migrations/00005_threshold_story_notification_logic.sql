-- ============================================================
-- 00005_threshold_story_notification_logic.sql
-- 인증 공유 대상 변경에 따라 threshold_states, story_cards, notifications를
-- 서버에서 자동 갱신한다.
-- ============================================================

-- StoryCard가 어떤 멤버/인증 조합으로 생성됐는지 추적해야 version 증가 여부를
-- 안정적으로 판단할 수 있다.
alter table public.story_cards
  add column if not exists contributor_user_ids uuid[] not null default '{}'::uuid[],
  add column if not exists certification_ids uuid[] not null default '{}'::uuid[],
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_group_members_group_life_window
  on public.group_members (group_id, joined_at, left_at);

create index if not exists idx_certifications_active_life_user_uploaded
  on public.certifications (lifestyle_date, user_id, uploaded_at desc)
  where status = 'active';

create index if not exists idx_notifications_story_events
  on public.notifications (user_id, type, created_at desc)
  where type in ('new_certification', 'threshold_unlocked', 'story_card_finalized');

create or replace function public.lifestyle_date_starts_at(target_lifestyle_date date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select make_timestamptz(
    extract(year from target_lifestyle_date)::int,
    extract(month from target_lifestyle_date)::int,
    extract(day from target_lifestyle_date)::int,
    5,
    0,
    0,
    'Asia/Seoul'
  );
$$;

create or replace function public.resolve_effective_threshold(
  target_threshold_rule text,
  target_eligible_member_count int
)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(target_eligible_member_count, 0) <= 0 then 0
    when target_threshold_rule = 'N_MINUS_1' then greatest(1, target_eligible_member_count - 1)
    when target_threshold_rule = 'N_MINUS_2' then greatest(1, target_eligible_member_count - 2)
    else target_eligible_member_count
  end;
$$;

create or replace function public.notification_exists_for_story_event(
  target_user_id uuid,
  target_type text,
  target_group_id uuid,
  target_group_tag_id uuid,
  target_lifestyle_date date,
  target_story_version int,
  target_certification_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.notifications n
    where n.user_id = target_user_id
      and n.type = target_type
      and n.payload ->> 'groupId' = target_group_id::text
      and n.payload ->> 'groupTagId' = target_group_tag_id::text
      and n.payload ->> 'lifestyleDate' = target_lifestyle_date::text
      and (
        target_story_version is null
        or n.payload ->> 'storyVersion' = target_story_version::text
      )
      and (
        target_certification_id is null
        or n.payload ->> 'certificationId' = target_certification_id::text
      )
  );
$$;

create or replace function public.notify_group_certification(
  target_group_id uuid,
  target_group_tag_id uuid,
  target_lifestyle_date date,
  target_certification_id uuid,
  target_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_name text;
  v_tag_label text;
  v_actor_name text;
begin
  if target_actor_user_id is null then
    return;
  end if;

  select g.name, gt.label
  into v_group_name, v_tag_label
  from public.groups g
  join public.group_tags gt
    on gt.group_id = g.id
   and gt.id = target_group_tag_id
  where g.id = target_group_id;

  select u.display_name
  into v_actor_name
  from public.users u
  where u.id = target_actor_user_id;

  insert into public.notifications (user_id, type, payload)
  select
    gm.user_id,
    'new_certification',
    jsonb_build_object(
      'groupId', target_group_id::text,
      'groupTagId', target_group_tag_id::text,
      'lifestyleDate', target_lifestyle_date::text,
      'certificationId', target_certification_id::text,
      'message', coalesce(v_actor_name, '멤버') || '님이 ' || coalesce(v_tag_label, '태그') || ' 인증을 올렸어요.',
      'groupName', coalesce(v_group_name, ''),
      'tagLabel', coalesce(v_tag_label, '')
    )
  from public.group_members gm
  where gm.group_id = target_group_id
    and gm.status = 'active'
    and gm.user_id <> target_actor_user_id
    and not public.notification_exists_for_story_event(
      gm.user_id,
      'new_certification',
      target_group_id,
      target_group_tag_id,
      target_lifestyle_date,
      null,
      target_certification_id
    );
end;
$$;

create or replace function public.notify_threshold_story_event(
  target_type text,
  target_group_id uuid,
  target_group_tag_id uuid,
  target_lifestyle_date date,
  target_threshold_state_id uuid,
  target_story_card_id uuid,
  target_story_version int,
  target_actor_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_name text;
  v_tag_label text;
  v_message text;
begin
  if target_type not in ('threshold_unlocked', 'story_card_finalized') then
    raise exception '지원하지 않는 알림 타입입니다: %', target_type
      using errcode = '22023';
  end if;

  select g.name, gt.label
  into v_group_name, v_tag_label
  from public.groups g
  join public.group_tags gt
    on gt.group_id = g.id
   and gt.id = target_group_tag_id
  where g.id = target_group_id;

  v_message := case
    when target_type = 'threshold_unlocked'
      then coalesce(v_tag_label, '태그') || ' 그룹 스토리가 열렸어요.'
    else coalesce(v_tag_label, '태그') || ' 스토리가 오전 5시 기준으로 확정됐어요.'
  end;

  insert into public.notifications (user_id, type, payload)
  select
    gm.user_id,
    target_type,
    jsonb_build_object(
      'groupId', target_group_id::text,
      'groupTagId', target_group_tag_id::text,
      'lifestyleDate', target_lifestyle_date::text,
      'thresholdStateId', target_threshold_state_id::text,
      'storyCardId', target_story_card_id::text,
      'storyVersion', target_story_version,
      'message', v_message,
      'groupName', coalesce(v_group_name, ''),
      'tagLabel', coalesce(v_tag_label, '')
    )
  from public.group_members gm
  where gm.group_id = target_group_id
    and gm.status = 'active'
    and (
      target_actor_user_id is null
      or gm.user_id <> target_actor_user_id
    )
    and not public.notification_exists_for_story_event(
      gm.user_id,
      target_type,
      target_group_id,
      target_group_tag_id,
      target_lifestyle_date,
      target_story_version,
      null
    );
end;
$$;

create or replace function public.recalculate_threshold_state(
  target_group_id uuid,
  target_group_tag_id uuid,
  target_lifestyle_date date,
  target_actor_user_id uuid default null,
  force_finalize boolean default false,
  emit_notifications boolean default true
)
returns public.threshold_states
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.groups;
  v_threshold public.threshold_states;
  v_previous_threshold public.threshold_states;
  v_story public.story_cards;
  v_previous_story public.story_cards;
  v_life_day_start timestamptz;
  v_editable_until timestamptz;
  v_should_finalize boolean;
  v_eligible_count int := 0;
  v_effective_threshold int := 0;
  v_certified_count int := 0;
  v_contributor_user_ids uuid[] := '{}'::uuid[];
  v_certification_ids uuid[] := '{}'::uuid[];
  v_meets_threshold boolean := false;
  v_new_threshold_status text;
  v_new_story_status text;
  v_story_version int;
  v_previously_unlocked boolean := false;
  v_unlock_started boolean := false;
  v_finalized_now boolean := false;
  v_now timestamptz := now();
begin
  select *
  into v_group
  from public.groups g
  where g.id = target_group_id;

  if not found then
    raise exception '그룹을 찾을 수 없습니다: %', target_group_id
      using errcode = '23503';
  end if;

  if not exists (
    select 1
    from public.group_tags gt
    where gt.id = target_group_tag_id
      and gt.group_id = target_group_id
  ) then
    raise exception '그룹 태그가 그룹에 속하지 않습니다: %', target_group_tag_id
      using errcode = '23503';
  end if;

  select *
  into v_previous_threshold
  from public.threshold_states ts
  where ts.group_id = target_group_id
    and ts.group_tag_id = target_group_tag_id
    and ts.lifestyle_date = target_lifestyle_date
  for update;

  select *
  into v_previous_story
  from public.story_cards sc
  where sc.group_id = target_group_id
    and sc.group_tag_id = target_group_tag_id
    and sc.lifestyle_date = target_lifestyle_date
  for update;

  v_life_day_start := public.lifestyle_date_starts_at(target_lifestyle_date);
  v_editable_until := public.certification_editable_until(target_lifestyle_date);
  v_should_finalize :=
    force_finalize
    or v_now >= v_editable_until
    or v_previous_threshold.status in ('finalized', 'expired');

  select count(distinct gm.user_id)::int
  into v_eligible_count
  from public.group_members gm
  where gm.group_id = target_group_id
    and gm.joined_at <= v_life_day_start
    and (
      gm.left_at is null
      or gm.left_at > v_life_day_start
    );

  with eligible_members as (
    select distinct gm.user_id
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.joined_at <= v_life_day_start
      and (
        gm.left_at is null
        or gm.left_at > v_life_day_start
      )
  ),
  latest_certifications as (
    select distinct on (c.user_id)
      c.user_id,
      c.id,
      c.uploaded_at
    from public.share_targets st
    join public.certifications c
      on c.id = st.certification_id
    join eligible_members em
      on em.user_id = c.user_id
    where st.kind = 'group_tag'
      and st.group_id = target_group_id
      and st.group_tag_id = target_group_tag_id
      and st.lifestyle_date = target_lifestyle_date
      and c.lifestyle_date = target_lifestyle_date
      and c.status = 'active'
    order by c.user_id, c.uploaded_at desc, c.id desc
  )
  select
    count(*)::int,
    coalesce(array_agg(user_id order by user_id), '{}'::uuid[]),
    coalesce(array_agg(id order by uploaded_at desc, id), '{}'::uuid[])
  into v_certified_count, v_contributor_user_ids, v_certification_ids
  from latest_certifications;

  v_effective_threshold := public.resolve_effective_threshold(
    v_group.threshold_rule,
    v_eligible_count
  );
  v_meets_threshold := v_effective_threshold > 0
    and v_certified_count >= v_effective_threshold;

  v_new_threshold_status := case
    when v_should_finalize and v_meets_threshold then 'finalized'
    when v_should_finalize then 'expired'
    when v_meets_threshold then 'provisional_unlocked'
    else 'locked'
  end;

  insert into public.threshold_states (
    group_id,
    group_tag_id,
    lifestyle_date,
    eligible_member_count,
    effective_threshold,
    certified_member_count,
    status,
    unlocked_at,
    finalized_at
  )
  values (
    target_group_id,
    target_group_tag_id,
    target_lifestyle_date,
    v_eligible_count,
    v_effective_threshold,
    v_certified_count,
    v_new_threshold_status,
    case
      when v_meets_threshold then coalesce(v_previous_threshold.unlocked_at, v_now)
      else null
    end,
    case
      when v_should_finalize then coalesce(v_previous_threshold.finalized_at, v_now)
      else null
    end
  )
  on conflict (group_id, group_tag_id, lifestyle_date)
  do update set
    eligible_member_count = excluded.eligible_member_count,
    effective_threshold = excluded.effective_threshold,
    certified_member_count = excluded.certified_member_count,
    status = excluded.status,
    unlocked_at = excluded.unlocked_at,
    finalized_at = excluded.finalized_at
  returning * into v_threshold;

  v_previously_unlocked :=
    v_previous_threshold.status in ('provisional_unlocked', 'finalized')
    or v_previous_threshold.unlocked_at is not null
    or v_previous_story.status in ('provisional', 'finalized', 'revoked')
    or v_previous_story.unlocked_at is not null;

  if v_meets_threshold then
    v_new_story_status := case
      when v_should_finalize then 'finalized'
      else 'provisional'
    end;

    v_story_version := case
      when v_previous_story.id is null then 1
      when v_previous_story.status = 'revoked' then v_previous_story.version + 1
      when v_previous_story.certification_ids is distinct from v_certification_ids then v_previous_story.version + 1
      else v_previous_story.version
    end;
  else
    v_new_story_status := case
      when v_should_finalize then 'locked'
      when v_previously_unlocked then 'revoked'
      else 'locked'
    end;
    v_story_version := coalesce(v_previous_story.version, 1);
  end if;

  if v_meets_threshold or v_previous_story.id is not null then
    insert into public.story_cards (
      group_id,
      group_tag_id,
      lifestyle_date,
      status,
      version,
      unlocked_at,
      finalized_at,
      contributor_user_ids,
      certification_ids,
      updated_at
    )
    values (
      target_group_id,
      target_group_tag_id,
      target_lifestyle_date,
      v_new_story_status,
      v_story_version,
      case
        when v_meets_threshold then coalesce(v_previous_story.unlocked_at, v_now)
        else v_previous_story.unlocked_at
      end,
      case
        when v_should_finalize and v_meets_threshold then coalesce(v_previous_story.finalized_at, v_now)
        else null
      end,
      v_contributor_user_ids,
      v_certification_ids,
      v_now
    )
    on conflict (group_id, group_tag_id, lifestyle_date)
    do update set
      status = excluded.status,
      version = excluded.version,
      unlocked_at = excluded.unlocked_at,
      finalized_at = excluded.finalized_at,
      contributor_user_ids = excluded.contributor_user_ids,
      certification_ids = excluded.certification_ids,
      updated_at = excluded.updated_at
    returning * into v_story;
  end if;

  v_unlock_started :=
    emit_notifications
    and v_new_threshold_status = 'provisional_unlocked'
    and coalesce(v_previous_threshold.status, 'locked') <> 'provisional_unlocked';

  v_finalized_now :=
    emit_notifications
    and v_new_threshold_status = 'finalized'
    and coalesce(v_previous_threshold.status, 'locked') <> 'finalized'
    and v_story.id is not null;

  if v_unlock_started and v_story.id is not null then
    perform public.notify_threshold_story_event(
      'threshold_unlocked',
      target_group_id,
      target_group_tag_id,
      target_lifestyle_date,
      v_threshold.id,
      v_story.id,
      v_story.version,
      target_actor_user_id
    );
  end if;

  if v_finalized_now then
    perform public.notify_threshold_story_event(
      'story_card_finalized',
      target_group_id,
      target_group_tag_id,
      target_lifestyle_date,
      v_threshold.id,
      v_story.id,
      v_story.version,
      null
    );
  end if;

  return v_threshold;
end;
$$;

create or replace function public.recalculate_threshold_state_for_share_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid;
begin
  if tg_op = 'INSERT'
    and new.kind = 'group_tag'
    and new.group_id is not null
    and new.group_tag_id is not null then
    select c.user_id
    into v_actor_user_id
    from public.certifications c
    where c.id = new.certification_id;

    perform public.notify_group_certification(
      new.group_id,
      new.group_tag_id,
      new.lifestyle_date,
      new.certification_id,
      v_actor_user_id
    );

    perform public.recalculate_threshold_state(
      new.group_id,
      new.group_tag_id,
      new.lifestyle_date,
      v_actor_user_id,
      false,
      true
    );

    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.kind = 'group_tag'
    and new.group_id is not null
    and new.group_tag_id is not null then
    select c.user_id
    into v_actor_user_id
    from public.certifications c
    where c.id = new.certification_id;

    perform public.recalculate_threshold_state(
      new.group_id,
      new.group_tag_id,
      new.lifestyle_date,
      v_actor_user_id,
      false,
      true
    );
  end if;

  if tg_op = 'UPDATE'
    and old.kind = 'group_tag'
    and old.group_id is not null
    and old.group_tag_id is not null
    and (
      old.group_id is distinct from new.group_id
      or old.group_tag_id is distinct from new.group_tag_id
      or old.lifestyle_date is distinct from new.lifestyle_date
      or old.certification_id is distinct from new.certification_id
    ) then
    select c.user_id
    into v_actor_user_id
    from public.certifications c
    where c.id = old.certification_id;

    perform public.recalculate_threshold_state(
      old.group_id,
      old.group_tag_id,
      old.lifestyle_date,
      v_actor_user_id,
      false,
      true
    );
  end if;

  if tg_op = 'DELETE'
    and old.kind = 'group_tag'
    and old.group_id is not null
    and old.group_tag_id is not null then
    select c.user_id
    into v_actor_user_id
    from public.certifications c
    where c.id = old.certification_id;

    perform public.recalculate_threshold_state(
      old.group_id,
      old.group_tag_id,
      old.lifestyle_date,
      v_actor_user_id,
      false,
      true
    );

    return old;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists share_target_threshold_recalc on public.share_targets;
create trigger share_target_threshold_recalc
  after insert or update or delete on public.share_targets
  for each row execute function public.recalculate_threshold_state_for_share_target();

create or replace function public.recalculate_threshold_state_for_certification_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target record;
begin
  if old.status is not distinct from new.status
    and old.lifestyle_date is not distinct from new.lifestyle_date then
    return new;
  end if;

  for v_target in
    select distinct
      st.group_id,
      st.group_tag_id,
      st.lifestyle_date
    from public.share_targets st
    where st.certification_id = new.id
      and st.kind = 'group_tag'
      and st.group_id is not null
      and st.group_tag_id is not null
  loop
    perform public.recalculate_threshold_state(
      v_target.group_id,
      v_target.group_tag_id,
      v_target.lifestyle_date,
      new.user_id,
      false,
      true
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists certification_status_threshold_recalc on public.certifications;
create trigger certification_status_threshold_recalc
  after update of status, lifestyle_date on public.certifications
  for each row execute function public.recalculate_threshold_state_for_certification_status();

create or replace function public.finalize_due_threshold_states(target_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target record;
  v_count int := 0;
begin
  for v_target in
    select distinct
      ts.group_id,
      ts.group_tag_id,
      ts.lifestyle_date
    from public.threshold_states ts
    where ts.status in ('locked', 'provisional_unlocked')
      and public.certification_editable_until(ts.lifestyle_date) <= target_now

    union

    select distinct
      st.group_id,
      st.group_tag_id,
      st.lifestyle_date
    from public.share_targets st
    join public.certifications c
      on c.id = st.certification_id
    where st.kind = 'group_tag'
      and st.group_id is not null
      and st.group_tag_id is not null
      and c.status = 'active'
      and public.certification_editable_until(st.lifestyle_date) <= target_now
  loop
    perform public.recalculate_threshold_state(
      v_target.group_id,
      v_target.group_tag_id,
      v_target.lifestyle_date,
      null,
      true,
      true
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Migration 적용 전 이미 존재하던 인증/공유 대상은 알림 없이 집계 상태만 backfill한다.
do $$
declare
  v_target record;
begin
  for v_target in
    select distinct
      st.group_id,
      st.group_tag_id,
      st.lifestyle_date
    from public.share_targets st
    where st.kind = 'group_tag'
      and st.group_id is not null
      and st.group_tag_id is not null
  loop
    perform public.recalculate_threshold_state(
      v_target.group_id,
      v_target.group_tag_id,
      v_target.lifestyle_date,
      null,
      public.certification_editable_until(v_target.lifestyle_date) <= now(),
      false
    );
  end loop;
end $$;

revoke all on function public.lifestyle_date_starts_at(date) from public;
revoke all on function public.resolve_effective_threshold(text, int) from public;
revoke all on function public.notification_exists_for_story_event(uuid, text, uuid, uuid, date, int, uuid) from public;
revoke all on function public.notify_group_certification(uuid, uuid, date, uuid, uuid) from public;
revoke all on function public.notify_threshold_story_event(text, uuid, uuid, date, uuid, uuid, int, uuid) from public;
revoke all on function public.recalculate_threshold_state(uuid, uuid, date, uuid, boolean, boolean) from public;
revoke all on function public.recalculate_threshold_state_for_share_target() from public;
revoke all on function public.recalculate_threshold_state_for_certification_status() from public;
revoke all on function public.finalize_due_threshold_states(timestamptz) from public;

grant execute on function public.lifestyle_date_starts_at(date) to authenticated, service_role;
grant execute on function public.resolve_effective_threshold(text, int) to authenticated, service_role;
grant execute on function public.finalize_due_threshold_states(timestamptz) to service_role;
