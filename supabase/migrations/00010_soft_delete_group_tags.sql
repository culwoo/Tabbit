alter table public.group_tags
  add column if not exists deleted_at timestamptz;

alter table public.group_tags
  drop constraint if exists group_tags_group_id_normalized_label_key;

create unique index if not exists group_tags_active_unique_label
  on public.group_tags (group_id, normalized_label)
  where deleted_at is null;

drop policy if exists "group_tags_update_member" on public.group_tags;
create policy "group_tags_update_member" on public.group_tags
  for update
  using (public.is_active_group_member(group_tags.group_id))
  with check (public.is_active_group_member(group_tags.group_id));
