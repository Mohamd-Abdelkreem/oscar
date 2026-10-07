BEGIN;
CREATE TABLE deposit_candidate_discoveries (
  candidate_id UUID NOT NULL REFERENCES deposit_candidates(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  assignment_id UUID NOT NULL REFERENCES deposit_address_assignments(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  discovered_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (candidate_id, assignment_id)
);
CREATE INDEX deposit_candidate_discoveries_assignment_idx ON deposit_candidate_discoveries(assignment_id, candidate_id);

-- Only retained canonical receipts can establish ownership of legacy candidates.
INSERT INTO deposit_candidate_discoveries (candidate_id, assignment_id, discovered_at)
SELECT DISTINCT c.id, r.assignment_id, c.first_observed_at
FROM deposit_candidates c JOIN deposit_receipts r ON r.network=c.network AND r.transaction_id=c.transaction_id
ON CONFLICT DO NOTHING;

CREATE FUNCTION guard_p06_candidate_discovery() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p06_discovery_immutable', MESSAGE='Discovery attribution is retained';
  END IF;
  IF NOT (p06_role_member('p06_deposit_worker') OR p06_recovery_authority()) OR NOT EXISTS (
    SELECT 1 FROM deposit_candidates c JOIN deposit_address_assignments a ON a.network=c.network
    WHERE c.id=NEW.candidate_id AND a.id=NEW.assignment_id AND a.address IS NOT NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514', CONSTRAINT='ck_p06_discovery_binding', MESSAGE='Invalid discovery attribution';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_p06_candidate_discovery BEFORE INSERT OR UPDATE OR DELETE ON deposit_candidate_discoveries
FOR EACH ROW EXECUTE FUNCTION guard_p06_candidate_discovery();
COMMIT;
