-- CreateTable
CREATE TABLE "packages" (
    "code" VARCHAR(2) NOT NULL,
    "tier_order" INTEGER NOT NULL,
    "price_units" BIGINT NOT NULL,
    "daily_reward_units" BIGINT NOT NULL,
    "counted_work_dates" INTEGER NOT NULL,
    "withdrawal_fee_bps" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by_user_id" UUID,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "referral_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "level_1_bps" INTEGER NOT NULL,
    "level_2_bps" INTEGER NOT NULL,
    "level_3_bps" INTEGER NOT NULL,
    "level_4_bps" INTEGER NOT NULL,
    "level_5_bps" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by_user_id" UUID,

    CONSTRAINT "referral_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuration_changes" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "command_id" UUID NOT NULL,
    "target_kind" VARCHAR(32) NOT NULL,
    "package_code" VARCHAR(2),
    "intent_hash" CHAR(64) NOT NULL,
    "expected_version" INTEGER NOT NULL,
    "committed_version" INTEGER NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "before_snapshot" JSONB NOT NULL,
    "after_snapshot" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "configuration_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_quotes" (
    "id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "package_code" VARCHAR(2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "package_version" INTEGER NOT NULL,
    "referral_settings_version" INTEGER NOT NULL,
    "saved_rates_bps" JSONB NOT NULL,
    "expected_buyer_purchase_sequence" BIGINT NOT NULL,
    "observed_subscription_id" UUID,
    "action" VARCHAR(16) NOT NULL,
    "accepted_terms" JSONB NOT NULL,
    "tier_order" INTEGER NOT NULL,
    "price_units" BIGINT NOT NULL,
    "daily_reward_units" BIGINT NOT NULL,
    "counted_work_dates" INTEGER NOT NULL,
    "withdrawal_fee_bps" INTEGER NOT NULL,
    "available_referral_units" BIGINT NOT NULL,
    "reserved_referral_units" BIGINT NOT NULL,
    "available_non_referral_units" BIGINT NOT NULL,
    "reserved_non_referral_units" BIGINT NOT NULL,
    "full_debit_units" BIGINT NOT NULL,
    "usable_units" BIGINT NOT NULL,
    "top_up_units" BIGINT NOT NULL,
    "funded_referral_units" BIGINT NOT NULL,
    "funded_non_referral_units" BIGINT NOT NULL,
    "first_work_date" DATE NOT NULL,
    "final_work_date" DATE NOT NULL,
    "subscription_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "intent_hash" CHAR(64) NOT NULL,

    CONSTRAINT "purchase_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "buyer_sequence" BIGINT NOT NULL,
    "action" VARCHAR(16) NOT NULL,
    "package_code" VARCHAR(2) NOT NULL,
    "previous_subscription_id" UUID,
    "debit_operation_id" UUID NOT NULL,
    "purchased_at" TIMESTAMPTZ(6) NOT NULL,
    "accepted_terms" JSONB NOT NULL,
    "tier_order" INTEGER NOT NULL,
    "price_units" BIGINT NOT NULL,
    "daily_reward_units" BIGINT NOT NULL,
    "counted_work_dates" INTEGER NOT NULL,
    "withdrawal_fee_bps" INTEGER NOT NULL,
    "package_version" INTEGER NOT NULL,
    "full_debit_units" BIGINT NOT NULL,
    "source_referral_units" BIGINT NOT NULL,
    "source_non_referral_units" BIGINT NOT NULL,
    "commission_base_units" BIGINT NOT NULL,
    "referral_settings_version" INTEGER NOT NULL,
    "saved_rates_bps" JSONB NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "package_code" VARCHAR(2) NOT NULL,
    "accepted_terms" JSONB NOT NULL,
    "tier_order" INTEGER NOT NULL,
    "price_units" BIGINT NOT NULL,
    "daily_reward_units" BIGINT NOT NULL,
    "counted_work_dates" INTEGER NOT NULL,
    "withdrawal_fee_bps" INTEGER NOT NULL,
    "package_version" INTEGER NOT NULL,
    "activation_at" TIMESTAMPTZ(6) NOT NULL,
    "first_work_date" DATE NOT NULL,
    "final_work_date" DATE NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "state" VARCHAR(16) NOT NULL DEFAULT 'CURRENT',
    "replaced_at" TIMESTAMPTZ(6),
    "replacement_purchase_id" UUID,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_decisions" (
    "id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "decision" VARCHAR(16) NOT NULL,
    "skipped_reason" VARCHAR(32),
    "zero_reason" VARCHAR(32),
    "rate_bps" INTEGER NOT NULL,
    "commission_base_units" BIGINT NOT NULL,
    "award_units" BIGINT NOT NULL,
    "recipient_subscription_id" UUID,
    "eligibility_snapshot" JSONB NOT NULL,
    "credit_operation_id" UUID,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "referral_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "packages_tier_order_key" ON "packages"("tier_order");

-- CreateIndex
CREATE INDEX "configuration_changes_target_time_idx" ON "configuration_changes"("target_kind", "package_code", "occurred_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "configuration_changes_actor_command_key" ON "configuration_changes"("actor_user_id", "command_id");

-- CreateIndex
CREATE INDEX "purchase_quotes_buyer_time_idx" ON "purchase_quotes"("buyer_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_quotes_id_buyer_key" ON "purchase_quotes"("id", "buyer_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_quote_id_key" ON "purchases"("quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_debit_operation_id_key" ON "purchases"("debit_operation_id");

-- CreateIndex
CREATE INDEX "purchases_buyer_time_idx" ON "purchases"("buyer_id", "purchased_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_buyer_sequence_key" ON "purchases"("buyer_id", "buyer_sequence");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_quote_buyer_key" ON "purchases"("quote_id", "buyer_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_id_buyer_key" ON "purchases"("id", "buyer_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_purchase_id_key" ON "subscriptions"("purchase_id");

-- CreateIndex
CREATE INDEX "subscriptions_owner_activation_idx" ON "subscriptions"("owner_user_id", "activation_at", "id");

-- CreateIndex
CREATE INDEX "subscriptions_package_state_expiry_idx" ON "subscriptions"("package_code", "state", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_id_owner_key" ON "subscriptions"("id", "owner_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_purchase_owner_key" ON "subscriptions"("purchase_id", "owner_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "referral_decisions_credit_operation_id_key" ON "referral_decisions"("credit_operation_id");

-- CreateIndex
CREATE INDEX "referral_decisions_recipient_time_idx" ON "referral_decisions"("recipient_user_id", "occurred_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "referral_decisions_award_key" ON "referral_decisions"("purchase_id", "recipient_user_id", "level");

-- CreateIndex
CREATE UNIQUE INDEX "referral_decisions_purchase_level_key" ON "referral_decisions"("purchase_id", "level");

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "referral_settings" ADD CONSTRAINT "referral_settings_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "configuration_changes" ADD CONSTRAINT "configuration_changes_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "configuration_changes" ADD CONSTRAINT "configuration_changes_package_code_fkey" FOREIGN KEY ("package_code") REFERENCES "packages"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "purchase_quotes" ADD CONSTRAINT "purchase_quotes_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "purchase_quotes" ADD CONSTRAINT "purchase_quotes_package_code_fkey" FOREIGN KEY ("package_code") REFERENCES "packages"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "purchase_quotes" ADD CONSTRAINT "purchase_quotes_observed_subscription_id_buyer_id_fkey" FOREIGN KEY ("observed_subscription_id", "buyer_id") REFERENCES "subscriptions"("id", "owner_user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_package_code_fkey" FOREIGN KEY ("package_code") REFERENCES "packages"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_quote_id_buyer_id_fkey" FOREIGN KEY ("quote_id", "buyer_id") REFERENCES "purchase_quotes"("id", "buyer_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_previous_subscription_id_buyer_id_fkey" FOREIGN KEY ("previous_subscription_id", "buyer_id") REFERENCES "subscriptions"("id", "owner_user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_debit_operation_id_fkey" FOREIGN KEY ("debit_operation_id") REFERENCES "financial_operations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_package_code_fkey" FOREIGN KEY ("package_code") REFERENCES "packages"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_purchase_id_owner_user_id_fkey" FOREIGN KEY ("purchase_id", "owner_user_id") REFERENCES "purchases"("id", "buyer_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_replacement_purchase_id_owner_user_id_fkey" FOREIGN KEY ("replacement_purchase_id", "owner_user_id") REFERENCES "purchases"("id", "buyer_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "referral_decisions" ADD CONSTRAINT "referral_decisions_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "referral_decisions" ADD CONSTRAINT "referral_decisions_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "referral_decisions" ADD CONSTRAINT "referral_decisions_recipient_subscription_id_recipient_use_fkey" FOREIGN KEY ("recipient_subscription_id", "recipient_user_id") REFERENCES "subscriptions"("id", "owner_user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "referral_decisions" ADD CONSTRAINT "referral_decisions_credit_operation_id_fkey" FOREIGN KEY ("credit_operation_id") REFERENCES "financial_operations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Typed terms remain authoritative; JSON carries the same canonical, allowlisted snapshot.
CREATE FUNCTION p04_amount_units(amount text) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF amount IS NULL OR length(amount) > 20 OR amount !~ '^(0|[1-9][0-9]*)(\.[0-9]{0,5}[1-9])?$' THEN RETURN NULL; END IF;
  IF amount::numeric * 1000000 > 9223372036854775807 THEN RETURN NULL; END IF;
  RETURN amount::numeric * 1000000;
END $$;

CREATE FUNCTION p04_valid_rates(rates jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE rate jsonb;
BEGIN
  IF jsonb_typeof(rates) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(rates) <> 5 THEN RETURN false; END IF;
  FOR rate IN SELECT * FROM jsonb_array_elements(rates) LOOP
    IF jsonb_typeof(rate) <> 'number' OR rate::text !~ '^[0-9]+$' THEN RETURN false; END IF;
    IF rate::text::numeric > 10000 THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END $$;

CREATE FUNCTION p04_valid_terms(terms jsonb, code text, tier integer, version integer,
  price bigint, reward bigint, duration integer, fee integer) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF jsonb_typeof(terms) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  IF (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(terms) key) IS DISTINCT FROM
    ARRAY['calendar','code','conditionalGross','countedWorkDates','dailyReward','price','tierOrder','version','withdrawalFeeBps'] THEN RETURN false; END IF;
  RETURN COALESCE(terms->>'code' = code AND terms->'code' = to_jsonb(code)
    AND terms->'tierOrder' = to_jsonb(tier) AND terms->'version' = to_jsonb(version)
    AND terms->'countedWorkDates' = to_jsonb(duration) AND terms->'withdrawalFeeBps' = to_jsonb(fee)
    AND jsonb_typeof(terms->'price') = 'string' AND p04_amount_units(terms->>'price') = price
    AND jsonb_typeof(terms->'dailyReward') = 'string' AND p04_amount_units(terms->>'dailyReward') = reward
    AND jsonb_typeof(terms->'conditionalGross') = 'string'
    AND p04_amount_units(terms->>'conditionalGross') = reward::numeric * duration
    AND terms->'calendar' = '{"zone":"Asia/Baghdad","workdays":[1,2,3,4,5],"firstDateCutoff":"18:00","expiryBoundary":"EXCLUSIVE_NEXT_CALENDAR_DATE_START"}'::jsonb, false);
END $$;

CREATE FUNCTION p04_valid_term_dates(activation timestamptz, duration integer, first_date date, final_date date, expiry timestamptz)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE local_activation timestamp; expected_first date; expected_final date; remainder integer; days_to_add bigint;
BEGIN
  IF duration <= 0 OR activation < '0001-01-01T00:00:00Z'::timestamptz OR activation >= '10000-01-01T00:00:00Z'::timestamptz THEN RETURN false; END IF;
  local_activation := activation AT TIME ZONE 'Asia/Baghdad';
  expected_first := local_activation::date;
  IF local_activation::time >= '18:00' OR extract(isodow FROM expected_first) > 5 THEN expected_first := expected_first + 1; END IF;
  WHILE extract(isodow FROM expected_first) > 5 LOOP expected_first := expected_first + 1; END LOOP;
  days_to_add := ((duration::bigint - 1) / 5) * 7;
  IF days_to_add > '9999-12-31'::date - expected_first THEN RETURN false; END IF;
  expected_final := expected_first + days_to_add::integer;
  remainder := (duration - 1) % 5;
  WHILE remainder > 0 LOOP
    expected_final := expected_final + 1;
    IF extract(isodow FROM expected_final) <= 5 THEN remainder := remainder - 1; END IF;
  END LOOP;
  RETURN expected_first >= '0001-01-01'::date AND expected_final < '9999-12-31'::date
    AND first_date = expected_first AND final_date = expected_final
    AND expiry = ((expected_final + 1)::timestamp AT TIME ZONE 'Asia/Baghdad')
    AND expiry >= '0001-01-01T00:00:00Z'::timestamptz AND expiry < '10000-01-01T00:00:00Z'::timestamptz;
END $$;

ALTER TABLE packages ADD CONSTRAINT ck_packages_terms CHECK (
  (code, tier_order) IN (('S1',1),('S2',2),('O1',3),('O2',4),('A1',5))
  AND price_units > 0 AND daily_reward_units > 0 AND counted_work_dates > 0
  AND daily_reward_units::numeric * counted_work_dates <= 9223372036854775807
  AND withdrawal_fee_bps BETWEEN 0 AND 10000 AND version > 0);
ALTER TABLE referral_settings ADD CONSTRAINT ck_referral_settings_terms CHECK (
  id = 1 AND version > 0 AND level_1_bps BETWEEN 0 AND 10000 AND level_2_bps BETWEEN 0 AND 10000
  AND level_3_bps BETWEEN 0 AND 10000 AND level_4_bps BETWEEN 0 AND 10000 AND level_5_bps BETWEEN 0 AND 10000);
ALTER TABLE configuration_changes ADD CONSTRAINT ck_configuration_change_shape CHECK (
  ((target_kind = 'PACKAGE' AND package_code IS NOT NULL) OR (target_kind = 'REFERRAL_SETTINGS' AND package_code IS NULL))
  AND expected_version BETWEEN 1 AND 2147483646 AND committed_version::bigint = expected_version::bigint + 1
  AND length(btrim(reason)) > 0 AND intent_hash ~ '^[0-9a-f]{64}$'
  AND jsonb_typeof(before_snapshot) = 'object' AND jsonb_typeof(after_snapshot) = 'object'
  AND before_snapshot->'version' = to_jsonb(expected_version) AND after_snapshot->'version' = to_jsonb(committed_version)
  AND (target_kind <> 'PACKAGE' OR (before_snapshot->>'code' = package_code AND after_snapshot->>'code' = package_code)));
ALTER TABLE purchase_quotes ADD CONSTRAINT ck_purchase_quotes_terms CHECK (
  price_units > 0 AND daily_reward_units > 0 AND counted_work_dates > 0 AND package_version > 0
  AND withdrawal_fee_bps BETWEEN 0 AND 10000 AND referral_settings_version > 0
  AND expected_buyer_purchase_sequence BETWEEN 0 AND 9223372036854775806
  AND p04_valid_terms(accepted_terms,package_code,tier_order,package_version,price_units,daily_reward_units,counted_work_dates,withdrawal_fee_bps)
  AND p04_valid_rates(saved_rates_bps) AND intent_hash ~ '^[0-9a-f]{64}$'
  AND (package_code,tier_order) IN (('S1',1),('S2',2),('O1',3),('O2',4),('A1',5))
  AND action IN ('PURCHASE','UPGRADE') AND (action <> 'UPGRADE' OR observed_subscription_id IS NOT NULL)
  AND expires_at = created_at + interval '10 minutes'
  AND p04_valid_term_dates(created_at,counted_work_dates,first_work_date,final_work_date,subscription_expires_at));
ALTER TABLE purchase_quotes ADD CONSTRAINT ck_purchase_quotes_funding CHECK (
  available_referral_units >= 0 AND reserved_referral_units >= 0 AND available_non_referral_units >= 0 AND reserved_non_referral_units >= 0
  AND available_referral_units::numeric + reserved_referral_units + available_non_referral_units + reserved_non_referral_units <= 9223372036854775807
  AND full_debit_units = price_units AND usable_units::numeric = available_referral_units::numeric + available_non_referral_units
  AND funded_referral_units = LEAST(full_debit_units, available_referral_units)
  AND funded_non_referral_units = LEAST(full_debit_units - funded_referral_units, available_non_referral_units)
  AND top_up_units = GREATEST(0,full_debit_units - usable_units));
ALTER TABLE purchases ADD CONSTRAINT ck_purchases_terms CHECK (
  buyer_sequence > 0 AND package_version > 0 AND referral_settings_version > 0
  AND price_units > 0 AND daily_reward_units > 0 AND counted_work_dates > 0 AND withdrawal_fee_bps BETWEEN 0 AND 10000
  AND p04_valid_terms(accepted_terms,package_code,tier_order,package_version,price_units,daily_reward_units,counted_work_dates,withdrawal_fee_bps)
  AND p04_valid_rates(saved_rates_bps) AND full_debit_units = price_units AND source_referral_units >= 0 AND source_non_referral_units >= 0
  AND source_referral_units::numeric + source_non_referral_units = full_debit_units
  AND commission_base_units BETWEEN 0 AND full_debit_units
  AND ((action = 'PURCHASE' AND commission_base_units = full_debit_units) OR (action = 'UPGRADE' AND previous_subscription_id IS NOT NULL)));
ALTER TABLE subscriptions ADD CONSTRAINT ck_subscriptions_terms CHECK (
  price_units > 0 AND daily_reward_units > 0 AND counted_work_dates > 0 AND package_version > 0 AND withdrawal_fee_bps BETWEEN 0 AND 10000
  AND p04_valid_terms(accepted_terms,package_code,tier_order,package_version,price_units,daily_reward_units,counted_work_dates,withdrawal_fee_bps)
  AND p04_valid_term_dates(activation_at,counted_work_dates,first_work_date,final_work_date,expires_at));
ALTER TABLE subscriptions ADD CONSTRAINT ck_subscriptions_state CHECK (
  (state IN ('CURRENT','EXPIRED') AND replaced_at IS NULL AND replacement_purchase_id IS NULL)
  OR (state = 'REPLACED' AND replaced_at >= activation_at AND replaced_at < expires_at AND replacement_purchase_id IS NOT NULL));
CREATE UNIQUE INDEX subscriptions_one_current_per_owner ON subscriptions(owner_user_id) WHERE state = 'CURRENT';
ALTER TABLE referral_decisions ADD CONSTRAINT ck_referral_decisions_shape CHECK (
  level BETWEEN 1 AND 5 AND rate_bps BETWEEN 0 AND 10000 AND commission_base_units >= 0 AND award_units >= 0
  AND jsonb_typeof(eligibility_snapshot) = 'object'
  AND ((decision = 'AWARDED' AND award_units > 0 AND credit_operation_id IS NOT NULL AND recipient_subscription_id IS NOT NULL AND skipped_reason IS NULL AND zero_reason IS NULL
        AND award_units = floor(commission_base_units::numeric * rate_bps / 10000))
    OR (decision = 'ELIGIBLE_ZERO' AND award_units = 0 AND credit_operation_id IS NULL AND recipient_subscription_id IS NOT NULL AND skipped_reason IS NULL
        AND ((zero_reason = 'ZERO_BASE' AND commission_base_units = 0)
          OR (zero_reason = 'ZERO_RATE' AND commission_base_units > 0 AND rate_bps = 0)
          OR (zero_reason = 'FLOORED_ZERO' AND commission_base_units > 0 AND rate_bps > 0 AND floor(commission_base_units::numeric * rate_bps / 10000) = 0)))
    OR (decision = 'SKIPPED' AND award_units = 0 AND credit_operation_id IS NULL AND zero_reason IS NULL AND skipped_reason IN ('FREE','EXPIRED','BANNED','ACCOUNT_UNAVAILABLE'))));

INSERT INTO packages(code,tier_order,price_units,daily_reward_units,counted_work_dates,withdrawal_fee_bps,version,updated_at)
VALUES ('S1',1,60000000,2000000,365,2100,1,CURRENT_TIMESTAMP),
  ('S2',2,120000000,4000000,365,2100,1,CURRENT_TIMESTAMP),
  ('O1',3,600000000,16000000,365,2100,1,CURRENT_TIMESTAMP),
  ('O2',4,1200000000,38000000,365,2100,1,CURRENT_TIMESTAMP),
  ('A1',5,2600000000,67000000,365,2100,1,CURRENT_TIMESTAMP);
INSERT INTO referral_settings(id,version,level_1_bps,level_2_bps,level_3_bps,level_4_bps,level_5_bps,updated_at)
VALUES (1,1,1200,600,400,200,200,CURRENT_TIMESTAMP);

CREATE FUNCTION reject_p04_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_p04_history_immutable', MESSAGE = 'P04 history is immutable'; END $$;
DO $$ DECLARE history_table text; BEGIN
  FOREACH history_table IN ARRAY ARRAY['configuration_changes','purchase_quotes','purchases','referral_decisions'] LOOP
    EXECUTE format('CREATE TRIGGER p04_history_guard BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_p04_history_mutation()',history_table);
    EXECUTE format('CREATE TRIGGER p04_history_truncate_guard BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION reject_p04_history_mutation()',history_table);
  END LOOP;
END $$;

CREATE FUNCTION guard_p04_configuration() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_p04_configuration_fixed', MESSAGE = 'Configuration identity is fixed';
  END IF;
  IF NEW.version::bigint <> OLD.version::bigint + 1 OR NEW.updated_at < OLD.updated_at OR NEW.updated_by_user_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.updated_by_user_id AND role = 'ADMIN' AND status = 'ACTIVE' AND email_verified_at IS NOT NULL)
    OR (TG_TABLE_NAME = 'packages' AND (to_jsonb(NEW)->'code' <> to_jsonb(OLD)->'code' OR to_jsonb(NEW)->'tier_order' <> to_jsonb(OLD)->'tier_order'))
    OR (TG_TABLE_NAME = 'referral_settings' AND to_jsonb(NEW)->'id' <> to_jsonb(OLD)->'id') THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_p04_configuration_transition', MESSAGE = 'Invalid configuration transition';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER packages_configuration_guard BEFORE INSERT OR UPDATE OR DELETE ON packages FOR EACH ROW EXECUTE FUNCTION guard_p04_configuration();
CREATE TRIGGER packages_truncate_guard BEFORE TRUNCATE ON packages FOR EACH STATEMENT EXECUTE FUNCTION reject_p04_history_mutation();
CREATE TRIGGER referral_settings_configuration_guard BEFORE INSERT OR UPDATE OR DELETE ON referral_settings FOR EACH ROW EXECUTE FUNCTION guard_p04_configuration();
CREATE TRIGGER referral_settings_truncate_guard BEFORE TRUNCATE ON referral_settings FOR EACH STATEMENT EXECUTE FUNCTION reject_p04_history_mutation();

CREATE FUNCTION guard_p04_configuration_actor() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.actor_user_id AND role='ADMIN' AND status='ACTIVE' AND email_verified_at IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p04_configuration_actor', MESSAGE='Invalid configuration actor';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER configuration_changes_actor_guard BEFORE INSERT ON configuration_changes FOR EACH ROW EXECUTE FUNCTION guard_p04_configuration_actor();

CREATE FUNCTION guard_p04_purchase() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE quote purchase_quotes; prior subscriptions; operation financial_operations; owner uuid;
BEGIN
  SELECT * INTO quote FROM purchase_quotes WHERE id = NEW.quote_id AND buyer_id = NEW.buyer_id;
  SELECT * INTO operation FROM financial_operations WHERE id = NEW.debit_operation_id;
  SELECT owner_user_id INTO owner FROM wallets WHERE id = operation.wallet_id;
  IF quote.id IS NULL OR quote.top_up_units <> 0 OR NEW.buyer_sequence::numeric <> quote.expected_buyer_purchase_sequence::numeric + 1
    OR NEW.action <> quote.action OR NEW.package_code <> quote.package_code OR NEW.accepted_terms <> quote.accepted_terms
    OR NEW.saved_rates_bps <> quote.saved_rates_bps OR NEW.referral_settings_version <> quote.referral_settings_version
    OR NEW.previous_subscription_id IS DISTINCT FROM quote.observed_subscription_id
    OR NEW.full_debit_units <> quote.full_debit_units OR NEW.source_referral_units <> quote.funded_referral_units OR NEW.source_non_referral_units <> quote.funded_non_referral_units
    OR NEW.purchased_at < quote.created_at OR NEW.purchased_at >= quote.expires_at
    OR NOT p04_valid_term_dates(NEW.purchased_at,NEW.counted_work_dates,quote.first_work_date,quote.final_work_date,quote.subscription_expires_at)
    OR owner IS DISTINCT FROM NEW.buyer_id OR operation.kind IS DISTINCT FROM 'PURCHASE_DEBIT'
    OR operation.origin IS DISTINCT FROM 'PACKAGE_PURCHASE' OR operation.magnitude_units IS DISTINCT FROM NEW.full_debit_units
    OR operation.business_namespace IS DISTINCT FROM 'p04.purchase' OR operation.business_key IS DISTINCT FROM NEW.quote_id::text
    OR operation.actor_type IS DISTINCT FROM 'USER' OR operation.actor_user_id IS DISTINCT FROM NEW.buyer_id THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_p04_purchase_reference', MESSAGE = 'Purchase references disagree';
  END IF;
  IF (SELECT COALESCE(sum(-available_delta_units),0) FROM ledger_postings WHERE operation_id=NEW.debit_operation_id AND source='REFERRAL') <> NEW.source_referral_units
    OR (SELECT COALESCE(sum(-available_delta_units),0) FROM ledger_postings WHERE operation_id=NEW.debit_operation_id AND source='NON_REFERRAL') <> NEW.source_non_referral_units THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p04_purchase_sources', MESSAGE='Purchase source postings disagree';
  END IF;
  IF NEW.action = 'UPGRADE' THEN
    SELECT * INTO prior FROM subscriptions WHERE id = NEW.previous_subscription_id AND owner_user_id = NEW.buyer_id;
    IF prior.id IS NULL OR prior.state <> 'CURRENT' OR prior.activation_at > NEW.purchased_at OR prior.expires_at <= NEW.purchased_at
      OR NEW.tier_order <= prior.tier_order OR NEW.commission_base_units <> GREATEST(0,NEW.price_units - prior.price_units) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_p04_purchase_upgrade', MESSAGE = 'Upgrade terms disagree';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER purchases_reference_guard BEFORE INSERT ON purchases FOR EACH ROW EXECUTE FUNCTION guard_p04_purchase();

CREATE FUNCTION guard_p04_subscription() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE purchase purchases; replacement purchases;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p04_history_immutable', MESSAGE='Subscription history is retained';
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO purchase FROM purchases WHERE id = NEW.purchase_id AND buyer_id = NEW.owner_user_id;
    IF purchase.id IS NULL OR NEW.state <> 'CURRENT' OR NEW.package_code <> purchase.package_code OR NEW.accepted_terms <> purchase.accepted_terms OR NEW.activation_at <> purchase.purchased_at THEN
      RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_p04_subscription_purchase', MESSAGE = 'Subscription purchase disagrees';
    END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - ARRAY['state','replaced_at','replacement_purchase_id']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['state','replaced_at','replacement_purchase_id'])
    OR OLD.state <> 'CURRENT' OR NEW.state NOT IN ('REPLACED','EXPIRED') THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_p04_subscription_immutable', MESSAGE = 'Invalid subscription transition';
  END IF;
  -- Lazy expiry is tied to the accepted renewal event, not a second database clock.
  IF NEW.state = 'EXPIRED' AND NOT EXISTS (
    SELECT 1 FROM purchases WHERE previous_subscription_id=OLD.id AND buyer_id=OLD.owner_user_id
      AND action='PURCHASE' AND purchased_at>=OLD.expires_at
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_p04_subscription_expiry', MESSAGE = 'Subscription has not expired';
  END IF;
  IF NEW.state = 'REPLACED' THEN
    SELECT * INTO replacement FROM purchases WHERE id = NEW.replacement_purchase_id AND buyer_id = OLD.owner_user_id;
    IF replacement.id IS NULL OR replacement.previous_subscription_id IS DISTINCT FROM OLD.id OR replacement.action <> 'UPGRADE' OR replacement.purchased_at IS DISTINCT FROM NEW.replaced_at THEN
      RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_p04_subscription_replacement', MESSAGE = 'Replacement purchase disagrees';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER subscriptions_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON subscriptions FOR EACH ROW EXECUTE FUNCTION guard_p04_subscription();
CREATE TRIGGER subscriptions_truncate_guard BEFORE TRUNCATE ON subscriptions FOR EACH STATEMENT EXECUTE FUNCTION reject_p04_history_mutation();

CREATE FUNCTION guard_p04_referral_decision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE purchase purchases; operation financial_operations; owner uuid; ancestor uuid; depth integer;
BEGIN
  IF NEW.level NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_referral_decisions_shape', MESSAGE='Invalid referral level';
  END IF;
  SELECT * INTO purchase FROM purchases WHERE id = NEW.purchase_id;
  ancestor := purchase.buyer_id;
  FOR depth IN 1..NEW.level LOOP SELECT sponsor_user_id INTO ancestor FROM users WHERE id = ancestor; END LOOP;
  IF purchase.id IS NULL OR NEW.level NOT BETWEEN 1 AND 5 OR ancestor IS DISTINCT FROM NEW.recipient_user_id
    OR NEW.occurred_at <> purchase.purchased_at OR NEW.commission_base_units <> purchase.commission_base_units
    OR to_jsonb(NEW.rate_bps) IS DISTINCT FROM purchase.saved_rates_bps->(NEW.level - 1) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_p04_referral_event', MESSAGE = 'Referral event disagrees';
  END IF;
  IF NEW.decision = 'AWARDED' THEN
    SELECT * INTO operation FROM financial_operations WHERE id = NEW.credit_operation_id;
    SELECT owner_user_id INTO owner FROM wallets WHERE id = operation.wallet_id;
    IF owner IS DISTINCT FROM NEW.recipient_user_id OR operation.kind IS DISTINCT FROM 'CREDIT' OR operation.origin IS DISTINCT FROM 'REFERRAL_COMMISSION'
      OR operation.magnitude_units IS DISTINCT FROM NEW.award_units OR operation.business_namespace IS DISTINCT FROM 'p04.referral'
      OR operation.business_key IS DISTINCT FROM concat(NEW.purchase_id,':',NEW.recipient_user_id,':',NEW.level)
      OR NOT EXISTS (SELECT 1 FROM ledger_postings WHERE operation_id=NEW.credit_operation_id AND source='REFERRAL' AND available_delta_units=NEW.award_units AND reserved_delta_units=0) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', CONSTRAINT = 'ck_p04_referral_credit', MESSAGE = 'Referral credit disagrees';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER referral_decisions_reference_guard BEFORE INSERT ON referral_decisions FOR EACH ROW EXECUTE FUNCTION guard_p04_referral_decision();
