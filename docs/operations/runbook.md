# Runbook Operasional

## Prasyarat

Node 22+, npm 10+, Docker (opsional untuk Postgres).

## Menjalankan cepat (tanpa database)

```bash
npm install
BATURPAY_MODE=sandbox DATABASE_URL=memory:// npm run start:api
# API di http://localhost:4000
```

## Bootstrapping

```bash
curl -s -X POST localhost:4000/v1/workspaces -H 'content-type: application/json' -d '{"name":"Demo"}'
export BATURPAY_API_KEY=sk_sandbox_...   # dari respons
npm run cli -- scenarios
```

## Menjalankan dengan Postgres

```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres
export DATABASE_URL=postgres://baturpay:baturpay@localhost:5432/baturpay
npm run db:migrate
npm run db:seed        # cetak workspace + key demo
npm run start:api
```

Atau seluruh stack: `npm run docker:up` (Postgres + API + web + Nginx di :8080).

## Perintah CLI

```bash
export BATURPAY_API_URL=http://localhost:4000
npm run cli -- health
npm run cli -- invoice:create --external-id INV-1 --amount 50000
npm run cli -- run --invoice inv_... --scenario duplicate_webhook --export report.xml
npm run cli -- endpoint:add --url http://127.0.0.1:9099/hook
npm run cli -- dispatch
npm run cli -- deliveries
```

## Integrasi agent (MCP)

```bash
BATURPAY_API_URL=http://localhost:4000 BATURPAY_API_KEY=sk_sandbox_... \
  npm run mcp
```
Daftarkan perintah sebagai MCP server stdio di klien agent. Tool yang tersedia bersifat sandbox/read; tidak ada akses shell atau berkas.

## Pengujian

```bash
npm run typecheck
npm test
```

## Diagnosa umum

| Gejala | Kemungkinan | Tindakan |
|---|---|---|
| `401 UNAUTHORIZED` | Key salah/tercabut | Bootstrap ulang atau `key:create` |
| `409 IDEMPOTENCY_CONFLICT` | Key dipakai ulang dengan body beda | Pakai key baru atau body identik |
| `400 WEBHOOK_TARGET_BLOCKED` | URL privat/non-http | Aktifkan allowlist atau pakai host publik |
| `451 LIVE_OPERATION_BLOCKED` | Gate tertutup | Ini perilaku benar; jangan dipaksa terbuka |
| Delivery `FAILED` | Endpoint 4xx / habis retry | Periksa endpoint, gunakan replay |
| `INVALID_TRANSITION` | Skenario menurunkan status terminal | Buat invoice baru |

## Respons insiden (ringkas)

1. Identifikasi: periksa `/health`, log API, `audit_events`.
2. Batasi: cabut key terdampak (`revoked_at`) atau hentikan worker.
3. Perbaiki: pulihkan dari backup; ulangi delivery yang gagal.
4. Catat: incident ID, waktu, dampak, mitigasi, akar masalah, pencegahan.
5. Tinjau pasca-insiden.

## Backup & pemulihan

Backup `pg_dump` berkala untuk Postgres. Uji pemulihan minimal sekali per kuartal. Data sandbox tidak dianggap catatan finansial, tetapi tetap dilindungi.
