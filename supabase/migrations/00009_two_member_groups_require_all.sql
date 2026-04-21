-- Keep small groups emotionally simple: one- and two-person groups always need everyone.
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
    when target_eligible_member_count <= 2 then target_eligible_member_count
    when target_threshold_rule = 'N_MINUS_1' then greatest(1, target_eligible_member_count - 1)
    when target_threshold_rule = 'N_MINUS_2' then greatest(1, target_eligible_member_count - 2)
    else target_eligible_member_count
  end;
$$;

revoke all on function public.resolve_effective_threshold(text, int) from public;
grant execute on function public.resolve_effective_threshold(text, int) to authenticated, service_role;
