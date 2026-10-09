-- CreateTable
BEGIN;
CREATE TABLE "withdrawal_destinations" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "network" "tron_network" NOT NULL,
    "address" VARCHAR(34),
    "address_version" INTEGER,
    "confirmed_at" TIMESTAMPTZ(6),
    "proof_id" UUID,
    "proof_hash" CHAR(64),
    "pending_address" VARCHAR(34),
    "proof_generation" INTEGER NOT NULL DEFAULT 0,
    "issued_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "next_issuance_at" TIMESTAMPTZ(6),
    "delivery_status" VARCHAR(16) NOT NULL DEFAULT 'NOT_ATTEMPTED',
    "delivery_attempted_at" TIMESTAMPTZ(6),
    "delivery_acknowledged_at" TIMESTAMPTZ(6),
    "delivery_failure_code" VARCHAR(32),
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "withdrawal_destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_destination_audits" (
    "id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "proof_id" UUID NOT NULL,
    "proof_generation" INTEGER NOT NULL,
    "network" "tron_network" NOT NULL,
    "address" VARCHAR(34) NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "committed_destination_version" INTEGER NOT NULL,

    CONSTRAINT "withdrawal_destination_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_policy" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "minimum_gross_units" BIGINT NOT NULL,
    "maximum_gross_units" BIGINT NOT NULL,
    "free_fee_bps" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by_user_id" UUID,

    CONSTRAINT "withdrawal_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_quotes" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "address_version" INTEGER NOT NULL,
    "network" "tron_network" NOT NULL,
    "recipient" VARCHAR(34) NOT NULL,
    "policy_version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "gross_units" BIGINT NOT NULL,
    "fee_bps" INTEGER NOT NULL,
    "fee_units" BIGINT NOT NULL,
    "net_units" BIGINT NOT NULL,
    "terms_hash" CHAR(64) NOT NULL,
    "quoted_terms" JSONB NOT NULL,
    "eligibility_snapshot" JSONB NOT NULL,
    "available_non_referral_units" BIGINT NOT NULL,
    "available_referral_units" BIGINT NOT NULL,
    "funded_non_referral_units" BIGINT NOT NULL,
    "funded_referral_units" BIGINT NOT NULL,
    "required_top_up_units" BIGINT NOT NULL,
    "can_accept" BOOLEAN NOT NULL,
    "block_reason" VARCHAR(32),
    "preview_due_at" TIMESTAMPTZ(6) NOT NULL,
    "preview_dispatch_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "withdrawal_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_requests" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "network" "tron_network" NOT NULL,
    "recipient" VARCHAR(34) NOT NULL,
    "address_version" INTEGER NOT NULL,
    "gross_units" BIGINT NOT NULL,
    "fee_bps" INTEGER NOT NULL,
    "fee_units" BIGINT NOT NULL,
    "net_units" BIGINT NOT NULL,
    "accepted_terms" JSONB NOT NULL,
    "terms_hash" CHAR(64) NOT NULL,
    "eligibility_snapshot" JSONB NOT NULL,
    "non_referral_units" BIGINT NOT NULL,
    "referral_units" BIGINT NOT NULL,
    "accepted_at" TIMESTAMPTZ(6) NOT NULL,
    "original_due_at" TIMESTAMPTZ(6) NOT NULL,
    "schedule_policy" JSONB NOT NULL,
    "state" VARCHAR(16) NOT NULL DEFAULT 'SCHEDULED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "due_at" TIMESTAMPTZ(6) NOT NULL,
    "dispatch_at" TIMESTAMPTZ(6) NOT NULL,
    "schedule_version" INTEGER NOT NULL DEFAULT 1,
    "next_check_at" TIMESTAMPTZ(6),
    "blocker" VARCHAR(32),
    "finalized_at" TIMESTAMPTZ(6),
    "release_operation_id" UUID,

    CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_actions" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "actor_process_id" VARCHAR(64),
    "actor_scope" VARCHAR(72) NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "request_key" VARCHAR(128),
    "intent_hash" CHAR(64) NOT NULL,
    "expected_version" INTEGER NOT NULL,
    "committed_version" INTEGER NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "before_state" VARCHAR(16),
    "after_state" VARCHAR(16) NOT NULL,
    "before_due_at" TIMESTAMPTZ(6),
    "after_due_at" TIMESTAMPTZ(6) NOT NULL,
    "before_schedule_version" INTEGER,
    "after_schedule_version" INTEGER NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "reason" VARCHAR(500),
    "financial_operation_id" UUID,

    CONSTRAINT "withdrawal_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_destinations_employee_id_key" ON "withdrawal_destinations"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_destinations_proof_id_key" ON "withdrawal_destinations"("proof_id");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_destinations_proof_hash_key" ON "withdrawal_destinations"("proof_hash");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_destinations_id_employee_id_key" ON "withdrawal_destinations"("id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_destination_audits_destination_id_proof_generati_key" ON "withdrawal_destination_audits"("destination_id", "proof_generation", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_destination_audits_destination_id_committed_dest_key" ON "withdrawal_destination_audits"("destination_id", "committed_destination_version");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_quotes_id_employee_id_wallet_id_key" ON "withdrawal_quotes"("id", "employee_id", "wallet_id");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_requests_quote_id_key" ON "withdrawal_requests"("quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_requests_reservation_id_key" ON "withdrawal_requests"("reservation_id");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_requests_release_operation_id_key" ON "withdrawal_requests"("release_operation_id");

-- CreateIndex
CREATE INDEX "withdrawal_requests_state_dispatch_at_next_check_at_idx" ON "withdrawal_requests"("state", "dispatch_at", "next_check_at");

-- CreateIndex
CREATE INDEX "withdrawal_requests_employee_id_accepted_at_id_idx" ON "withdrawal_requests"("employee_id", "accepted_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_requests_quote_id_employee_id_wallet_id_key" ON "withdrawal_requests"("quote_id", "employee_id", "wallet_id");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_requests_reservation_id_wallet_id_key" ON "withdrawal_requests"("reservation_id", "wallet_id");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_requests_id_employee_id_wallet_id_key" ON "withdrawal_requests"("id", "employee_id", "wallet_id");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_actions_request_id_committed_version_key" ON "withdrawal_actions"("request_id", "committed_version");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_actions_actor_scope_kind_request_key_key" ON "withdrawal_actions"("actor_scope", "kind", "request_key");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_allocations_id_wallet_id_key" ON "reservation_allocations"("id", "wallet_id");

-- AddForeignKey
ALTER TABLE "withdrawal_destinations" ADD CONSTRAINT "withdrawal_destinations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "withdrawal_destination_audits" ADD CONSTRAINT "withdrawal_destination_audits_destination_id_actor_user_id_fkey" FOREIGN KEY ("destination_id", "actor_user_id") REFERENCES "withdrawal_destinations"("id", "employee_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "withdrawal_policy" ADD CONSTRAINT "withdrawal_policy_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "withdrawal_quotes" ADD CONSTRAINT "withdrawal_quotes_wallet_id_employee_id_fkey" FOREIGN KEY ("wallet_id", "employee_id") REFERENCES "wallets"("id", "owner_user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "withdrawal_quotes" ADD CONSTRAINT "withdrawal_quotes_destination_id_employee_id_fkey" FOREIGN KEY ("destination_id", "employee_id") REFERENCES "withdrawal_destinations"("id", "employee_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_quote_id_employee_id_wallet_id_fkey" FOREIGN KEY ("quote_id", "employee_id", "wallet_id") REFERENCES "withdrawal_quotes"("id", "employee_id", "wallet_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_reservation_id_wallet_id_fkey" FOREIGN KEY ("reservation_id", "wallet_id") REFERENCES "reservation_allocations"("id", "wallet_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_destination_id_employee_id_fkey" FOREIGN KEY ("destination_id", "employee_id") REFERENCES "withdrawal_destinations"("id", "employee_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_release_operation_id_wallet_id_fkey" FOREIGN KEY ("release_operation_id", "wallet_id") REFERENCES "financial_operations"("id", "wallet_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "withdrawal_actions" ADD CONSTRAINT "withdrawal_actions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "withdrawal_requests"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "withdrawal_actions" ADD CONSTRAINT "withdrawal_actions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "withdrawal_actions" ADD CONSTRAINT "withdrawal_actions_financial_operation_id_fkey" FOREIGN KEY ("financial_operation_id") REFERENCES "financial_operations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

INSERT INTO withdrawal_policy(id,minimum_gross_units,maximum_gross_units,free_fee_bps,version,updated_at)
VALUES (1,16000000,500000000,2100,1,now()) ON CONFLICT(id) DO NOTHING;
ALTER TABLE withdrawal_policy ADD CONSTRAINT ck_p08_policy CHECK
  (id=1 AND minimum_gross_units>0 AND maximum_gross_units>=minimum_gross_units AND free_fee_bps BETWEEN 0 AND 10000 AND version>0);
ALTER TABLE withdrawal_destinations ADD CONSTRAINT ck_p08_destination CHECK ((
  version>0 AND proof_generation>0 AND
  ((address IS NULL AND address_version IS NULL AND confirmed_at IS NULL AND proof_id IS NOT NULL
    AND proof_hash ~ '^[0-9a-f]{64}$' AND pending_address ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$'
    AND issued_at IS NOT NULL AND expires_at>issued_at AND next_issuance_at>issued_at)
   OR (address ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$' AND address_version>0 AND confirmed_at IS NOT NULL
    AND proof_id IS NULL AND proof_hash IS NULL AND pending_address IS NULL
    AND issued_at IS NULL AND expires_at IS NULL AND next_issuance_at IS NULL))
  AND delivery_status IN ('NOT_ATTEMPTED','UNKNOWN','ACKNOWLEDGED','REJECTED')
  AND (delivery_status<>'ACKNOWLEDGED' OR delivery_acknowledged_at IS NOT NULL)
) IS TRUE);
ALTER TABLE withdrawal_destination_audits ADD CONSTRAINT ck_p08_destination_audit CHECK (
  kind IN ('PROOF_ISSUED','PROOF_CONSUMED') AND proof_generation>0 AND committed_destination_version>0
  AND address ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$');
ALTER TABLE withdrawal_quotes ADD CONSTRAINT ck_p08_quote CHECK ((
  address_version>0 AND policy_version>0 AND expires_at-created_at BETWEEN interval '60 seconds' AND interval '3600 seconds'
  AND gross_units>0 AND fee_bps BETWEEN 0 AND 10000 AND net_units>0 AND fee_units>=0
  AND fee_units=floor(gross_units::numeric*fee_bps/10000) AND gross_units::numeric=fee_units::numeric+net_units
  AND terms_hash ~ '^[0-9a-f]{64}$' AND recipient ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$'
  AND jsonb_typeof(quoted_terms)='object' AND jsonb_typeof(eligibility_snapshot)='object'
  AND available_non_referral_units>=0 AND available_referral_units>=0 AND funded_non_referral_units>=0 AND funded_referral_units>=0 AND required_top_up_units>=0
  AND funded_non_referral_units=least(gross_units,available_non_referral_units)
  AND funded_referral_units=least(gross_units-funded_non_referral_units,available_referral_units)
  AND gross_units::numeric=funded_non_referral_units::numeric+funded_referral_units+required_top_up_units
  AND can_accept=(block_reason IS NULL) AND (NOT can_accept OR required_top_up_units=0)
  AND (required_top_up_units=0 OR block_reason IS NOT NULL)
  AND (block_reason IS NULL OR block_reason IN ('INSUFFICIENT_FUNDS','WITHDRAWAL_BLOCKED','WITHDRAWAL_ACTIVE'))
  AND (block_reason IS DISTINCT FROM 'INSUFFICIENT_FUNDS' OR required_top_up_units>0)
  AND preview_due_at>=created_at AND preview_dispatch_at>=preview_due_at
) IS TRUE);
ALTER TABLE withdrawal_requests ADD CONSTRAINT ck_p08_request CHECK ((
  state IN ('SCHEDULED','SIGNING','SIGNED','SUBMITTED','UNKNOWN','REJECTED','CANCELLED')
  AND version>0 AND schedule_version>0 AND address_version>0 AND gross_units>0 AND fee_bps BETWEEN 0 AND 10000
  AND fee_units>=0 AND net_units>0 AND fee_units=floor(gross_units::numeric*fee_bps/10000)
  AND gross_units::numeric=fee_units::numeric+net_units AND non_referral_units>=0 AND referral_units>=0
  AND gross_units::numeric=non_referral_units::numeric+referral_units AND terms_hash ~ '^[0-9a-f]{64}$'
  AND recipient ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$' AND jsonb_typeof(accepted_terms)='object' AND jsonb_typeof(eligibility_snapshot)='object'
  AND schedule_policy='{"zone":"Asia/Baghdad","countedHours":"72","excludedWeekdays":[6,7]}'::jsonb
  AND original_due_at>=accepted_at AND due_at>=original_due_at AND dispatch_at>=due_at
  AND ((state IN ('REJECTED','CANCELLED') AND finalized_at IS NOT NULL AND release_operation_id IS NOT NULL)
    OR (state IN ('SCHEDULED','SIGNING','SIGNED','SUBMITTED','UNKNOWN') AND finalized_at IS NULL AND release_operation_id IS NULL))
) IS TRUE);
CREATE UNIQUE INDEX withdrawal_requests_active_employee_key ON withdrawal_requests(employee_id)
WHERE state IN ('SCHEDULED','SIGNING','SIGNED','SUBMITTED','UNKNOWN');
ALTER TABLE withdrawal_actions ADD CONSTRAINT ck_p08_action CHECK ((
  kind IN ('ACCEPT','EXTEND','REJECT','RESTRICTION_CANCEL','FUTURE_DESTINATION_CANCEL','CLAIM')
  AND expected_version>=0 AND committed_version=expected_version+1 AND after_schedule_version>0
  AND intent_hash ~ '^[0-9a-f]{64}$' AND ((actor_user_id IS NULL)<>(actor_process_id IS NULL))
  AND actor_scope=coalesce('user:'||actor_user_id::text,'process:'||actor_process_id)
  AND (request_key IS NULL OR request_key ~ '^[A-Za-z0-9._:-]{1,128}$')
  AND (kind NOT IN ('EXTEND','REJECT','FUTURE_DESTINATION_CANCEL') OR (confirmed AND length(btrim(reason))>0))
) IS TRUE);

CREATE FUNCTION p08_table_owner(table_name text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass(table_name) AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user));
$$;
CREATE FUNCTION guard_p08_destination() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Destination authority is retained'; END IF;
  IF NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.employee_id AND role='USER') THEN
    RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='ck_p08_employee',MESSAGE='Employee destination required';
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.address IS NOT NULL OR NEW.version<>1 OR NEW.proof_generation<>1 THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Destination starts with first proof';
    END IF;
  ELSE
    IF ROW(NEW.id,NEW.employee_id,NEW.network) IS DISTINCT FROM ROW(OLD.id,OLD.employee_id,OLD.network)
      OR (OLD.address IS NOT NULL AND ROW(NEW.address,NEW.address_version,NEW.confirmed_at) IS DISTINCT FROM ROW(OLD.address,OLD.address_version,OLD.confirmed_at)) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Destination identity is fixed';
    END IF;
    IF NEW.proof_id IS DISTINCT FROM OLD.proof_id THEN
      IF NEW.version<>OLD.version+1 OR OLD.address IS NOT NULL
        OR (NEW.proof_id IS NOT NULL AND (NEW.proof_generation<>OLD.proof_generation+1 OR NEW.issued_at<OLD.next_issuance_at))
        OR (NEW.proof_id IS NULL AND (NEW.proof_generation<>OLD.proof_generation OR NEW.address IS DISTINCT FROM OLD.pending_address OR NEW.address_version<>1 OR NEW.confirmed_at<OLD.issued_at OR NEW.confirmed_at>=OLD.expires_at)) THEN
        RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Invalid proof transition';
      END IF;
    ELSIF (to_jsonb(NEW)-ARRAY['delivery_status','delivery_attempted_at','delivery_acknowledged_at','delivery_failure_code','updated_at'])
      IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['delivery_status','delivery_attempted_at','delivery_acknowledged_at','delivery_failure_code','updated_at']) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Proof authority is immutable within generation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_p08_destination BEFORE INSERT OR UPDATE OR DELETE ON withdrawal_destinations FOR EACH ROW EXECUTE FUNCTION guard_p08_destination();

CREATE FUNCTION guard_p08_destination_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE destination withdrawal_destinations%ROWTYPE;
BEGIN
  SELECT * INTO destination FROM withdrawal_destinations WHERE id=NEW.destination_id;
  IF NOT FOUND OR NEW.actor_user_id<>destination.employee_id OR NEW.network<>destination.network
    OR NEW.proof_generation<>destination.proof_generation OR NEW.committed_destination_version<>destination.version
    OR (NEW.kind='PROOF_ISSUED' AND ROW(NEW.proof_id,NEW.address,NEW.occurred_at) IS DISTINCT FROM ROW(destination.proof_id,destination.pending_address,destination.issued_at))
    OR (NEW.kind='PROOF_CONSUMED' AND (destination.proof_id IS NOT NULL OR NEW.address IS DISTINCT FROM destination.address OR NEW.occurred_at IS DISTINCT FROM destination.confirmed_at
      OR NOT EXISTS(SELECT 1 FROM withdrawal_destination_audits issued WHERE issued.destination_id=NEW.destination_id AND issued.kind='PROOF_ISSUED' AND ROW(issued.proof_id,issued.proof_generation,issued.address,issued.network)=ROW(NEW.proof_id,NEW.proof_generation,NEW.address,NEW.network)))) THEN
    RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='ck_p08_proof_event_binding',MESSAGE='Proof event must match committed employee authority';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_p08_destination_event BEFORE INSERT ON withdrawal_destination_audits FOR EACH ROW EXECUTE FUNCTION guard_p08_destination_event();
CREATE FUNCTION validate_p08_destination_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' OR NEW.proof_id IS DISTINCT FROM OLD.proof_id THEN
    IF NOT EXISTS(SELECT 1 FROM withdrawal_destination_audits WHERE destination_id=NEW.id AND committed_destination_version=NEW.version
      AND kind=CASE WHEN NEW.proof_id IS NULL THEN 'PROOF_CONSUMED' ELSE 'PROOF_ISSUED' END) THEN
      RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='ck_p08_proof_event_required',MESSAGE='Proof transition requires atomic audit';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER validate_p08_destination_event AFTER INSERT OR UPDATE ON withdrawal_destinations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_p08_destination_event();

CREATE FUNCTION guard_p08_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Withdrawal identity is permanent'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'SCHEDULED' OR NEW.version<>1 OR NEW.schedule_version<>1 OR NEW.due_at<>NEW.original_due_at OR NEW.next_check_at IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Withdrawal starts scheduled';
    END IF;
  ELSE
    IF (to_jsonb(NEW)-ARRAY['state','version','due_at','dispatch_at','schedule_version','next_check_at','blocker','finalized_at','release_operation_id'])
      IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','version','due_at','dispatch_at','schedule_version','next_check_at','blocker','finalized_at','release_operation_id']) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Accepted withdrawal snapshots are immutable';
    END IF;
    IF ROW(NEW.state,NEW.due_at,NEW.dispatch_at,NEW.schedule_version,NEW.finalized_at,NEW.release_operation_id)
      IS DISTINCT FROM ROW(OLD.state,OLD.due_at,OLD.dispatch_at,OLD.schedule_version,OLD.finalized_at,OLD.release_operation_id) THEN
      IF OLD.state<>'SCHEDULED' OR NEW.version<>OLD.version+1
        OR (NEW.state='SCHEDULED' AND (NEW.due_at<=OLD.due_at OR NEW.schedule_version<>OLD.schedule_version+1 OR NEW.next_check_at IS NOT NULL))
        OR (NEW.state<>'SCHEDULED' AND (NEW.state NOT IN ('SIGNING','REJECTED','CANCELLED') OR ROW(NEW.due_at,NEW.dispatch_at,NEW.schedule_version) IS DISTINCT FROM ROW(OLD.due_at,OLD.dispatch_at,OLD.schedule_version))) THEN
        RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Invalid safe-unsent transition';
      END IF;
      IF NEW.state='SIGNING' AND NOT p08_table_owner('withdrawal_requests') AND
        (NOT p06_role_member('p06_signer') OR p06_role_member('p06_api') OR p06_role_member('p06_deposit_worker') OR p06_role_member('p06_recovery_operator')) THEN
        RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Protected claim authority required';
      END IF;
      IF NEW.state='SIGNING' AND (
        NEW.dispatch_at>clock_timestamp() OR extract(isodow FROM clock_timestamp() AT TIME ZONE 'Asia/Baghdad') IN (6,7)
        OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.employee_id AND role='USER' AND status='ACTIVE' AND email_verified_at IS NOT NULL AND NOT withdrawals_blocked)
        OR NOT EXISTS(SELECT 1 FROM financial_runtime_control WHERE id=1 AND NOT financial_writes_fenced AND NOT new_dispatch_paused)
      ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Protected claim preconditions are not met'; END IF;
    ELSIF NEW.version<>OLD.version OR NEW.next_check_at IS NULL OR OLD.next_check_at IS NOT NULL
      OR OLD.state<>'SCHEDULED' OR NEW.next_check_at<NEW.dispatch_at OR NEW.next_check_at>clock_timestamp()
      OR NEW.blocker IS DISTINCT FROM OLD.blocker THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Only a previously null discovery hint may change';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_p08_request BEFORE INSERT OR UPDATE OR DELETE ON withdrawal_requests FOR EACH ROW EXECUTE FUNCTION guard_p08_request();

CREATE FUNCTION validate_p08_request_binding() RETURNS trigger LANGUAGE plpgsql AS $$
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
    OR (request.state IN ('REJECTED','CANCELLED') AND (allocation.state<>'RELEASED' OR request.release_operation_id IS DISTINCT FROM allocation.release_operation_id OR request.finalized_at IS DISTINCT FROM allocation.released_at))
    OR (request.state NOT IN ('REJECTED','CANCELLED') AND allocation.state<>'ACTIVE')
    OR NOT EXISTS(SELECT 1 FROM withdrawal_actions WHERE request_id=request.id AND committed_version=request.version AND after_state=request.state AND after_due_at=request.due_at AND after_schedule_version=request.schedule_version) THEN
    RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='ck_p08_request_binding',MESSAGE='Request, quote, allocation and action must agree';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM financial_operations WHERE id=allocation.opening_operation_id AND kind='RESERVE' AND origin='WITHDRAWAL_RESERVATION'
    AND business_namespace='p08.withdrawal.reserve' AND business_key=request.quote_id::text AND actor_user_id=request.employee_id) THEN
    RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='ck_p08_reserve_binding',MESSAGE='Reservation identity must bind the accepted quote';
  END IF;
  IF request.state IN ('REJECTED','CANCELLED') AND NOT EXISTS(
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
CREATE CONSTRAINT TRIGGER validate_p08_request AFTER INSERT OR UPDATE ON withdrawal_requests DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_p08_request_binding();
CREATE CONSTRAINT TRIGGER validate_p08_allocation AFTER INSERT OR UPDATE ON reservation_allocations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_p08_request_binding();
CREATE CONSTRAINT TRIGGER validate_p08_action AFTER INSERT ON withdrawal_actions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_p08_request_binding();

CREATE FUNCTION guard_p08_action() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE request withdrawal_requests%ROWTYPE;
BEGIN
  SELECT * INTO request FROM withdrawal_requests WHERE id=NEW.request_id;
  IF NEW.committed_version<>request.version OR NEW.after_state<>request.state OR NEW.after_due_at<>request.due_at OR NEW.after_schedule_version<>request.schedule_version
    OR (NEW.kind='ACCEPT' AND (NEW.expected_version<>0 OR NEW.before_state IS NOT NULL OR NEW.actor_user_id IS DISTINCT FROM request.employee_id
      OR NEW.financial_operation_id IS DISTINCT FROM (SELECT opening_operation_id FROM reservation_allocations WHERE id=request.reservation_id)))
    OR (NEW.kind IN ('REJECT','RESTRICTION_CANCEL','FUTURE_DESTINATION_CANCEL') AND NEW.financial_operation_id IS DISTINCT FROM request.release_operation_id)
    OR (NEW.kind IN ('EXTEND','REJECT','FUTURE_DESTINATION_CANCEL') AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.actor_user_id AND role='ADMIN' AND status='ACTIVE' AND email_verified_at IS NOT NULL))
    OR (NEW.kind='EXTEND' AND (NEW.before_state<>'SCHEDULED' OR NEW.after_state<>'SCHEDULED' OR NEW.after_due_at<=NEW.before_due_at OR NEW.after_schedule_version<>NEW.before_schedule_version+1))
    OR (NEW.kind='REJECT' AND NEW.after_state<>'REJECTED') OR (NEW.kind IN ('RESTRICTION_CANCEL','FUTURE_DESTINATION_CANCEL') AND NEW.after_state<>'CANCELLED')
    OR (NEW.kind='CLAIM' AND (NEW.after_state<>'SIGNING' OR NEW.actor_process_id IS NULL)) THEN
    RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='ck_p08_action_binding',MESSAGE='Invalid withdrawal action';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_p08_action BEFORE INSERT ON withdrawal_actions FOR EACH ROW EXECUTE FUNCTION guard_p08_action();
CREATE FUNCTION validate_p08_reserve_domain() RETURNS trigger LANGUAGE plpgsql AS $$
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
    SELECT 1 FROM withdrawal_requests r WHERE r.release_operation_id=operation.id AND r.state IN ('REJECTED','CANCELLED')
      AND operation.kind='RELEASE' AND operation.business_key=r.id::text
  ) THEN RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='ck_p08_release_domain',MESSAGE='Withdrawal release requires a safe terminal request'; END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER validate_p08_reserve_operation AFTER INSERT ON financial_operations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_p08_reserve_domain();
CREATE CONSTRAINT TRIGGER validate_p08_reserve_posting AFTER INSERT ON ledger_postings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_p08_reserve_domain();
CREATE CONSTRAINT TRIGGER validate_p08_reserve_allocation AFTER INSERT ON reservation_allocations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_p08_reserve_domain();
CREATE FUNCTION guard_p08_quote() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM withdrawal_destinations d JOIN users u ON u.id=d.employee_id
    WHERE d.id=NEW.destination_id AND d.employee_id=NEW.employee_id AND u.role='USER'
      AND ROW(d.address,d.address_version,d.network)=ROW(NEW.recipient,NEW.address_version,NEW.network)) THEN
    RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='ck_p08_quote_destination',MESSAGE='Quote must bind confirmed destination';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_p08_quote BEFORE INSERT ON withdrawal_quotes FOR EACH ROW EXECUTE FUNCTION guard_p08_quote();
DO $$ DECLARE retained text; BEGIN
  FOREACH retained IN ARRAY ARRAY['withdrawal_quotes','withdrawal_destination_audits','withdrawal_actions'] LOOP
    EXECUTE format('CREATE TRIGGER immutable_p08_history BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_financial_history_mutation()',retained);
  END LOOP;
  FOREACH retained IN ARRAY ARRAY['withdrawal_quotes','withdrawal_destination_audits','withdrawal_actions','withdrawal_requests','withdrawal_destinations','withdrawal_policy'] LOOP
    EXECUTE format('CREATE TRIGGER retained_p08_history BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION reject_financial_history_mutation()',retained);
  END LOOP;
END $$;
DO $$ DECLARE runtime_role text; BEGIN
  FOREACH runtime_role IN ARRAY ARRAY['p06_api','p06_deposit_worker','p06_signer','p06_recovery_operator'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=runtime_role) THEN EXECUTE format('CREATE ROLE %I NOLOGIN',runtime_role); END IF;
  END LOOP;
END $$;
GRANT SELECT ON withdrawal_policy,withdrawal_destinations,withdrawal_quotes,withdrawal_requests,withdrawal_actions,withdrawal_destination_audits TO p06_api;
GRANT INSERT,UPDATE ON withdrawal_destinations TO p06_api;
GRANT INSERT ON withdrawal_quotes,withdrawal_requests,withdrawal_actions,withdrawal_destination_audits TO p06_api;
GRANT UPDATE(state,version,due_at,dispatch_at,schedule_version,next_check_at,finalized_at,release_operation_id) ON withdrawal_requests TO p06_api;
GRANT SELECT ON withdrawal_requests TO p06_deposit_worker;
GRANT UPDATE(next_check_at) ON withdrawal_requests TO p06_deposit_worker;
GRANT SELECT ON withdrawal_requests,withdrawal_quotes,withdrawal_destinations,withdrawal_actions TO p06_signer;
GRANT UPDATE(state,version) ON withdrawal_requests TO p06_signer;
GRANT INSERT ON withdrawal_actions TO p06_signer;
GRANT SELECT ON withdrawal_policy,withdrawal_destinations,withdrawal_quotes,withdrawal_requests,withdrawal_actions,withdrawal_destination_audits TO p06_recovery_operator;
COMMIT;
