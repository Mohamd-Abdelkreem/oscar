BEGIN;

-- CreateEnum
CREATE TYPE "task_publication_state" AS ENUM ('PUBLISHED', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "task_code_state" AS ENUM ('ENABLED', 'PAUSED');

-- CreateEnum
CREATE TYPE "image_asset_purpose" AS ENUM ('PROOF', 'TASK_ILLUSTRATION');

-- CreateEnum
CREATE TYPE "image_asset_state" AS ENUM ('STAGING', 'READY', 'FAILED', 'DELETING', 'DELETED');

-- CreateEnum
CREATE TYPE "task_submission_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "task_command_kind" AS ENUM ('TASK_CREATE', 'TASK_EDIT', 'TASK_STATUS', 'CODE_CREATE', 'CODE_STATUS', 'TASK_UNLOCK', 'SUBMISSION_CREATE', 'EVIDENCE_REPLACE', 'FINAL_REVIEW');

-- CreateEnum
CREATE TYPE "task_command_terminal_state" AS ENUM ('COMMITTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "publication_date" DATE NOT NULL,
    "publication_state" "task_publication_state" NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "first_participation_at" TIMESTAMPTZ(6),
    "title" VARCHAR(150) NOT NULL,
    "description" VARCHAR(10000) NOT NULL,
    "target_url" VARCHAR(2000) NOT NULL,
    "platform" VARCHAR(80) NOT NULL,
    "illustration_asset_id" UUID,
    "illustration_purpose" "image_asset_purpose",
    "is_code_required" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by_user_id" UUID NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_codes" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "normalized_text" VARCHAR(64) NOT NULL,
    "state" "task_code_state" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "description" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by_user_id" UUID NOT NULL,

    CONSTRAINT "task_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_unlocks" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "code_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "unlocked_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "task_unlocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_assets" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "purpose" "image_asset_purpose" NOT NULL,
    "upload_command_id" UUID NOT NULL,
    "upload_intent_hash" CHAR(64),
    "state" "image_asset_state" NOT NULL,
    "received_at" TIMESTAMPTZ(6),
    "uploaded_by_session_id" UUID,
    "processing_lease_id" UUID,
    "processing_lease_expires_at" TIMESTAMPTZ(6),
    "uploaded_at" TIMESTAMPTZ(6),
    "ready_at" TIMESTAMPTZ(6),
    "storage_key" VARCHAR(128),
    "input_byte_count" INTEGER,
    "stored_byte_count" INTEGER,
    "format" VARCHAR(8),
    "width" INTEGER,
    "height" INTEGER,
    "content_hash" CHAR(64),
    "failure_code" VARCHAR(40),
    "failed_at" TIMESTAMPTZ(6),
    "deletion_lease_id" UUID,
    "deletion_lease_expires_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "image_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_submissions" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "captured_task_revision" INTEGER NOT NULL,
    "captured_task_content" JSONB NOT NULL,
    "subscription_id" UUID NOT NULL,
    "captured_subscription_terms" JSONB NOT NULL,
    "reward_units" BIGINT NOT NULL,
    "execution_declared" BOOLEAN NOT NULL,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL,
    "deadline_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "task_submission_status" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "current_evidence_version" INTEGER NOT NULL,

    CONSTRAINT "task_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_evidence" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "asset_id" UUID NOT NULL,
    "asset_purpose" "image_asset_purpose" NOT NULL,
    "accepted_at" TIMESTAMPTZ(6) NOT NULL,
    "accepted_by_user_id" UUID NOT NULL,

    CONSTRAINT "submission_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "final_reviews" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "decision" "task_submission_status" NOT NULL,
    "submission_version" INTEGER NOT NULL,
    "evidence_version" INTEGER NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "decided_at" TIMESTAMPTZ(6) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "wallet_id" UUID,
    "approval_operation_id" UUID,

    CONSTRAINT "final_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_command_records" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "kind" "task_command_kind" NOT NULL,
    "command_id" UUID NOT NULL,
    "terminal_state" "task_command_terminal_state" NOT NULL,
    "intent_hash" CHAR(64),
    "task_id" UUID,
    "code_id" UUID,
    "submission_id" UUID,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "reason" VARCHAR(500),
    "before_snapshot" JSONB,
    "after_snapshot" JSONB,
    "safe_outcome" JSONB,

    CONSTRAINT "task_command_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tasks_publication_date_key" ON "tasks"("publication_date");

-- CreateIndex
CREATE INDEX "tasks_date_id_idx" ON "tasks"("publication_date", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_id_date_key" ON "tasks"("id", "publication_date");

-- CreateIndex
CREATE UNIQUE INDEX "task_codes_normalized_text_key" ON "task_codes"("normalized_text");

-- CreateIndex
CREATE INDEX "task_codes_task_state_id_idx" ON "task_codes"("task_id", "state", "id");

-- CreateIndex
CREATE UNIQUE INDEX "task_codes_id_task_key" ON "task_codes"("id", "task_id");

-- CreateIndex
CREATE INDEX "task_unlocks_code_time_idx" ON "task_unlocks"("code_id", "unlocked_at", "id");

-- CreateIndex
CREATE INDEX "task_unlocks_employee_date_idx" ON "task_unlocks"("employee_id", "business_date", "id");

-- CreateIndex
CREATE UNIQUE INDEX "task_unlocks_employee_task_date_key" ON "task_unlocks"("employee_id", "task_id", "business_date");

-- CreateIndex
CREATE UNIQUE INDEX "image_assets_storage_key_key" ON "image_assets"("storage_key");

-- CreateIndex
CREATE INDEX "image_assets_retention_idx" ON "image_assets"("purpose", "state", "uploaded_at", "id");

-- CreateIndex
CREATE INDEX "image_assets_deletion_lease_idx" ON "image_assets"("state", "deletion_lease_expires_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "image_assets_owner_purpose_upload_key" ON "image_assets"("owner_user_id", "purpose", "upload_command_id");

-- CreateIndex
CREATE UNIQUE INDEX "image_assets_id_owner_purpose_key" ON "image_assets"("id", "owner_user_id", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "image_assets_id_purpose_key" ON "image_assets"("id", "purpose");

-- CreateIndex
CREATE INDEX "task_submissions_status_time_idx" ON "task_submissions"("status", "submitted_at", "id");

-- CreateIndex
CREATE INDEX "task_submissions_task_status_time_idx" ON "task_submissions"("task_id", "status", "submitted_at", "id");

-- CreateIndex
CREATE INDEX "task_submissions_employee_time_idx" ON "task_submissions"("employee_id", "submitted_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "task_submissions_employee_date_key" ON "task_submissions"("employee_id", "business_date");

-- CreateIndex
CREATE UNIQUE INDEX "task_submissions_id_employee_key" ON "task_submissions"("id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_submissions_id_task_date_key" ON "task_submissions"("id", "task_id", "business_date");

-- CreateIndex
CREATE INDEX "submission_evidence_asset_submission_idx" ON "submission_evidence"("asset_id", "submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "submission_evidence_submission_version_key" ON "submission_evidence"("submission_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "final_reviews_submission_key" ON "final_reviews"("submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "final_reviews_approval_operation_key" ON "final_reviews"("approval_operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "final_reviews_submission_employee_key" ON "final_reviews"("submission_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "final_reviews_operation_wallet_key" ON "final_reviews"("approval_operation_id", "wallet_id");

-- CreateIndex
CREATE INDEX "task_commands_actor_time_idx" ON "task_command_records"("actor_user_id", "occurred_at", "id");

-- CreateIndex
CREATE INDEX "task_commands_code_time_idx" ON "task_command_records"("code_id", "occurred_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "task_commands_actor_kind_command_key" ON "task_command_records"("actor_user_id", "kind", "command_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_id_owner_key" ON "wallets"("id", "owner_user_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_illustration_asset_id_illustration_purpose_fkey" FOREIGN KEY ("illustration_asset_id", "illustration_purpose") REFERENCES "image_assets"("id", "purpose") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_codes" ADD CONSTRAINT "task_codes_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_codes" ADD CONSTRAINT "task_codes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_codes" ADD CONSTRAINT "task_codes_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_unlocks" ADD CONSTRAINT "task_unlocks_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_unlocks" ADD CONSTRAINT "task_unlocks_task_id_business_date_fkey" FOREIGN KEY ("task_id", "business_date") REFERENCES "tasks"("id", "publication_date") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_unlocks" ADD CONSTRAINT "task_unlocks_code_id_task_id_fkey" FOREIGN KEY ("code_id", "task_id") REFERENCES "task_codes"("id", "task_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_uploaded_by_session_id_owner_user_id_fkey" FOREIGN KEY ("uploaded_by_session_id", "owner_user_id") REFERENCES "auth_sessions"("id", "user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_task_id_business_date_fkey" FOREIGN KEY ("task_id", "business_date") REFERENCES "tasks"("id", "publication_date") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_submissions" ADD CONSTRAINT "task_submissions_subscription_id_employee_id_fkey" FOREIGN KEY ("subscription_id", "employee_id") REFERENCES "subscriptions"("id", "owner_user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "submission_evidence" ADD CONSTRAINT "submission_evidence_submission_id_employee_id_fkey" FOREIGN KEY ("submission_id", "employee_id") REFERENCES "task_submissions"("id", "employee_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "submission_evidence" ADD CONSTRAINT "submission_evidence_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "submission_evidence" ADD CONSTRAINT "submission_evidence_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "submission_evidence" ADD CONSTRAINT "submission_evidence_asset_id_employee_id_asset_purpose_fkey" FOREIGN KEY ("asset_id", "employee_id", "asset_purpose") REFERENCES "image_assets"("id", "owner_user_id", "purpose") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "final_reviews" ADD CONSTRAINT "final_reviews_submission_id_employee_id_fkey" FOREIGN KEY ("submission_id", "employee_id") REFERENCES "task_submissions"("id", "employee_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "final_reviews" ADD CONSTRAINT "final_reviews_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "final_reviews" ADD CONSTRAINT "final_reviews_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "final_reviews" ADD CONSTRAINT "final_reviews_submission_id_evidence_version_fkey" FOREIGN KEY ("submission_id", "evidence_version") REFERENCES "submission_evidence"("submission_id", "version") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "final_reviews" ADD CONSTRAINT "final_reviews_wallet_id_employee_id_fkey" FOREIGN KEY ("wallet_id", "employee_id") REFERENCES "wallets"("id", "owner_user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "final_reviews" ADD CONSTRAINT "final_reviews_approval_operation_id_wallet_id_fkey" FOREIGN KEY ("approval_operation_id", "wallet_id") REFERENCES "financial_operations"("id", "wallet_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_command_records" ADD CONSTRAINT "task_command_records_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_command_records" ADD CONSTRAINT "task_command_records_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_command_records" ADD CONSTRAINT "task_command_records_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "task_codes"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "task_command_records" ADD CONSTRAINT "task_command_records_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "task_submissions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- SQL complements wire validation and protects direct writes and deferred links.
ALTER TABLE tasks ADD CONSTRAINT ck_tasks_publication_weekday CHECK (extract(isodow FROM publication_date) BETWEEN 1 AND 5);
ALTER TABLE tasks ADD CONSTRAINT ck_tasks_state CHECK (publication_state IN ('PUBLISHED','PAUSED','CLOSED'));
ALTER TABLE tasks ADD CONSTRAINT ck_tasks_revision CHECK (revision BETWEEN 1 AND 2147483647);
ALTER TABLE tasks ADD CONSTRAINT ck_tasks_first_participation CHECK (first_participation_at IS NULL OR first_participation_at >= created_at);
ALTER TABLE tasks ADD CONSTRAINT ck_tasks_content CHECK (length(btrim(title))>0 AND length(btrim(description))>0 AND length(btrim(platform))>0 AND target_url ~ '^https?://');
ALTER TABLE tasks ADD CONSTRAINT ck_tasks_illustration CHECK (((illustration_asset_id IS NULL AND illustration_purpose IS NULL) OR (illustration_asset_id IS NOT NULL AND illustration_purpose='TASK_ILLUSTRATION')) IS TRUE);
ALTER TABLE task_codes ADD CONSTRAINT ck_task_codes_state CHECK (state IN ('ENABLED','PAUSED'));
ALTER TABLE task_codes ADD CONSTRAINT ck_task_codes_version CHECK (version BETWEEN 1 AND 2147483647);
-- Full Unicode case mapping agrees with JS uppercase (including expansions such as ß).
CREATE FUNCTION p05_utf16_length(code text) RETURNS integer LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT length(code)::integer + count(*)::integer FROM regexp_split_to_table(code,'') ch WHERE ascii(ch)>65535;
$$;
ALTER TABLE task_codes ADD CONSTRAINT ck_task_codes_normalized_text CHECK ((
  length(normalized_text)>0 AND normalized_text=upper(normalized_text COLLATE pg_unicode_fast)
  AND normalized_text=btrim(normalized_text, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
  AND normalized_text !~ '[\x01-\x1F\x7F-\x9F]'
  AND p05_utf16_length(normalized_text)<=64
) IS TRUE);

ALTER TABLE image_assets ADD CONSTRAINT ck_image_assets_purpose CHECK (purpose IN ('PROOF','TASK_ILLUSTRATION'));
ALTER TABLE image_assets ADD CONSTRAINT ck_image_assets_file_bounds CHECK ((
  (input_byte_count IS NULL OR input_byte_count BETWEEN 1 AND 5242880)
  AND (stored_byte_count IS NULL OR stored_byte_count BETWEEN 1 AND 33554432)
  AND (width IS NULL OR width BETWEEN 1 AND 8192) AND (height IS NULL OR height BETWEEN 1 AND 8192)
  AND (width IS NULL OR height IS NULL OR width::bigint*height<=16777216)
  AND (format IS NULL OR format='PNG')
  AND (upload_intent_hash IS NULL OR upload_intent_hash ~ '^[0-9a-f]{64}$')
  AND (content_hash IS NULL OR content_hash ~ '^[0-9a-f]{64}$')
  AND (storage_key IS NULL OR storage_key ~ '^[a-zA-Z0-9_-]{1,128}$')
) IS TRUE);
ALTER TABLE image_assets ADD CONSTRAINT ck_image_assets_state_metadata CHECK ((
  ((state='STAGING' AND received_at IS NOT NULL AND uploaded_by_session_id IS NOT NULL AND storage_key IS NOT NULL
    AND processing_lease_id IS NOT NULL AND processing_lease_expires_at>received_at AND ready_at IS NULL
    AND failure_code IS NULL AND failed_at IS NULL
    AND ((uploaded_at IS NULL AND upload_intent_hash IS NULL AND input_byte_count IS NULL)
      OR (uploaded_at>=received_at AND upload_intent_hash IS NOT NULL AND input_byte_count IS NOT NULL)))
  OR (state IN ('READY','DELETING','DELETED') AND received_at IS NOT NULL AND uploaded_by_session_id IS NOT NULL
    AND uploaded_at>=received_at AND ready_at>=uploaded_at AND storage_key IS NOT NULL
    AND upload_intent_hash IS NOT NULL AND input_byte_count IS NOT NULL AND stored_byte_count IS NOT NULL
    AND width IS NOT NULL AND height IS NOT NULL AND format='PNG' AND content_hash IS NOT NULL
    AND processing_lease_id IS NULL AND processing_lease_expires_at IS NULL AND failure_code IS NULL AND failed_at IS NULL)
  OR (state='FAILED' AND failure_code IN ('UPLOAD_CANCELLED','UPLOAD_TOO_LARGE','UNSUPPORTED_IMAGE','INVALID_IMAGE','STORAGE_UNAVAILABLE','IMAGE_PROCESSING_UNAVAILABLE','UPLOAD_INTERRUPTED','UPLOAD_EXPIRED')
    AND failed_at IS NOT NULL AND ready_at IS NULL AND processing_lease_id IS NULL AND processing_lease_expires_at IS NULL
    AND ((received_at IS NULL AND uploaded_by_session_id IS NULL AND storage_key IS NULL AND uploaded_at IS NULL AND upload_intent_hash IS NULL
          AND input_byte_count IS NULL AND stored_byte_count IS NULL AND format IS NULL AND width IS NULL AND height IS NULL AND content_hash IS NULL AND failure_code='UPLOAD_CANCELLED')
      OR (received_at IS NOT NULL AND uploaded_by_session_id IS NOT NULL AND storage_key IS NOT NULL AND failed_at>=received_at
        AND ((uploaded_at IS NULL AND upload_intent_hash IS NULL AND input_byte_count IS NULL)
          OR (uploaded_at>=received_at AND upload_intent_hash IS NOT NULL AND input_byte_count IS NOT NULL))))))
) IS TRUE);
ALTER TABLE image_assets ADD CONSTRAINT ck_image_assets_deletion_lease CHECK ((
  (state='DELETING' AND deletion_lease_id IS NOT NULL AND deletion_lease_expires_at IS NOT NULL AND deleted_at IS NULL)
  OR (state='DELETED' AND deletion_lease_id IS NULL AND deletion_lease_expires_at IS NULL AND deleted_at>=ready_at)
  OR (state IN ('STAGING','READY','FAILED') AND deletion_lease_id IS NULL AND deletion_lease_expires_at IS NULL AND deleted_at IS NULL)
) IS TRUE);

ALTER TABLE task_submissions ADD CONSTRAINT ck_task_submissions_declaration CHECK (execution_declared IS TRUE);
ALTER TABLE task_submissions ADD CONSTRAINT ck_task_submissions_reward CHECK (reward_units>0);
ALTER TABLE task_submissions ADD CONSTRAINT ck_task_submissions_versions CHECK (version BETWEEN 1 AND 2147483647 AND current_evidence_version BETWEEN 1 AND 2147483647 AND captured_task_revision BETWEEN 1 AND 2147483647);
ALTER TABLE task_submissions ADD CONSTRAINT ck_task_submissions_window CHECK ((
  extract(isodow FROM business_date) BETWEEN 1 AND 5
  AND (submitted_at AT TIME ZONE 'Asia/Baghdad')::date=business_date
  AND (submitted_at AT TIME ZONE 'Asia/Baghdad')::time >= '12:00'::time
  AND (submitted_at AT TIME ZONE 'Asia/Baghdad')::time < '18:00'::time
  AND deadline_at=(business_date + '18:00'::time) AT TIME ZONE 'Asia/Baghdad'
) IS TRUE);
ALTER TABLE submission_evidence ADD CONSTRAINT ck_submission_evidence_shape CHECK (version>0 AND asset_purpose='PROOF' AND accepted_by_user_id=employee_id);
ALTER TABLE task_submissions ADD CONSTRAINT task_submissions_current_evidence_fkey FOREIGN KEY (id,current_evidence_version)
  REFERENCES submission_evidence(submission_id,version) ON UPDATE RESTRICT ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE final_reviews ADD CONSTRAINT ck_final_reviews_decision_money CHECK ((
  submission_version BETWEEN 1 AND 2147483646 AND evidence_version>0 AND length(btrim(reason))>0
  AND ((decision='APPROVED' AND wallet_id IS NOT NULL AND approval_operation_id IS NOT NULL)
    OR (decision='REJECTED' AND wallet_id IS NULL AND approval_operation_id IS NULL))
) IS TRUE);
ALTER TABLE task_command_records ADD CONSTRAINT ck_task_commands_terminal_shape CHECK ((
  (terminal_state='CANCELLED' AND intent_hash IS NULL AND task_id IS NULL AND code_id IS NULL AND submission_id IS NULL
    AND safe_outcome IS NULL AND before_snapshot IS NULL AND after_snapshot IS NULL AND reason IS NULL)
  OR (terminal_state='COMMITTED' AND intent_hash ~ '^[0-9a-f]{64}$' AND task_id IS NOT NULL AND jsonb_typeof(safe_outcome)='object'
    AND ((kind IN ('TASK_CREATE','TASK_EDIT','TASK_STATUS') AND code_id IS NULL AND submission_id IS NULL AND reason IS NULL
      AND jsonb_typeof(after_snapshot)='object' AND (kind='TASK_CREATE' OR jsonb_typeof(before_snapshot)='object'))
    OR (kind IN ('CODE_CREATE','CODE_STATUS') AND code_id IS NOT NULL AND submission_id IS NULL AND reason IS NULL
      AND jsonb_typeof(after_snapshot)='object' AND (kind='CODE_CREATE' OR jsonb_typeof(before_snapshot)='object'))
    OR (kind='TASK_UNLOCK' AND code_id IS NOT NULL AND submission_id IS NULL AND reason IS NULL AND before_snapshot IS NULL AND after_snapshot IS NULL)
    OR (kind IN ('SUBMISSION_CREATE','EVIDENCE_REPLACE') AND submission_id IS NOT NULL AND code_id IS NULL AND reason IS NULL AND before_snapshot IS NULL AND after_snapshot IS NULL)
    OR (kind='FINAL_REVIEW' AND submission_id IS NOT NULL AND code_id IS NULL AND length(btrim(reason))>0 AND jsonb_typeof(before_snapshot)='object' AND jsonb_typeof(after_snapshot)='object')))
) IS TRUE);
ALTER TABLE task_command_records ADD CONSTRAINT ck_task_commands_snapshot_bounds CHECK (
  (before_snapshot IS NULL OR octet_length(before_snapshot::text)<=65536)
  AND (after_snapshot IS NULL OR octet_length(after_snapshot::text)<=65536)
  AND (safe_outcome IS NULL OR octet_length(safe_outcome::text)<=131072)
);

CREATE FUNCTION reject_p05_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p05_history_immutable', MESSAGE='Task history is retained';
END $$;
DO $$ DECLARE history_table text; BEGIN
  FOREACH history_table IN ARRAY ARRAY['task_unlocks','submission_evidence','final_reviews','task_command_records'] LOOP
    EXECUTE format('CREATE TRIGGER p05_history_guard BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_p05_history_mutation()',history_table);
  END LOOP;
  FOREACH history_table IN ARRAY ARRAY['tasks','task_codes','task_unlocks','image_assets','task_submissions','submission_evidence','final_reviews','task_command_records'] LOOP
    EXECUTE format('CREATE TRIGGER p05_truncate_guard BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION reject_p05_history_mutation()',history_table);
  END LOOP;
END $$;

CREATE FUNCTION guard_p05_task() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p05_history_immutable', MESSAGE='Task history is retained'; END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW.id<>OLD.id OR NEW.created_at<>OLD.created_at OR NEW.created_by_user_id<>OLD.created_by_user_id
      OR (OLD.first_participation_at IS NOT NULL AND (NEW.publication_date<>OLD.publication_date OR NEW.first_participation_at IS DISTINCT FROM OLD.first_participation_at)) THEN
      RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_tasks_date_immutable', MESSAGE='Task attribution is immutable';
    END IF;
    IF (to_jsonb(NEW)-ARRAY['first_participation_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['first_participation_at'])
      AND NEW.revision::bigint<>OLD.revision::bigint+1 THEN
      RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_tasks_revision_transition', MESSAGE='Task revision must advance';
    END IF;
  END IF;
  IF TG_OP='INSERT' OR NEW.illustration_asset_id IS DISTINCT FROM OLD.illustration_asset_id THEN
    IF NEW.illustration_asset_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM image_assets WHERE id=NEW.illustration_asset_id AND purpose='TASK_ILLUSTRATION' AND state='READY' FOR SHARE) THEN
      RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_tasks_ready_illustration', MESSAGE='Ready illustration required';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tasks_mutation_guard BEFORE INSERT OR UPDATE OR DELETE ON tasks FOR EACH ROW EXECUTE FUNCTION guard_p05_task();

CREATE FUNCTION guard_p05_code() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p05_history_immutable', MESSAGE='Code history is retained'; END IF;
  IF NEW.id<>OLD.id OR NEW.task_id<>OLD.task_id OR NEW.normalized_text<>OLD.normalized_text OR NEW.created_at<>OLD.created_at OR NEW.created_by_user_id<>OLD.created_by_user_id
    OR NEW.version::bigint<>OLD.version::bigint+1 THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_task_codes_immutable', MESSAGE='Invalid code transition';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER task_codes_mutation_guard BEFORE UPDATE OR DELETE ON task_codes FOR EACH ROW EXECUTE FUNCTION guard_p05_code();

CREATE FUNCTION guard_p05_asset() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p05_history_immutable', MESSAGE='Asset history is retained'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.state NOT IN ('STAGING','FAILED') THEN RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_image_assets_transition', MESSAGE='Intake must precede readiness'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.id<>OLD.id OR NEW.owner_user_id<>OLD.owner_user_id OR NEW.purpose<>OLD.purpose OR NEW.upload_command_id<>OLD.upload_command_id
    OR NEW.received_at IS DISTINCT FROM OLD.received_at OR NEW.uploaded_by_session_id IS DISTINCT FROM OLD.uploaded_by_session_id OR NEW.storage_key IS DISTINCT FROM OLD.storage_key
    OR (OLD.uploaded_at IS NOT NULL AND (NEW.uploaded_at IS DISTINCT FROM OLD.uploaded_at OR NEW.upload_intent_hash IS DISTINCT FROM OLD.upload_intent_hash OR NEW.input_byte_count IS DISTINCT FROM OLD.input_byte_count))
    OR OLD.state IN ('FAILED','DELETED')
    OR NOT ((OLD.state='STAGING' AND NEW.state IN ('STAGING','READY','FAILED')) OR (OLD.state='READY' AND NEW.state='DELETING') OR (OLD.state='DELETING' AND NEW.state IN ('DELETING','DELETED'))) THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_image_assets_transition', MESSAGE='Invalid immutable asset transition';
  END IF;
  IF OLD.state IN ('READY','DELETING') AND
    (to_jsonb(NEW)-ARRAY['state','deletion_lease_id','deletion_lease_expires_at','deleted_at']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['state','deletion_lease_id','deletion_lease_expires_at','deleted_at']) THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_image_assets_metadata_immutable', MESSAGE='Accepted image facts are immutable';
  END IF;
  IF OLD.state='READY' AND (EXISTS (SELECT 1 FROM tasks WHERE illustration_asset_id=OLD.id)
    OR (OLD.purpose='PROOF' AND (NEW.deletion_lease_expires_at-interval '120 seconds' < OLD.uploaded_at+interval '30 days' OR EXISTS (
      SELECT 1 FROM submission_evidence e JOIN task_submissions s ON s.id=e.submission_id WHERE e.asset_id=OLD.id AND s.status='PENDING')))) THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_image_assets_retained', MESSAGE='Retained asset cannot be deleted';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER image_assets_lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON image_assets FOR EACH ROW EXECUTE FUNCTION guard_p05_asset();

CREATE FUNCTION guard_p05_submission() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE saved subscriptions; current_task tasks;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p05_history_immutable', MESSAGE='Submission history is retained'; END IF;
  IF TG_OP='INSERT' THEN
    SELECT * INTO saved FROM subscriptions WHERE id=NEW.subscription_id AND owner_user_id=NEW.employee_id;
    SELECT * INTO current_task FROM tasks WHERE id=NEW.task_id;
    IF saved.id IS NULL OR current_task.id IS NULL OR NEW.status<>'PENDING' OR NEW.version<>1 OR NEW.current_evidence_version<>1
      OR NEW.captured_subscription_terms IS DISTINCT FROM saved.accepted_terms OR NEW.reward_units IS DISTINCT FROM saved.daily_reward_units
      OR saved.state<>'CURRENT' OR NEW.submitted_at<saved.activation_at OR NEW.submitted_at>=saved.expires_at
      OR NEW.captured_task_revision<>current_task.revision OR NEW.captured_task_content IS DISTINCT FROM jsonb_build_object('title',current_task.title,'description',current_task.description,'targetUrl',current_task.target_url,'platform',current_task.platform) THEN
      RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_task_submissions_snapshot', MESSAGE='Accepted snapshot disagrees';
    END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW)-ARRAY['status','version','current_evidence_version']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','version','current_evidence_version'])
    OR OLD.status<>'PENDING' OR NEW.version::bigint<>OLD.version::bigint+1
    OR NOT ((NEW.status='PENDING' AND NEW.current_evidence_version::bigint=OLD.current_evidence_version::bigint+1)
      OR (NEW.status IN ('APPROVED','REJECTED') AND NEW.current_evidence_version=OLD.current_evidence_version)) THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_task_submissions_immutable', MESSAGE='Invalid accepted submission transition';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER task_submissions_mutation_guard BEFORE INSERT OR UPDATE OR DELETE ON task_submissions FOR EACH ROW EXECUTE FUNCTION guard_p05_submission();

CREATE FUNCTION guard_p05_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE claim task_submissions;
BEGIN
  SELECT * INTO claim FROM task_submissions WHERE id=NEW.submission_id AND employee_id=NEW.employee_id;
  IF claim.id IS NULL OR claim.status<>'PENDING' OR NEW.accepted_at<claim.submitted_at OR NEW.accepted_at>=claim.deadline_at
    OR NOT EXISTS (SELECT 1 FROM image_assets WHERE id=NEW.asset_id AND owner_user_id=NEW.employee_id AND purpose='PROOF' AND state='READY' FOR SHARE) THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_submission_evidence_ready', MESSAGE='Owned ready pending evidence required';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER submission_evidence_attachment_guard BEFORE INSERT ON submission_evidence FOR EACH ROW EXECUTE FUNCTION guard_p05_evidence();

-- Each relevant write side schedules a final-state check, not just review inserts.
CREATE FUNCTION validate_p05_submission_links() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE claim_id uuid; claim task_submissions; review final_reviews; operation financial_operations; posting_total numeric; evidence_count bigint;
BEGIN
  IF TG_TABLE_NAME='task_submissions' THEN claim_id:=NEW.id;
  ELSIF TG_TABLE_NAME IN ('submission_evidence','final_reviews') THEN claim_id:=NEW.submission_id;
  ELSIF TG_TABLE_NAME='financial_operations' THEN
    IF NEW.business_namespace<>'p05.task-reward' THEN RETURN NULL; END IF;
    BEGIN claim_id:=NEW.business_key::uuid; EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p05_reward_reference', MESSAGE='Invalid reward identity'; END;
  ELSE
    SELECT business_key::uuid INTO claim_id FROM financial_operations WHERE id=NEW.operation_id AND business_namespace='p05.task-reward';
    IF claim_id IS NULL THEN RETURN NULL; END IF;
  END IF;
  SELECT * INTO claim FROM task_submissions WHERE id=claim_id;
  IF claim.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p05_reward_reference', MESSAGE='Reward has no accepted claim'; END IF;
  SELECT * INTO review FROM final_reviews WHERE submission_id=claim.id;
  IF TG_TABLE_NAME='financial_operations' AND NEW.id IS DISTINCT FROM review.approval_operation_id THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p05_reward_reference', MESSAGE='Reward operation requires its own final review';
  END IF;
  SELECT count(*) INTO evidence_count FROM submission_evidence WHERE submission_id=claim.id;
  IF evidence_count<>claim.current_evidence_version OR NOT EXISTS (SELECT 1 FROM submission_evidence WHERE submission_id=claim.id AND version=claim.current_evidence_version)
    OR EXISTS (SELECT 1 FROM submission_evidence WHERE submission_id=claim.id AND (version>claim.current_evidence_version OR employee_id<>claim.employee_id)) THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p05_current_evidence', MESSAGE='Evidence versions disagree';
  END IF;
  IF claim.status='PENDING' THEN
    IF review.id IS NOT NULL OR EXISTS (SELECT 1 FROM financial_operations WHERE business_namespace='p05.task-reward' AND business_key=claim.id::text) THEN
      RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p05_final_consistency', MESSAGE='Pending work has final effects'; END IF;
    RETURN NULL;
  END IF;
  IF review.id IS NULL OR review.decision<>claim.status OR review.evidence_version<>claim.current_evidence_version OR review.submission_version::bigint+1<>claim.version
    OR review.decided_at<claim.submitted_at OR NOT EXISTS (SELECT 1 FROM users WHERE id=review.actor_user_id AND role='ADMIN') THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p05_final_consistency', MESSAGE='Final decision disagrees'; END IF;
  IF claim.status='REJECTED' THEN
    IF EXISTS (SELECT 1 FROM financial_operations WHERE business_namespace='p05.task-reward' AND business_key=claim.id::text) THEN
      RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p05_final_consistency', MESSAGE='Rejected work has reward'; END IF;
    RETURN NULL;
  END IF;
  SELECT * INTO operation FROM financial_operations WHERE id=review.approval_operation_id;
  SELECT COALESCE(sum(available_delta_units),0) INTO posting_total FROM ledger_postings WHERE operation_id=operation.id AND source='NON_REFERRAL' AND reserved_delta_units=0;
  IF operation.id IS NULL OR operation.kind<>'CREDIT' OR operation.origin<>'TASK_REWARD' OR operation.business_namespace<>'p05.task-reward' OR operation.business_key<>claim.id::text
    OR operation.wallet_id IS DISTINCT FROM review.wallet_id OR operation.magnitude_units<>claim.reward_units OR posting_total<>claim.reward_units
    OR operation.actor_type<>'USER' OR operation.actor_user_id IS DISTINCT FROM review.actor_user_id
    OR NOT EXISTS (SELECT 1 FROM financial_audit_records WHERE operation_id=operation.id)
    OR EXISTS (SELECT 1 FROM ledger_postings WHERE operation_id=operation.id AND (source<>'NON_REFERRAL' OR reserved_delta_units<>0)) THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p05_reward_reference', MESSAGE='Captured reward credit disagrees'; END IF;
  RETURN NULL;
END $$;
DO $$ DECLARE source_table text; BEGIN
  FOREACH source_table IN ARRAY ARRAY['task_submissions','submission_evidence','final_reviews','financial_operations','ledger_postings','financial_audit_records'] LOOP
    EXECUTE format('CREATE CONSTRAINT TRIGGER p05_final_links AFTER INSERT OR UPDATE ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_p05_submission_links()',source_table);
  END LOOP;
END $$;

CREATE FUNCTION validate_p05_participation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE candidate_task_id uuid; marker timestamptz;
BEGIN
  IF TG_TABLE_NAME='tasks' THEN candidate_task_id:=NEW.id; ELSE candidate_task_id:=NEW.task_id; END IF;
  SELECT first_participation_at INTO marker FROM tasks WHERE id=candidate_task_id;
  IF (EXISTS (SELECT 1 FROM task_unlocks WHERE task_id=candidate_task_id) OR EXISTS (SELECT 1 FROM task_submissions WHERE task_id=candidate_task_id)) AND marker IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p05_participation', MESSAGE='Participation marker required'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER p05_participation AFTER INSERT OR UPDATE ON tasks DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_p05_participation();
CREATE CONSTRAINT TRIGGER p05_participation AFTER INSERT OR UPDATE ON task_unlocks DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_p05_participation();
CREATE CONSTRAINT TRIGGER p05_participation AFTER INSERT OR UPDATE ON task_submissions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_p05_participation();

CREATE FUNCTION guard_p05_command() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE required_role user_role;
BEGIN
  required_role:=CASE WHEN NEW.kind IN ('TASK_UNLOCK','SUBMISSION_CREATE','EVIDENCE_REPLACE') THEN 'USER'::user_role ELSE 'ADMIN'::user_role END;
  IF NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.actor_user_id AND role=required_role AND status='ACTIVE' AND email_verified_at IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_task_commands_actor', MESSAGE='Current command actor required'; END IF;
  IF NEW.terminal_state='COMMITTED' AND (
    (NEW.code_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM task_codes WHERE id=NEW.code_id AND task_id=NEW.task_id))
    OR (NEW.submission_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM task_submissions WHERE id=NEW.submission_id AND task_id=NEW.task_id AND (required_role='ADMIN' OR employee_id=NEW.actor_user_id)))) THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_task_commands_target', MESSAGE='Command attribution disagrees'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER task_commands_attribution_guard BEFORE INSERT ON task_command_records FOR EACH ROW EXECUTE FUNCTION guard_p05_command();

COMMIT;
