BEGIN;

-- PostgreSQL requires these labels to commit before dependent constraints use them.
ALTER TYPE financial_operation_kind ADD VALUE 'SETTLE';
ALTER TYPE financial_origin ADD VALUE 'WITHDRAWAL_SETTLEMENT';
ALTER TYPE reservation_state ADD VALUE 'SETTLED';

COMMIT;
