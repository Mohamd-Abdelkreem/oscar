BEGIN;

-- AlterTable
ALTER TABLE "withdrawal_requests" ADD COLUMN     "settlement_operation_id" UUID;

-- AlterTable
ALTER TABLE "reservation_allocations" ADD COLUMN     "settled_at" TIMESTAMPTZ(6),
ADD COLUMN     "settlement_operation_id" UUID;

-- CreateTable
CREATE TABLE "treasury_payout_keys" (
    "id" UUID NOT NULL,
    "network" "tron_network" NOT NULL,
    "token_contract" VARCHAR(34) NOT NULL,
    "source" VARCHAR(34) NOT NULL,
    "envelope_id" UUID NOT NULL,
    "envelope_digest" CHAR(64) NOT NULL,
    "recovery_ack_id" UUID NOT NULL,
    "recovery_digest" CHAR(64) NOT NULL,
    "recovery_acknowledged_at" TIMESTAMPTZ(6) NOT NULL,
    "operator_identity" VARCHAR(160) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "last_final_block_number" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "treasury_payout_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_attempts" (
    "id" UUID NOT NULL,
    "withdrawal_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "treasury_key_id" UUID NOT NULL,
    "network" "tron_network" NOT NULL,
    "token_contract" VARCHAR(34) NOT NULL,
    "source" VARCHAR(34) NOT NULL,
    "recipient" VARCHAR(34) NOT NULL,
    "address_version" INTEGER NOT NULL,
    "gross_units" BIGINT NOT NULL,
    "fee_units" BIGINT NOT NULL,
    "net_units" BIGINT NOT NULL,
    "terms_hash" CHAR(64) NOT NULL,
    "intent_hash" CHAR(64) NOT NULL,
    "policy_snapshot" JSONB NOT NULL,
    "initial_floor_number" BIGINT NOT NULL,
    "initial_floor_id" CHAR(64) NOT NULL,
    "transaction_id" CHAR(64),
    "unsigned_record_id" UUID,
    "unsigned_digest" CHAR(64),
    "expiration" BIGINT,
    "prepared_at" TIMESTAMPTZ(6),
    "signed_record_id" UUID,
    "signed_digest" CHAR(64),
    "signed_ack_id" UUID,
    "signed_acknowledged_at" TIMESTAMPTZ(6),
    "signed_at" TIMESTAMPTZ(6),
    "broadcast_intent_id" UUID,
    "broadcast_admitted_at" TIMESTAMPTZ(6),
    "broadcast_digest" CHAR(64),
    "broadcast_ack_id" UUID,
    "broadcast_acknowledged_at" TIMESTAMPTZ(6),
    "final_evidence" JSONB,
    "final_block_number" BIGINT,
    "final_block_id" CHAR(64),
    "finalized_at" TIMESTAMPTZ(6),
    "state" VARCHAR(24) NOT NULL DEFAULT 'PREPARING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "next_check_at" TIMESTAMPTZ(6) NOT NULL,
    "blocker" VARCHAR(32),
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "withdrawal_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "treasury_payout_keys_envelope_id_key" ON "treasury_payout_keys"("envelope_id");

-- CreateIndex
CREATE UNIQUE INDEX "treasury_payout_keys_network_token_contract_source_key" ON "treasury_payout_keys"("network", "token_contract", "source");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_attempts_withdrawal_id_key" ON "withdrawal_attempts"("withdrawal_id");

-- CreateIndex
CREATE INDEX "withdrawal_attempts_state_next_check_at_id_idx" ON "withdrawal_attempts"("state", "next_check_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_attempts_withdrawal_id_employee_id_wallet_id_key" ON "withdrawal_attempts"("withdrawal_id", "employee_id", "wallet_id");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_attempts_network_transaction_id_key" ON "withdrawal_attempts"("network", "transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_requests_settlement_operation_id_key" ON "withdrawal_requests"("settlement_operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_allocations_settlement_operation_id_key" ON "reservation_allocations"("settlement_operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_allocations_settlement_operation_id_wallet_id_key" ON "reservation_allocations"("settlement_operation_id", "wallet_id");

-- AddForeignKey
ALTER TABLE "withdrawal_attempts" ADD CONSTRAINT "withdrawal_attempts_withdrawal_id_employee_id_wallet_id_fkey" FOREIGN KEY ("withdrawal_id", "employee_id", "wallet_id") REFERENCES "withdrawal_requests"("id", "employee_id", "wallet_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "withdrawal_attempts" ADD CONSTRAINT "withdrawal_attempts_treasury_key_id_fkey" FOREIGN KEY ("treasury_key_id") REFERENCES "treasury_payout_keys"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_settlement_operation_id_wallet_id_fkey" FOREIGN KEY ("settlement_operation_id", "wallet_id") REFERENCES "financial_operations"("id", "wallet_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reservation_allocations" ADD CONSTRAINT "reservation_allocations_settlement_operation_id_wallet_id_fkey" FOREIGN KEY ("settlement_operation_id", "wallet_id") REFERENCES "financial_operations"("id", "wallet_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Payout invariants.
CREATE OR REPLACE FUNCTION guard_p08_request() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE business_change boolean;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Withdrawal identity is permanent'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'SCHEDULED' OR NEW.version<>1 OR NEW.schedule_version<>1 OR NEW.due_at<>NEW.original_due_at OR NEW.next_check_at IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Withdrawal starts scheduled';
    END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW)-ARRAY['state','version','due_at','dispatch_at','schedule_version','next_check_at','blocker','finalized_at','release_operation_id','settlement_operation_id'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','version','due_at','dispatch_at','schedule_version','next_check_at','blocker','finalized_at','release_operation_id','settlement_operation_id']) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Accepted withdrawal snapshots are immutable';
  END IF;
  business_change:=ROW(NEW.state,NEW.due_at,NEW.dispatch_at,NEW.schedule_version,NEW.finalized_at,NEW.release_operation_id,NEW.settlement_operation_id)
    IS DISTINCT FROM ROW(OLD.state,OLD.due_at,OLD.dispatch_at,OLD.schedule_version,OLD.finalized_at,OLD.release_operation_id,OLD.settlement_operation_id);
  IF business_change THEN
    IF NEW.version<>OLD.version+1 OR OLD.state IN ('COMPLETED','REJECTED','CANCELLED','FAILED') THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Invalid withdrawal transition version';
    END IF;
    IF OLD.state='SCHEDULED' THEN
      IF (NEW.state='SCHEDULED' AND (NEW.due_at<=OLD.due_at OR NEW.schedule_version<>OLD.schedule_version+1 OR NEW.next_check_at IS NOT NULL))
        OR (NEW.state<>'SCHEDULED' AND (NEW.state NOT IN ('SIGNING','REJECTED','CANCELLED') OR ROW(NEW.due_at,NEW.dispatch_at,NEW.schedule_version) IS DISTINCT FROM ROW(OLD.due_at,OLD.dispatch_at,OLD.schedule_version))) THEN
        RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Invalid safe-unsent transition';
      END IF;
      IF NEW.state='SIGNING' THEN
        IF NOT p08_signer_authority() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Protected claim authority required'; END IF;
        IF NEW.dispatch_at>clock_timestamp() OR extract(isodow FROM clock_timestamp() AT TIME ZONE 'Asia/Baghdad') IN (6,7)
          OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.employee_id AND role='USER' AND status='ACTIVE' AND email_verified_at IS NOT NULL AND NOT withdrawals_blocked)
          OR NOT EXISTS(SELECT 1 FROM financial_runtime_control WHERE id=1 AND NOT financial_writes_fenced AND NOT new_dispatch_paused)
          OR NOT EXISTS(SELECT 1 FROM withdrawal_destinations WHERE id=NEW.destination_id AND address=NEW.recipient AND address_version=NEW.address_version) THEN
          RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Protected claim preconditions are not met';
        END IF;
      END IF;
    ELSE
      IF NOT p08_signer_authority() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Protected payout transition required'; END IF;
      IF NEW.state NOT IN ('SIGNED','SUBMITTED','UNKNOWN','COMPLETED','FAILED')
        OR ROW(NEW.due_at,NEW.dispatch_at,NEW.schedule_version) IS DISTINCT FROM ROW(OLD.due_at,OLD.dispatch_at,OLD.schedule_version) THEN
        RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Potentially live payout cannot be cancelled or rescheduled';
      END IF;
    END IF;
  ELSE
    IF NEW.version<>OLD.version OR OLD.state IN ('COMPLETED','REJECTED','CANCELLED','FAILED') THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Invalid discovery version';
    END IF;
    IF NOT p08_signer_authority() AND (NEW.next_check_at IS NULL OR OLD.next_check_at IS NOT NULL OR OLD.state<>'SCHEDULED'
      OR NEW.next_check_at<NEW.dispatch_at OR NEW.next_check_at>clock_timestamp() OR NEW.blocker IS DISTINCT FROM OLD.blocker) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Only a previously null discovery hint may change';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE UNIQUE INDEX withdrawal_attempts_unresolved_source_key ON withdrawal_attempts(network,token_contract,source)
WHERE state NOT IN ('CONFIRMED_SUCCESS','CHAIN_FAILED');

ALTER TABLE reservation_allocations DROP CONSTRAINT ck_reservation_allocation_state;
ALTER TABLE reservation_allocations ADD CONSTRAINT ck_reservation_allocation_state CHECK ((
  (state='ACTIVE' AND release_operation_id IS NULL AND released_at IS NULL AND settlement_operation_id IS NULL AND settled_at IS NULL)
  OR (state='RELEASED' AND release_operation_id IS NOT NULL AND released_at IS NOT NULL AND settlement_operation_id IS NULL AND settled_at IS NULL)
  OR (state='SETTLED' AND release_operation_id IS NULL AND released_at IS NULL AND settlement_operation_id IS NOT NULL AND settled_at IS NOT NULL)
) IS TRUE);

ALTER TABLE treasury_payout_keys ADD CONSTRAINT ck_p08_payout_key CHECK ((
  token_contract ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$' AND source ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$'
  AND envelope_digest ~ '^[0-9a-f]{64}$' AND recovery_digest=envelope_digest
  AND recovery_acknowledged_at<=created_at AND last_final_block_number>=0
  AND length(btrim(operator_identity))>0 AND length(btrim(reason))>0
) IS TRUE);

ALTER TABLE withdrawal_attempts ADD CONSTRAINT ck_p08_attempt CHECK ((
  state IN ('PREPARING','SIGNED','BROADCAST_INTENT','SUBMITTED','UNKNOWN','CONFIRMED_SUCCESS','CHAIN_FAILED')
  AND version>0 AND address_version>0 AND gross_units>0 AND fee_units>=0 AND net_units>0 AND gross_units::numeric=fee_units::numeric+net_units
  AND initial_floor_number>=0 AND initial_floor_id ~ '^[0-9a-f]{64}$' AND terms_hash ~ '^[0-9a-f]{64}$' AND intent_hash ~ '^[0-9a-f]{64}$'
  AND token_contract ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$' AND source ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$' AND recipient ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$'
  AND source<>recipient AND jsonb_typeof(policy_snapshot)='object'
  AND ((transaction_id IS NULL AND unsigned_record_id IS NULL AND unsigned_digest IS NULL AND expiration IS NULL AND prepared_at IS NULL)
    OR (transaction_id ~ '^[0-9a-f]{64}$' AND unsigned_record_id IS NOT NULL AND unsigned_digest ~ '^[0-9a-f]{64}$' AND expiration>0 AND prepared_at>=created_at))
  AND ((signed_record_id IS NULL AND signed_digest IS NULL AND signed_ack_id IS NULL AND signed_acknowledged_at IS NULL AND signed_at IS NULL)
    OR (transaction_id IS NOT NULL AND signed_record_id IS NOT NULL AND signed_digest ~ '^[0-9a-f]{64}$' AND signed_ack_id IS NOT NULL AND signed_acknowledged_at IS NOT NULL AND signed_at>=prepared_at))
  AND ((broadcast_intent_id IS NULL AND broadcast_admitted_at IS NULL AND broadcast_digest IS NULL AND broadcast_ack_id IS NULL AND broadcast_acknowledged_at IS NULL)
    OR (signed_record_id IS NOT NULL AND broadcast_intent_id IS NOT NULL AND broadcast_admitted_at>=signed_at
      AND ((broadcast_digest IS NULL AND broadcast_ack_id IS NULL AND broadcast_acknowledged_at IS NULL)
        OR (broadcast_digest ~ '^[0-9a-f]{64}$' AND broadcast_ack_id IS NOT NULL AND broadcast_acknowledged_at>=broadcast_admitted_at))))
  AND (state NOT IN ('SIGNED','BROADCAST_INTENT','SUBMITTED','CONFIRMED_SUCCESS','CHAIN_FAILED') OR signed_record_id IS NOT NULL)
  AND (state NOT IN ('BROADCAST_INTENT','SUBMITTED','CONFIRMED_SUCCESS','CHAIN_FAILED') OR broadcast_intent_id IS NOT NULL)
  AND (state NOT IN ('SUBMITTED','CONFIRMED_SUCCESS','CHAIN_FAILED') OR broadcast_ack_id IS NOT NULL)
  AND ((state IN ('CONFIRMED_SUCCESS','CHAIN_FAILED') AND jsonb_typeof(final_evidence)='object' AND final_block_number>=initial_floor_number AND final_block_id ~ '^[0-9a-f]{64}$' AND finalized_at>=broadcast_admitted_at)
    OR (state NOT IN ('CONFIRMED_SUCCESS','CHAIN_FAILED') AND final_evidence IS NULL AND final_block_number IS NULL AND final_block_id IS NULL AND finalized_at IS NULL))
) IS TRUE);

CREATE FUNCTION p08_signer_authority() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT p08_table_owner('withdrawal_attempts') OR (p06_role_member('p06_signer')
    AND NOT p06_role_member('p06_api') AND NOT p06_role_member('p06_deposit_worker') AND NOT p06_role_member('p06_recovery_operator'));
$$;

CREATE FUNCTION guard_p08_payout_key() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Treasury key authority is retained'; END IF;
  IF TG_OP='INSERT' THEN
    IF NOT p06_recovery_authority() OR NEW.last_final_block_number<>0 THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Protected key provisioning required';
    END IF;
  ELSE
    IF NOT p08_signer_authority() OR (to_jsonb(NEW)-'last_final_block_number') IS DISTINCT FROM (to_jsonb(OLD)-'last_final_block_number')
      OR NEW.last_final_block_number<=OLD.last_final_block_number THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Immutable treasury key or final block floor';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_p08_payout_key BEFORE INSERT OR UPDATE OR DELETE ON treasury_payout_keys FOR EACH ROW EXECUTE FUNCTION guard_p08_payout_key();

CREATE FUNCTION guard_p08_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE request withdrawal_requests%ROWTYPE; key treasury_payout_keys%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Original payout identity is retained'; END IF;
  IF NOT p08_signer_authority() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Protected attempt authority required'; END IF;
  SELECT * INTO request FROM withdrawal_requests WHERE id=NEW.withdrawal_id;
  SELECT * INTO key FROM treasury_payout_keys WHERE id=NEW.treasury_key_id;
  IF ROW(NEW.employee_id,NEW.wallet_id,NEW.network,NEW.recipient,NEW.address_version,NEW.gross_units,NEW.fee_units,NEW.net_units,NEW.terms_hash)
    IS DISTINCT FROM ROW(request.employee_id,request.wallet_id,request.network,request.recipient,request.address_version,request.gross_units,request.fee_units,request.net_units,request.terms_hash)
    OR ROW(NEW.network,NEW.token_contract,NEW.source) IS DISTINCT FROM ROW(key.network,key.token_contract,key.source) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Attempt must match original payout authority';
  END IF;
  IF TG_OP='INSERT' THEN
    IF request.state<>'SIGNING' OR NEW.state<>'PREPARING' OR NEW.version<>1 OR NEW.transaction_id IS NOT NULL
      OR NEW.signed_record_id IS NOT NULL OR NEW.broadcast_intent_id IS NOT NULL OR NEW.initial_floor_number<key.last_final_block_number THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Attempt requires one admitted original claim';
    END IF;
  ELSE
    IF (to_jsonb(NEW)-ARRAY['transaction_id','unsigned_record_id','unsigned_digest','expiration','prepared_at','signed_record_id','signed_digest','signed_ack_id','signed_acknowledged_at','signed_at','broadcast_intent_id','broadcast_admitted_at','broadcast_digest','broadcast_ack_id','broadcast_acknowledged_at','final_evidence','final_block_number','final_block_id','finalized_at','state','version','next_check_at','blocker'])
      IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['transaction_id','unsigned_record_id','unsigned_digest','expiration','prepared_at','signed_record_id','signed_digest','signed_ack_id','signed_acknowledged_at','signed_at','broadcast_intent_id','broadcast_admitted_at','broadcast_digest','broadcast_ack_id','broadcast_acknowledged_at','final_evidence','final_block_number','final_block_id','finalized_at','state','version','next_check_at','blocker'])
      OR OLD.state IN ('CONFIRMED_SUCCESS','CHAIN_FAILED') OR NEW.version<>OLD.version+1
      OR (OLD.transaction_id IS NOT NULL AND ROW(NEW.transaction_id,NEW.unsigned_record_id,NEW.unsigned_digest,NEW.expiration,NEW.prepared_at) IS DISTINCT FROM ROW(OLD.transaction_id,OLD.unsigned_record_id,OLD.unsigned_digest,OLD.expiration,OLD.prepared_at))
      OR (OLD.signed_record_id IS NOT NULL AND ROW(NEW.signed_record_id,NEW.signed_digest,NEW.signed_ack_id,NEW.signed_acknowledged_at,NEW.signed_at) IS DISTINCT FROM ROW(OLD.signed_record_id,OLD.signed_digest,OLD.signed_ack_id,OLD.signed_acknowledged_at,OLD.signed_at))
      OR (OLD.broadcast_intent_id IS NOT NULL AND ROW(NEW.broadcast_intent_id,NEW.broadcast_admitted_at) IS DISTINCT FROM ROW(OLD.broadcast_intent_id,OLD.broadcast_admitted_at))
      OR (OLD.broadcast_ack_id IS NOT NULL AND ROW(NEW.broadcast_digest,NEW.broadcast_ack_id,NEW.broadcast_acknowledged_at) IS DISTINCT FROM ROW(OLD.broadcast_digest,OLD.broadcast_ack_id,OLD.broadcast_acknowledged_at))
      OR (OLD.state<>'PREPARING' AND NEW.state='PREPARING') OR (OLD.broadcast_intent_id IS NOT NULL AND NEW.state='SIGNED') THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Original preparation, signature and broadcast identity are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_p08_attempt BEFORE INSERT OR UPDATE OR DELETE ON withdrawal_attempts FOR EACH ROW EXECUTE FUNCTION guard_p08_attempt();

ALTER TABLE financial_operations DROP CONSTRAINT ck_financial_operations_origin;
ALTER TABLE financial_operations ADD CONSTRAINT ck_financial_operations_origin CHECK (
  (kind='CREDIT' AND origin IN ('DEPOSIT','TASK_REWARD','REFERRAL_COMMISSION','ADMIN_ADJUSTMENT'))
  OR (kind='PURCHASE_DEBIT' AND origin='PACKAGE_PURCHASE') OR (kind='RESERVE' AND origin='WITHDRAWAL_RESERVATION')
  OR (kind='RELEASE' AND origin='RESERVATION_RELEASE') OR (kind='SETTLE' AND origin='WITHDRAWAL_SETTLEMENT') OR (kind='CORRECTION' AND origin='ADMIN_ADJUSTMENT'));

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
    OR (operation.kind='SETTLE' AND NEW.available_delta_units=0 AND NEW.reserved_delta_units<0)
      OR (operation.kind='CORRECTION' AND NEW.available_delta_units<>0 AND NEW.reserved_delta_units=0)
  ) THEN RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_ledger_postings_operation_shape', MESSAGE='Invalid financial posting'; END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION guard_financial_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_reservation_allocation_immutable', MESSAGE = 'Reservation allocation is retained';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.state <> 'ACTIVE' OR NEW.state NOT IN ('RELEASED','SETTLED')
      OR ROW(NEW.id, NEW.wallet_id, NEW.opening_operation_id, NEW.gross_units, NEW.non_referral_units, NEW.referral_units, NEW.created_at)
        IS DISTINCT FROM ROW(OLD.id, OLD.wallet_id, OLD.opening_operation_id, OLD.gross_units, OLD.non_referral_units, OLD.referral_units, OLD.created_at) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_reservation_allocation_immutable', MESSAGE = 'Invalid reservation transition';
    END IF;
  ELSIF NEW.state <> 'ACTIVE' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_reservation_allocation_initial_state', MESSAGE = 'Reservation must start active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM financial_operations WHERE id = NEW.opening_operation_id AND wallet_id = NEW.wallet_id AND kind = 'RESERVE')
    OR (NEW.state = 'RELEASED' AND NOT EXISTS (SELECT 1 FROM financial_operations WHERE id = NEW.release_operation_id AND wallet_id = NEW.wallet_id AND kind = 'RELEASE'))
    OR (NEW.state='SETTLED' AND NOT EXISTS (SELECT 1 FROM financial_operations WHERE id=NEW.settlement_operation_id AND wallet_id=NEW.wallet_id AND kind='SETTLE')) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_reservation_allocation_operation_link', MESSAGE = 'Invalid reservation operation';
  END IF;
  RETURN NEW;
END;
$$;
ALTER TABLE withdrawal_requests DROP CONSTRAINT ck_p08_request;
ALTER TABLE withdrawal_requests ADD CONSTRAINT ck_p08_request CHECK ((
  state IN ('SCHEDULED','SIGNING','SIGNED','SUBMITTED','UNKNOWN','REJECTED','CANCELLED','COMPLETED','FAILED')
  AND version>0 AND schedule_version>0 AND address_version>0 AND gross_units>0 AND fee_bps BETWEEN 0 AND 10000
  AND fee_units>=0 AND net_units>0 AND fee_units=floor(gross_units::numeric*fee_bps/10000)
  AND gross_units::numeric=fee_units::numeric+net_units AND non_referral_units>=0 AND referral_units>=0
  AND gross_units::numeric=non_referral_units::numeric+referral_units AND terms_hash ~ '^[0-9a-f]{64}$'
  AND recipient ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$' AND jsonb_typeof(accepted_terms)='object' AND jsonb_typeof(eligibility_snapshot)='object'
  AND schedule_policy='{"zone":"Asia/Baghdad","countedHours":"72","excludedWeekdays":[6,7]}'::jsonb
  AND original_due_at>=accepted_at AND due_at>=original_due_at AND dispatch_at>=due_at
  AND ((state IN ('REJECTED','CANCELLED','FAILED') AND finalized_at IS NOT NULL AND release_operation_id IS NOT NULL)
    OR (state='COMPLETED' AND finalized_at IS NOT NULL AND release_operation_id IS NULL AND settlement_operation_id IS NOT NULL)
    OR (state IN ('SCHEDULED','SIGNING','SIGNED','SUBMITTED','UNKNOWN') AND finalized_at IS NULL AND release_operation_id IS NULL AND settlement_operation_id IS NULL))
) IS TRUE);

ALTER TABLE withdrawal_actions DROP CONSTRAINT ck_p08_action;
ALTER TABLE withdrawal_actions ADD CONSTRAINT ck_p08_action CHECK ((
  kind IN ('ACCEPT','EXTEND','REJECT','RESTRICTION_CANCEL','FUTURE_DESTINATION_CANCEL','CLAIM','SIGNED','BROADCAST_ADMISSION','OBSERVE','COMPLETE','SAFE_FAIL')
  AND expected_version>=0 AND committed_version=expected_version+1 AND after_schedule_version>0
  AND intent_hash ~ '^[0-9a-f]{64}$' AND ((actor_user_id IS NULL)<>(actor_process_id IS NULL))
  AND actor_scope=coalesce('user:'||actor_user_id::text,'process:'||actor_process_id)
  AND (request_key IS NULL OR request_key ~ '^[A-Za-z0-9._:-]{1,128}$')
  AND (kind NOT IN ('EXTEND','REJECT','FUTURE_DESTINATION_CANCEL') OR (confirmed AND length(btrim(reason))>0))
) IS TRUE);


CREATE OR REPLACE FUNCTION validate_p08_request_binding() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE request withdrawal_requests%ROWTYPE; quote withdrawal_quotes%ROWTYPE; allocation reservation_allocations%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='withdrawal_requests' THEN
    IF TG_OP='UPDATE' AND NEW.version=OLD.version THEN RETURN NULL; END IF;
    SELECT * INTO request FROM withdrawal_requests WHERE id=NEW.id;
  ELSIF TG_TABLE_NAME='withdrawal_actions' THEN SELECT * INTO request FROM withdrawal_requests WHERE id=NEW.request_id;
  ELSE SELECT * INTO request FROM withdrawal_requests WHERE reservation_id=NEW.id; END IF;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO quote FROM withdrawal_quotes WHERE id=request.quote_id;
  SELECT * INTO allocation FROM reservation_allocations WHERE id=request.reservation_id;
  IF NOT quote.can_accept OR ROW(request.destination_id,request.network,request.recipient,request.address_version,request.gross_units,request.fee_bps,request.fee_units,request.net_units,request.terms_hash,request.eligibility_snapshot)
    IS DISTINCT FROM ROW(quote.destination_id,quote.network,quote.recipient,quote.address_version,quote.gross_units,quote.fee_bps,quote.fee_units,quote.net_units,quote.terms_hash,quote.eligibility_snapshot)
    OR request.accepted_terms IS DISTINCT FROM quote.quoted_terms OR request.accepted_at>=quote.expires_at OR request.accepted_at<quote.created_at
    OR ROW(request.gross_units,request.non_referral_units,request.referral_units) IS DISTINCT FROM ROW(allocation.gross_units,allocation.non_referral_units,allocation.referral_units)
    OR ROW(request.non_referral_units,request.referral_units) IS DISTINCT FROM ROW(quote.funded_non_referral_units,quote.funded_referral_units)
    OR (request.state IN ('REJECTED','CANCELLED','FAILED') AND (allocation.state<>'RELEASED' OR request.release_operation_id IS DISTINCT FROM allocation.release_operation_id OR request.finalized_at IS DISTINCT FROM allocation.released_at))
    OR (request.state='COMPLETED' AND (allocation.state<>'SETTLED' OR request.settlement_operation_id IS DISTINCT FROM allocation.settlement_operation_id OR request.finalized_at IS DISTINCT FROM allocation.settled_at))
    OR (request.state NOT IN ('REJECTED','CANCELLED','FAILED','COMPLETED') AND allocation.state<>'ACTIVE')
    OR NOT EXISTS(SELECT 1 FROM withdrawal_actions WHERE request_id=request.id AND committed_version=request.version AND after_state=request.state AND after_due_at=request.due_at AND after_schedule_version=request.schedule_version) THEN
    RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='ck_p08_request_binding',MESSAGE='Request, quote, allocation and action must agree';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM financial_operations WHERE id=allocation.opening_operation_id AND kind='RESERVE' AND origin='WITHDRAWAL_RESERVATION'
    AND business_namespace='p08.withdrawal.reserve' AND business_key=request.quote_id::text AND actor_user_id=request.employee_id) THEN
    RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='ck_p08_reserve_binding',MESSAGE='Reservation identity must bind the accepted quote';
  END IF;
  IF request.state IN ('REJECTED','CANCELLED','FAILED') AND NOT EXISTS(
    SELECT 1 FROM financial_operations release WHERE release.id=request.release_operation_id
      AND release.kind='RELEASE' AND release.origin='RESERVATION_RELEASE' AND release.wallet_id=request.wallet_id
      AND release.business_namespace='p08.withdrawal.release' AND release.business_key=request.id::text
      AND release.magnitude_units=request.gross_units
      AND EXISTS(SELECT 1 FROM financial_audit_records WHERE operation_id=release.id)
      AND (SELECT coalesce(sum(available_delta_units),0) FROM ledger_postings WHERE operation_id=release.id AND source='NON_REFERRAL')=request.non_referral_units
      AND (SELECT coalesce(sum(available_delta_units),0) FROM ledger_postings WHERE operation_id=release.id AND source='REFERRAL')=request.referral_units
  ) THEN RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='ck_p08_release_binding',MESSAGE='Safe release must restore the recorded sources'; END IF;
  RETURN NULL;
END;
$$;
CREATE OR REPLACE FUNCTION validate_p08_reserve_domain() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE operation financial_operations%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='financial_operations' THEN operation:=NEW;
  ELSIF TG_TABLE_NAME='ledger_postings' THEN SELECT * INTO operation FROM financial_operations WHERE id=NEW.operation_id;
  ELSE SELECT * INTO operation FROM financial_operations WHERE id=NEW.opening_operation_id; END IF;
  IF operation.business_namespace='p08.withdrawal.reserve' AND NOT EXISTS(
    SELECT 1 FROM withdrawal_requests r JOIN reservation_allocations a ON a.id=r.reservation_id
    WHERE a.opening_operation_id=operation.id AND operation.kind='RESERVE' AND operation.business_key=r.quote_id::text
      AND operation.magnitude_units=r.gross_units AND operation.wallet_id=r.wallet_id
      AND EXISTS(SELECT 1 FROM financial_audit_records WHERE operation_id=operation.id)
      AND (SELECT coalesce(sum(reserved_delta_units),0) FROM ledger_postings WHERE operation_id=operation.id AND source='NON_REFERRAL')=r.non_referral_units
      AND (SELECT coalesce(sum(reserved_delta_units),0) FROM ledger_postings WHERE operation_id=operation.id AND source='REFERRAL')=r.referral_units
  ) THEN RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='ck_p08_reserve_domain',MESSAGE='Withdrawal reservation requires complete domain effects'; END IF;
  IF operation.business_namespace='p08.withdrawal.release' AND NOT EXISTS(
    SELECT 1 FROM withdrawal_requests r WHERE r.release_operation_id=operation.id AND r.state IN ('REJECTED','CANCELLED','FAILED')
      AND operation.kind='RELEASE' AND operation.business_key=r.id::text
  ) THEN RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='ck_p08_release_domain',MESSAGE='Withdrawal release requires a safe terminal request'; END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION validate_p08_payout_binding() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE request withdrawal_requests%ROWTYPE; attempt withdrawal_attempts%ROWTYPE; allocation reservation_allocations%ROWTYPE;
  operation financial_operations%ROWTYPE; evidence jsonb;
BEGIN
  IF TG_TABLE_NAME='treasury_payout_keys' THEN
    IF TG_OP='UPDATE' AND NEW.last_final_block_number<>OLD.last_final_block_number AND NOT EXISTS(
      SELECT 1 FROM withdrawal_attempts WHERE treasury_key_id=NEW.id AND state IN ('CONFIRMED_SUCCESS','CHAIN_FAILED') AND final_block_number=NEW.last_final_block_number
    ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Source floor requires matching terminal lane'; END IF;
    RETURN NULL;
  ELSIF TG_TABLE_NAME='withdrawal_requests' THEN SELECT * INTO request FROM withdrawal_requests WHERE id=NEW.id;
  ELSIF TG_TABLE_NAME='withdrawal_attempts' THEN SELECT * INTO request FROM withdrawal_requests WHERE id=NEW.withdrawal_id;
  ELSIF TG_TABLE_NAME='reservation_allocations' THEN SELECT * INTO request FROM withdrawal_requests WHERE reservation_id=NEW.id;
  ELSE
    IF TG_TABLE_NAME='financial_operations' THEN operation:=NEW;
    ELSE SELECT * INTO operation FROM financial_operations WHERE id=NEW.operation_id; END IF;
    IF operation.kind<>'SETTLE' AND operation.business_namespace<>'p08.withdrawal.release' THEN RETURN NULL; END IF;
    SELECT * INTO request FROM withdrawal_requests WHERE settlement_operation_id=operation.id OR release_operation_id=operation.id;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payout financial effect requires its terminal request'; END IF;
  END IF;
  IF request.id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO attempt FROM withdrawal_attempts WHERE withdrawal_id=request.id;
  IF (request.state IN ('SCHEDULED','REJECTED','CANCELLED') AND attempt.id IS NOT NULL)
    OR (request.state IN ('SIGNING','SIGNED','UNKNOWN','SUBMITTED','COMPLETED','FAILED') AND attempt.id IS NULL)
    OR (request.state='SIGNING' AND attempt.state NOT IN ('PREPARING','UNKNOWN'))
    OR (request.state='SIGNED' AND attempt.state<>'SIGNED')
    OR (request.state='SUBMITTED' AND attempt.state<>'SUBMITTED')
    OR (request.state='UNKNOWN' AND attempt.state NOT IN ('UNKNOWN','BROADCAST_INTENT','PREPARING'))
    OR (request.state='COMPLETED' AND attempt.state<>'CONFIRMED_SUCCESS')
    OR (request.state='FAILED' AND attempt.state<>'CHAIN_FAILED') THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Request and sole original attempt must agree';
  END IF;
  IF request.state NOT IN ('COMPLETED','FAILED') THEN RETURN NULL; END IF;
  SELECT * INTO allocation FROM reservation_allocations WHERE id=request.reservation_id;
  SELECT * INTO operation FROM financial_operations WHERE id=coalesce(request.settlement_operation_id,request.release_operation_id);
  evidence:=attempt.final_evidence;
  IF NOT ((
    evidence->>'transactionId'=attempt.transaction_id AND evidence->>'network'=attempt.network::text
    AND evidence->>'tokenContract'=attempt.token_contract AND evidence->>'source'=attempt.source AND evidence->>'recipient'=attempt.recipient
    AND evidence->>'amountUnits'=attempt.net_units::text AND evidence->>'blockId'=attempt.final_block_id
    AND evidence->>'blockNumber'=attempt.final_block_number::text AND evidence->>'intentHash'=attempt.intent_hash
    AND evidence->>'outcome'=CASE WHEN request.state='COMPLETED' THEN 'CONFIRMED_SUCCESS' ELSE 'CHAIN_FAILED' END
    AND evidence->>'evidenceDigest' ~ '^[0-9a-f]{64}$'
    AND attempt.finalized_at=request.finalized_at AND operation.wallet_id=request.wallet_id AND operation.magnitude_units=request.gross_units
    AND operation.business_key=request.id::text AND operation.actor_type='PROCESS'
    AND (SELECT last_final_block_number FROM treasury_payout_keys WHERE id=attempt.treasury_key_id)>=attempt.final_block_number
    AND EXISTS(SELECT 1 FROM financial_audit_records WHERE operation_id=operation.id)
    AND EXISTS(SELECT 1 FROM withdrawal_actions WHERE request_id=request.id AND committed_version=request.version
      AND financial_operation_id=operation.id AND kind=CASE WHEN request.state='COMPLETED' THEN 'COMPLETE' ELSE 'SAFE_FAIL' END)
    AND (SELECT coalesce(sum(reserved_delta_units),0) FROM ledger_postings WHERE operation_id=operation.id AND source='NON_REFERRAL')=-request.non_referral_units
    AND (SELECT coalesce(sum(reserved_delta_units),0) FROM ledger_postings WHERE operation_id=operation.id AND source='REFERRAL')=-request.referral_units
    AND ((request.state='COMPLETED' AND operation.kind='SETTLE' AND operation.origin='WITHDRAWAL_SETTLEMENT'
      AND operation.business_namespace='p08.withdrawal.settle' AND allocation.state='SETTLED'
      AND allocation.settlement_operation_id=operation.id AND allocation.settled_at=request.finalized_at
      AND (SELECT coalesce(sum(available_delta_units),0) FROM ledger_postings WHERE operation_id=operation.id)=0)
      OR (request.state='FAILED' AND operation.kind='RELEASE' AND allocation.state='RELEASED'
        AND allocation.release_operation_id=operation.id AND allocation.released_at=request.finalized_at
        AND operation.business_namespace='p08.withdrawal.release'))
  ) IS TRUE) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Terminal payout requires original canonical evidence and atomic gross effects'; END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER validate_p08_payout_request AFTER INSERT OR UPDATE ON withdrawal_requests DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_p08_payout_binding();
CREATE CONSTRAINT TRIGGER validate_p08_payout_attempt AFTER INSERT OR UPDATE ON withdrawal_attempts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_p08_payout_binding();
CREATE CONSTRAINT TRIGGER validate_p08_payout_allocation AFTER INSERT OR UPDATE ON reservation_allocations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_p08_payout_binding();
CREATE CONSTRAINT TRIGGER validate_p08_payout_operation AFTER INSERT ON financial_operations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_p08_payout_binding();
CREATE CONSTRAINT TRIGGER validate_p08_payout_posting AFTER INSERT ON ledger_postings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_p08_payout_binding();
CREATE CONSTRAINT TRIGGER validate_p08_payout_audit AFTER INSERT ON financial_audit_records DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_p08_payout_binding();
CREATE CONSTRAINT TRIGGER validate_p08_payout_floor AFTER UPDATE ON treasury_payout_keys DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_p08_payout_binding();

CREATE FUNCTION guard_p08_settlement_authority() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='financial_operations' THEN
    IF NEW.kind<>'SETTLE' THEN RETURN NEW; END IF;
  ELSE
    IF NEW.state<>'SETTLED' THEN RETURN NEW; END IF;
  END IF;
  IF NOT p08_signer_authority() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Protected settlement authority required'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_p08_settlement_operation BEFORE INSERT ON financial_operations FOR EACH ROW EXECUTE FUNCTION guard_p08_settlement_authority();
CREATE TRIGGER guard_p08_settlement_allocation BEFORE INSERT OR UPDATE ON reservation_allocations FOR EACH ROW EXECUTE FUNCTION guard_p08_settlement_authority();

CREATE TRIGGER immutable_p08_key_truncate BEFORE TRUNCATE ON treasury_payout_keys FOR EACH STATEMENT EXECUTE FUNCTION reject_financial_history_mutation();
CREATE TRIGGER immutable_p08_attempt_truncate BEFORE TRUNCATE ON withdrawal_attempts FOR EACH STATEMENT EXECUTE FUNCTION reject_financial_history_mutation();

GRANT SELECT,INSERT,UPDATE ON withdrawal_attempts TO p06_signer;
GRANT SELECT ON treasury_payout_keys TO p06_signer;
GRANT UPDATE(last_final_block_number) ON treasury_payout_keys TO p06_signer;
GRANT SELECT,INSERT ON treasury_payout_keys TO p06_recovery_operator;
GRANT SELECT ON withdrawal_attempts TO p06_recovery_operator;
GRANT SELECT ON wallets TO p06_signer;
GRANT SELECT,INSERT ON financial_operations,ledger_postings,financial_audit_records,financial_request_identities TO p06_signer;
GRANT UPDATE(available_non_referral_units,reserved_non_referral_units,available_referral_units,reserved_referral_units,updated_at) ON wallets TO p06_signer;
GRANT UPDATE(state,settlement_operation_id,settled_at,release_operation_id,released_at) ON reservation_allocations TO p06_signer;
GRANT UPDATE(state,version,next_check_at,blocker,finalized_at,settlement_operation_id,release_operation_id) ON withdrawal_requests TO p06_signer;
-- Safe public projection only; private body/digest/key/intent authority remains denied.
GRANT SELECT(id,withdrawal_id,employee_id,wallet_id,transaction_id,token_contract,source,final_block_number,final_block_id) ON withdrawal_attempts TO p06_api;
-- Existing package provenance is also selected for settlement detail; preserve its safe projection.
GRANT SELECT(id,debit_operation_id,accepted_terms) ON purchases TO p06_api;
GRANT SELECT(id,purchase_id,credit_operation_id) ON referral_decisions TO p06_api;

-- Group A markers are not payment evidence. Retain them and fence rather than inventing attempts.
UPDATE financial_runtime_control SET financial_writes_fenced=true,new_dispatch_paused=true,
  generation=generation+CASE WHEN financial_writes_fenced THEN 0 ELSE 1 END,version=version+1
WHERE id=1 AND EXISTS(SELECT 1 FROM withdrawal_requests WHERE state IN ('SIGNING','SIGNED','SUBMITTED','UNKNOWN'));

COMMIT;
