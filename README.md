# BaturPay

**Payment developer workbench** — sandbox deterministik, webhook lab, dan alat integrasi yang siap dipakai manusia maupun coding agent.

BaturPay bukan PJP dan tidak memindahkan uang. Build ini menyediakan infrastruktur kelas produksi untuk **membangun, menguji, dan memverifikasi** integrasi pembayaran. Seluruh transaksi bersifat simulasi; operasi uang riil diblokir oleh *live gate* yang gagal-tertutup.

## Kenapa

Integrasi pembayaran sulit bukan karena membuat satu request, tetapi karena kegagalan: webhook duplikat/terlambat, urutan event salah, timeout ambigu, dan rekonsiliasi yang tidak cocok. BaturPay menyediakan lingkungan failure-first yang dapat diputar ulang, sehingga integrasi dan handler Anda diuji terhadap hal-hal yang benar-benar merusak produksi.

## Fitur

- **Sandbox deterministik** — skenario dengan seed tetap, hasil dapat direproduksi persis.
- **Webhook lab** — HMAC + timestamp, dedup, retry backoff, DLQ, replay manual, anti-SSRF.
- **Kebenaran domain** — uang integer minor, state machine, idempotensi keras, pembayaran ≠ settlement.
- **Kontrak terkunci** — OpenAPI + skema Zod + fixture yang divalidasi test.
- **Siap agent** — CLI + server MCP stdio (sandbox/read-only, tanpa akses shell).
- **Siap produksi** — Postgres/atau memori, migrasi, Docker + Nginx, CI lengkap, audit trail.
- **Live gate** — operasi uang riil hanya bisa aktif dengan mode + flag + atestasi kepatuhan.

## Mulai cepat (tanpa database)

```bash
npm install
BATURPAY_MODE=sandbox DATABASE_URL=memory:// npm run start:api   # http://localhost:4000

# di terminal lain
curl -s -X POST localhost:4000/v1/workspaces -H 'content-type: application/json' -d '{"name":"Demo"}'
export BATURPAY_API_KEY=sk_sandbox_...
npm run cli -- scenarios
npm run cli -- invoice:create --external-id INV-1 --amount 50000
```

## Mulai cepat (stack penuh)

```bash
cp .env.example .env
npm run docker:up            # Postgres + API + Web + Nginx (:8080)
# atau
docker compose -f infra/docker/docker-compose.yml up -d postgres
export DATABASE_URL=postgres://baturpay:baturpay@localhost:5432/baturpay
npm run db:migrate && npm run db:seed && npm run start:api
```

## Struktur repositori

```text
apps/
  api/         Fastify API + worker webhook (rute -> service -> store)
  web/         Dashboard Next.js (kontrol sandbox)
  cli/         CLI operator
  mcp/         Server MCP stdio untuk coding agent
packages/
  core/        Domain: money, state machine, idempotency, live gate
  simulator/   Engine skenario deterministik
  webhook/     Tanda tangan, SSRF guard, retry, dedup
  contracts/   Skema Zod + OpenAPI + fixture
  config/      Validasi environment + perakitan live gate
infra/
  docker/      Compose + Dockerfile
  nginx/       Konfigurasi reverse proxy
docs/
  strategy/ product/ technical/ security/ operations/ research/
```

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run typecheck` | Typecheck seluruh workspace |
| `npm test` | Unit + integrasi (hermetis, tanpa jaringan) |
| `npm run dev:api` | API dalam mode watch |
| `npm run cli -- <cmd>` | CLI operator |
| `npm run mcp` | Server MCP stdio |
| `npm run db:migrate` | Terapkan migrasi SQL |
| `npm run db:seed` | Buat workspace + key demo |
| `npm run docker:up` | Jalankan stack penuh |

## Dokumentasi

- [Visi & tesis produk](docs/strategy/vision.md)
- [PRD sandbox MVP](docs/product/prd-sandbox-mvp.md)
- [Arsitektur](docs/technical/architecture.md)
- [Referensi API](docs/technical/api.md)
- [Integrasi coding agent](docs/technical/agent-integration.md)
- [Kesiapan produksi & batas](docs/technical/production-readiness.md)
- [Model keamanan](docs/security/security-model.md)
- [Runbook operasional](docs/operations/runbook.md)
- [Batasan regulasi & keselamatan](docs/security/safety-and-compliance.md)
- [Riset developer platform & agents](docs/research/developer-platform-and-agents.md)
- [ADR 0001](docs/technical/adr/0001-stack-and-boundaries.md)

## Batas & kepatuhan

Build ini tidak melakukan acquiring, tidak menahan/memindahkan dana, tidak menerbitkan QRIS yang dapat dibayar, dan tidak menyimpan saldo. Aktivasi aktivitas uang riil memerlukan mitra PJP berizin, perizinan/persetujuan yang relevan, kontrak, dan review hukum. Lihat `docs/technical/production-readiness.md` dan `docs/security/safety-and-compliance.md`.

Lisensi: MIT.
