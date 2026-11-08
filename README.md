# BaturPay

**Infrastruktur pembayaran yang dibangun dengan pengalaman developer sebagai produk inti.**

BaturPay dimulai sebagai payment developer platform berbasis sandbox: API, simulator transaksi, webhook lab, rekonsiliasi deterministik, serta alur kerja coding-agent yang membantu pengembang mengintegrasikan dan menguji pembayaran dengan aman. BaturPay bukan PJP dan tidak memproses dana riil pada tahap ini.

## Prinsip

- Sandbox-first; mode produksi tidak tersedia pada MVP.
- Source of truth transaksi ditentukan server/provider, bukan redirect browser atau klaim agent.
- Integrasi provider melalui adapter teruji dan kontrak terdokumentasi.
- Agen AI mengusulkan/menghasilkan perubahan, tetapi seluruh tindakan berdampak wajib melalui policy dan persetujuan manusia.
- OpenCode, Hermes, dan toolchain agent lain diperlakukan sebagai klien/adaptor opsional; tidak ada ketergantungan pada satu vendor/model.
- Jangan pernah masukkan credential, data kartu, atau data pribadi nyata ke prompt/log.

## Rencana dokumen

- [Strategi & visi](docs/strategy/vision.md)
- [Riset developer platform dan coding agents](docs/research/developer-platform-and-agents.md)
- [PRD sandbox MVP](docs/product/prd-sandbox-mvp.md)
- [Arsitektur teknis](docs/technical/architecture.md)
- [Backlog awal](docs/product/backlog.md)
- [Batasan regulasi dan keselamatan](docs/security/safety-and-compliance.md)

## Status

Perencanaan dan sandbox. Belum untuk transaksi uang sungguhan, onboarding merchant komersial, settlement, atau klaim status Merchant Aggregator. Klasifikasi dan kewajiban hukum harus ditinjau penasihat kompeten serta mitra berizin sebelum ada aktivitas produksi.
