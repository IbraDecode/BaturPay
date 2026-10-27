# BaturPay

BaturPay adalah proyek infrastruktur orkestrasi pembayaran yang dibangun dari nol. Tujuannya menyediakan kontrak integrasi merchant yang konsisten di atas provider pembayaran yang didukung, dengan fokus pada keandalan transaksi, integritas finansial, keamanan, pemulihan, observability, dan auditabilitas.

## Status

Fondasi dokumentasi dan prototipe orchestrator lokal sedang disiapkan. Task contract, validator, state transitions, registry JSON, dan bounded process runner telah diimplementasikan dan diuji lokal. Belum ada dispatcher yang menjalankan OpenCode, aplikasi pembayaran, integrasi provider, dashboard, worker, database schema, atau layanan produksi. Belum ada provider yang dinyatakan didukung.

## Visi dan ruang lingkup awal

Prioritas MVP yang direncanakan: autentikasi API merchant, payment creation/status, payment attempts, adapter provider, webhook aman, idempotency, refund, fondasi rekonsiliasi, dashboard, audit log, sandbox, observability, dan automated testing. Gunakan provider simulasi sampai integrasi eksternal disetujui dan diverifikasi.

Dua model layanan yang menjadi konteks desain ialah CONNECTED_PROVIDER (akun provider merchant sendiri) dan BATURPAY (kapabilitas yang disediakan melalui BaturPay). Keduanya ditujukan berbagi payment core. BATURPAY memerlukan keputusan bisnis, fund-flow, custody, pricing, settlement, operasional, dan regulasi sebelum implementasi berisiko.

BaturPay bukan wallet atau platform perbankan berdasarkan keputusan proyek saat ini. Tidak ada kewenangan yang diasumsikan untuk menahan dana, menyediakan wallet, payout, atau memindahkan uang.

## Engineering

- Dokumentasi otoritatif dan batas keputusan: `docs/ai-system/PROJECT_CONTEXT.md`.
- Instruksi coding agent: `AGENTS.md`.
- Desain arsitektur awal: `docs/architecture/ARCHITECTURE_PRINCIPLES.md`.
- Alur verifikasi: `docs/engineering/DEVELOPMENT_WORKFLOW.md`.
- Keputusan terbuka: `docs/ai-system/OPEN_DECISIONS.md`.

Stack TypeScript/Node.js, PostgreSQL, Redis, BullMQ atau alternatif, Next.js, modular monolith, Git/CI dan Docker/isolasi lain masih merupakan usulan awal, bukan keputusan final.

## Status kesiapan

Belum siap produksi. Belum ada skema domain final, audit regulasi, provider terpilih, credential produksi, deployment, atau validasi operasional. Setiap kemampuan harus dianggap belum tersedia sampai implementasi dan bukti pengujiannya tercatat.
