-- Groups created after the lifestyle day starts must still be usable that day.
-- The original threshold recalculation only counted members whose joined_at was
-- before the lifestyle day start, which makes a new one-person group show 1/0
-- and prevents its story card from unlocking after a valid certification.

create or replace function public.recalculate_threshold_state_for_current_active_members(
  target_group_id uuid,
  target_group_tag_id uuid,
  target_lifestyle_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.groups;
  v_previous_threshold public.threshold_states;
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
  v_threshold_status text;
  v_story_status text;
  v_now timestamptz := now();
begin
  select *
  into v_group
  from public.groups g
  where g.id = target_group_id;

  if not found then
    return;
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
    v_now >= v_editable_until
    or v_previous_threshold.status in ('finalized', 'expired');

  -- Keep the old archival rule for established groups. Only patch the case
  -- where the regular recalculation produced an empty eligible set.
  if coalesce(v_previous_threshold.effective_threshold, 0) > 0
    and v_group.created_at <= v_life_day_start then
    return;
  end if;

  select count(distinct gm.user_id)::int
  into v_eligible_count
  from public.group_members gm
  where gm.group_id = target_group_id
    and gm.status = 'active'
    and gm.joined_at <= v_editable_until
    and (
      gm.left_at is null
      or gm.left_at > v_life_day_start
    );

  with eligible_members as (
    select distinct gm.user_id
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.status = 'active'
      and gm.joined_at <= v_editable_until
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

  v_threshold_status := case
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
    v_threshold_status,
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
    finalized_at = excluded.finalized_at;

  if v_meets_threshold then
    v_story_status := case
      when v_should_finalize then 'finalized'
      else 'provisional'
    end;
  elsif v_previous_story.id is not null then
    v_story_status := case
      when v_previous_story.unlocked_at is not null then 'revoked'
      else 'locked'
    end;
  else
    return;
  end if;

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
    v_story_status,
    coalesce(v_previous_story.version, 1),
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
    unlocked_at = excluded.unlocked_at,
    finalized_at = excluded.finalized_at,
    contributor_user_ids = excluded.contributor_user_ids,
    certification_ids = excluded.certification_ids,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.recalculate_same_day_group_threshold_patch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE')
    and new.kind = 'group_tag'
    and new.group_id is not null
    and new.group_tag_id is not null then
    perform public.recalculate_threshold_state_for_current_active_members(
      new.group_id,
      new.group_tag_id,
      new.lifestyle_date
    );
  end if;

  if tg_op in ('UPDATE', 'DELETE')
    and old.kind = 'group_tag'
    and old.group_id is not null
    and old.group_tag_id is not null then
    perform public.recalculate_threshold_state_for_current_active_members(
      old.group_id,
      old.group_tag_id,
      old.lifestyle_date
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists zz_same_day_group_threshold_patch on public.share_targets;
create trigger zz_same_day_group_threshold_patch
after insert or update or delete on public.share_targets
for each row
execute function public.recalculate_same_day_group_threshold_patch();

revoke all on function public.recalculate_threshold_state_for_current_active_members(uuid, uuid, date) from public;
revoke all on function public.recalculate_same_day_group_threshold_patch() from public;
