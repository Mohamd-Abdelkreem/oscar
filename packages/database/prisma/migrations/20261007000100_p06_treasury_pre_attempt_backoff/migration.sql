BEGIN;
ALTER TABLE treasury_sweeps ADD COLUMN next_attempt_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX treasury_sweeps_due_idx ON treasury_sweeps(state, next_attempt_at, created_at, id);
COMMIT;
