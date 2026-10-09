BEGIN;

-- The composed signer checks retained inbound inventory before its payout pass.
-- These reads and the assignment lock do not grant recovery acknowledgement.
GRANT SELECT ON transfer_attempts,treasury_sweeps,deposit_address_assignments TO p06_signer;
GRANT UPDATE(id) ON deposit_address_assignments TO p06_signer;

COMMIT;
