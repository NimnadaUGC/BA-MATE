-- BA Mate research service. Apply with a least-privilege MySQL user on an empty database.
CREATE TABLE accounts (
  id BINARY(16) PRIMARY KEY, email VARCHAR(254) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
  role ENUM('participant','researcher') NOT NULL DEFAULT 'participant', status ENUM('active','revoked') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, revoked_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE study_identities (
  account_id BINARY(16) PRIMARY KEY, study_pseudonym CHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_identity_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE invitations (
  id BINARY(16) PRIMARY KEY, email VARCHAR(254) NOT NULL, token_hash CHAR(64) NOT NULL UNIQUE,
  role ENUM('participant','researcher') NOT NULL DEFAULT 'participant', expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL, created_by BINARY(16) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX invitation_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE sessions (
  id BINARY(16) PRIMARY KEY, account_id BINARY(16) NOT NULL, token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL, offline_until TIMESTAMP NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL, CONSTRAINT fk_session_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  INDEX session_lookup (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE recovery_tokens (
  id BINARY(16) PRIMARY KEY, account_id BINARY(16) NOT NULL, token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL, used_at TIMESTAMP NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recovery_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Short-lived, one-way request fingerprints for account abuse protection. Cleaned by the API after 24 hours.
CREATE TABLE auth_rate_limits (
  throttle_key CHAR(64) PRIMARY KEY, attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE consent_receipts (
  id BINARY(16) PRIMARY KEY, account_id BINARY(16) NOT NULL, consent_version VARCHAR(80) NOT NULL,
  state ENUM('active','withdrawn') NOT NULL, recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  withdrawn_at TIMESTAMP NULL, CONSTRAINT fk_consent_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  INDEX consent_current (account_id, state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE upload_batches (
  batch_id CHAR(36) PRIMARY KEY, account_id BINARY(16) NOT NULL, study_pseudonym CHAR(20) NOT NULL,
  consent_version VARCHAR(80) NOT NULL, received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_batch_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE research_events (
  event_id VARCHAR(100) PRIMARY KEY, batch_id CHAR(36) NOT NULL, study_pseudonym CHAR(20) NOT NULL,
  occurred_at TIMESTAMP NOT NULL, run_code VARCHAR(100) NULL, run_condition VARCHAR(40) NULL,
  payload JSON NOT NULL, received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_event_batch FOREIGN KEY (batch_id) REFERENCES upload_batches(batch_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Deliberate free-text feedback is held outside routine measurement batches and never included in the ordinary export.
CREATE TABLE feedback_submissions (
  feedback_id CHAR(36) PRIMARY KEY, account_id BINARY(16) NOT NULL, study_pseudonym CHAR(20) NOT NULL,
  consent_version VARCHAR(80) NOT NULL, feedback_text TEXT NOT NULL,
  review_state ENUM('unreviewed','reviewed','withheld','withdrawal_requested') NOT NULL DEFAULT 'unreviewed',
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TIMESTAMP NULL,
  CONSTRAINT fk_feedback_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  INDEX feedback_review (review_state, submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Researcher-recorded rubric score and correction effort. It is distinct from participant self-ratings.
CREATE TABLE quality_assessments (
  assessment_id CHAR(36) PRIMARY KEY, researcher_id BINARY(16) NOT NULL, study_pseudonym CHAR(20) NOT NULL,
  run_code VARCHAR(100) NOT NULL, instrument_version VARCHAR(120) NOT NULL,
  quality_score TINYINT UNSIGNED NOT NULL, correction_effort_minutes SMALLINT UNSIGNED NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_assessment_researcher FOREIGN KEY (researcher_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CONSTRAINT uq_quality_assessment UNIQUE (study_pseudonym, run_code, instrument_version),
  INDEX quality_run (study_pseudonym, run_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE administrative_actions (
  id BINARY(16) PRIMARY KEY, actor_id BINARY(16) NOT NULL, action VARCHAR(80) NOT NULL,
  subject VARCHAR(120) NOT NULL, at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
