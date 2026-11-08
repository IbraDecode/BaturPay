# Arsitektur Sistem — BaturPay

**Status:** sesuai implementasi pada repo ini. **Batas:** sandbox; operasi uang riil diblokir.

## Peta komponen

```text
apps/web        Dashboard Next.js (kontrol sandbox)
apps/cli        CLI operator (skrip + CI)
apps/mcp        Server MCP stdio (tool sandbox untuk coding agent)
apps/api        Fastify: rute -> service -> store, + worker webhook
packages/core       Domain: money, state machine, idempotency, live gate
packages/simulator  Engine skenario deterministik
packages/webhook    Tanda tangan, SSRF guard, retry, dedup
packages/contracts  Skema Zod + OpenAPI + fixture
packages/config     Validasi env + perakitan live gate
infra/docker        Compose, Dockerfile, Nginx
```

## Alur permintaan (API)

```text
Client (web/cli/mcp)
      |
      v
Fastify  --(preHandler auth: verifikasi API key)-->  request.auth
      |
      v
Service (invoice/run/webhook)  --(validasi Zod, idempotency)-->
      |
      v
Store  --(MemoryStore | PgStore)-->  Postgres / memori
      |
      v
Worker (WebhookDispatcher)  --(HMAC + retry)-->  endpoint pelanggan
```

## Prinsip yang ditegakkan kode

1. **Uang = integer minor unit.** Tidak ada float. Disimpan `BIGINT`, divalidasi `positiveMoney()`.
2. **Status adalah proyeksi event.** Event append-only; status invoice dihitung dengan berjalan sepanjang aliran melalui state machine; transisi ilegal ditolak.
3. **Pembayaran ≠ settlement.** Dua mesin status terpisah di `state-machine.ts`.
4. **Idempotensi keras.** Key sama + body beda = konflik. Disimpan sebagai hash key + fingerprint body.
5. **Webhook at-least-once.** Tanda tangan + timestamp + dedup + backoff + DLQ (status `FAILED`).
6. **Anti-SSRF.** Skema, kredensial URL, IP privat, dan hasil resolusi DNS diperiksa; allowlist bisa membuka pengecualian.
7. **Live gate gagal-tertutup.** `assertLiveAllowed()` menolak operasi uang riil kecuali mode production + flag + atestasi.

## Model data (ringkas)

`workspaces`, `api_keys`, `invoices`, `events`, `runs`, `webhook_endpoints`, `webhook_deliveries`, `idempotency_keys`, `audit_events`. Tidak ada tabel saldo/ledger/settlement: build ini tidak memindahkan dana.

## Kepatuhan desain

- Sandbox dibedakan jelas: `environment: "sandbox"`, badge UI, kredensial `sk_sandbox_*`, payload bertanda `simulated: true`.
- Seluruh aksi penting masuk `audit_events` (pembuatan invoice, eksekusi skenario, registrasi endpoint, replay, pembuatan key/workspace).
- Tidak ada endpoint yang memindahkan uang.

## Alur deploy

`infra/docker/docker-compose.yml` menyalakan Postgres, API (migrasi lalu start), dashboard, dan Nginx. Alternatif tanpa database: `DATABASE_URL=memory://` untuk demo cepat.

## Uji

- Unit: domain, simulator, webhook, config.
- Integrasi: seluruh alur HTTP dengan `MemoryStore` + fetcher webhook palsu (deterministik, tanpa jaringan).
- CI: typecheck, unit+integrasi, validasi compose, smoke test store pada Postgres nyata.
