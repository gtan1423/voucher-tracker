-- Voucher & Benefits Tracker: cloud schema.
-- Additive only -- does not touch any existing finance-tracker table.
-- Paste into the Supabase SQL Editor for the SAME project as the finance tracker.

create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  value numeric,
  value_note text,          -- free-text fallback, e.g. "8 left", when there's no clean dollar amount
  start_date date,
  expiry_date date,
  type text not null default '',
  interest text not null default '',
  status_input text not null default '',  -- manual override, e.g. "Redeemed" / "Booked"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vouchers_user_id_idx on public.vouchers(user_id);

alter table public.vouchers enable row level security;

create policy "vouchers_select_own" on public.vouchers for select using (auth.uid() = user_id);
create policy "vouchers_insert_own" on public.vouchers for insert with check (auth.uid() = user_id);
create policy "vouchers_update_own" on public.vouchers for update using (auth.uid() = user_id);
create policy "vouchers_delete_own" on public.vouchers for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.vouchers to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger vouchers_set_updated_at
before update on public.vouchers
for each row execute function public.set_updated_at();

-- Computed status, mirroring the original Excel formulas exactly (see xlsx_io.py):
--   Ageing Bucket: based on expiry_date vs today
--   Days Until Expiry: based on expiry_date vs today
--   Status: status_input override, else Open/Expired based on expiry_date
create or replace view public.voucher_status
with (security_invoker = true) as
select
  v.*,
  case
    when v.expiry_date is null then 'No Expiry'
    when v.expiry_date < current_date then '(1) Overdue'
    when v.expiry_date <= current_date + 30 then '(2) 0-30 Days'
    when v.expiry_date <= current_date + 60 then '(3) 31-60 Days'
    when v.expiry_date <= current_date + 90 then '(4) 61-90 Days'
    else '(5) 91+ Days'
  end as ageing_bucket,
  case
    when v.expiry_date is null then '-'
    when v.expiry_date < current_date then 'Overdue'
    else (v.expiry_date - current_date)::text || ' days'
  end as days_until_expiry,
  coalesce(
    nullif(v.status_input, ''),
    case
      when v.expiry_date is null then 'Open'
      when v.expiry_date < current_date then 'Expired'
      else 'Open'
    end
  ) as status
from public.vouchers v;

grant select on public.voucher_status to authenticated;

-- Notification settings: one row per user, editable from the app's Settings page.
create table public.voucher_notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  recipient_email text not null,
  day_of_week int not null default 5 check (day_of_week between 0 and 6),  -- 0=Sunday .. 6=Saturday
  hour int not null default 19 check (hour between 0 and 23),              -- 24h, local to `timezone`
  timezone text not null default 'Asia/Singapore',
  enabled boolean not null default true,
  last_sent_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.voucher_notification_settings enable row level security;

create policy "vns_select_own" on public.voucher_notification_settings for select using (auth.uid() = user_id);
create policy "vns_insert_own" on public.voucher_notification_settings for insert with check (auth.uid() = user_id);
create policy "vns_update_own" on public.voucher_notification_settings for update using (auth.uid() = user_id);

grant select, insert, update on public.voucher_notification_settings to authenticated;

create trigger vns_set_updated_at
before update on public.voucher_notification_settings
for each row execute function public.set_updated_at();

-- service_role needs its own explicit grants (BYPASSRLS does not imply table privileges --
-- see the finance tracker's own note on this exact gotcha from the shared-accounts feature).
-- The voucher-weekly-email edge function reads across users via a service-role client.
grant select on public.vouchers to service_role;
grant select on public.voucher_status to service_role;
grant select, update on public.voucher_notification_settings to service_role;

-- Schedule the weekly-email edge function to be checked every hour; the function itself
-- decides per-user whether it's actually their configured day/hour before sending anything.
-- Running hourly (rather than hardcoding one weekly cron time) is what makes changing the
-- day/hour from the Settings page actually take effect without editing this schedule.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'voucher-weekly-email-hourly',
  '5 * * * *',
  $cron$
  select net.http_post(
    url := 'https://ywujsfpwmcfrwxswvvia.supabase.co/functions/v1/voucher-weekly-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_Pyegx0JsMJfR6RepJql7Sg_nf6FRgsw'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $cron$
);
