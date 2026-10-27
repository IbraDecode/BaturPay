# BaturPay

BaturPay adalah proyek infrastruktur orkestrasi pembayaran yang dibangun dari nol. Tujuannya menyediakan kontrak integrasi merchant yang konsisten di atas provider pembayaran yang didukung, dengan fokus pada keandalan transaksi, integritas finansial, keamanan, pemulihan, observability, dan auditabilitas.

## Status

Fondasi dokumentasi, prototipe orchestrator lokal, dan pure payment state-transition model tersedia. Task contract/registry, fixed local test/typecheck executor, dan payment transition logic memiliki tests; strict typecheck dijalankan terpisah. Belum ada OpenCode task yang dijalankan, payment API, provider adapter nyata, database schema, webhook verifier, ledger, dashboard, worker, atau layanan produksi. Belum ada provider yang dinyatakan didukung.

## Visi dan ruang lingkup awal

Prioritas MVP yang direncanakan: autentikasi API merchant, payment creation/status, payment attempts, adapter provider, webhook aman, idempotency, refund, fondasi rekonsiliasi, dashboard, audit log, sandbox, observability, dan automated testing. Gunakan provider simulasi sampai integrasi eksternal disetujui dan diverifikasi.

Dua model layanan yang menjadi konteks desain ialah CONNECTED_PROVIDER (akun provider merchant sendiri) dan BATURPAY (kapabilitas yang disediakan melalui BaturPay). Keduanya ditujukan berbagi payment core. BATURPAY memerlukan keputusan bisnis, fund-flow, custody, pricing, settlement, operasional, dan regulasi sebelum implementasi berisiko.

BaturPay bukan wallet atau platform perbankan berdasarkan keputusan proyek saat ini. Tidak ada kewenangan yang diasumsikan untuk menahan dana, menyediakan wallet, payout, atau memindahkan uang.

## Engineering

- Dokumentasi otoritatif dan batas keputusan: `docs/ai-system/PROJECT_CONTEXT.md`.
- Instruksi coding agent: `AGENTS.md`.
- Desain arsitektur awal: `docs/architecture/ARCHITECTURE_PRINCIPLES.md`.
- Status dan batas payment state machine: `docs/architecture/PAYMENT_DOMAIN_FOUNDATION.md`.
- Kontrak idempotency (tanpa storage): `docs/architecture/IDEMPOTENCY_CONTRACT.md`.
- Desain PostgreSQL (belum diimplementasikan): `docs/architecture/PERSISTENCE_DESIGN.md`.
- Alur verifikasi: `docs/engineering/DEVELOPMENT_WORKFLOW.md`.
- Keputusan terbuka: `docs/ai-system/OPEN_DECISIONS.md`.

Stack TypeScript/Node.js, PostgreSQL, Redis, BullMQ atau alternatif, Next.js, modular monolith, Git/CI dan Docker/isolasi lain masih merupakan usulan awal, bukan keputusan final.

## Status kesiapan

Belum siap produksi. Belum ada skema domain final, audit regulasi, provider terpilih, credential produksi, deployment, atau validasi operasional. Setiap kemampuan harus dianggap belum tersedia sampai implementasi dan bukti pengujiannya tercatat.
