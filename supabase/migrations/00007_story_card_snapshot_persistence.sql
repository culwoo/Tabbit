-- ============================================================
-- 00007_story_card_snapshot_persistence.sql
-- Persist 9:16 story card export metadata on story_cards.
-- ============================================================

alter table public.story_cards
  add column if not exists last_snapshot_image_uri text,
  add column if not exists last_snapshot_asset_id text,
  add column if not exists last_snapshot_exported_by uuid references public.users(id) on delete set null,
  add column if not exists last_snapshot_exported_at timestamptz,
  add column if not exists last_snapshot_shared_at timestamptz,
  add column if not exists last_snapshot_layout_version text,
  add column if not exists last_snapshot_platform text
    check (
      last_snapshot_platform is null
      or last_snapshot_platform in ('android', 'ios', 'web', 'unknown')
    ),
  add column if not exists snapshot_export_count int not null default 0;

create index if not exists idx_story_cards_snapshot_exports
  on public.story_cards (group_id, lifestyle_date, last_snapshot_exported_at desc)
  where last_snapshot_exported_at is not null;

create or replace function public.save_story_card_snapshot(
  p_group_id uuid,
  p_group_tag_id uuid,
  p_lifestyle_date date,
  p_image_uri text,
  p_asset_id text default null,
  p_layout_version text default 'share-mode-v1',
  p_shared boolean default false,
  p_platform text default 'unknown',
  p_increment_export_count boolean default true
)
returns public.story_cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_story public.story_cards;
  v_platform text := lower(coalesce(nullif(trim(p_platform), ''), 'unknown'));
begin
  if v_user_id is null then
    raise exception 'Authentication is required to save a story card snapshot.'
      using errcode = '28000';
  end if;

  if nullif(trim(p_image_uri), '') is null then
    raise exception 'Snapshot image URI is required.'
      using errcode = '22023';
  end if;

  if v_platform not in ('android', 'ios', 'web', 'unknown') then
    v_platform := 'unknown';
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = v_user_id
      and gm.status = 'active'
  ) then
    raise exception 'Only active group members can save story card snapshots.'
      using errcode = '42501';
  end if;

  select *
  into v_story
  from public.story_cards sc
  where sc.group_id = p_group_id
    and sc.group_tag_id = p_group_tag_id
    and sc.lifestyle_date = p_lifestyle_date
  for update;

  if not found then
    raise exception 'Story card does not exist for the requested group, tag, and date.'
      using errcode = 'P0002';
  end if;

  if v_story.status not in ('provisional', 'finalized') then
    raise exception 'Only unlocked story cards can be exported.'
      using errcode = '42501';
  end if;

  update public.story_cards
  set
    last_snapshot_image_uri = p_image_uri,
    last_snapshot_asset_id = nullif(trim(coalesce(p_asset_id, '')), ''),
    last_snapshot_exported_by = v_user_id,
    last_snapshot_exported_at = case
      when p_increment_export_count then v_now
      else coalesce(public.story_cards.last_snapshot_exported_at, v_now)
    end,
    last_snapshot_shared_at = case
      when p_shared then v_now
      else public.story_cards.last_snapshot_shared_at
    end,
    last_snapshot_layout_version = coalesce(nullif(trim(p_layout_version), ''), 'share-mode-v1'),
    last_snapshot_platform = v_platform,
    snapshot_export_count = public.story_cards.snapshot_export_count
      + case when p_increment_export_count then 1 else 0 end,
    updated_at = v_now
  where public.story_cards.id = v_story.id
  returning * into v_story;

  return v_story;
end;
$$;

revoke all on function public.save_story_card_snapshot(uuid, uuid, date, text, text, text, boolean, text, boolean) from public;
grant execute on function public.save_story_card_snapshot(uuid, uuid, date, text, text, text, boolean, text, boolean)
  to authenticated, service_role;
