BEGIN;
-- Old API traffic must remain fenced throughout this migration and session-bound API cutover.
LOCK TABLE users IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE role='ADMIN') AND NOT EXISTS (
    SELECT 1 FROM users WHERE role='ADMIN' AND
      ((status='ACTIVE' AND email_verified_at IS NOT NULL) OR status='PENDING_VERIFICATION')
  ) THEN
    RAISE EXCEPTION 'Historical administrator recovery is required before identity cutover'
      USING ERRCODE='23514', CONSTRAINT='ck_identity_historical_admin_viable';
  END IF;
END $$;

ALTER TABLE users
  ADD COLUMN referral_code CHAR(32) NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  ADD COLUMN sponsor_user_id UUID,
  ADD COLUMN tasks_blocked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN withdrawals_blocked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN account_version INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX users_referral_code_key ON users(referral_code);
CREATE INDEX users_sponsor_idx ON users(sponsor_user_id);
CREATE INDEX users_role_created_id_idx ON users(role,created_at,id);
ALTER TABLE users DROP CONSTRAINT ck_users_status_timestamps_consistent;
UPDATE users SET status='DEACTIVATED' WHERE role='ADMIN' AND status='SUSPENDED';
ALTER TABLE users
  ADD CONSTRAINT ck_users_status_timestamps_consistent CHECK (status NOT IN ('ACTIVE','DEACTIVATED') OR email_verified_at IS NOT NULL),
  ADD CONSTRAINT ck_users_role_status CHECK ((role='USER' AND status <> 'DEACTIVATED') OR (role='ADMIN' AND status IN ('PENDING_VERIFICATION','ACTIVE','DEACTIVATED'))),
  ADD CONSTRAINT ck_users_admin_controls CHECK (role <> 'ADMIN' OR (sponsor_user_id IS NULL AND NOT tasks_blocked AND NOT withdrawals_blocked)),
  ADD CONSTRAINT ck_users_referral_code CHECK (referral_code ~ '^[0-9a-f]{32}$'),
  ADD CONSTRAINT ck_users_account_version CHECK (account_version >= 0),
  ADD CONSTRAINT ck_users_sponsor_not_self CHECK (sponsor_user_id IS NULL OR sponsor_user_id <> id),
  ADD CONSTRAINT users_sponsor_user_id_fkey FOREIGN KEY(sponsor_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

INSERT INTO wallets(id,owner_user_id,updated_at)
  SELECT gen_random_uuid(),id,CURRENT_TIMESTAMP FROM users WHERE role='USER'
  ON CONFLICT(owner_user_id) DO NOTHING;
DELETE FROM refresh_tokens;
UPDATE users SET verification_token_hash=NULL,verification_token_expires_at=NULL,reset_token_hash=NULL,reset_token_expires_at=NULL;
ALTER TABLE users ADD CONSTRAINT ck_users_action_pairs CHECK (
  ((verification_token_hash IS NULL AND verification_token_expires_at IS NULL) OR (verification_token_hash IS NOT NULL AND verification_token_expires_at IS NOT NULL AND verification_token_hash ~ '^[0-9a-f]{64}$'))
  AND ((reset_token_hash IS NULL AND reset_token_expires_at IS NULL) OR (reset_token_hash IS NOT NULL AND reset_token_expires_at IS NOT NULL AND reset_token_hash ~ '^[0-9a-f]{64}$'))
);
CREATE FUNCTION protect_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF TG_OP='UPDATE' AND (OLD.role IS DISTINCT FROM NEW.role OR OLD.referral_code IS DISTINCT FROM NEW.referral_code OR OLD.sponsor_user_id IS DISTINCT FROM NEW.sponsor_user_id) THEN
    RAISE EXCEPTION 'Identity relationship is immutable' USING ERRCODE='23514',CONSTRAINT='ck_users_identity_immutable';
  END IF;
  IF TG_OP='INSERT' AND NEW.sponsor_user_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.sponsor_user_id AND role='USER') THEN
    RAISE EXCEPTION 'Sponsor must be an existing employee' USING ERRCODE='23514',CONSTRAINT='ck_users_sponsor_employee';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER users_identity_guard BEFORE INSERT OR UPDATE ON users FOR EACH ROW EXECUTE FUNCTION protect_identity();

CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL,
  remember_me BOOLEAN NOT NULL, created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ(6) NOT NULL, revoked_at TIMESTAMPTZ(6),
  CONSTRAINT auth_sessions_id_user_key UNIQUE(id,user_id),
  CONSTRAINT auth_sessions_user_id_fkey FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_auth_sessions_times CHECK(expires_at>created_at AND (revoked_at IS NULL OR revoked_at>=created_at))
);
CREATE INDEX auth_sessions_user_revoked_idx ON auth_sessions(user_id,revoked_at);
CREATE INDEX auth_sessions_expiry_idx ON auth_sessions(expires_at);
ALTER TABLE refresh_tokens ADD COLUMN session_id UUID NOT NULL;
CREATE UNIQUE INDEX refresh_tokens_session_id_key ON refresh_tokens(session_id);
ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_session_id_user_id_fkey FOREIGN KEY(session_id,user_id) REFERENCES auth_sessions(id,user_id) ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE FUNCTION protect_session_revocation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF OLD.revoked_at IS NOT NULL AND OLD.revoked_at IS DISTINCT FROM NEW.revoked_at THEN
    RAISE EXCEPTION 'Session revocation is irreversible' USING ERRCODE='23514',CONSTRAINT='ck_auth_sessions_revocation_immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER auth_sessions_revocation_guard BEFORE UPDATE ON auth_sessions FOR EACH ROW EXECUTE FUNCTION protect_session_revocation();

CREATE TABLE admin_setup_state (
  id INTEGER PRIMARY KEY DEFAULT 1,first_admin_user_id UUID UNIQUE,completed_at TIMESTAMPTZ(6),completion_source VARCHAR(32),
  CONSTRAINT ck_admin_setup_singleton CHECK(id=1),
  CONSTRAINT ck_admin_setup_completion CHECK((first_admin_user_id IS NULL AND completed_at IS NULL AND completion_source IS NULL) OR (first_admin_user_id IS NOT NULL AND completed_at IS NOT NULL AND completion_source IS NOT NULL AND completion_source IN ('BOOTSTRAP','LEGACY_PRESENT'))),
  CONSTRAINT admin_setup_state_first_admin_user_id_fkey FOREIGN KEY(first_admin_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
INSERT INTO admin_setup_state(id,first_admin_user_id,completed_at,completion_source)
  SELECT 1,id,CURRENT_TIMESTAMP,'LEGACY_PRESENT' FROM users WHERE role='ADMIN' ORDER BY created_at,id LIMIT 1;
INSERT INTO admin_setup_state(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
CREATE FUNCTION protect_admin_setup() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') THEN
    RAISE EXCEPTION 'Administrator setup cannot be removed' USING ERRCODE='23514',CONSTRAINT='ck_admin_setup_irreversible';
  END IF;
  IF OLD.completed_at IS NOT NULL AND (OLD.first_admin_user_id IS DISTINCT FROM NEW.first_admin_user_id OR OLD.completed_at IS DISTINCT FROM NEW.completed_at OR OLD.completion_source IS DISTINCT FROM NEW.completion_source) THEN
    RAISE EXCEPTION 'Administrator setup cannot reopen' USING ERRCODE='23514',CONSTRAINT='ck_admin_setup_irreversible';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER admin_setup_guard BEFORE UPDATE OR DELETE ON admin_setup_state FOR EACH ROW EXECUTE FUNCTION protect_admin_setup();
CREATE TRIGGER admin_setup_truncate_guard BEFORE TRUNCATE ON admin_setup_state FOR EACH STATEMENT EXECUTE FUNCTION protect_admin_setup();

CREATE TABLE admin_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),email VARCHAR(320) NOT NULL,full_name VARCHAR(150) NOT NULL,issuer_user_id UUID NOT NULL,
  token_version INTEGER NOT NULL,token_hash CHAR(64) NOT NULL,issued_at TIMESTAMPTZ(6) NOT NULL,expires_at TIMESTAMPTZ(6) NOT NULL,
  accepted_at TIMESTAMPTZ(6),accepted_user_id UUID,revoked_at TIMESTAMPTZ(6),revoked_by_user_id UUID,revocation_reason VARCHAR(500),
  email_attempt_id UUID NOT NULL,delivery_status VARCHAR(32) NOT NULL DEFAULT 'NOT_ATTEMPTED',email_attempted_at TIMESTAMPTZ(6),email_acknowledged_at TIMESTAMPTZ(6),failure_code VARCHAR(32),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT ck_admin_invitation_identity CHECK(email=lower(btrim(email)) AND length(btrim(full_name))>0 AND token_version>0 AND token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_admin_invitation_expiry CHECK(expires_at>issued_at),
  CONSTRAINT ck_admin_invitation_disposition CHECK((accepted_at IS NULL)=(accepted_user_id IS NULL) AND (revoked_at IS NULL)=(revoked_by_user_id IS NULL) AND NOT(accepted_at IS NOT NULL AND revoked_at IS NOT NULL) AND (revoked_at IS NULL OR (revocation_reason IS NOT NULL AND length(btrim(revocation_reason))>0))),
  CONSTRAINT ck_admin_invitation_delivery CHECK(delivery_status IN ('NOT_ATTEMPTED','UNKNOWN','ACKNOWLEDGED','REJECTED') AND ((delivery_status='ACKNOWLEDGED' AND email_acknowledged_at IS NOT NULL) OR (delivery_status<>'ACKNOWLEDGED' AND email_acknowledged_at IS NULL)) AND (delivery_status='NOT_ATTEMPTED' OR email_attempted_at IS NOT NULL) AND (failure_code IS NULL OR failure_code IN ('TIMEOUT','TRANSPORT','RATE_LIMIT','PROVIDER_UNAVAILABLE','PROVIDER_REJECTED','INVALID_RESPONSE','RESPONSE_TOO_LARGE'))),
  CONSTRAINT admin_invitations_issuer_user_id_fkey FOREIGN KEY(issuer_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT admin_invitations_accepted_user_id_fkey FOREIGN KEY(accepted_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT admin_invitations_revoked_by_user_id_fkey FOREIGN KEY(revoked_by_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX admin_invitations_email_key ON admin_invitations(email);
CREATE UNIQUE INDEX admin_invitations_token_hash_key ON admin_invitations(token_hash);
CREATE INDEX admin_invitations_issuer_disposition_idx ON admin_invitations(issuer_user_id,accepted_at,revoked_at);
CREATE INDEX admin_invitations_created_id_idx ON admin_invitations(created_at,id);

CREATE FUNCTION valid_identity_snapshot(snapshot JSONB) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE field RECORD; scalar TEXT;
BEGIN
  IF snapshot IS NULL THEN RETURN true; END IF;
  IF jsonb_typeof(snapshot)<>'object' THEN RETURN false; END IF;
  FOR field IN SELECT key,value FROM jsonb_each(snapshot) LOOP
    scalar := field.value #>> '{}';
    IF field.key IN ('id','issuerUserId','acceptedUserId','revokedByUserId','firstAdminUserId') THEN
      IF field.value <> 'null'::jsonb AND (jsonb_typeof(field.value)<>'string' OR scalar !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') THEN RETURN false; END IF;
    ELSIF field.key IN ('issuedAt','expiresAt','acceptedAt','revokedAt','completedAt') THEN
      IF field.value <> 'null'::jsonb AND (jsonb_typeof(field.value)<>'string' OR length(scalar)>40 OR scalar !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$') THEN RETURN false; END IF;
    ELSIF field.key IN ('tasksBlocked','withdrawalsBlocked') THEN
      IF jsonb_typeof(field.value)<>'boolean' THEN RETURN false; END IF;
    ELSIF field.key IN ('accountVersion','tokenVersion') THEN
      IF jsonb_typeof(field.value)<>'number' OR scalar !~ '^\d{1,10}$' THEN RETURN false; END IF;
      IF scalar::numeric>2147483647 OR (field.key='tokenVersion' AND scalar::numeric<1) THEN RETURN false; END IF;
    ELSIF field.key='role' THEN
      IF scalar IS NULL OR scalar NOT IN ('USER','ADMIN') THEN RETURN false; END IF;
    ELSIF field.key='status' THEN
      IF scalar IS NULL OR scalar NOT IN ('PENDING_VERIFICATION','ACTIVE','SUSPENDED','BANNED','DEACTIVATED') THEN RETURN false; END IF;
    ELSIF field.key='disposition' THEN
      IF scalar IS NULL OR scalar NOT IN ('PENDING','ACCEPTED','REVOKED','EXPIRED') THEN RETURN false; END IF;
    ELSIF field.key='completionSource' THEN
      IF scalar IS NULL OR scalar NOT IN ('BOOTSTRAP','LEGACY_PRESENT') THEN RETURN false; END IF;
    ELSE RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END $$;
CREATE TABLE identity_audit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),occurred_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  action VARCHAR(32) NOT NULL,outcome VARCHAR(16) NOT NULL,actor_kind VARCHAR(32) NOT NULL,actor_user_id UUID,operator_identity VARCHAR(160),
  target_user_id UUID,invitation_id UUID,issuer_user_id UUID,token_version INTEGER,reason VARCHAR(500),before_snapshot JSONB,after_snapshot JSONB,
  CONSTRAINT ck_identity_audit_matrix CHECK(outcome='COMMITTED' AND (
    (action='BOOTSTRAP' AND actor_kind='OPERATOR' AND actor_user_id IS NULL AND operator_identity IS NOT NULL AND length(btrim(operator_identity))>0 AND target_user_id IS NOT NULL)
    OR (action IN ('INVITATION_ISSUE','INVITATION_REISSUE','INVITATION_REVOKE','EMPLOYEE_CONTROL','ADMIN_ACTIVATE','ADMIN_DEACTIVATE') AND actor_kind='ADMIN' AND actor_user_id IS NOT NULL AND operator_identity IS NULL)
    OR (action='INVITATION_ACCEPT' AND actor_kind='INVITED_RECIPIENT' AND actor_user_id IS NOT NULL AND actor_user_id=target_user_id AND target_user_id IS NOT NULL AND operator_identity IS NULL)
    OR (action='ADMIN_EMAIL_ACTIVATE' AND actor_kind='VERIFIED_EMAIL_RECIPIENT' AND actor_user_id IS NOT NULL AND actor_user_id=target_user_id AND target_user_id IS NOT NULL AND operator_identity IS NULL)
  )),
  CONSTRAINT ck_identity_audit_reason CHECK((actor_kind IN ('ADMIN','OPERATOR') AND reason IS NOT NULL AND length(btrim(reason))>0) OR (actor_kind IN ('INVITED_RECIPIENT','VERIFIED_EMAIL_RECIPIENT') AND reason IS NULL)),
  CONSTRAINT ck_identity_audit_links CHECK((action LIKE 'INVITATION_%' AND invitation_id IS NOT NULL AND issuer_user_id IS NOT NULL AND token_version IS NOT NULL AND token_version>0) OR (action NOT LIKE 'INVITATION_%' AND invitation_id IS NULL AND issuer_user_id IS NULL AND token_version IS NULL AND target_user_id IS NOT NULL)),
  CONSTRAINT ck_identity_audit_snapshots CHECK(valid_identity_snapshot(before_snapshot) AND valid_identity_snapshot(after_snapshot)),
  CONSTRAINT identity_audit_records_actor_user_id_fkey FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT identity_audit_records_target_user_id_fkey FOREIGN KEY(target_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT identity_audit_records_issuer_user_id_fkey FOREIGN KEY(issuer_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT identity_audit_records_invitation_id_fkey FOREIGN KEY(invitation_id) REFERENCES admin_invitations(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX identity_audit_target_time_idx ON identity_audit_records(target_user_id,occurred_at,id);
CREATE INDEX identity_audit_invitation_time_idx ON identity_audit_records(invitation_id,occurred_at,id);
CREATE FUNCTION protect_identity_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  RAISE EXCEPTION 'Identity audit is append-only' USING ERRCODE='23514',CONSTRAINT='ck_identity_audit_append_only';
END $$;
CREATE TRIGGER identity_audit_guard BEFORE UPDATE OR DELETE ON identity_audit_records FOR EACH ROW EXECUTE FUNCTION protect_identity_audit();
CREATE TRIGGER identity_audit_truncate_guard BEFORE TRUNCATE ON identity_audit_records FOR EACH STATEMENT EXECUTE FUNCTION protect_identity_audit();
COMMIT;
