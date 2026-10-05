BEGIN;

-- CHECK accepts UNKNOWN; immutable history must satisfy the entire shape as TRUE.
-- Replacement constraints validate retained rows and abort without repairing history.
ALTER TABLE configuration_changes DROP CONSTRAINT ck_configuration_change_shape;
ALTER TABLE configuration_changes ADD CONSTRAINT ck_configuration_change_shape CHECK ((
  ((target_kind = 'PACKAGE' AND package_code IS NOT NULL) OR (target_kind = 'REFERRAL_SETTINGS' AND package_code IS NULL))
  AND expected_version BETWEEN 1 AND 2147483646 AND committed_version::bigint = expected_version::bigint + 1
  AND length(btrim(reason)) > 0 AND intent_hash ~ '^[0-9a-f]{64}$'
  AND jsonb_typeof(before_snapshot) = 'object' AND jsonb_typeof(after_snapshot) = 'object'
  AND before_snapshot->'version' = to_jsonb(expected_version) AND after_snapshot->'version' = to_jsonb(committed_version)
  AND (target_kind <> 'PACKAGE' OR (before_snapshot->>'code' = package_code AND after_snapshot->>'code' = package_code))
) IS TRUE);

ALTER TABLE referral_decisions DROP CONSTRAINT ck_referral_decisions_shape;
ALTER TABLE referral_decisions ADD CONSTRAINT ck_referral_decisions_shape CHECK ((
  level BETWEEN 1 AND 5 AND rate_bps BETWEEN 0 AND 10000 AND commission_base_units >= 0 AND award_units >= 0
  AND jsonb_typeof(eligibility_snapshot) = 'object'
  AND ((decision = 'AWARDED' AND award_units > 0 AND credit_operation_id IS NOT NULL AND recipient_subscription_id IS NOT NULL AND skipped_reason IS NULL AND zero_reason IS NULL
        AND award_units = floor(commission_base_units::numeric * rate_bps / 10000))
    OR (decision = 'ELIGIBLE_ZERO' AND award_units = 0 AND credit_operation_id IS NULL AND recipient_subscription_id IS NOT NULL AND skipped_reason IS NULL
        AND ((zero_reason = 'ZERO_BASE' AND commission_base_units = 0)
          OR (zero_reason = 'ZERO_RATE' AND commission_base_units > 0 AND rate_bps = 0)
          OR (zero_reason = 'FLOORED_ZERO' AND commission_base_units > 0 AND rate_bps > 0 AND floor(commission_base_units::numeric * rate_bps / 10000) = 0)))
    OR (decision = 'SKIPPED' AND award_units = 0 AND credit_operation_id IS NULL AND zero_reason IS NULL AND skipped_reason IN ('FREE','EXPIRED','BANNED','ACCOUNT_UNAVAILABLE')))
) IS TRUE);

COMMIT;
