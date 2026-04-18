-- ============================================================
-- 00006_push_notifications.sql
-- Stores Expo push tokens and queues notification rows for push delivery.
-- ============================================================

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null default 'unknown'
    check (platform in ('android', 'ios', 'web', 'unknown')),
  device_id text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  unique (user_id, expo_push_token)
);

create index if not exists idx_push_tokens_user_active
  on public.push_tokens (user_id, updated_at desc)
  where disabled_at is null;

create index if not exists idx_push_tokens_token_active
  on public.push_tokens (expo_push_token)
  where disabled_at is null;

create table if not exists public.push_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts int not null default 0,
  receipt_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (notification_id)
);

create index if not exists idx_push_deliveries_pending
  on public.push_notification_deliveries (created_at)
  where status = 'pending';

create index if not exists idx_push_deliveries_user
  on public.push_notification_deliveries (user_id, created_at desc);

alter table public.push_tokens enable row level security;
alter table public.push_notification_deliveries enable row level security;

drop policy if exists "push_tokens_select_own" on public.push_tokens;
create policy "push_tokens_select_own" on public.push_tokens
  for select using (auth.uid() = push_tokens.user_id);

drop policy if exists "push_tokens_insert_own" on public.push_tokens;
create policy "push_tokens_insert_own" on public.push_tokens
  for insert with check (auth.uid() = push_tokens.user_id);

drop policy if exists "push_tokens_update_own" on public.push_tokens;
create policy "push_tokens_update_own" on public.push_tokens
  for update using (auth.uid() = push_tokens.user_id)
  with check (auth.uid() = push_tokens.user_id);

drop policy if exists "push_tokens_delete_own" on public.push_tokens;
create policy "push_tokens_delete_own" on public.push_tokens
  for delete using (auth.uid() = push_tokens.user_id);

drop policy if exists "push_deliveries_select_own" on public.push_notification_deliveries;
create policy "push_deliveries_select_own" on public.push_notification_deliveries
  for select using (auth.uid() = push_notification_deliveries.user_id);

drop trigger if exists set_updated_at on public.push_tokens;
create trigger set_updated_at before update on public.push_tokens
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.push_notification_deliveries;
create trigger set_updated_at before update on public.push_notification_deliveries
  for each row execute function public.set_updated_at();

create or replace function public.register_push_token(
  p_expo_push_token text,
  p_platform text default 'unknown',
  p_device_id text default 'unknown'
)
returns public.push_tokens
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_push_token public.push_tokens;
  v_platform text := case
    when p_platform in ('android', 'ios', 'web') then p_platform
    else 'unknown'
  end;
  v_device_id text := coalesce(nullif(trim(p_device_id), ''), 'unknown');
  v_expo_push_token text := trim(p_expo_push_token);
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = '28000';
  end if;

  if v_expo_push_token is null or v_expo_push_token = '' then
    raise exception 'Expo push token is required'
      using errcode = '22023';
  end if;

  update public.push_tokens
  set disabled_at = coalesce(disabled_at, now()),
      updated_at = now()
  where expo_push_token = v_expo_push_token
    and user_id <> v_user_id
    and disabled_at is null;

  insert into public.push_tokens (
    user_id,
    expo_push_token,
    platform,
    device_id,
    last_seen_at,
    disabled_at
  )
  values (
    v_user_id,
    v_expo_push_token,
    v_platform,
    v_device_id,
    now(),
    null
  )
  on conflict (user_id, expo_push_token)
  do update set
    platform = excluded.platform,
    device_id = excluded.device_id,
    last_seen_at = now(),
    disabled_at = null,
    updated_at = now()
  returning * into v_push_token;

  return v_push_token;
end;
$$;

create or replace function public.disable_push_token(
  p_expo_push_token text,
  p_device_id text default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row_count int := 0;
  v_expo_push_token text := trim(p_expo_push_token);
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = '28000';
  end if;

  update public.push_tokens
  set disabled_at = coalesce(disabled_at, now()),
      updated_at = now()
  where user_id = v_user_id
    and expo_push_token = v_expo_push_token
    and (
      p_device_id is null
      or device_id = p_device_id
    );

  get diagnostics v_row_count = row_count;
  return v_row_count;
end;
$$;

create or replace function public.enqueue_push_delivery_for_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.push_notification_deliveries (notification_id, user_id)
  values (new.id, new.user_id)
  on conflict (notification_id) do nothing;

  return new;
end;
$$;

drop trigger if exists notification_push_delivery_enqueue on public.notifications;
create trigger notification_push_delivery_enqueue
  after insert on public.notifications
  for each row execute function public.enqueue_push_delivery_for_notification();

-- Backfill pending deliveries for notifications that existed before this migration.
insert into public.push_notification_deliveries (notification_id, user_id)
select n.id, n.user_id
from public.notifications n
where not exists (
  select 1
  from public.push_notification_deliveries pnd
  where pnd.notification_id = n.id
);

revoke all on function public.register_push_token(text, text, text) from public;
revoke all on function public.disable_push_token(text, text) from public;
revoke all on function public.enqueue_push_delivery_for_notification() from public;

grant execute on function public.register_push_token(text, text, text) to authenticated;
grant execute on function public.disable_push_token(text, text) to authenticated;
