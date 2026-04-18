-- Tabbit Supabase DB schema hardening
-- Scope: pgcrypto, Storage bucket/policies, recursive RLS removal,
-- profile visibility, and certification mutation guard rails.

-- ============================================================
-- 0. Extensions
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. Schema hardening for certification assets and share targets
-- ============================================================
alter table public.certifications
  add column if not exists image_bucket text not null default 'certifications',
  add column if not exists image_path text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'certifications_image_bucket_check'
      and conrelid = 'public.certifications'::regclass
  ) then
    alter table public.certifications
      add constraint certifications_image_bucket_check
      check (image_bucket = 'certifications');
  end if;
end $$;

update public.share_targets
set personal_tag_ids = '{}'
where personal_tag_ids is null;

alter table public.share_targets
  alter column personal_tag_ids set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'share_targets_kind_shape_check'
      and conrelid = 'public.share_targets'::regclass
  ) then
    alter table public.share_targets
      add constraint share_targets_kind_shape_check
      check (
        (
          kind = 'personal'
          and group_id is null
          and group_tag_id is null
        )
        or (
          kind = 'group_tag'
          and group_id is not null
          and group_tag_id is not null
          and cardinality(personal_tag_ids) = 0
        )
      );
  end if;
end $$;

create index if not exists idx_group_members_active_user_group
  on public.group_members (user_id, group_id)
  where status = 'active';

create index if not exists idx_group_members_active_group_user
  on public.group_members (group_id, user_id)
  where status = 'active';

create index if not exists idx_certifications_user_life_day
  on public.certifications (user_id, lifestyle_date, uploaded_at desc)
  where status = 'active';

create index if not exists idx_certifications_image_asset
  on public.certifications (image_bucket, image_path)
  where image_path is not null;

create index if not exists idx_share_targets_certification
  on public.share_targets (certification_id);

create index if not exists idx_share_targets_group_tag_life_day
  on public.share_targets (group_id, group_tag_id, lifestyle_date)
  where kind = 'group_tag';

create unique index if not exists idx_share_targets_one_personal_per_cert
  on public.share_targets (certification_id)
  where kind = 'personal';

create unique index if not exists idx_share_targets_one_group_tag_per_cert
  on public.share_targets (certification_id, group_id, group_tag_id)
  where kind = 'group_tag';

-- ============================================================
-- 2. RLS helper functions
-- Security definer helpers avoid recursive policies on group_members.
-- ============================================================
create or replace function public.is_active_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = (select auth.uid())
      and gm.status = 'active'
  );
$$;

create or replace function public.can_read_user_profile(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) = target_user_id
    or exists (
      select 1
      from public.group_members self_membership
      join public.group_members target_membership
        on target_membership.group_id = self_membership.group_id
      where self_membership.user_id = (select auth.uid())
        and self_membership.status = 'active'
        and target_membership.user_id = target_user_id
        and target_membership.status = 'active'
    );
$$;

create or replace function public.owns_certification(target_certification_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.certifications c
    where c.id = target_certification_id
      and c.user_id = (select auth.uid())
  );
$$;

create or replace function public.can_access_certification(target_certification_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.certifications c
    where c.id = target_certification_id
      and c.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.certifications c
    join public.share_targets st
      on st.certification_id = c.id
      and st.kind = 'group_tag'
    join public.group_members gm
      on gm.group_id = st.group_id
      and gm.user_id = (select auth.uid())
      and gm.status = 'active'
    where c.id = target_certification_id
      and c.status = 'active'
  );
$$;

create or replace function public.can_mutate_certification(target_certification_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.certifications c
    where c.id = target_certification_id
      and c.user_id = (select auth.uid())
      and c.status = 'active'
      and c.editable_until > now()
  );
$$;

create or replace function public.can_insert_share_target(
  target_certification_id uuid,
  target_kind text,
  target_group_id uuid,
  target_group_tag_id uuid,
  target_personal_tag_ids uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_mutate_certification(target_certification_id)
    and (
      (
        target_kind = 'personal'
        and target_group_id is null
        and target_group_tag_id is null
        and coalesce(cardinality(target_personal_tag_ids), 0) = (
          select count(*)::int
          from unnest(coalesce(target_personal_tag_ids, '{}'::uuid[])) as selected_tags(tag_id)
          join public.personal_tags pt
            on pt.id = selected_tags.tag_id
            and pt.user_id = (select auth.uid())
        )
      )
      or (
        target_kind = 'group_tag'
        and target_group_id is not null
        and target_group_tag_id is not null
        and coalesce(cardinality(target_personal_tag_ids), 0) = 0
        and public.is_active_group_member(target_group_id)
        and exists (
          select 1
          from public.group_tags gt
          where gt.id = target_group_tag_id
            and gt.group_id = target_group_id
        )
      )
    );
$$;

create or replace function public.certification_editable_until(target_lifestyle_date date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select make_timestamptz(
    extract(year from (target_lifestyle_date + 1))::int,
    extract(month from (target_lifestyle_date + 1))::int,
    extract(day from (target_lifestyle_date + 1))::int,
    5,
    0,
    0,
    'Asia/Seoul'
  );
$$;

create or replace function public.set_certification_editable_until()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.editable_until = public.certification_editable_until(new.lifestyle_date);
  return new;
end;
$$;

drop trigger if exists set_certification_editable_until on public.certifications;
create trigger set_certification_editable_until
  before insert or update on public.certifications
  for each row execute function public.set_certification_editable_until();

create or replace function public.can_access_certification_image(
  target_bucket_id text,
  target_object_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.certifications c
    where c.image_bucket = target_bucket_id
      and c.image_path = target_object_name
      and c.status = 'active'
      and public.can_access_certification(c.id)
  );
$$;

create or replace function public.can_mutate_certification_image(
  target_bucket_id text,
  target_object_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_bucket_id = 'certifications'
    and (storage.foldername(target_object_name))[1] = (select auth.uid())::text
    and (
      not exists (
        select 1
        from public.certifications c
        where c.image_bucket = target_bucket_id
          and c.image_path = target_object_name
      )
      or exists (
        select 1
        from public.certifications c
        where c.image_bucket = target_bucket_id
          and c.image_path = target_object_name
          and c.user_id = (select auth.uid())
          and c.status = 'active'
          and c.editable_until > now()
      )
    );
$$;

revoke all on function public.is_active_group_member(uuid) from public;
revoke all on function public.can_read_user_profile(uuid) from public;
revoke all on function public.owns_certification(uuid) from public;
revoke all on function public.can_access_certification(uuid) from public;
revoke all on function public.can_mutate_certification(uuid) from public;
revoke all on function public.can_insert_share_target(uuid, text, uuid, uuid, uuid[]) from public;
revoke all on function public.certification_editable_until(date) from public;
revoke all on function public.can_access_certification_image(text, text) from public;
revoke all on function public.can_mutate_certification_image(text, text) from public;

grant execute on function public.is_active_group_member(uuid) to authenticated, service_role;
grant execute on function public.can_read_user_profile(uuid) to authenticated, service_role;
grant execute on function public.owns_certification(uuid) to authenticated, service_role;
grant execute on function public.can_access_certification(uuid) to authenticated, service_role;
grant execute on function public.can_mutate_certification(uuid) to authenticated, service_role;
grant execute on function public.can_insert_share_target(uuid, text, uuid, uuid, uuid[]) to authenticated, service_role;
grant execute on function public.certification_editable_until(date) to authenticated, service_role;
grant execute on function public.can_access_certification_image(text, text) to authenticated, service_role;
grant execute on function public.can_mutate_certification_image(text, text) to authenticated, service_role;

-- ============================================================
-- 3. Public table RLS policy replacement
-- ============================================================
drop policy if exists "users_select_own" on public.users;
drop policy if exists "users_select_visible" on public.users;
create policy "users_select_visible" on public.users
  for select to authenticated
  using (public.can_read_user_profile(users.id));

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update to authenticated
  using ((select auth.uid()) = users.id)
  with check ((select auth.uid()) = users.id);

drop policy if exists "personal_tags_all_own" on public.personal_tags;
drop policy if exists "personal_tags_own" on public.personal_tags;
create policy "personal_tags_own" on public.personal_tags
  for all to authenticated
  using ((select auth.uid()) = personal_tags.user_id)
  with check ((select auth.uid()) = personal_tags.user_id);

drop policy if exists "groups_select_member" on public.groups;
create policy "groups_select_member" on public.groups
  for select to authenticated
  using (
    (select auth.uid()) = groups.created_by
    or public.is_active_group_member(groups.id)
  );

drop policy if exists "groups_update_owner" on public.groups;
create policy "groups_update_owner" on public.groups
  for update to authenticated
  using ((select auth.uid()) = groups.created_by)
  with check ((select auth.uid()) = groups.created_by);

drop policy if exists "groups_insert_auth" on public.groups;
create policy "groups_insert_auth" on public.groups
  for insert to authenticated
  with check ((select auth.uid()) = groups.created_by);

drop policy if exists "group_members_select_peer" on public.group_members;
create policy "group_members_select_peer" on public.group_members
  for select to authenticated
  using (
    (select auth.uid()) = group_members.user_id
    or public.is_active_group_member(group_members.group_id)
  );

drop policy if exists "group_members_insert_self" on public.group_members;
create policy "group_members_insert_self" on public.group_members
  for insert to authenticated
  with check ((select auth.uid()) = group_members.user_id);

drop policy if exists "group_members_update_self" on public.group_members;
create policy "group_members_update_self" on public.group_members
  for update to authenticated
  using ((select auth.uid()) = group_members.user_id)
  with check ((select auth.uid()) = group_members.user_id);

drop policy if exists "group_tags_select_member" on public.group_tags;
create policy "group_tags_select_member" on public.group_tags
  for select to authenticated
  using (public.is_active_group_member(group_tags.group_id));

drop policy if exists "group_tags_insert_member" on public.group_tags;
create policy "group_tags_insert_member" on public.group_tags
  for insert to authenticated
  with check (public.is_active_group_member(group_tags.group_id));

drop policy if exists "certifications_all_own" on public.certifications;
drop policy if exists "certifications_select_group" on public.certifications;
drop policy if exists "certifications_select_accessible" on public.certifications;
drop policy if exists "certifications_insert_own" on public.certifications;
drop policy if exists "certifications_update_own_before_deadline" on public.certifications;
drop policy if exists "certifications_delete_own_before_deadline" on public.certifications;

create policy "certifications_select_accessible" on public.certifications
  for select to authenticated
  using (public.can_access_certification(certifications.id));

create policy "certifications_insert_own" on public.certifications
  for insert to authenticated
  with check ((select auth.uid()) = certifications.user_id);

create policy "certifications_update_own_before_deadline" on public.certifications
  for update to authenticated
  using (public.can_mutate_certification(certifications.id))
  with check ((select auth.uid()) = certifications.user_id);

create policy "certifications_delete_own_before_deadline" on public.certifications
  for delete to authenticated
  using (public.can_mutate_certification(certifications.id));

drop policy if exists "share_targets_all_owner" on public.share_targets;
drop policy if exists "share_targets_select_group" on public.share_targets;
drop policy if exists "share_targets_select_accessible" on public.share_targets;
drop policy if exists "share_targets_insert_owner_valid_target" on public.share_targets;
drop policy if exists "share_targets_update_owner_before_deadline" on public.share_targets;
drop policy if exists "share_targets_delete_owner_before_deadline" on public.share_targets;

create policy "share_targets_select_accessible" on public.share_targets
  for select to authenticated
  using (
    public.owns_certification(share_targets.certification_id)
    or (
      share_targets.kind = 'group_tag'
      and public.is_active_group_member(share_targets.group_id)
    )
  );

create policy "share_targets_insert_owner_valid_target" on public.share_targets
  for insert to authenticated
  with check (
    public.can_insert_share_target(
      share_targets.certification_id,
      share_targets.kind,
      share_targets.group_id,
      share_targets.group_tag_id,
      share_targets.personal_tag_ids
    )
  );

create policy "share_targets_update_owner_before_deadline" on public.share_targets
  for update to authenticated
  using (public.can_mutate_certification(share_targets.certification_id))
  with check (
    public.can_insert_share_target(
      share_targets.certification_id,
      share_targets.kind,
      share_targets.group_id,
      share_targets.group_tag_id,
      share_targets.personal_tag_ids
    )
  );

create policy "share_targets_delete_owner_before_deadline" on public.share_targets
  for delete to authenticated
  using (public.can_mutate_certification(share_targets.certification_id));

drop policy if exists "cert_comments_select_group" on public.certification_comments;
drop policy if exists "cert_comments_select_accessible" on public.certification_comments;
create policy "cert_comments_select_accessible" on public.certification_comments
  for select to authenticated
  using (public.can_access_certification(certification_comments.certification_id));

drop policy if exists "cert_comments_insert_self" on public.certification_comments;
create policy "cert_comments_insert_self" on public.certification_comments
  for insert to authenticated
  with check (
    (select auth.uid()) = certification_comments.author_id
    and public.can_access_certification(certification_comments.certification_id)
  );

drop policy if exists "cert_comments_update_self" on public.certification_comments;
create policy "cert_comments_update_self" on public.certification_comments
  for update to authenticated
  using ((select auth.uid()) = certification_comments.author_id)
  with check ((select auth.uid()) = certification_comments.author_id);

drop policy if exists "cert_comments_delete_self" on public.certification_comments;
create policy "cert_comments_delete_self" on public.certification_comments
  for delete to authenticated
  using ((select auth.uid()) = certification_comments.author_id);

drop policy if exists "threshold_states_select_member" on public.threshold_states;
create policy "threshold_states_select_member" on public.threshold_states
  for select to authenticated
  using (public.is_active_group_member(threshold_states.group_id));

drop policy if exists "story_cards_select_member" on public.story_cards;
create policy "story_cards_select_member" on public.story_cards
  for select to authenticated
  using (public.is_active_group_member(story_cards.group_id));

drop policy if exists "notifications_all_own" on public.notifications;
drop policy if exists "notifications_own" on public.notifications;
create policy "notifications_own" on public.notifications
  for all to authenticated
  using ((select auth.uid()) = notifications.user_id)
  with check ((select auth.uid()) = notifications.user_id);

drop policy if exists "chat_select_member" on public.chat_messages;
create policy "chat_select_member" on public.chat_messages
  for select to authenticated
  using (public.is_active_group_member(chat_messages.group_id));

drop policy if exists "chat_insert_member" on public.chat_messages;
create policy "chat_insert_member" on public.chat_messages
  for insert to authenticated
  with check (
    (select auth.uid()) = chat_messages.author_id
    and public.is_active_group_member(chat_messages.group_id)
  );

-- ============================================================
-- 4. Private Storage bucket and storage.objects RLS
-- ============================================================
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'certifications',
  'certifications',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Supabase owns and manages RLS on storage.objects. Hosted projects can reject
-- ALTER TABLE here with "must be owner of table objects"; policies below are
-- the intended customization point.

drop policy if exists "certification_images_insert_own_path" on storage.objects;
create policy "certification_images_insert_own_path" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'certifications'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "certification_images_select_accessible" on storage.objects;
create policy "certification_images_select_accessible" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'certifications'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.can_access_certification_image(bucket_id, name)
    )
  );

drop policy if exists "certification_images_update_own_before_deadline" on storage.objects;
create policy "certification_images_update_own_before_deadline" on storage.objects
  for update to authenticated
  using (public.can_mutate_certification_image(bucket_id, name))
  with check (
    bucket_id = 'certifications'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "certification_images_delete_own_before_deadline" on storage.objects;
create policy "certification_images_delete_own_before_deadline" on storage.objects
  for delete to authenticated
  using (public.can_mutate_certification_image(bucket_id, name));
