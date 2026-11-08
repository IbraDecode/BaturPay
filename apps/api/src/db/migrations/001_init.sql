-- ==========================================================================
-- BaturPay — initial schema (sandbox)
-- Powered by Ibra X 3.1 Sovereign Execution Engine
-- Author: Ibra Ramdan <ibradecode@gmail.com>
--
-- All money columns are BIGINT minor units. Nothing stores floats.
-- There is deliberately NO ledger/settlement/balance table here: this build
-- does not move real money. Those tables belong to a future, licensed phase.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS workspaces (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  environment  TEXT NOT NULL DEFAULT 'sandbox',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key_prefix    TEXT NOT NULL,
  key_hash      TEXT NOT NULL,
  scopes        TEXT[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS api_keys_prefix_idx ON api_keys (key_prefix);
CREATE INDEX IF NOT EXISTS api_keys_ws_idx ON api_keys (workspace_id);

CREATE TABLE IF NOT EXISTS invoices (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  external_id  TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency     TEXT NOT NULL,
  status       TEXT NOT NULL,
  environment  TEXT NOT NULL DEFAULT 'sandbox',
  description  TEXT,
  scenario     TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoices_ws_created_idx ON invoices (workspace_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_ws_external_idx ON invoices (workspace_id, external_id);

CREATE TABLE IF NOT EXISTS events (
  event_id     TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  invoice_id   TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  sequence     INTEGER NOT NULL,
  occurred_at  TIMESTAMPTZ NOT NULL,
  data         JSONB NOT NULL DEFAULT '{}',
  UNIQUE (invoice_id, sequence)
);
CREATE INDEX IF NOT EXISTS events_invoice_idx ON events (invoice_id, sequence);

CREATE TABLE IF NOT EXISTS runs (
  run_id                TEXT PRIMARY KEY,
  workspace_id          TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invoice_id            TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  scenario              TEXT NOT NULL,
  seed                  TEXT NOT NULL,
  final_status          TEXT NOT NULL,
  expected_settle_minor BIGINT NOT NULL,
  payload               JSONB NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS runs_ws_idx ON runs (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id             TEXT PRIMARY KEY,
  workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  url            TEXT NOT NULL,
  description    TEXT,
  signing_secret TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhook_endpoints_ws_idx ON webhook_endpoints (workspace_id);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL,
  endpoint_id     TEXT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING',
  attempts        INTEGER NOT NULL DEFAULT 0,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  last_attempt_at TIMESTAMPTZ,
  response_status INTEGER,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deliveries_due_idx ON webhook_deliveries (status, scheduled_at);
CREATE INDEX IF NOT EXISTS deliveries_ws_idx ON webhook_deliveries (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key_hash            TEXT PRIMARY KEY,
  workspace_id        TEXT NOT NULL,
  operation           TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  response_status     INTEGER NOT NULL,
  response_body       JSONB NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT,
  actor        TEXT NOT NULL,
  action       TEXT NOT NULL,
  resource     TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_ws_idx ON audit_events (workspace_id, created_at DESC);
