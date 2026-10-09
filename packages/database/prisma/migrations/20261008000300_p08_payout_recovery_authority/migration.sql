-- Transaction-scoped independent recovery evidence binds the current fenced generation and inventory.
CREATE FUNCTION p08_recovery_fingerprint() RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE retained text; contents text; inventory text := ''; hints text[];
BEGIN
  FOREACH retained IN ARRAY ARRAY['users','auth_sessions','identity_audit_records','wallets','financial_operations','financial_request_identities','ledger_postings','reservation_allocations','financial_audit_records','purchases','subscriptions','referral_decisions','task_submissions','final_reviews','manual_credits','withdrawal_destinations','withdrawal_destination_audits','withdrawal_policy','withdrawal_quotes','withdrawal_requests','withdrawal_actions','treasury_payout_keys','withdrawal_attempts'] LOOP
    hints := CASE WHEN retained='withdrawal_attempts' THEN ARRAY['next_check_at','blocker','version'] WHEN retained='withdrawal_requests' THEN ARRAY['next_check_at','blocker'] ELSE ARRAY[]::text[] END;
    EXECUTE format('SELECT coalesce(string_agg((to_jsonb(record)-$1)::text,E''\n'' ORDER BY id),'''') FROM %I record',retained) INTO contents USING hints;
    inventory := inventory || retained || E'\n' || encode(sha256(convert_to(contents,'UTF8')),'hex') || E'\n';
  END LOOP;
  SELECT inventory || generation::text || ':' || version::text INTO inventory FROM financial_runtime_control WHERE id=1;
  RETURN encode(sha256(convert_to(inventory,'UTF8')),'hex');
END;
$$;
REVOKE ALL ON FUNCTION p08_recovery_fingerprint() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION p08_recovery_fingerprint() TO p06_recovery_operator;

CREATE FUNCTION guard_p08_recovery_admission() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE approving boolean;
BEGIN
  IF TG_TABLE_NAME='financial_runtime_admissions' THEN
    approving := NEW.acknowledged_generation IS NOT NULL;
  ELSE
    approving := OLD.financial_writes_fenced AND NOT NEW.financial_writes_fenced;
  END IF;
  IF NOT approving THEN RETURN NEW; END IF;
  -- Disposable migration owner remains available to fixtures, never admitted ordinary runtime roles.
  IF EXISTS(SELECT 1 FROM pg_class WHERE oid='financial_runtime_control'::regclass AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) THEN RETURN NEW; END IF;
  IF NOT p06_role_member('p06_recovery_operator')
    OR p06_role_member('p06_api') OR p06_role_member('p06_deposit_worker') OR p06_role_member('p06_signer')
    OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='public' AND pg_has_role(current_user,nspowner,'MEMBER'))
    OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND pg_has_role(current_user,c.relowner,'MEMBER'))
    OR EXISTS(SELECT 1 FROM pg_roles WHERE (rolsuper OR rolcreaterole OR rolbypassrls) AND pg_has_role(current_user,oid,'MEMBER')) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Independent recovery authority required';
  END IF;
  IF (EXISTS(SELECT 1 FROM treasury_payout_keys) OR EXISTS(SELECT 1 FROM withdrawal_attempts))
    AND current_setting('p08.verified_inventory',true) IS DISTINCT FROM p08_recovery_fingerprint() THEN
    RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='ck_p08_recovery_inventory',MESSAGE='Current independently verified payout inventory required';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_p08_recovery_boot BEFORE UPDATE ON financial_runtime_admissions FOR EACH ROW EXECUTE FUNCTION guard_p08_recovery_admission();
CREATE TRIGGER guard_p08_recovery_control BEFORE UPDATE ON financial_runtime_control FOR EACH ROW EXECUTE FUNCTION guard_p08_recovery_admission();

GRANT SELECT ON treasury_payout_keys,withdrawal_attempts TO p06_recovery_operator;
GRANT SELECT ON financial_runtime_control,financial_runtime_admissions TO p06_recovery_operator;
GRANT UPDATE(version,generation,financial_writes_fenced,new_dispatch_paused,operator_identity,reason,evidence_reference,reconciliation_cutoff,updated_at) ON financial_runtime_control TO p06_recovery_operator;
GRANT UPDATE(acknowledged_generation,acknowledged_at,operator_identity,evidence_reference) ON financial_runtime_admissions TO p06_recovery_operator;
-- Read-only off-chain authority is required for history and original-source admission, never a balance writer.
GRANT SELECT ON users,auth_sessions,identity_audit_records,wallets,financial_operations,financial_request_identities,ledger_postings,reservation_allocations,financial_audit_records,purchases,subscriptions,referral_decisions,task_submissions,final_reviews,manual_credits TO p06_recovery_operator;
GRANT SELECT ON deposit_address_assignments,treasury_sweeps,transfer_attempts,deposit_receipts,deposit_candidates,deposit_candidate_discoveries,deposit_scan_progress TO p06_recovery_operator;
