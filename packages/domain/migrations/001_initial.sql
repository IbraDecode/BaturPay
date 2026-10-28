CREATE TABLE merchants (
  merchant_id TEXT PRIMARY KEY CHECK (length(btrim(merchant_id)) BETWEEN 1 AND 255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE provider_accounts (
  merchant_id TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('SANDBOX', 'PRODUCTION')),
  provider_account_id TEXT NOT NULL CHECK (length(btrim(provider_account_id)) BETWEEN 1 AND 255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (merchant_id, environment, provider_account_id),
  CONSTRAINT provider_accounts_merchant_fk FOREIGN KEY (merchant_id) REFERENCES merchants (merchant_id) ON DELETE RESTRICT
);

CREATE TABLE idempotency_records (
  storage_key TEXT PRIMARY KEY CHECK (length(storage_key) = 64 AND storage_key ~ '^[0-9a-f]{64}$'),
  merchant_id TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('SANDBOX', 'PRODUCTION')),
  operation TEXT NOT NULL CHECK (operation IN ('PAYMENT_CREATE', 'REFUND_CREATE')),
  provider_account_id TEXT NULL,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64 AND fingerprint ~ '^[0-9a-f]{64}$'),
  payment_id TEXT NOT NULL CHECK (length(btrim(payment_id)) BETWEEN 1 AND 255),
  state TEXT NOT NULL CHECK (state IN ('IN_PROGRESS', 'SUCCEEDED', 'FAILED_FINAL', 'UNKNOWN')),
  response JSONB NULL,
  recovery_code TEXT NULL CHECK (recovery_code IS NULL OR recovery_code ~ '^[A-Z0-9_]{1,64}$'),
  retention_seconds BIGINT NOT NULL CHECK (retention_seconds > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT idempotency_records_merchant_fk FOREIGN KEY (merchant_id) REFERENCES merchants (merchant_id) ON DELETE RESTRICT,
  CONSTRAINT idempotency_records_provider_account_fk FOREIGN KEY (merchant_id, environment, provider_account_id)
    REFERENCES provider_accounts (merchant_id, environment, provider_account_id) ON DELETE RESTRICT,
  CONSTRAINT idempotency_scope_unique UNIQUE (storage_key, merchant_id, environment, payment_id),
  CONSTRAINT idempotency_final_has_response CHECK ((state IN ('SUCCEEDED', 'FAILED_FINAL')) = (response IS NOT NULL)),
  CONSTRAINT idempotency_unknown_has_recovery_code CHECK ((state = 'UNKNOWN') = (recovery_code IS NOT NULL))
);

CREATE INDEX idempotency_recovery_idx ON idempotency_records (state, updated_at) WHERE state IN ('IN_PROGRESS', 'UNKNOWN');
CREATE INDEX idempotency_expiry_idx ON idempotency_records (expires_at) WHERE state IN ('SUCCEEDED', 'FAILED_FINAL');

CREATE TABLE payments (
  payment_id TEXT PRIMARY KEY CHECK (length(btrim(payment_id)) BETWEEN 1 AND 255),
  merchant_id TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('SANDBOX', 'PRODUCTION')),
  service_model TEXT NOT NULL CHECK (service_model IN ('CONNECTED_PROVIDER', 'BATURPAY')),
  provider_account_id TEXT NULL,
  amount_minor BIGINT NOT NULL,
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status TEXT NOT NULL CHECK (status IN ('CREATED', 'PENDING', 'REQUIRES_ACTION', 'PROCESSING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'UNKNOWN')),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version BETWEEN 1 AND 9007199254740991),
  idempotency_storage_key TEXT NOT NULL CHECK (length(idempotency_storage_key) = 64 AND idempotency_storage_key ~ '^[0-9a-f]{64}$') UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT payment_amount_positive CHECK (amount_minor > 0),
  CONSTRAINT payment_merchant_environment_id_unique UNIQUE (merchant_id, environment, payment_id),
  CONSTRAINT payments_merchant_fk FOREIGN KEY (merchant_id) REFERENCES merchants (merchant_id) ON DELETE RESTRICT,
  CONSTRAINT payments_provider_account_fk FOREIGN KEY (merchant_id, environment, provider_account_id)
    REFERENCES provider_accounts (merchant_id, environment, provider_account_id) ON DELETE RESTRICT,
  CONSTRAINT payments_idempotency_scope_fk FOREIGN KEY (idempotency_storage_key, merchant_id, environment, payment_id)
    REFERENCES idempotency_records (storage_key, merchant_id, environment, payment_id) ON DELETE RESTRICT
);

CREATE INDEX payments_merchant_environment_created_idx ON payments (merchant_id, environment, created_at DESC);

CREATE FUNCTION baturpay_guard_payment_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> 'CREATED' OR NEW.version <> 1 THEN
    RAISE EXCEPTION 'payments must be inserted in CREATED version 1' USING ERRCODE = '23514', CONSTRAINT = 'payments_initial_state_guard';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payments_initial_state_guard BEFORE INSERT ON payments
FOR EACH ROW EXECUTE FUNCTION baturpay_guard_payment_insert();

ALTER TABLE idempotency_records
  ADD CONSTRAINT idempotency_payment_fk FOREIGN KEY (merchant_id, environment, payment_id)
  REFERENCES payments (merchant_id, environment, payment_id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE payment_evidence (
  evidence_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payment_id TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('SANDBOX', 'PRODUCTION')),
  evidence_kind TEXT NOT NULL CHECK (evidence_kind IN ('REQUEST_ACCEPTED', 'PROVIDER_OBSERVATION', 'VERIFIED_WEBHOOK', 'VERIFIED_RECONCILIATION', 'OPERATION_AMBIGUOUS')),
  reference TEXT NOT NULL CHECK (length(btrim(reference)) BETWEEN 1 AND 512),
  received_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT payment_evidence_payment_fk FOREIGN KEY (merchant_id, environment, payment_id)
    REFERENCES payments (merchant_id, environment, payment_id) ON DELETE RESTRICT
);
CREATE INDEX payment_evidence_payment_received_idx ON payment_evidence (payment_id, received_at);

CREATE FUNCTION baturpay_guard_payment_update() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  expected_version BIGINT;
BEGIN
  IF OLD.status IN ('PAID', 'FAILED', 'EXPIRED', 'CANCELLED') THEN
    RAISE EXCEPTION 'terminal payment state is immutable' USING ERRCODE = '23514', CONSTRAINT = 'payments_transition_guard';
  END IF;
  IF ROW(NEW.payment_id, NEW.merchant_id, NEW.environment, NEW.service_model, NEW.provider_account_id, NEW.amount_minor, NEW.currency, NEW.idempotency_storage_key, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.payment_id, OLD.merchant_id, OLD.environment, OLD.service_model, OLD.provider_account_id, OLD.amount_minor, OLD.currency, OLD.idempotency_storage_key, OLD.created_at) THEN
    RAISE EXCEPTION 'payment identity and request fields are immutable' USING ERRCODE = '23514', CONSTRAINT = 'payments_transition_guard';
  END IF;
  expected_version := OLD.version;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status <> 'UNKNOWN' OR OLD.status = 'UNKNOWN' THEN
      RAISE EXCEPTION 'payment state transition requires verified application authority' USING ERRCODE = '23514', CONSTRAINT = 'payments_transition_guard';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM idempotency_records r WHERE r.storage_key = OLD.idempotency_storage_key AND r.state = 'IN_PROGRESS') THEN
      RAISE EXCEPTION 'UNKNOWN requires an in-progress operation record' USING ERRCODE = '23514', CONSTRAINT = 'payments_transition_guard';
    END IF;
    expected_version := OLD.version + 1;
  END IF;
  IF NEW.version <> expected_version THEN
    RAISE EXCEPTION 'payment version change is invalid' USING ERRCODE = '23514', CONSTRAINT = 'payments_transition_guard';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payments_state_guard BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION baturpay_guard_payment_update();

CREATE FUNCTION baturpay_guard_idempotency_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.storage_key, NEW.merchant_id, NEW.environment, NEW.operation, NEW.provider_account_id, NEW.fingerprint, NEW.payment_id, NEW.retention_seconds, NEW.created_at, NEW.expires_at)
     IS DISTINCT FROM
     ROW(OLD.storage_key, OLD.merchant_id, OLD.environment, OLD.operation, OLD.provider_account_id, OLD.fingerprint, OLD.payment_id, OLD.retention_seconds, OLD.created_at, OLD.expires_at) THEN
    RAISE EXCEPTION 'idempotency identity is immutable' USING ERRCODE = '23514', CONSTRAINT = 'idempotency_transition_guard';
  END IF;
  IF OLD.state IN ('SUCCEEDED', 'FAILED_FINAL') THEN
    RAISE EXCEPTION 'final idempotency result is immutable' USING ERRCODE = '23514', CONSTRAINT = 'idempotency_transition_guard';
  END IF;
  IF NEW.state = 'UNKNOWN' AND NOT EXISTS (
    SELECT 1 FROM payments p WHERE p.idempotency_storage_key = NEW.storage_key AND p.status = 'UNKNOWN'
  ) THEN
    RAISE EXCEPTION 'UNKNOWN operation requires payment marked UNKNOWN in same transaction' USING ERRCODE = '23514', CONSTRAINT = 'idempotency_transition_guard';
  END IF;
  IF NEW.state IN ('SUCCEEDED', 'FAILED_FINAL') AND OLD.state <> 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'only an in-progress operation can finalize' USING ERRCODE = '23514', CONSTRAINT = 'idempotency_transition_guard';
  END IF;
  IF OLD.state = 'UNKNOWN' AND NEW.state <> 'UNKNOWN' THEN
    RAISE EXCEPTION 'UNKNOWN requires an explicit recovery protocol' USING ERRCODE = '23514', CONSTRAINT = 'idempotency_transition_guard';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION baturpay_guard_idempotency_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state <> 'IN_PROGRESS' OR NEW.response IS NOT NULL OR NEW.recovery_code IS NOT NULL THEN
    RAISE EXCEPTION 'idempotency claims must start IN_PROGRESS without a result' USING ERRCODE = '23514', CONSTRAINT = 'idempotency_initial_state_guard';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER idempotency_initial_state_guard BEFORE INSERT ON idempotency_records
FOR EACH ROW EXECUTE FUNCTION baturpay_guard_idempotency_insert();

CREATE TRIGGER idempotency_state_guard BEFORE UPDATE ON idempotency_records
FOR EACH ROW EXECUTE FUNCTION baturpay_guard_idempotency_update();

CREATE FUNCTION baturpay_restrict_financial_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'financial records are append-only and cannot be deleted' USING ERRCODE = '23514', CONSTRAINT = 'financial_records_no_delete';
  RETURN OLD;
END;
$$;

CREATE TRIGGER payments_no_delete BEFORE DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION baturpay_restrict_financial_delete();
CREATE TRIGGER idempotency_records_no_delete BEFORE DELETE ON idempotency_records
FOR EACH ROW EXECUTE FUNCTION baturpay_restrict_financial_delete();
CREATE TRIGGER payment_evidence_no_update BEFORE UPDATE OR DELETE ON payment_evidence
FOR EACH ROW EXECUTE FUNCTION baturpay_restrict_financial_delete();
