-- =============================================================================
-- Eleos — digital banking demo schema
--
-- Money is stored as BIGINT kobo. Balances change only through the SECURITY
-- DEFINER functions at the bottom of this file, which are executable solely by
-- the service role (called from Next.js server actions after the session has
-- been verified). Authenticated users can read their own rows through RLS and
-- manage only low-risk records (beneficiaries, preferences, card controls).
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  email text not null check (char_length(email) <= 320),
  phone text check (phone is null or phone ~ '^0[789][01][0-9]{8}$'),
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  account_number text not null unique check (account_number ~ '^[0-9]{10}$'),
  account_name text not null,
  bank_name text not null,
  currency char(3) not null default 'NGN' check (currency = 'NGN'),
  balance bigint not null default 0 check (balance >= 0),
  status text not null default 'active' check (status in ('active', 'frozen', 'closed')),
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  reference text not null unique check (char_length(reference) between 8 and 40),
  idempotency_key text check (idempotency_key is null or char_length(idempotency_key) <= 64),
  request_fingerprint text,
  type text not null check (type in ('transfer', 'airtime', 'data', 'electricity', 'cable_tv', 'internet', 'utility', 'betting', 'card', 'credit')),
  direction text not null check (direction in ('debit', 'credit')),
  status text not null check (status in ('pending', 'successful', 'failed', 'reversed')),
  amount bigint not null check (amount > 0),
  fee bigint not null default 0 check (fee >= 0),
  total bigint generated always as (case when direction = 'debit' then amount + fee else amount end) stored,
  description text not null check (char_length(description) <= 200),
  narration text check (narration is null or char_length(narration) <= 100),
  details jsonb not null default '{}'::jsonb,
  balance_after bigint,
  failure_reason text,
  provider text not null default 'demo',
  provider_reference text,
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint transactions_idempotency_unique unique (user_id, idempotency_key),
  constraint transactions_credit_no_fee check (direction = 'debit' or fee = 0)
);

create index transactions_user_created_idx on public.transactions (user_id, created_at desc);
create index transactions_account_created_idx on public.transactions (account_id, created_at desc);
create index transactions_user_type_idx on public.transactions (user_id, type);
create index transactions_user_status_idx on public.transactions (user_id, status);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  transaction_id uuid references public.transactions (id) on delete cascade,
  entry_type text not null check (entry_type in ('opening', 'principal', 'fee', 'reversal', 'credit')),
  direction text not null check (direction in ('debit', 'credit')),
  amount bigint not null check (amount > 0),
  balance_after bigint not null check (balance_after >= 0),
  created_at timestamptz not null default now(),
  constraint ledger_opening_has_no_txn check ((entry_type = 'opening') = (transaction_id is null))
);

create index ledger_entries_account_idx on public.ledger_entries (account_id, created_at);
create index ledger_entries_transaction_idx on public.ledger_entries (transaction_id);

create table public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bank_code text not null check (bank_code ~ '^[0-9]{3,6}$'),
  bank_name text not null,
  account_number text not null check (account_number ~ '^[0-9]{10}$'),
  account_name text not null check (char_length(account_name) <= 120),
  nickname text check (nickname is null or char_length(nickname) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  constraint beneficiaries_unique_account unique (user_id, bank_code, account_number)
);

create index beneficiaries_user_idx on public.beneficiaries (user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('transaction', 'security', 'system')),
  title text not null,
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

create table public.virtual_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  label text not null,
  last4 text not null check (last4 ~ '^[0-9]{4}$'),
  expiry_month smallint not null check (expiry_month between 1 and 12),
  expiry_year smallint not null check (expiry_year between 2024 and 2100),
  cardholder_name text not null,
  frozen boolean not null default false,
  online_payments boolean not null default true,
  daily_limit bigint not null check (daily_limit between 100000 and 500000000),
  monthly_limit bigint not null check (monthly_limit between 100000 and 2000000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint virtual_cards_limits check (daily_limit <= monthly_limit)
);

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'light' check (theme in ('light', 'dark', 'system')),
  hide_balance boolean not null default false,
  email_alerts boolean not null default true,
  sms_alerts boolean not null default false,
  push_alerts boolean not null default true,
  low_balance_alert boolean not null default true,
  low_balance_threshold bigint not null default 5000000 check (low_balance_threshold >= 0),
  marketing_emails boolean not null default false,
  updated_at timestamptz not null default now()
);

-- PIN hashes live in their own table with NO client policies: service role only.
create table public.user_security (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pin_hash text,
  pin_updated_at timestamptz,
  failed_pin_attempts integer not null default 0 check (failed_pin_attempts >= 0),
  pin_locked_until timestamptz
);

-- -----------------------------------------------------------------------------
-- Integrity triggers
-- -----------------------------------------------------------------------------

-- Ledger entries are append-only (resets set a transaction-local flag).
create or replace function public.prevent_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('eleos.allow_ledger_delete', true), '') = 'on' and tg_op = 'DELETE' then
    return old;
  end if;
  raise exception 'ledger_entries are append-only';
end;
$$;

create trigger ledger_entries_append_only
  before update or delete on public.ledger_entries
  for each row execute function public.prevent_ledger_mutation();

-- At commit, an account's balance must equal the sum of its ledger entries.
create or replace function public.assert_ledger_balanced()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_balance bigint;
  v_sum bigint;
begin
  select a.balance into v_balance from public.accounts a where a.id = new.account_id;
  if not found then
    return null; -- account deleted in the same transaction (reset)
  end if;
  select coalesce(sum(case when e.direction = 'credit' then e.amount else -e.amount end), 0)
    into v_sum from public.ledger_entries e where e.account_id = new.account_id;
  if v_sum <> v_balance then
    raise exception 'LEDGER_IMBALANCE: account % balance % != ledger %', new.account_id, v_balance, v_sum;
  end if;
  return null;
end;
$$;

create constraint trigger ledger_entries_balanced
  after insert on public.ledger_entries
  deferrable initially deferred
  for each row execute function public.assert_ledger_balanced();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger beneficiaries_touch before update on public.beneficiaries for each row execute function public.touch_updated_at();
create trigger virtual_cards_touch before update on public.virtual_cards for each row execute function public.touch_updated_at();
create trigger user_preferences_touch before update on public.user_preferences for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.beneficiaries enable row level security;
alter table public.notifications enable row level security;
alter table public.virtual_cards enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_security enable row level security;

-- Profiles: read own; update only name/phone (email changes go through Supabase Auth).
create policy "profiles: read own" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- Accounts, transactions, ledger: read-only for owners. Writes only via service-role functions.
create policy "accounts: read own" on public.accounts for select to authenticated using (user_id = (select auth.uid()));
create policy "transactions: read own" on public.transactions for select to authenticated using (user_id = (select auth.uid()));
create policy "ledger: read own" on public.ledger_entries for select to authenticated
  using (account_id in (select a.id from public.accounts a where a.user_id = (select auth.uid())));
revoke insert, update, delete on public.accounts, public.transactions, public.ledger_entries from anon, authenticated;
grant select on public.accounts, public.transactions, public.ledger_entries to authenticated;

-- Beneficiaries: full CRUD on own rows.
create policy "beneficiaries: read own" on public.beneficiaries for select to authenticated using (user_id = (select auth.uid()));
create policy "beneficiaries: insert own" on public.beneficiaries for insert to authenticated with check (user_id = (select auth.uid()));
create policy "beneficiaries: update own" on public.beneficiaries for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "beneficiaries: delete own" on public.beneficiaries for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.beneficiaries to authenticated;

-- Notifications: read own, mark own as read.
create policy "notifications: read own" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications: update own" on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, update, delete on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Virtual card: read own, change controls only.
create policy "cards: read own" on public.virtual_cards for select to authenticated using (user_id = (select auth.uid()));
create policy "cards: update own" on public.virtual_cards for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, update, delete on public.virtual_cards from anon, authenticated;
grant select on public.virtual_cards to authenticated;
grant update (frozen, online_payments, daily_limit, monthly_limit) on public.virtual_cards to authenticated;

-- Preferences: read/update own.
create policy "preferences: read own" on public.user_preferences for select to authenticated using (user_id = (select auth.uid()));
create policy "preferences: update own" on public.user_preferences for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, delete on public.user_preferences from anon, authenticated;
grant select, update on public.user_preferences to authenticated;

-- user_security: no policies at all -> inaccessible to anon/authenticated.
revoke all on public.user_security from anon, authenticated;

-- RLS does not apply to TRUNCATE; never let API roles hold it (or trigger/references).
revoke truncate, references, trigger on
  public.profiles, public.accounts, public.transactions, public.ledger_entries, public.beneficiaries,
  public.notifications, public.virtual_cards, public.user_preferences, public.user_security
  from anon, authenticated;
-- Anonymous (signed-out) visitors get nothing.
revoke all on
  public.profiles, public.accounts, public.transactions, public.ledger_entries, public.beneficiaries,
  public.notifications, public.virtual_cards, public.user_preferences
  from anon;

-- -----------------------------------------------------------------------------
-- Ledger functions (service role only)
-- Errors are raised as 'CODE:message' so the app can map them to user messages.
-- -----------------------------------------------------------------------------

create or replace function public.app_reserve_debit(
  p_user_id uuid,
  p_idempotency_key text,
  p_fingerprint text,
  p_reference text,
  p_type text,
  p_amount bigint,
  p_fee bigint,
  p_description text,
  p_narration text,
  p_details jsonb,
  p_provider text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.accounts;
  v_existing public.transactions;
  v_txn public.transactions;
  v_total bigint;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'VALIDATION:Amount must be positive'; end if;
  if p_fee is null or p_fee < 0 then raise exception 'VALIDATION:Fee must not be negative'; end if;
  if p_type = 'credit' then raise exception 'VALIDATION:Use app_post_credit for credits'; end if;

  -- Lock the account row first: concurrent submissions for this user serialise here.
  select * into v_account from public.accounts where user_id = p_user_id for update;
  if not found then raise exception 'NOT_FOUND:Account was not found.'; end if;

  select * into v_existing from public.transactions where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_fingerprint is distinct from p_fingerprint then
      raise exception 'IDEMPOTENCY_CONFLICT:This submission key was already used for a different payment.';
    end if;
    return jsonb_build_object('transaction', to_jsonb(v_existing), 'replayed', true);
  end if;

  if v_account.status <> 'active' then raise exception 'FORBIDDEN:This account cannot make payments right now.'; end if;

  v_total := p_amount + p_fee;
  if v_account.balance < v_total then
    raise exception 'INSUFFICIENT_FUNDS:Insufficient balance for this transaction, including fees.';
  end if;

  update public.accounts set balance = balance - v_total, updated_at = now() where id = v_account.id returning * into v_account;

  insert into public.transactions (user_id, account_id, reference, idempotency_key, request_fingerprint, type, direction, status,
                                   amount, fee, description, narration, details, balance_after, provider)
  values (p_user_id, v_account.id, p_reference, p_idempotency_key, p_fingerprint, p_type, 'debit', 'pending',
          p_amount, p_fee, p_description, p_narration, coalesce(p_details, '{}'::jsonb), v_account.balance, p_provider)
  returning * into v_txn;

  insert into public.ledger_entries (account_id, transaction_id, entry_type, direction, amount, balance_after)
  values (v_account.id, v_txn.id, 'principal', 'debit', p_amount, v_account.balance + p_fee);
  if p_fee > 0 then
    insert into public.ledger_entries (account_id, transaction_id, entry_type, direction, amount, balance_after)
    values (v_account.id, v_txn.id, 'fee', 'debit', p_fee, v_account.balance);
  end if;

  return jsonb_build_object('transaction', to_jsonb(v_txn), 'replayed', false);
end;
$$;

create or replace function public.app_settle_transaction(
  p_user_id uuid,
  p_transaction_id uuid,
  p_status text,
  p_provider_reference text,
  p_failure_reason text,
  p_details jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_txn public.transactions;
  v_account public.accounts;
begin
  if p_status not in ('successful', 'failed', 'pending') then raise exception 'VALIDATION:Invalid settlement status'; end if;

  select * into v_txn from public.transactions where id = p_transaction_id and user_id = p_user_id for update;
  if not found then raise exception 'NOT_FOUND:Transaction was not found.'; end if;
  if v_txn.status <> 'pending' then
    return to_jsonb(v_txn); -- already final: idempotent no-op
  end if;

  if p_status = 'failed' then
    select * into v_account from public.accounts where id = v_txn.account_id and user_id = p_user_id for update;
    update public.accounts set balance = balance + v_txn.total, updated_at = now() where id = v_account.id returning * into v_account;
    insert into public.ledger_entries (account_id, transaction_id, entry_type, direction, amount, balance_after)
    values (v_account.id, v_txn.id, 'reversal', 'credit', v_txn.total, v_account.balance);
  end if;

  update public.transactions set
    status = p_status,
    provider_reference = coalesce(p_provider_reference, provider_reference),
    failure_reason = case when p_status = 'failed' then coalesce(p_failure_reason, 'The payment could not be completed.') else failure_reason end,
    details = details || coalesce(p_details, '{}'::jsonb),
    completed_at = case when p_status = 'pending' then null else now() end,
    updated_at = now()
  where id = v_txn.id
  returning * into v_txn;

  return to_jsonb(v_txn);
end;
$$;

create or replace function public.app_post_credit(
  p_user_id uuid,
  p_idempotency_key text,
  p_fingerprint text,
  p_reference text,
  p_amount bigint,
  p_description text,
  p_narration text,
  p_details jsonb,
  p_provider text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.accounts;
  v_existing public.transactions;
  v_txn public.transactions;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'VALIDATION:Amount must be positive'; end if;

  select * into v_account from public.accounts where user_id = p_user_id for update;
  if not found then raise exception 'NOT_FOUND:Account was not found.'; end if;

  select * into v_existing from public.transactions where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_fingerprint is distinct from p_fingerprint then
      raise exception 'IDEMPOTENCY_CONFLICT:This submission key was already used for a different payment.';
    end if;
    return jsonb_build_object('transaction', to_jsonb(v_existing), 'replayed', true);
  end if;

  update public.accounts set balance = balance + p_amount, updated_at = now() where id = v_account.id returning * into v_account;

  insert into public.transactions (user_id, account_id, reference, idempotency_key, request_fingerprint, type, direction, status,
                                   amount, fee, description, narration, details, balance_after, provider, provider_reference, completed_at)
  values (p_user_id, v_account.id, p_reference, p_idempotency_key, p_fingerprint, 'credit', 'credit', 'successful',
          p_amount, 0, p_description, p_narration, coalesce(p_details, '{}'::jsonb), v_account.balance, p_provider,
          'CR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), now())
  returning * into v_txn;

  insert into public.ledger_entries (account_id, transaction_id, entry_type, direction, amount, balance_after)
  values (v_account.id, v_txn.id, 'credit', 'credit', p_amount, v_account.balance);

  return jsonb_build_object('transaction', to_jsonb(v_txn), 'replayed', false);
end;
$$;

create or replace function public.app_record_declined(
  p_user_id uuid,
  p_idempotency_key text,
  p_fingerprint text,
  p_reference text,
  p_type text,
  p_amount bigint,
  p_description text,
  p_details jsonb,
  p_provider text,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.accounts;
  v_existing public.transactions;
  v_txn public.transactions;
begin
  select * into v_account from public.accounts where user_id = p_user_id for update;
  if not found then raise exception 'NOT_FOUND:Account was not found.'; end if;

  select * into v_existing from public.transactions where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_fingerprint is distinct from p_fingerprint then
      raise exception 'IDEMPOTENCY_CONFLICT:This submission key was already used for a different payment.';
    end if;
    return jsonb_build_object('transaction', to_jsonb(v_existing), 'replayed', true);
  end if;

  insert into public.transactions (user_id, account_id, reference, idempotency_key, request_fingerprint, type, direction, status,
                                   amount, fee, description, details, balance_after, provider, failure_reason, completed_at)
  values (p_user_id, v_account.id, p_reference, p_idempotency_key, p_fingerprint, p_type, 'debit', 'failed',
          p_amount, 0, p_description, coalesce(p_details, '{}'::jsonb), v_account.balance, p_provider, p_reason, now())
  returning * into v_txn;

  return jsonb_build_object('transaction', to_jsonb(v_txn), 'replayed', false);
end;
$$;

create or replace function public.app_record_pin_attempt(p_user_id uuid, p_success boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.user_security;
begin
  select * into v_row from public.user_security where user_id = p_user_id for update;
  if not found then raise exception 'NOT_FOUND:Security settings were not found.'; end if;
  if p_success then
    update public.user_security set failed_pin_attempts = 0, pin_locked_until = null where user_id = p_user_id returning * into v_row;
  elsif v_row.failed_pin_attempts + 1 >= 5 then
    update public.user_security set failed_pin_attempts = 0, pin_locked_until = now() + interval '15 minutes' where user_id = p_user_id returning * into v_row;
  else
    update public.user_security set failed_pin_attempts = failed_pin_attempts + 1 where user_id = p_user_id returning * into v_row;
  end if;
  return to_jsonb(v_row);
end;
$$;

-- Provision a demo account from a seed built by the application (src/server/seed/demo-seed.ts).
-- Idempotent: returns false without changes if the user already has an account.
create or replace function public.app_provision_demo_account(p_user_id uuid, p_seed jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('eleos-provision:' || p_user_id::text));
  if exists (select 1 from public.accounts where user_id = p_user_id) then
    return false;
  end if;

  insert into public.profiles (id, full_name, email, phone, is_demo, created_at, updated_at)
  select p_user_id, r.full_name, r.email, r.phone, true, r.created_at, r.updated_at
  from jsonb_populate_record(null::public.profiles, p_seed -> 'profile') r
  on conflict (id) do nothing;

  insert into public.accounts (id, user_id, account_number, account_name, bank_name, currency, balance, status, is_demo, created_at, updated_at)
  select r.id, p_user_id, r.account_number, r.account_name, r.bank_name, r.currency, r.balance, r.status, true, r.created_at, r.updated_at
  from jsonb_populate_record(null::public.accounts, p_seed -> 'account') r;

  insert into public.transactions (id, user_id, account_id, reference, idempotency_key, request_fingerprint, type, direction, status,
                                   amount, fee, description, narration, details, balance_after, failure_reason, provider,
                                   provider_reference, is_demo, created_at, updated_at, completed_at)
  select r.id, p_user_id, r.account_id, r.reference, null, null, r.type, r.direction, r.status,
         r.amount, r.fee, r.description, r.narration, r.details, r.balance_after, r.failure_reason, r.provider,
         r.provider_reference, true, r.created_at, r.updated_at, r.completed_at
  from jsonb_populate_recordset(null::public.transactions, p_seed -> 'transactions') r;

  insert into public.ledger_entries (id, account_id, transaction_id, entry_type, direction, amount, balance_after, created_at)
  select r.id, r.account_id, r.transaction_id, r.entry_type, r.direction, r.amount, r.balance_after, r.created_at
  from jsonb_populate_recordset(null::public.ledger_entries, p_seed -> 'ledger_entries') r;

  insert into public.virtual_cards (id, user_id, account_id, label, last4, expiry_month, expiry_year, cardholder_name,
                                    frozen, online_payments, daily_limit, monthly_limit, created_at, updated_at)
  select r.id, p_user_id, r.account_id, r.label, r.last4, r.expiry_month, r.expiry_year, r.cardholder_name,
         r.frozen, r.online_payments, r.daily_limit, r.monthly_limit, r.created_at, r.updated_at
  from jsonb_populate_record(null::public.virtual_cards, p_seed -> 'card') r;

  insert into public.user_preferences (user_id, theme, hide_balance, email_alerts, sms_alerts, push_alerts,
                                       low_balance_alert, low_balance_threshold, marketing_emails, updated_at)
  select p_user_id, r.theme, r.hide_balance, r.email_alerts, r.sms_alerts, r.push_alerts,
         r.low_balance_alert, r.low_balance_threshold, r.marketing_emails, r.updated_at
  from jsonb_populate_record(null::public.user_preferences, p_seed -> 'preferences') r
  on conflict (user_id) do nothing;

  insert into public.user_security (user_id) values (p_user_id) on conflict (user_id) do nothing;

  insert into public.beneficiaries (id, user_id, bank_code, bank_name, account_number, account_name, nickname, created_at, updated_at, last_used_at)
  select r.id, p_user_id, r.bank_code, r.bank_name, r.account_number, r.account_name, r.nickname, r.created_at, r.updated_at, r.last_used_at
  from jsonb_populate_recordset(null::public.beneficiaries, p_seed -> 'beneficiaries') r
  on conflict (user_id, bank_code, account_number) do nothing;

  insert into public.notifications (id, user_id, kind, title, body, link, read_at, created_at)
  select r.id, p_user_id, r.kind, r.title, r.body, r.link, r.read_at, r.created_at
  from jsonb_populate_recordset(null::public.notifications, p_seed -> 'notifications') r;

  return true;
end;
$$;

-- Wipe a user's demo money data and provision a fresh demo account.
create or replace function public.app_reset_demo_account(p_user_id uuid, p_seed jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('eleos.allow_ledger_delete', 'on', true);
  delete from public.notifications where user_id = p_user_id;
  delete from public.beneficiaries where user_id = p_user_id;
  delete from public.virtual_cards where user_id = p_user_id;
  delete from public.accounts where user_id = p_user_id; -- cascades transactions and ledger entries
  perform set_config('eleos.allow_ledger_delete', 'off', true);
  return public.app_provision_demo_account(p_user_id, p_seed);
end;
$$;

-- Only the service role (server actions) may execute the money functions.
revoke all on function public.app_reserve_debit(uuid, text, text, text, text, bigint, bigint, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.app_settle_transaction(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.app_post_credit(uuid, text, text, text, bigint, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.app_record_declined(uuid, text, text, text, text, bigint, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.app_record_pin_attempt(uuid, boolean) from public, anon, authenticated;
revoke all on function public.app_provision_demo_account(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.app_reset_demo_account(uuid, jsonb) from public, anon, authenticated;

grant execute on function public.app_reserve_debit(uuid, text, text, text, text, bigint, bigint, text, text, jsonb, text) to service_role;
grant execute on function public.app_settle_transaction(uuid, uuid, text, text, text, jsonb) to service_role;
grant execute on function public.app_post_credit(uuid, text, text, text, bigint, text, text, jsonb, text) to service_role;
grant execute on function public.app_record_declined(uuid, text, text, text, text, bigint, text, jsonb, text, text) to service_role;
grant execute on function public.app_record_pin_attempt(uuid, boolean) to service_role;
grant execute on function public.app_provision_demo_account(uuid, jsonb) to service_role;
grant execute on function public.app_reset_demo_account(uuid, jsonb) to service_role;
