BEGIN;

-- Public gross reservations use the existing audited ledger and immutable history guards.
GRANT SELECT ON wallets, subscriptions, reservation_allocations, financial_operations,
  financial_request_identities, ledger_postings, financial_audit_records TO p06_api;
GRANT INSERT ON reservation_allocations, financial_operations, financial_request_identities,
  ledger_postings, financial_audit_records TO p06_api;
GRANT UPDATE(available_non_referral_units,reserved_non_referral_units,available_referral_units,reserved_referral_units,updated_at) ON wallets TO p06_api;
-- These column privileges permit row locks without granting mutable domain terms.
GRANT UPDATE(id) ON reservation_allocations, auth_sessions, withdrawal_policy, withdrawal_quotes TO p06_api;

COMMIT;
