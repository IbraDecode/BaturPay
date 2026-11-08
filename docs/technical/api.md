# Referensi API Sandbox

Semua endpoint bersifat simulasi. Tidak ada uang riil yang berpindah. Basis URL lokal: `http://localhost:4000`.

## Autentikasi

Gunakan header `Authorization: Bearer <API_KEY>` untuk seluruh endpoint `/v1/*` kecuali pembuatan workspace pertama.

```bash
# Bootstrap workspace pertama (hanya boleh tanpa auth saat belum ada workspace)
curl -s -X POST http://localhost:4000/v1/workspaces \
  -H 'content-type: application/json' \
  -d '{"name":"Demo"}' | jq
# -> { "workspace": {...}, "apiKey": { "secret": "sk_sandbox_..." } }
```

Simpan `secret`; hanya ditampilkan sekali.

## Idempotensi

`POST /v1/invoices` dan `POST /v1/runs` wajib menyertakan `Idempotency-Key`.
- Key sama + body sama → mengembalikan hasil pertama (tanpa duplikasi).
- Key sama + body berbeda → `409 IDEMPOTENCY_CONFLICT`.

## Endpoint

| Metode | Path | Keterangan |
|---|---|---|
| GET | `/health` | Status, mode, status live gate |
| GET | `/v1/contracts` | Versi kontrak + dokumen OpenAPI |
| GET | `/v1/scenarios` | Katalog skenario (failure-first) |
| POST | `/v1/workspaces` | Bootstrap workspace + key pertama |
| POST | `/v1/keys` | Tambah API key (tampil sekali) |
| GET | `/v1/keys` | Daftar key (tanpa secret) |
| GET | `/v1/audit` | Audit event workspace |
| POST | `/v1/invoices` | Buat invoice sandbox |
| GET | `/v1/invoices` | Daftar invoice (cursor) |
| GET | `/v1/invoices/{id}` | Detail invoice + status kanonis |
| GET | `/v1/invoices/{id}/events` | Aliran event append-only |
| POST | `/v1/runs` | Jalankan skenario pada invoice |
| GET | `/v1/runs/{id}` | Ambil hasil run |
| POST | `/v1/webhook-endpoints` | Registrasi endpoint (dijaga SSRF) |
| GET | `/v1/webhook-endpoints` | Daftar endpoint |
| GET | `/v1/webhook-deliveries` | Riwayat pengiriman webhook |
| POST | `/v1/webhook-deliveries/{id}/retry` | Replay satu delivery |
| POST | `/v1/admin/dispatch-tick` | Jalankan satu siklus pengiriman |

## Contoh alur

```bash
KEY=sk_sandbox_...        # dari bootstrap
API=http://localhost:4000

# 1. Buat invoice
INV=$(curl -s -X POST $API/v1/invoices \
  -H "authorization: Bearer $KEY" \
  -H 'content-type: application/json' \
  -H 'idempotency-key: demo-invoice-0001' \
  -d '{"externalId":"INV-DEMO-1","amountMinor":50000,"currency":"IDR"}' | jq -r .id)

# 2. Registrasi endpoint webhook (uji lokal)
curl -s -X POST $API/v1/webhook-endpoints \
  -H "authorization: Bearer $KEY" -H 'content-type: application/json' \
  -d '{"url":"http://127.0.0.1:9099/hook"}' | jq

# 3. Jalankan skenario duplicate_webhook
curl -s -X POST $API/v1/runs \
  -H "authorization: Bearer $KEY" -H 'content-type: application/json' \
  -H 'idempotency-key: demo-run-0001' \
  -d "{\"invoiceId\":\"$INV\",\"scenario\":\"duplicate_webhook\"}" | jq '.finalStatus, .deliveries'

# 4. Trigger pengiriman & lihat hasil
curl -s -X POST $API/v1/admin/dispatch-tick -H "authorization: Bearer $KEY" | jq
curl -s $API/v1/webhook-deliveries -H "authorization: Bearer $KEY" | jq
```

## Verifikasi tanda tangan webhook

Header: `x-baturpay-signature: t=<unix>,v1=<hex>`
Pesan yang ditandatangani: `` `${t}.${rawBody}` `` dengan HMAC-SHA256 memakai `signingSecret` endpoint. Toleransi default 300 detik. Implementasi ada di `packages/webhook/src/signing.ts`.

## Format error

```json
{ "error": { "code": "IDEMPOTENCY_CONFLICT", "message": "...", "details": { } } }
```

Kode penting: `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `CONFLICT`, `IDEMPOTENCY_CONFLICT`, `INVALID_TRANSITION`, `WEBHOOK_TARGET_BLOCKED`, `LIVE_OPERATION_BLOCKED`, `RATE_LIMITED`.
