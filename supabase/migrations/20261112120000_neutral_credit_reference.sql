-- =============================================================================
-- Eleos — neutral provider reference for incoming credits
--
-- Re-creates public.app_post_credit so new credits get a "CR-XXXXXXXX" provider
-- reference instead of "DEMO-CR-XXXXXXXX". Behaviour is otherwise identical.
-- Safe to run more than once. Already included in the main schema file for new
-- projects; only existing projects need this.
-- =============================================================================

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

revoke all on function public.app_post_credit(uuid, text, text, text, bigint, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.app_post_credit(uuid, text, text, text, bigint, text, text, jsonb, text) to service_role;
