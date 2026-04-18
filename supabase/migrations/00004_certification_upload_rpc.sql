-- ============================================================
-- 00004_certification_upload_rpc.sql
-- 인증 DB 저장을 Security Definer RPC로 묶는다.
-- Storage 업로드 이후 certifications + share_targets 저장을 한 트랜잭션으로 처리해
-- 클라이언트 직접 INSERT/RETURNING 과정의 RLS 문제를 피한다.
-- ============================================================

create or replace function public.create_certification_with_targets(
  p_image_bucket text,
  p_image_path text,
  p_image_width int,
  p_image_height int,
  p_caption text,
  p_lifestyle_date date,
  p_personal_tag_ids uuid[] default '{}'::uuid[],
  p_group_share_targets jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_cert public.certifications;
  v_personal_tag_ids uuid[] := coalesce(p_personal_tag_ids, '{}'::uuid[]);
  v_personal_tag_count int;
  v_group_target record;
begin
  if v_user_id is null then
    raise exception '인증 세션이 필요합니다.'
      using errcode = '28000';
  end if;

  if p_image_bucket <> 'certifications' then
    raise exception '지원하지 않는 인증 이미지 bucket입니다: %', p_image_bucket
      using errcode = '22023';
  end if;

  if nullif(p_image_path, '') is null
    or split_part(p_image_path, '/', 1) <> v_user_id::text then
    raise exception '인증 이미지 경로가 현재 사용자와 일치하지 않습니다.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.users u
    where u.id = v_user_id
  ) then
    raise exception 'public.users 프로필이 없습니다: %', v_user_id
      using errcode = '23503';
  end if;

  select count(*)::int
  into v_personal_tag_count
  from unnest(v_personal_tag_ids) as selected_tags(tag_id)
  join public.personal_tags pt
    on pt.id = selected_tags.tag_id
   and pt.user_id = v_user_id;

  if cardinality(v_personal_tag_ids) <> v_personal_tag_count then
    raise exception '현재 사용자의 개인 태그만 인증에 연결할 수 있습니다.'
      using errcode = '42501';
  end if;

  insert into public.certifications (
    user_id,
    image_bucket,
    image_path,
    image_url,
    image_width,
    image_height,
    caption,
    lifestyle_date,
    editable_until
  )
  values (
    v_user_id,
    p_image_bucket,
    p_image_path,
    p_image_path,
    p_image_width,
    p_image_height,
    coalesce(p_caption, ''),
    p_lifestyle_date,
    public.certification_editable_until(p_lifestyle_date)
  )
  returning * into v_cert;

  if cardinality(v_personal_tag_ids) > 0 then
    insert into public.share_targets (
      certification_id,
      kind,
      lifestyle_date,
      personal_tag_ids
    )
    values (
      v_cert.id,
      'personal',
      p_lifestyle_date,
      v_personal_tag_ids
    );
  end if;

  for v_group_target in
    select *
    from jsonb_to_recordset(coalesce(p_group_share_targets, '[]'::jsonb))
      as target(group_id uuid, group_tag_id uuid)
  loop
    if not exists (
      select 1
      from public.group_members gm
      where gm.group_id = v_group_target.group_id
        and gm.user_id = v_user_id
        and gm.status = 'active'
    ) then
      raise exception '현재 사용자는 그룹의 활성 멤버가 아닙니다: %', v_group_target.group_id
        using errcode = '42501';
    end if;

    if not exists (
      select 1
      from public.group_tags gt
      where gt.id = v_group_target.group_tag_id
        and gt.group_id = v_group_target.group_id
    ) then
      raise exception '그룹 태그가 그룹에 속하지 않습니다: %', v_group_target.group_tag_id
        using errcode = '23503';
    end if;

    insert into public.share_targets (
      certification_id,
      kind,
      lifestyle_date,
      group_id,
      group_tag_id,
      personal_tag_ids
    )
    values (
      v_cert.id,
      'group_tag',
      p_lifestyle_date,
      v_group_target.group_id,
      v_group_target.group_tag_id,
      '{}'::uuid[]
    );
  end loop;

  return to_jsonb(v_cert);
end;
$$;

revoke all on function public.create_certification_with_targets(
  text,
  text,
  int,
  int,
  text,
  date,
  uuid[],
  jsonb
) from public;

grant execute on function public.create_certification_with_targets(
  text,
  text,
  int,
  int,
  text,
  date,
  uuid[],
  jsonb
) to authenticated, service_role;
