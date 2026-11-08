# Arsitektur awal — BaturPay Integration Lab

**Status:** rancangan MVP, sandbox saja.

## Prinsip desain

- Modular monolith untuk layanan awal; CLI/SDK terpisah sebagai client.
- API contract-first; OpenAPI + schema terversi menjadi sumber tipe dan fixture.
- Simulator deterministik, tidak terhubung ke jaringan/provider pembayaran live.
- Event/event delivery bersifat at-least-once; consumer idempotent.
- Uang direpresentasikan sebagai integer minor unit dan currency eksplisit.
- Model transaksi dan event simulator tidak mewakili ledger atau settlement dana riil.

## Komponen

```text
Developer / CI / Optional Agent
              |
       CLI + SDK + Docs
              |
       Sandbox API (NestJS)
       /      |         \
 Workspace  Contract   Scenario Engine
   Auth      Registry   (seeded, deterministic)
              |              |
              +------ Event Queue (Redis/BullMQ)
                             |
                    Webhook Delivery Lab
                             |
                PostgreSQL event/run store
                             |
                  Test Report Exporter
```

MCP adapter tahap berikutnya membungkus API yang sama; ia tidak memiliki otoritas tambahan dan tidak mengakses host shell atau secret. Mulai dengan `list_scenarios`, `get_contract`, `inspect_run` (read-only). Operasi simulator mutatif baru setelah izin tenant, batas operasi, dan audit diuji.

## Kontrak dan model data minimal

- `workspaces`: id, owner, environment=`sandbox`, created_at.
- `api_keys`: workspace_id, hash, prefix, scopes, expires_at, revoked_at; secret mentah tidak disimpan.
- `contracts`: name, version, schema_digest, source, created_at.
- `invoices`: id, workspace_id, external_id, amount_minor, currency, status, idempotency_key_hash, scenario_id.
- `events`: event_id, invoice_id, type, sequence, occurred_at, payload_redacted.
- `webhook_endpoints`: workspace_id, URL sandbox, signing secret terenkripsi, state.
- `deliveries`: event_id, attempt, response_code, signature_valid, next_attempt_at.
- `runs`: run_id, workspace_id, scenario/seed, contract_version, started_at, outcome.
- `audit_events`: actor, workspace_id, action, resource, timestamp, metadata_redacted.

Jangan mengimplementasikan tabel saldo/settlement produksi untuk MVP.

## State dan semantik

Status invoice: `CREATED → PENDING → SUCCEEDED | FAILED | EXPIRED`. Terminal state tidak boleh berubah oleh webhook yang terlambat kecuali skenario eksplisit menunjukkan event historis; API harus tetap mengembalikan current state kanonis dan event history terpisah. Status pembayaran bukan settlement.

Idempotency: unique constraint per `(workspace_id, operation, key_hash)`. Simpan fingerprint request dan respons. Fingerprint berbeda untuk key sama menghasilkan konflik. Webhook memiliki event ID unik; retry delivery menggunakan event yang sama dan attempt number berbeda.

## API draft

- `POST /v1/sandbox/invoices` (idempotency wajib)
- `GET /v1/sandbox/invoices/{id}`
- `POST /v1/sandbox/scenarios/{scenario}/run`
- `GET /v1/sandbox/runs/{run_id}`
- `GET /v1/sandbox/runs/{run_id}/events`
- `POST /v1/sandbox/webhook-deliveries/{id}/retry`
- `GET /v1/sandbox/contracts/{version}`

Response, schema, dan contoh adalah internal sandbox contract, bukan API provider.

## Security & deployment

- Nonaktifkan outbound networking dari scenario worker secara default; webhook egress allowlist ke localhost/test sink pada lingkungan terisolasi.
- Rate-limit per workspace, batasi ukuran payload, dan cegah SSRF pada webhook URL (block metadata/private ranges, resolve/revalidate DNS, egress proxy).
- Secret webhook dan API key: hash/enkripsi sesuai fungsi; jangan tampilkan ulang.
- Pisahkan database/host sandbox dari sistem produksi masa depan; tidak ada route live di build ini.
- Audit akses key, replay, skenario, dan konfigurasi.
- CI menjalankan unit/integration tests, contract validation, dependency/security scan.
- Backup diperlukan untuk artifact/doc, tetapi sandbox test data tidak boleh dianggap catatan finansial.
