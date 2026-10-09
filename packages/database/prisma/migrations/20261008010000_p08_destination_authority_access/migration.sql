BEGIN;

-- First-recipient commands must read current authority and lock users/admission
-- without inheriting the migrator's broad access. PostgreSQL locking SELECTs
-- require UPDATE on at least one column; control/boot mutations remain guarded.
GRANT SELECT ON users, auth_sessions, financial_runtime_control, financial_runtime_admissions TO p06_api;
GRANT UPDATE(updated_at) ON users TO p06_api;
GRANT UPDATE(id) ON financial_runtime_control TO p06_api;
GRANT UPDATE(boot_id) ON financial_runtime_admissions TO p06_api;

COMMIT;
