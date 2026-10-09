BEGIN;

-- Requesting a boot grants no acknowledgement; the existing trigger checks process role.
GRANT INSERT ON financial_runtime_admissions TO p06_api,p06_deposit_worker,p06_signer;

-- Restriction cancellation preserves existing identity/session audit in its financial transaction.
GRANT UPDATE(status,tasks_blocked,withdrawals_blocked,account_version,verification_token_hash,verification_token_expires_at,reset_token_hash,reset_token_expires_at) ON users TO p06_api;
GRANT UPDATE(revoked_at) ON auth_sessions TO p06_api;
GRANT SELECT,DELETE ON refresh_tokens TO p06_api;
GRANT UPDATE(id) ON refresh_tokens TO p06_api;
GRANT SELECT,INSERT ON identity_audit_records TO p06_api;
GRANT UPDATE(state,release_operation_id,released_at) ON reservation_allocations TO p06_api;

-- Scheduling has only the reads and column privileges needed for ordered locks and hints.
GRANT SELECT(id) ON users TO p06_deposit_worker;
GRANT SELECT(id,owner_user_id) ON wallets TO p06_deposit_worker;
GRANT SELECT(id,wallet_id) ON reservation_allocations TO p06_deposit_worker;
GRANT UPDATE(updated_at) ON users,wallets TO p06_deposit_worker;
GRANT UPDATE(id) ON reservation_allocations TO p06_deposit_worker;
GRANT SELECT ON financial_runtime_control,financial_runtime_admissions TO p06_deposit_worker,p06_signer;
GRANT UPDATE(id) ON financial_runtime_control TO p06_deposit_worker,p06_signer;
GRANT UPDATE(boot_id) ON financial_runtime_admissions TO p06_deposit_worker,p06_signer;

-- The protected non-signing Group A claim boundary shares the same lock order.
GRANT SELECT(id,role,status,email_verified_at,withdrawals_blocked) ON users TO p06_signer;
GRANT SELECT(id,owner_user_id) ON wallets TO p06_signer;
GRANT SELECT ON reservation_allocations TO p06_signer;
GRANT SELECT ON financial_operations,financial_audit_records,ledger_postings TO p06_signer;
GRANT UPDATE(updated_at) ON users,wallets TO p06_signer;
GRANT UPDATE(id) ON reservation_allocations,withdrawal_destinations,withdrawal_quotes TO p06_signer;

COMMIT;
