-- CreateEnum
CREATE TYPE "financial_operation_kind" AS ENUM ('CREDIT', 'PURCHASE_DEBIT', 'RESERVE', 'RELEASE', 'CORRECTION');

-- CreateEnum
CREATE TYPE "financial_origin" AS ENUM ('DEPOSIT', 'TASK_REWARD', 'REFERRAL_COMMISSION', 'PACKAGE_PURCHASE', 'WITHDRAWAL_RESERVATION', 'RESERVATION_RELEASE', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "financial_actor_type" AS ENUM ('USER', 'PROCESS');

-- CreateEnum
CREATE TYPE "fund_source" AS ENUM ('NON_REFERRAL', 'REFERRAL');

-- CreateEnum
CREATE TYPE "reservation_state" AS ENUM ('ACTIVE', 'RELEASED');

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "available_non_referral_units" BIGINT NOT NULL DEFAULT 0,
    "reserved_non_referral_units" BIGINT NOT NULL DEFAULT 0,
    "available_referral_units" BIGINT NOT NULL DEFAULT 0,
    "reserved_referral_units" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_operations" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "kind" "financial_operation_kind" NOT NULL,
    "business_namespace" VARCHAR(64) NOT NULL,
    "business_key" VARCHAR(256) NOT NULL,
    "intent_hash" CHAR(64) NOT NULL,
    "magnitude_units" BIGINT NOT NULL,
    "origin" "financial_origin" NOT NULL,
    "actor_type" "financial_actor_type" NOT NULL,
    "actor_user_id" UUID,
    "actor_process_id" VARCHAR(64),
    "accepted_terms" JSONB NOT NULL,
    "outcome" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_request_identities" (
    "id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "actor_scope" VARCHAR(72) NOT NULL,
    "kind" "financial_operation_kind" NOT NULL,
    "request_key" VARCHAR(128) NOT NULL,
    "intent_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_request_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_postings" (
    "id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "source" "fund_source" NOT NULL,
    "available_delta_units" BIGINT NOT NULL,
    "reserved_delta_units" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_postings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_allocations" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "opening_operation_id" UUID NOT NULL,
    "gross_units" BIGINT NOT NULL,
    "non_referral_units" BIGINT NOT NULL,
    "referral_units" BIGINT NOT NULL,
    "state" "reservation_state" NOT NULL DEFAULT 'ACTIVE',
    "release_operation_id" UUID,
    "released_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_audit_records" (
    "id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "actor_type" "financial_actor_type" NOT NULL,
    "actor_user_id" UUID,
    "actor_process_id" VARCHAR(64),
    "action" "financial_operation_kind" NOT NULL,
    "reason" VARCHAR(500),
    "reference_operation_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_audit_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_owner_user_id_key" ON "wallets"("owner_user_id");

-- CreateIndex
CREATE INDEX "financial_operations_wallet_idx" ON "financial_operations"("wallet_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_operations_id_wallet_id_key" ON "financial_operations"("id", "wallet_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_operations_business_key" ON "financial_operations"("kind", "business_namespace", "business_key");

-- CreateIndex
CREATE UNIQUE INDEX "financial_request_identities_scope_key" ON "financial_request_identities"("actor_scope", "kind", "request_key");

-- CreateIndex
CREATE INDEX "ledger_postings_wallet_idx" ON "ledger_postings"("wallet_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_postings_operation_source_key" ON "ledger_postings"("operation_id", "source");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_allocations_opening_operation_id_key" ON "reservation_allocations"("opening_operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_allocations_release_operation_id_key" ON "reservation_allocations"("release_operation_id");

-- CreateIndex
CREATE INDEX "reservation_allocations_wallet_state_idx" ON "reservation_allocations"("wallet_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_allocations_opening_operation_id_wallet_id_key" ON "reservation_allocations"("opening_operation_id", "wallet_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_allocations_release_operation_id_wallet_id_key" ON "reservation_allocations"("release_operation_id", "wallet_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_audit_records_operation_id_key" ON "financial_audit_records"("operation_id");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "financial_operations" ADD CONSTRAINT "financial_operations_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "financial_operations" ADD CONSTRAINT "financial_operations_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "financial_request_identities" ADD CONSTRAINT "financial_request_identities_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "financial_operations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ledger_postings" ADD CONSTRAINT "ledger_postings_operation_id_wallet_id_fkey" FOREIGN KEY ("operation_id", "wallet_id") REFERENCES "financial_operations"("id", "wallet_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reservation_allocations" ADD CONSTRAINT "reservation_allocations_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reservation_allocations" ADD CONSTRAINT "reservation_allocations_opening_operation_id_wallet_id_fkey" FOREIGN KEY ("opening_operation_id", "wallet_id") REFERENCES "financial_operations"("id", "wallet_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reservation_allocations" ADD CONSTRAINT "reservation_allocations_release_operation_id_wallet_id_fkey" FOREIGN KEY ("release_operation_id", "wallet_id") REFERENCES "financial_operations"("id", "wallet_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "financial_audit_records" ADD CONSTRAINT "financial_audit_records_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "financial_operations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "financial_audit_records" ADD CONSTRAINT "financial_audit_records_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "financial_audit_records" ADD CONSTRAINT "financial_audit_records_reference_operation_id_fkey" FOREIGN KEY ("reference_operation_id") REFERENCES "financial_operations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
-- PostgreSQL numeric sums avoid overflowing bigint before the bounds check.
ALTER TABLE "wallets"
  ADD CONSTRAINT "ck_wallets_components_nonnegative" CHECK (
    available_non_referral_units >= 0 AND reserved_non_referral_units >= 0
    AND available_referral_units >= 0 AND reserved_referral_units >= 0),
  ADD CONSTRAINT "ck_wallets_total_bounds" CHECK (
    available_non_referral_units::numeric + reserved_non_referral_units::numeric
    + available_referral_units::numeric + reserved_referral_units::numeric <= 9223372036854775807);

ALTER TABLE "financial_operations"
  ADD CONSTRAINT "ck_financial_operations_magnitude" CHECK (magnitude_units > 0),
  ADD CONSTRAINT "ck_financial_operations_identity" CHECK (
    length(btrim(business_namespace)) > 0 AND length(btrim(business_key)) > 0
    AND intent_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "ck_financial_operations_actor" CHECK (
    (actor_type = 'USER' AND actor_user_id IS NOT NULL AND actor_process_id IS NULL)
    OR (actor_type = 'PROCESS' AND actor_user_id IS NULL AND actor_process_id IS NOT NULL
      AND length(btrim(actor_process_id)) > 0)),
  ADD CONSTRAINT "ck_financial_operations_origin" CHECK (
    (kind = 'CREDIT' AND origin IN ('DEPOSIT', 'TASK_REWARD', 'REFERRAL_COMMISSION'))
    OR (kind = 'PURCHASE_DEBIT' AND origin = 'PACKAGE_PURCHASE')
    OR (kind = 'RESERVE' AND origin = 'WITHDRAWAL_RESERVATION')
    OR (kind = 'RELEASE' AND origin = 'RESERVATION_RELEASE')
    OR (kind = 'CORRECTION' AND origin = 'ADMIN_ADJUSTMENT')),
  ADD CONSTRAINT "ck_financial_operations_snapshots" CHECK (
    jsonb_typeof(accepted_terms) = 'object' AND jsonb_typeof(outcome) = 'object');

ALTER TABLE "financial_request_identities"
  ADD CONSTRAINT "ck_financial_request_identity" CHECK (
    request_key ~ '^[A-Za-z0-9._:-]{1,128}$' AND intent_hash ~ '^[0-9a-f]{64}$'
    AND (actor_scope ~ '^USER:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR actor_scope ~ '^PROCESS:.{1,64}$'));

ALTER TABLE "ledger_postings"
  ADD CONSTRAINT "ck_ledger_postings_delta_bounds" CHECK (
    available_delta_units >= -9223372036854775807 AND reserved_delta_units >= -9223372036854775807
    AND (available_delta_units <> 0 OR reserved_delta_units <> 0));

ALTER TABLE "reservation_allocations"
  ADD CONSTRAINT "ck_reservation_allocation_amounts" CHECK (
    gross_units > 0 AND non_referral_units >= 0 AND referral_units >= 0
    AND non_referral_units::numeric + referral_units::numeric = gross_units::numeric),
  ADD CONSTRAINT "ck_reservation_allocation_state" CHECK (
    (state = 'ACTIVE' AND release_operation_id IS NULL AND released_at IS NULL)
    OR (state = 'RELEASED' AND release_operation_id IS NOT NULL AND released_at IS NOT NULL));

ALTER TABLE "financial_audit_records"
  ADD CONSTRAINT "ck_financial_audit_actor" CHECK (
    (actor_type = 'USER' AND actor_user_id IS NOT NULL AND actor_process_id IS NULL)
    OR (actor_type = 'PROCESS' AND actor_user_id IS NULL AND actor_process_id IS NOT NULL
      AND length(btrim(actor_process_id)) > 0)),
  ADD CONSTRAINT "ck_financial_audit_correction" CHECK (
    (action = 'CORRECTION' AND reason IS NOT NULL AND length(btrim(reason)) > 0
      AND reference_operation_id IS NOT NULL)
    OR (action <> 'CORRECTION' AND reason IS NULL AND reference_operation_id IS NULL));

CREATE FUNCTION reject_financial_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_financial_history_immutable',
    MESSAGE = 'Financial history is immutable';
END;
$$;

DO $$
DECLARE history_table text;
BEGIN
  FOREACH history_table IN ARRAY ARRAY['financial_operations', 'financial_request_identities', 'ledger_postings', 'financial_audit_records'] LOOP
    EXECUTE format('CREATE TRIGGER guard_history_mutation BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_financial_history_mutation()', history_table);
  END LOOP;
  FOREACH history_table IN ARRAY ARRAY['wallets', 'financial_operations', 'financial_request_identities', 'ledger_postings', 'financial_audit_records', 'reservation_allocations'] LOOP
    EXECUTE format('CREATE TRIGGER guard_history_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION reject_financial_history_mutation()', history_table);
  END LOOP;
END;
$$;

CREATE FUNCTION guard_financial_posting() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE operation financial_operations%ROWTYPE;
BEGIN
  SELECT * INTO operation FROM financial_operations WHERE id = NEW.operation_id AND wallet_id = NEW.wallet_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NOT (
    (operation.kind = 'CREDIT' AND NEW.available_delta_units > 0 AND NEW.reserved_delta_units = 0
      AND ((operation.origin IN ('DEPOSIT', 'TASK_REWARD') AND NEW.source = 'NON_REFERRAL')
        OR (operation.origin = 'REFERRAL_COMMISSION' AND NEW.source = 'REFERRAL')))
    OR (operation.kind = 'PURCHASE_DEBIT' AND NEW.available_delta_units < 0 AND NEW.reserved_delta_units = 0)
    OR (operation.kind = 'RESERVE' AND NEW.available_delta_units < 0
      AND NEW.available_delta_units::numeric + NEW.reserved_delta_units::numeric = 0)
    OR (operation.kind = 'RELEASE' AND NEW.available_delta_units > 0
      AND NEW.available_delta_units::numeric + NEW.reserved_delta_units::numeric = 0)
    OR (operation.kind = 'CORRECTION' AND NEW.available_delta_units <> 0 AND NEW.reserved_delta_units = 0)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_ledger_postings_operation_shape', MESSAGE = 'Invalid financial posting';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_posting_insert BEFORE INSERT ON ledger_postings FOR EACH ROW EXECUTE FUNCTION guard_financial_posting();

CREATE FUNCTION guard_financial_request_identity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE operation financial_operations%ROWTYPE;
BEGIN
  SELECT * INTO operation FROM financial_operations WHERE id = NEW.operation_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NEW.kind <> operation.kind OR NEW.intent_hash <> operation.intent_hash THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_financial_request_operation_link', MESSAGE = 'Invalid request binding';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_request_identity_insert BEFORE INSERT ON financial_request_identities FOR EACH ROW EXECUTE FUNCTION guard_financial_request_identity();

CREATE FUNCTION guard_financial_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_reservation_allocation_immutable', MESSAGE = 'Reservation allocation is retained';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.state <> 'ACTIVE' OR NEW.state <> 'RELEASED'
      OR ROW(NEW.id, NEW.wallet_id, NEW.opening_operation_id, NEW.gross_units, NEW.non_referral_units, NEW.referral_units, NEW.created_at)
        IS DISTINCT FROM ROW(OLD.id, OLD.wallet_id, OLD.opening_operation_id, OLD.gross_units, OLD.non_referral_units, OLD.referral_units, OLD.created_at) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_reservation_allocation_immutable', MESSAGE = 'Invalid reservation transition';
    END IF;
  ELSIF NEW.state <> 'ACTIVE' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_reservation_allocation_initial_state', MESSAGE = 'Reservation must start active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM financial_operations WHERE id = NEW.opening_operation_id AND wallet_id = NEW.wallet_id AND kind = 'RESERVE')
    OR (NEW.state = 'RELEASED' AND NOT EXISTS (SELECT 1 FROM financial_operations WHERE id = NEW.release_operation_id AND wallet_id = NEW.wallet_id AND kind = 'RELEASE')) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_reservation_allocation_operation_link', MESSAGE = 'Invalid reservation operation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_allocation_change BEFORE INSERT OR UPDATE OR DELETE ON reservation_allocations FOR EACH ROW EXECUTE FUNCTION guard_financial_allocation();

CREATE FUNCTION guard_financial_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE operation financial_operations%ROWTYPE;
BEGIN
  SELECT * INTO operation FROM financial_operations WHERE id = NEW.operation_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NEW.action <> operation.kind OR NEW.actor_type <> operation.actor_type
    OR NEW.actor_user_id IS DISTINCT FROM operation.actor_user_id
    OR NEW.actor_process_id IS DISTINCT FROM operation.actor_process_id
    OR (NEW.action = 'CORRECTION' AND NOT EXISTS (
      SELECT 1 FROM financial_operations WHERE id = NEW.reference_operation_id AND wallet_id = operation.wallet_id)) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_financial_audit_operation_link', MESSAGE = 'Invalid financial audit';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_audit_insert BEFORE INSERT ON financial_audit_records FOR EACH ROW EXECUTE FUNCTION guard_financial_audit();
