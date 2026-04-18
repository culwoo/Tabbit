-- ============================================================
-- 00003_group_tag_personal_sync.sql
-- 그룹 태그를 멤버 개인공간 태그로 자동 동기화하고,
-- 아직 인증에 쓰이지 않은 그룹 태그 삭제를 허용한다.
-- ============================================================

-- 기존 그룹/태그 데이터를 현재 active 멤버들의 personal_tags로 backfill
insert into public.personal_tags (user_id, label, normalized_label)
select distinct on (gm.user_id, gt.normalized_label)
  gm.user_id,
  gt.label,
  gt.normalized_label
from public.group_members gm
join public.group_tags gt on gt.group_id = gm.group_id
where gm.status = 'active'
order by gm.user_id, gt.normalized_label, gt.created_at
on conflict (user_id, normalized_label) do nothing;

create or replace function public.sync_group_tag_to_member_personal_tags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.personal_tags (user_id, label, normalized_label)
  select
    gm.user_id,
    new.label,
    new.normalized_label
  from public.group_members gm
  where gm.group_id = new.group_id
    and gm.status = 'active'
  on conflict (user_id, normalized_label) do nothing;

  return new;
end;
$$;

drop trigger if exists group_tag_personal_sync on public.group_tags;
create trigger group_tag_personal_sync
  after insert on public.group_tags
  for each row execute function public.sync_group_tag_to_member_personal_tags();

create or replace function public.sync_group_member_tags_to_personal_tags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' then
    insert into public.personal_tags (user_id, label, normalized_label)
    select
      new.user_id,
      gt.label,
      gt.normalized_label
    from public.group_tags gt
    where gt.group_id = new.group_id
    on conflict (user_id, normalized_label) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists group_member_personal_tag_sync on public.group_members;
create trigger group_member_personal_tag_sync
  after insert or update of status on public.group_members
  for each row execute function public.sync_group_member_tags_to_personal_tags();

drop policy if exists "group_tags_delete_member" on public.group_tags;
create policy "group_tags_delete_member" on public.group_tags
  for delete to authenticated
  using (public.is_active_group_member(group_tags.group_id));
