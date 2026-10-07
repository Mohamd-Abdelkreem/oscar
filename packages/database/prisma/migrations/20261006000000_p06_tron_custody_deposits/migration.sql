BEGIN;

-- CreateEnum
CREATE TYPE "tron_network" AS ENUM ('TRON_MAINNET', 'TRON_SHASTA', 'TRON_NILE');

-- CreateEnum
CREATE TYPE "deposit_assignment_state" AS ENUM ('REQUESTED', 'KEY_STORED', 'RECOVERY_ACKED', 'READY');

-- CreateEnum
CREATE TYPE "tron_activation_state" AS ENUM ('UNKNOWN', 'INACTIVE', 'ACTIVE');

-- CreateEnum
CREATE TYPE "deposit_candidate_state" AS ENUM ('PENDING', 'VERIFYING', 'UNRESOLVED', 'ACCOUNTED', 'INELIGIBLE', 'CONFLICT');

-- CreateEnum
CREATE TYPE "deposit_scan_mode" AS ENUM ('HOT', 'HISTORICAL');

-- CreateEnum
CREATE TYPE "manual_credit_reference_kind" AS ENUM ('EXTERNAL', 'LEDGER_OPERATION');

-- CreateEnum
CREATE TYPE "treasury_sweep_state" AS ENUM ('REQUESTED', 'WAITING_RESOURCES', 'SIGNING', 'SIGNED', 'SUBMITTED', 'UNKNOWN', 'CONFIRMED', 'CHAIN_FAILED', 'SAFE_FAILED', 'EXPIRED_PROVEN_UNSENT');

-- CreateEnum
CREATE TYPE "financial_process_kind" AS ENUM ('API', 'DEPOSIT_WORKER', 'SIGNER');

-- CreateTable
CREATE TABLE "deposit_address_assignments" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "network" "tron_network" NOT NULL,
    "state" "deposit_assignment_state" NOT NULL DEFAULT 'REQUESTED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ready_at" TIMESTAMPTZ(6),
    "address" VARCHAR(34),
    "key_record_id" UUID NOT NULL,
    "key_envelope_digest" CHAR(64),
    "key_version" INTEGER,
    "recovery_ack_id" UUID,
    "recovery_digest" CHAR(64),
    "recovery_acknowledged_at" TIMESTAMPTZ(6),
    "lease_owner" UUID,
    "lease_until" TIMESTAMPTZ(6),
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error_code" VARCHAR(64),
    "activation_state" "tron_activation_state" NOT NULL DEFAULT 'UNKNOWN',
    "resource_checked_at" TIMESTAMPTZ(6),
    "scan_boundary_block_number" BIGINT,
    "scan_boundary_block_id" CHAR(64),
    "scan_boundary_timestamp" BIGINT,

    CONSTRAINT "deposit_address_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_candidates" (
    "id" UUID NOT NULL,
    "network" "tron_network" NOT NULL,
    "transaction_id" CHAR(64) NOT NULL,
    "first_observed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_observed_at" TIMESTAMPTZ(6) NOT NULL,
    "observed_block_time" BIGINT,
    "state" "deposit_candidate_state" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "lease_owner" UUID,
    "lease_until" TIMESTAMPTZ(6),
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error_code" VARCHAR(64),
    "canonical_evidence_digest" CHAR(64),
    "verified_at" TIMESTAMPTZ(6),
    "accounted_at" TIMESTAMPTZ(6),

    CONSTRAINT "deposit_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_scan_progress" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "mode" "deposit_scan_mode" NOT NULL,
    "cycle" INTEGER NOT NULL DEFAULT 0,
    "window_from" BIGINT NOT NULL,
    "window_to" BIGINT NOT NULL,
    "history_boundary" BIGINT NOT NULL,
    "next_window_from" BIGINT NOT NULL,
    "fingerprint" VARCHAR(2048),
    "query_policy_hash" CHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lease_owner" UUID,
    "lease_until" TIMESTAMPTZ(6),
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_completed_at" TIMESTAMPTZ(6),
    "last_error_code" VARCHAR(64),

    CONSTRAINT "deposit_scan_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_receipts" (
    "id" UUID NOT NULL,
    "network" "tron_network" NOT NULL,
    "transaction_id" CHAR(64) NOT NULL,
    "log_index" INTEGER NOT NULL,
    "assignment_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "token_contract" VARCHAR(34) NOT NULL,
    "sender" VARCHAR(34) NOT NULL,
    "recipient" VARCHAR(34) NOT NULL,
    "amount_units" BIGINT NOT NULL,
    "block_number" BIGINT NOT NULL,
    "block_id" CHAR(64) NOT NULL,
    "block_timestamp" BIGINT NOT NULL,
    "execution_result" VARCHAR(32) NOT NULL,
    "finality_policy" VARCHAR(64) NOT NULL,
    "verified_at" TIMESTAMPTZ(6) NOT NULL,
    "evidence_digest" CHAR(64) NOT NULL,
    "financial_operation_id" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "deposit_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_credits" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "amount_units" BIGINT NOT NULL,
    "source" "fund_source" NOT NULL DEFAULT 'NON_REFERRAL',
    "confirmed" BOOLEAN NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "reference_kind" "manual_credit_reference_kind" NOT NULL,
    "external_reference" VARCHAR(256),
    "reference_operation_id" UUID,
    "payload_hash" CHAR(64) NOT NULL,
    "financial_operation_id" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "manual_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_sweeps" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "network" "tron_network" NOT NULL,
    "token_contract" VARCHAR(34) NOT NULL,
    "source" VARCHAR(34) NOT NULL,
    "treasury" VARCHAR(34) NOT NULL,
    "amount_units" BIGINT NOT NULL,
    "policy_snapshot" JSONB NOT NULL,
    "operator_identity" VARCHAR(160) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "state" "treasury_sweep_state" NOT NULL DEFAULT 'REQUESTED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_at" TIMESTAMPTZ(6),
    "finalized_at" TIMESTAMPTZ(6),
    "current_attempt_id" UUID,
    "last_error_code" VARCHAR(64),

    CONSTRAINT "treasury_sweeps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_attempts" (
    "id" UUID NOT NULL,
    "sweep_id" UUID NOT NULL,
    "intent_hash" CHAR(64) NOT NULL,
    "network" "tron_network" NOT NULL,
    "token_contract" VARCHAR(34) NOT NULL,
    "source" VARCHAR(34) NOT NULL,
    "treasury" VARCHAR(34) NOT NULL,
    "amount_units" BIGINT NOT NULL,
    "transaction_id" CHAR(64),
    "expiration" BIGINT,
    "signed_at" TIMESTAMPTZ(6),
    "envelope_id" UUID,
    "envelope_digest" CHAR(64),
    "recovery_ack_id" UUID,
    "recovery_digest" CHAR(64),
    "recovery_acknowledged_at" TIMESTAMPTZ(6),
    "broadcast_intent_id" UUID,
    "observation_block_number" BIGINT,
    "observation_timestamp" BIGINT,
    "broadcast_admitted_at" TIMESTAMPTZ(6),
    "state" "treasury_sweep_state" NOT NULL DEFAULT 'SIGNING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error_code" VARCHAR(64),
    "final_evidence" JSONB,
    "energy_units" BIGINT,
    "bandwidth_units" BIGINT,
    "fee_sun" BIGINT,

    CONSTRAINT "transfer_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_runtime_control" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "generation" BIGINT NOT NULL DEFAULT 1,
    "financial_writes_fenced" BOOLEAN NOT NULL DEFAULT true,
    "new_dispatch_paused" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "reason" VARCHAR(500) NOT NULL,
    "operator_identity" VARCHAR(160) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidence_reference" VARCHAR(256),
    "reconciliation_cutoff" TIMESTAMPTZ(6),

    CONSTRAINT "financial_runtime_control_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_runtime_admissions" (
    "boot_id" UUID NOT NULL,
    "process_kind" "financial_process_kind" NOT NULL,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_generation" BIGINT,
    "acknowledged_at" TIMESTAMPTZ(6),
    "operator_identity" VARCHAR(160),
    "evidence_reference" VARCHAR(256),

    CONSTRAINT "financial_runtime_admissions_pkey" PRIMARY KEY ("boot_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deposit_address_assignments_key_record_id_key" ON "deposit_address_assignments"("key_record_id");

-- CreateIndex
CREATE INDEX "deposit_assignments_due_idx" ON "deposit_address_assignments"("state", "next_attempt_at", "lease_until", "id");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_assignments_employee_network_key" ON "deposit_address_assignments"("employee_id", "network");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_assignments_network_address_key" ON "deposit_address_assignments"("network", "address");

-- CreateIndex
CREATE INDEX "deposit_candidates_due_idx" ON "deposit_candidates"("state", "next_attempt_at", "lease_until", "id");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_candidates_event_key" ON "deposit_candidates"("network", "transaction_id");

-- CreateIndex
CREATE INDEX "deposit_scan_due_idx" ON "deposit_scan_progress"("next_attempt_at", "lease_until", "id");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_scan_assignment_mode_key" ON "deposit_scan_progress"("assignment_id", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_receipts_financial_operation_id_key" ON "deposit_receipts"("financial_operation_id");

-- CreateIndex
CREATE INDEX "deposit_receipts_wallet_history_idx" ON "deposit_receipts"("wallet_id", "recorded_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "deposit_receipts_history_idx" ON "deposit_receipts"("recorded_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "deposit_receipts_event_key" ON "deposit_receipts"("network", "transaction_id", "log_index");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_receipts_financial_operation_id_wallet_id_key" ON "deposit_receipts"("financial_operation_id", "wallet_id");

-- CreateIndex
CREATE UNIQUE INDEX "manual_credits_financial_operation_id_key" ON "manual_credits"("financial_operation_id");

-- CreateIndex
CREATE INDEX "manual_credits_wallet_history_idx" ON "manual_credits"("wallet_id", "recorded_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "manual_credits_history_idx" ON "manual_credits"("recorded_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "manual_credits_financial_operation_id_wallet_id_key" ON "manual_credits"("financial_operation_id", "wallet_id");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_sweeps_current_attempt_id_key" ON "treasury_sweeps"("current_attempt_id");

-- CreateIndex
CREATE INDEX "treasury_sweeps_reconcile_idx" ON "treasury_sweeps"("state", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_attempts_sweep_id_key" ON "transfer_attempts"("sweep_id");

-- CreateIndex
CREATE INDEX "transfer_attempts_reconcile_idx" ON "transfer_attempts"("state", "next_attempt_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_attempts_network_transaction_key" ON "transfer_attempts"("network", "transaction_id");

-- AddForeignKey
ALTER TABLE "deposit_address_assignments" ADD CONSTRAINT "deposit_address_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "deposit_address_assignments" ADD CONSTRAINT "deposit_address_assignments_wallet_id_employee_id_fkey" FOREIGN KEY ("wallet_id", "employee_id") REFERENCES "wallets"("id", "owner_user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "deposit_scan_progress" ADD CONSTRAINT "deposit_scan_progress_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "deposit_address_assignments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "deposit_receipts" ADD CONSTRAINT "deposit_receipts_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "deposit_address_assignments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "deposit_receipts" ADD CONSTRAINT "deposit_receipts_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "deposit_receipts" ADD CONSTRAINT "deposit_receipts_financial_operation_id_wallet_id_fkey" FOREIGN KEY ("financial_operation_id", "wallet_id") REFERENCES "financial_operations"("id", "wallet_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "manual_credits" ADD CONSTRAINT "manual_credits_wallet_id_employee_id_fkey" FOREIGN KEY ("wallet_id", "employee_id") REFERENCES "wallets"("id", "owner_user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "manual_credits" ADD CONSTRAINT "manual_credits_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "manual_credits" ADD CONSTRAINT "manual_credits_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "manual_credits" ADD CONSTRAINT "manual_credits_financial_operation_id_wallet_id_fkey" FOREIGN KEY ("financial_operation_id", "wallet_id") REFERENCES "financial_operations"("id", "wallet_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "manual_credits" ADD CONSTRAINT "manual_credits_reference_operation_id_wallet_id_fkey" FOREIGN KEY ("reference_operation_id", "wallet_id") REFERENCES "financial_operations"("id", "wallet_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "treasury_sweeps" ADD CONSTRAINT "treasury_sweeps_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "deposit_address_assignments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "treasury_sweeps" ADD CONSTRAINT "treasury_sweeps_current_attempt_id_fkey" FOREIGN KEY ("current_attempt_id") REFERENCES "transfer_attempts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "transfer_attempts" ADD CONSTRAINT "transfer_attempts_sweep_id_fkey" FOREIGN KEY ("sweep_id") REFERENCES "treasury_sweeps"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- No historic assignment, receipt or grant is inferred from existing ledger data.
INSERT INTO financial_runtime_control (id, reason, operator_identity)
VALUES (1, 'P06 recovery admission required', 'migration');

ALTER TABLE financial_runtime_control ADD CONSTRAINT ck_p06_control CHECK (
  id = 1 AND generation > 0 AND version > 0 AND length(btrim(reason)) > 0
  AND length(btrim(operator_identity)) > 0
  AND (financial_writes_fenced OR (evidence_reference IS NOT NULL AND reconciliation_cutoff IS NOT NULL)));
ALTER TABLE financial_runtime_admissions ADD CONSTRAINT ck_p06_admission CHECK (
  (acknowledged_generation IS NULL AND acknowledged_at IS NULL AND operator_identity IS NULL AND evidence_reference IS NULL)
  OR (acknowledged_generation > 0 AND acknowledged_at IS NOT NULL AND acknowledged_at >= requested_at
    AND operator_identity IS NOT NULL AND length(btrim(operator_identity)) > 0
    AND evidence_reference IS NOT NULL AND length(btrim(evidence_reference)) > 0));

ALTER TABLE deposit_address_assignments ADD CONSTRAINT ck_p06_assignment CHECK ((
  version > 0 AND (address IS NULL OR address ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$')
  AND ((lease_owner IS NULL) = (lease_until IS NULL))
  AND ((scan_boundary_block_number IS NULL AND scan_boundary_block_id IS NULL AND scan_boundary_timestamp IS NULL)
    OR (scan_boundary_block_number >= 0 AND scan_boundary_block_id ~ '^[0-9a-f]{64}$' AND scan_boundary_timestamp >= 0))
  AND ((state = 'REQUESTED' AND address IS NULL AND ready_at IS NULL AND key_envelope_digest IS NULL AND key_version IS NULL)
    OR (state IN ('KEY_STORED','RECOVERY_ACKED','READY') AND address IS NOT NULL
      AND scan_boundary_block_number IS NOT NULL AND scan_boundary_block_id IS NOT NULL AND scan_boundary_timestamp IS NOT NULL
      AND key_envelope_digest ~ '^[0-9a-f]{64}$' AND key_version > 0))
  AND ((state IN ('REQUESTED','KEY_STORED') AND recovery_ack_id IS NULL AND recovery_digest IS NULL AND recovery_acknowledged_at IS NULL AND ready_at IS NULL)
    OR (state IN ('RECOVERY_ACKED','READY') AND recovery_ack_id IS NOT NULL AND recovery_digest = key_envelope_digest AND recovery_acknowledged_at IS NOT NULL))
  AND ((state = 'READY' AND ready_at IS NOT NULL AND ready_at >= created_at) OR (state <> 'READY' AND ready_at IS NULL))
) IS TRUE);

ALTER TABLE deposit_candidates ADD CONSTRAINT ck_p06_candidate CHECK ((
  transaction_id ~ '^[0-9a-f]{64}$' AND version > 0 AND attempt_count >= 0
  AND last_observed_at >= first_observed_at AND (observed_block_time IS NULL OR observed_block_time >= 0)
  AND ((lease_owner IS NULL) = (lease_until IS NULL))
  AND (canonical_evidence_digest IS NULL OR canonical_evidence_digest ~ '^[0-9a-f]{64}$')
  AND (state NOT IN ('ACCOUNTED','INELIGIBLE') OR (canonical_evidence_digest IS NOT NULL AND verified_at IS NOT NULL))
  AND ((state = 'ACCOUNTED' AND accounted_at IS NOT NULL) OR (state <> 'ACCOUNTED' AND accounted_at IS NULL))
) IS TRUE);
ALTER TABLE deposit_scan_progress ADD CONSTRAINT ck_p06_scan CHECK (
  cycle >= 0 AND version > 0 AND window_from >= 0 AND window_to >= window_from
  AND history_boundary >= 0 AND next_window_from >= history_boundary AND window_from >= history_boundary
  AND query_policy_hash ~ '^[0-9a-f]{64}$' AND ((lease_owner IS NULL) = (lease_until IS NULL)));
ALTER TABLE deposit_receipts ADD CONSTRAINT ck_p06_receipt CHECK (
  transaction_id ~ '^[0-9a-f]{64}$' AND log_index >= 0 AND amount_units > 0
  AND block_number >= 0 AND block_timestamp >= 0 AND block_id ~ '^[0-9a-f]{64}$'
  AND evidence_digest ~ '^[0-9a-f]{64}$' AND execution_result = 'SUCCESS'
  AND finality_policy = 'SOLIDIFIED_CANONICAL_SUCCESS'
  AND token_contract ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$' AND sender ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$'
  AND recipient ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$' AND recorded_at >= verified_at);
ALTER TABLE manual_credits ADD CONSTRAINT ck_p06_manual_credit CHECK ((
  amount_units > 0 AND source = 'NON_REFERRAL' AND confirmed
  AND length(btrim(reason)) > 0 AND payload_hash ~ '^[0-9a-f]{64}$'
  AND ((reference_kind = 'EXTERNAL' AND reference_operation_id IS NULL AND external_reference IS NOT NULL
      AND length(btrim(external_reference)) BETWEEN 3 AND 256 AND external_reference ~ '[[:alnum:]]' AND external_reference !~ '[[:cntrl:]]')
    OR (reference_kind = 'LEDGER_OPERATION' AND reference_operation_id IS NOT NULL AND external_reference IS NULL))
) IS TRUE);
ALTER TABLE treasury_sweeps ADD CONSTRAINT ck_p06_sweep CHECK (
  version > 0 AND amount_units > 0 AND source <> treasury
  AND source ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$' AND treasury ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$'
  AND token_contract ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$' AND payload_hash ~ '^[0-9a-f]{64}$'
  AND length(btrim(operator_identity)) > 0 AND length(btrim(reason)) > 0 AND jsonb_typeof(policy_snapshot) = 'object'
  AND ((state IN ('CONFIRMED','CHAIN_FAILED','SAFE_FAILED','EXPIRED_PROVEN_UNSENT')) = (finalized_at IS NOT NULL)));
CREATE UNIQUE INDEX treasury_sweeps_active_source_key ON treasury_sweeps(source, network, token_contract)
WHERE state IN ('REQUESTED','WAITING_RESOURCES','SIGNING','SIGNED','SUBMITTED','UNKNOWN');
ALTER TABLE transfer_attempts ADD CONSTRAINT ck_p06_attempt CHECK ((
  version > 0 AND amount_units > 0 AND intent_hash ~ '^[0-9a-f]{64}$' AND attempt_count >= 0
  AND (energy_units IS NULL OR energy_units >= 0) AND (bandwidth_units IS NULL OR bandwidth_units >= 0) AND (fee_sun IS NULL OR fee_sun >= 0)
  AND ((transaction_id IS NULL AND expiration IS NULL AND signed_at IS NULL AND envelope_id IS NULL AND envelope_digest IS NULL)
    OR (transaction_id ~ '^[0-9a-f]{64}$' AND expiration > 0 AND signed_at IS NOT NULL AND envelope_id IS NOT NULL AND envelope_digest ~ '^[0-9a-f]{64}$'))
  AND ((recovery_ack_id IS NULL AND recovery_digest IS NULL AND recovery_acknowledged_at IS NULL)
    OR (transaction_id IS NOT NULL AND recovery_ack_id IS NOT NULL AND recovery_digest = envelope_digest AND recovery_acknowledged_at IS NOT NULL))
  AND ((broadcast_intent_id IS NULL AND broadcast_admitted_at IS NULL AND observation_block_number IS NULL AND observation_timestamp IS NULL)
    OR (recovery_ack_id IS NOT NULL AND broadcast_intent_id IS NOT NULL AND broadcast_admitted_at IS NOT NULL
      AND observation_block_number >= 0 AND observation_timestamp >= 0))
  AND (state NOT IN ('SIGNED','SUBMITTED','UNKNOWN','CONFIRMED','CHAIN_FAILED','EXPIRED_PROVEN_UNSENT') OR transaction_id IS NOT NULL)
  AND (state NOT IN ('SUBMITTED','UNKNOWN','CONFIRMED','CHAIN_FAILED','EXPIRED_PROVEN_UNSENT') OR broadcast_intent_id IS NOT NULL)
  AND (state NOT IN ('CONFIRMED','CHAIN_FAILED','EXPIRED_PROVEN_UNSENT') OR final_evidence IS NOT NULL)
) IS TRUE);

-- Membership is granted by protected deployment/test fixtures, never by the API.
-- A missing role is not privileged. Migrator/table-owner can bootstrap fixtures.
CREATE FUNCTION p06_role_member(role_name text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name AND pg_has_role(current_user, oid, 'MEMBER'));
$$;
CREATE FUNCTION p06_recovery_authority() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT p06_role_member('p06_recovery_operator') OR EXISTS (
    SELECT 1 FROM pg_class WHERE oid = 'financial_runtime_control'::regclass AND relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user));
$$;
CREATE FUNCTION guard_p06_runtime() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Runtime authority is retained'; END IF;
  IF NOT p06_recovery_authority() THEN
    IF TG_TABLE_NAME <> 'financial_runtime_admissions' OR TG_OP <> 'INSERT' THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Protected runtime authority required';
    END IF;
    IF NEW.acknowledged_generation IS NOT NULL OR NEW.acknowledged_at IS NOT NULL
      OR NEW.operator_identity IS NOT NULL OR NEW.evidence_reference IS NOT NULL
      OR NOT ((NEW.process_kind = 'API' AND p06_role_member('p06_api'))
        OR (NEW.process_kind = 'DEPOSIT_WORKER' AND p06_role_member('p06_deposit_worker'))
        OR (NEW.process_kind = 'SIGNER' AND p06_role_member('p06_signer'))) THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Protected runtime authority required';
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'financial_runtime_admissions' THEN
   IF NEW.acknowledged_generation IS NOT NULL AND NEW.acknowledged_generation <> (SELECT generation FROM financial_runtime_control WHERE id=1) THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p06_admission_binding', MESSAGE='Acknowledgement must match current generation';
   END IF;
   IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.boot_id,NEW.process_kind,NEW.requested_at) IS DISTINCT FROM ROW(OLD.boot_id,OLD.process_kind,OLD.requested_at)
      OR NEW.acknowledged_generation IS NULL OR NEW.acknowledged_generation <> (SELECT generation FROM financial_runtime_control WHERE id=1) THEN
      RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p06_admission_binding', MESSAGE='Invalid boot acknowledgement';
    END IF;
   END IF;
  END IF;
  IF TG_TABLE_NAME = 'financial_runtime_control' THEN
   IF TG_OP = 'UPDATE' THEN
    IF NEW.id <> OLD.id OR NEW.generation < OLD.generation OR NEW.version <> OLD.version + 1
      OR (NOT OLD.financial_writes_fenced AND NEW.financial_writes_fenced AND NEW.generation <> OLD.generation + 1) THEN
      RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p06_control_transition', MESSAGE='Invalid runtime transition';
    END IF;
   END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_p06_control BEFORE INSERT OR UPDATE OR DELETE ON financial_runtime_control FOR EACH ROW EXECUTE FUNCTION guard_p06_runtime();
CREATE TRIGGER guard_p06_admission BEFORE INSERT OR UPDATE OR DELETE ON financial_runtime_admissions FOR EACH ROW EXECUTE FUNCTION guard_p06_runtime();

CREATE FUNCTION guard_p06_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p06_assignment_immutable', MESSAGE='Permanent custody assignment'; END IF;
  IF TG_OP = 'INSERT' AND NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.employee_id AND role='USER') THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p06_assignment_owner', MESSAGE='Employee assignment required';
  END IF;
  IF (TG_OP='INSERT' OR OLD.state <> 'READY') AND NEW.state='READY' AND NEW.ready_at < NEW.recovery_acknowledged_at THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p06_assignment_ack', MESSAGE='Acknowledgement must precede publication';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    ROW(NEW.id,NEW.employee_id,NEW.wallet_id,NEW.network,NEW.key_record_id,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.employee_id,OLD.wallet_id,OLD.network,OLD.key_record_id,OLD.created_at)
    OR (OLD.address IS NOT NULL AND NEW.address IS DISTINCT FROM OLD.address)
    OR (OLD.scan_boundary_block_number IS NOT NULL AND ROW(NEW.scan_boundary_block_number,NEW.scan_boundary_block_id,NEW.scan_boundary_timestamp) IS DISTINCT FROM ROW(OLD.scan_boundary_block_number,OLD.scan_boundary_block_id,OLD.scan_boundary_timestamp))
    OR (OLD.ready_at IS NOT NULL AND NEW.ready_at IS DISTINCT FROM OLD.ready_at)
    OR (OLD.state='READY' AND NEW.state <> 'READY')
    OR (OLD.key_envelope_digest IS NOT NULL AND ROW(NEW.key_envelope_digest,NEW.key_version) IS DISTINCT FROM ROW(OLD.key_envelope_digest,OLD.key_version)
      AND NOT (NEW.key_version > OLD.key_version AND NEW.recovery_ack_id IS DISTINCT FROM OLD.recovery_ack_id
        AND NEW.recovery_digest=NEW.key_envelope_digest AND NEW.recovery_acknowledged_at IS NOT NULL))
  ) THEN RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p06_assignment_immutable', MESSAGE='Custody binding cannot change'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_p06_assignment BEFORE INSERT OR UPDATE OR DELETE ON deposit_address_assignments FOR EACH ROW EXECUTE FUNCTION guard_p06_assignment();
CREATE TRIGGER immutable_p06_receipt BEFORE UPDATE OR DELETE ON deposit_receipts FOR EACH ROW EXECUTE FUNCTION reject_financial_history_mutation();
CREATE TRIGGER immutable_p06_manual_credit BEFORE UPDATE OR DELETE ON manual_credits FOR EACH ROW EXECUTE FUNCTION reject_financial_history_mutation();

CREATE FUNCTION guard_p06_transfer() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sweep treasury_sweeps%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p06_transfer_immutable', MESSAGE='Transfer history is retained'; END IF;
  IF TG_TABLE_NAME='treasury_sweeps' THEN
    IF NOT EXISTS (SELECT 1 FROM deposit_address_assignments WHERE id=NEW.assignment_id AND network=NEW.network AND address=NEW.source
      AND (state='READY' OR (state='RECOVERY_ACKED' AND p06_role_member('p06_recovery_operator')
        AND EXISTS (SELECT 1 FROM financial_runtime_control WHERE id=1 AND financial_writes_fenced))))
      OR EXISTS (SELECT 1 FROM deposit_address_assignments WHERE network=NEW.network AND address=NEW.treasury) THEN
      RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p06_sweep_binding', MESSAGE='Invalid treasury intent binding';
    END IF;
    IF NEW.current_attempt_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM transfer_attempts WHERE id=NEW.current_attempt_id AND sweep_id=NEW.id) THEN
      RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p06_sweep_attempt', MESSAGE='Foreign current attempt';
    END IF;
    IF TG_OP='UPDATE' AND ROW(NEW.id,NEW.assignment_id,NEW.network,NEW.token_contract,NEW.source,NEW.treasury,NEW.amount_units,NEW.policy_snapshot,NEW.operator_identity,NEW.reason,NEW.payload_hash,NEW.created_at)
      IS DISTINCT FROM ROW(OLD.id,OLD.assignment_id,OLD.network,OLD.token_contract,OLD.source,OLD.treasury,OLD.amount_units,OLD.policy_snapshot,OLD.operator_identity,OLD.reason,OLD.payload_hash,OLD.created_at) THEN
      RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p06_transfer_immutable', MESSAGE='Immutable treasury intent';
    END IF;
  ELSE
    SELECT * INTO sweep FROM treasury_sweeps WHERE id=NEW.sweep_id;
    IF NOT FOUND OR ROW(NEW.intent_hash,NEW.network,NEW.token_contract,NEW.source,NEW.treasury,NEW.amount_units)
      IS DISTINCT FROM ROW(sweep.payload_hash,sweep.network,sweep.token_contract,sweep.source,sweep.treasury,sweep.amount_units) THEN
      RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p06_attempt_binding', MESSAGE='Attempt must match intent';
    END IF;
    IF TG_OP='UPDATE' AND (
      ROW(NEW.id,NEW.sweep_id,NEW.intent_hash,NEW.network,NEW.token_contract,NEW.source,NEW.treasury,NEW.amount_units)
        IS DISTINCT FROM ROW(OLD.id,OLD.sweep_id,OLD.intent_hash,OLD.network,OLD.token_contract,OLD.source,OLD.treasury,OLD.amount_units)
      OR (OLD.transaction_id IS NOT NULL AND ROW(NEW.transaction_id,NEW.expiration,NEW.signed_at,NEW.envelope_id,NEW.envelope_digest)
        IS DISTINCT FROM ROW(OLD.transaction_id,OLD.expiration,OLD.signed_at,OLD.envelope_id,OLD.envelope_digest))
      OR (OLD.recovery_ack_id IS NOT NULL AND ROW(NEW.recovery_ack_id,NEW.recovery_digest,NEW.recovery_acknowledged_at)
        IS DISTINCT FROM ROW(OLD.recovery_ack_id,OLD.recovery_digest,OLD.recovery_acknowledged_at))
      OR (OLD.broadcast_intent_id IS NOT NULL AND ROW(NEW.broadcast_intent_id,NEW.broadcast_admitted_at,NEW.observation_block_number,NEW.observation_timestamp)
        IS DISTINCT FROM ROW(OLD.broadcast_intent_id,OLD.broadcast_admitted_at,OLD.observation_block_number,OLD.observation_timestamp))
      OR (OLD.final_evidence IS NOT NULL AND ROW(NEW.final_evidence,NEW.energy_units,NEW.bandwidth_units,NEW.fee_sun)
        IS DISTINCT FROM ROW(OLD.final_evidence,OLD.energy_units,OLD.bandwidth_units,OLD.fee_sun))
    ) THEN RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p06_transfer_immutable', MESSAGE='Immutable signed attempt'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_p06_sweep BEFORE INSERT OR UPDATE OR DELETE ON treasury_sweeps FOR EACH ROW EXECUTE FUNCTION guard_p06_transfer();
CREATE TRIGGER guard_p06_attempt BEFORE INSERT OR UPDATE OR DELETE ON transfer_attempts FOR EACH ROW EXECUTE FUNCTION guard_p06_transfer();

ALTER TABLE financial_operations DROP CONSTRAINT ck_financial_operations_origin;
ALTER TABLE financial_operations ADD CONSTRAINT ck_financial_operations_origin CHECK (
  (kind='CREDIT' AND origin IN ('DEPOSIT','TASK_REWARD','REFERRAL_COMMISSION','ADMIN_ADJUSTMENT'))
  OR (kind='PURCHASE_DEBIT' AND origin='PACKAGE_PURCHASE') OR (kind='RESERVE' AND origin='WITHDRAWAL_RESERVATION')
  OR (kind='RELEASE' AND origin='RESERVATION_RELEASE') OR (kind='CORRECTION' AND origin='ADMIN_ADJUSTMENT'));
ALTER TABLE financial_audit_records DROP CONSTRAINT ck_financial_audit_correction;
ALTER TABLE financial_audit_records ADD CONSTRAINT ck_financial_audit_correction CHECK (
  (action='CORRECTION' AND reason IS NOT NULL AND length(btrim(reason))>0 AND reference_operation_id IS NOT NULL)
  OR (action='CREDIT' AND reason IS NOT NULL AND length(btrim(reason))>0)
  OR (action<>'CORRECTION' AND reason IS NULL AND reference_operation_id IS NULL));

CREATE OR REPLACE FUNCTION guard_financial_posting() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE operation financial_operations%ROWTYPE;
BEGIN
  SELECT * INTO operation FROM financial_operations WHERE id=NEW.operation_id AND wallet_id=NEW.wallet_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NOT (
    (operation.kind='CREDIT' AND NEW.available_delta_units>0 AND NEW.reserved_delta_units=0
      AND ((operation.origin IN ('DEPOSIT','TASK_REWARD','ADMIN_ADJUSTMENT') AND NEW.source='NON_REFERRAL')
        OR (operation.origin='REFERRAL_COMMISSION' AND NEW.source='REFERRAL')))
    OR (operation.kind='PURCHASE_DEBIT' AND NEW.available_delta_units<0 AND NEW.reserved_delta_units=0)
    OR (operation.kind='RESERVE' AND NEW.available_delta_units<0 AND NEW.available_delta_units::numeric+NEW.reserved_delta_units::numeric=0)
    OR (operation.kind='RELEASE' AND NEW.available_delta_units>0 AND NEW.available_delta_units::numeric+NEW.reserved_delta_units::numeric=0)
    OR (operation.kind='CORRECTION' AND NEW.available_delta_units<>0 AND NEW.reserved_delta_units=0)
  ) THEN RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_ledger_postings_operation_shape', MESSAGE='Invalid financial posting'; END IF;
  RETURN NEW;
END;
$$;

-- This runs at commit because the ledger writes audit before its domain callback.
-- Historic deposits remain valid; only P06 namespace deposits require new receipts.
CREATE FUNCTION validate_p06_credit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE operation financial_operations%ROWTYPE; receipt deposit_receipts%ROWTYPE; grant_row manual_credits%ROWTYPE; audit financial_audit_records%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='financial_operations' THEN SELECT * INTO operation FROM financial_operations WHERE id=NEW.id;
  ELSIF TG_TABLE_NAME IN ('deposit_receipts','manual_credits') THEN SELECT * INTO operation FROM financial_operations WHERE id=NEW.financial_operation_id;
  ELSE SELECT * INTO operation FROM financial_operations WHERE id=NEW.operation_id; END IF;
  IF operation.id IS NULL THEN RETURN NULL; END IF;
  IF (TG_TABLE_NAME='deposit_receipts' AND (operation.business_namespace<>'p06.deposit' OR operation.origin<>'DEPOSIT'))
    OR (TG_TABLE_NAME='manual_credits' AND (operation.business_namespace<>'p06.manual-credit' OR operation.origin<>'ADMIN_ADJUSTMENT')) THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p06_credit_link', MESSAGE='Wrong financial domain link';
  END IF;
  SELECT * INTO audit FROM financial_audit_records WHERE operation_id=operation.id;
  IF operation.kind='CREDIT' AND operation.origin='ADMIN_ADJUSTMENT' THEN
    SELECT * INTO grant_row FROM manual_credits WHERE financial_operation_id=operation.id;
    IF grant_row.id IS NULL OR audit.id IS NULL OR operation.business_namespace<>'p06.manual-credit'
      OR operation.business_key<>grant_row.id::text OR operation.actor_type<>'USER' OR operation.actor_user_id<>grant_row.actor_user_id
      OR operation.wallet_id<>grant_row.wallet_id OR operation.magnitude_units<>grant_row.amount_units
      OR operation.intent_hash<>grant_row.payload_hash OR operation.created_at<>grant_row.recorded_at
      OR operation.accepted_terms->>'source' IS DISTINCT FROM 'NON_REFERRAL'
      OR operation.accepted_terms->'grant' IS DISTINCT FROM jsonb_build_object('actionId',grant_row.id,'confirmed',true,'reason',grant_row.reason,
        'reference',CASE WHEN grant_row.reference_kind='EXTERNAL' THEN jsonb_build_object('kind','EXTERNAL','value',grant_row.external_reference)
          ELSE jsonb_build_object('kind','LEDGER_OPERATION','operationId',grant_row.reference_operation_id) END)
      OR audit.reason IS DISTINCT FROM grant_row.reason OR audit.reference_operation_id IS DISTINCT FROM grant_row.reference_operation_id
      OR NOT EXISTS (SELECT 1 FROM users WHERE id=grant_row.actor_user_id AND role='ADMIN' AND status='ACTIVE' AND email_verified_at IS NOT NULL) THEN
      RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p06_manual_credit_link', MESSAGE='Incomplete administrative credit';
    END IF;
  ELSIF operation.business_namespace='p06.deposit' THEN
    SELECT * INTO receipt FROM deposit_receipts WHERE financial_operation_id=operation.id;
    IF receipt.id IS NULL OR audit.id IS NULL OR operation.kind<>'CREDIT' OR operation.origin<>'DEPOSIT'
      OR operation.wallet_id<>receipt.wallet_id OR operation.magnitude_units<>receipt.amount_units OR operation.created_at<>receipt.recorded_at
      OR operation.business_key<>receipt.network::text||':'||receipt.transaction_id||':'||receipt.log_index::text
      OR NOT EXISTS (SELECT 1 FROM deposit_address_assignments WHERE id=receipt.assignment_id AND state='READY'
        AND network=receipt.network AND address=receipt.recipient AND wallet_id=receipt.wallet_id) THEN
      RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p06_receipt_link', MESSAGE='Incomplete canonical credit';
    END IF;
  ELSIF TG_TABLE_NAME IN ('deposit_receipts','manual_credits') THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p06_credit_link', MESSAGE='Wrong financial domain link';
  ELSIF audit.reason IS NOT NULL AND operation.kind<>'CORRECTION' THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p06_audit_link', MESSAGE='Administrative evidence requires a grant';
  ELSE RETURN NULL; END IF;
  IF (SELECT count(*) FROM ledger_postings WHERE operation_id=operation.id)<>1
    OR NOT EXISTS (SELECT 1 FROM ledger_postings WHERE operation_id=operation.id AND wallet_id=operation.wallet_id
      AND source='NON_REFERRAL' AND available_delta_units=operation.magnitude_units AND reserved_delta_units=0)
    OR audit.created_at<>operation.created_at THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p06_credit_effect', MESSAGE='Credit effect and audit must agree';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER validate_p06_operation AFTER INSERT ON financial_operations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_p06_credit();
CREATE CONSTRAINT TRIGGER validate_p06_receipt AFTER INSERT ON deposit_receipts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_p06_credit();
CREATE CONSTRAINT TRIGGER validate_p06_grant AFTER INSERT ON manual_credits DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_p06_credit();
CREATE CONSTRAINT TRIGGER validate_p06_audit AFTER INSERT ON financial_audit_records DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_p06_credit();

COMMIT;
