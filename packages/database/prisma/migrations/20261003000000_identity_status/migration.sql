-- Commit enum additions before the authority migration uses these values.
ALTER TYPE user_status ADD VALUE 'BANNED';
ALTER TYPE user_status ADD VALUE 'DEACTIVATED';
