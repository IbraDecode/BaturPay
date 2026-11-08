# ADR 0001 — Keputusan Stack dan Batas Sistem

**Status:** Diterima • **Tanggal:** 9 November 2026

## Konteks

BaturPay dibangun sebagai payment developer workbench dengan sandbox deterministik dan jalur menuju integrasi provider berizin. Fondasi harus mudah diaudit, diuji tanpa layanan eksternal, dan tidak boleh memberi jalan pintas menuju perpindahan uang riil tanpa kontrol yang jelas.

## Keputusan

1. **TypeScript monorepo dengan npm workspaces.** Alasan: satu bahasa untuk domain, API, CLI, dan tooling agent; resolusi workspace standar tanpa toolchain tambahan; `npm ci` cukup untuk CI dan image.
2. **Domain murni di `packages/core`.** Uang, state machine, idempotency, dan live gate terpisah dari HTTP/DB sehingga dapat diuji tanpa infrastruktur.
3. **HTTP server Fastify, bukan NestJS.** Alasan: jejak dependensi lebih kecil, boot lebih cepat, dan struktur modular eksplisit (rute → service → store) tetap dapat dipertahankan. NestJS tetap opsi jika kebutuhan DI/dekorator muncul; batas modul saat ini memudahkan migrasi.
4. **Dua implementasi store: `MemoryStore` dan `PgStore`.** Alasan: test hermetis dan demo instan tanpa database, sementara deployment produksi memakai Postgres. Service hanya bergantung pada antarmuka `Store`.
5. **Runtime `tsx` (tanpa langkah build JS).** Alasan: menjalankan TypeScript langsung mengurangi ruang kegagalan build; `tsc --noEmit` tetap menjadi gerbang tipe di CI. Bila diperlukan artefak terkompilasi, `tsc` dapat ditambahkan tanpa mengubah kode.
6. **Tidak ada adapter provider live pada build ini.** Hanya adapter sandbox. Operasi uang riil diblokir oleh *live gate* di `packages/core/src/mode.ts` yang gagal-tertutup.
7. **Integrasi agent melalui protokol terbuka (MCP stdio) + CLI.** Bukan integrasi khusus satu vendor. Server MCP bersifat read/sandbox-only dan tidak memiliki akses shell atau berkas.

## Konsekuensi

- Positif: auditable, dapat diuji end-to-end tanpa jaringan, tidak dapat "tidak sengaja" memindahkan uang, mudah diganti provider.
- Negatif: belum ada performa/emit terkompilasi; perlu langkah build tambahan jika target deploy menghendaki JS murni.
- Wajib: setiap operasi bertanda "live" harus memanggil `assertLiveAllowed()` dan gagal bila gate tertutup.

## Alternatif yang ditolak

- **Microservices sejak awal:** kompleksitas operasional tanpa volume yang membenarkan.
- **Integrasi provider live langsung:** risiko regulasi dan keamanan sebelum ada perizinan/kontrak.
- **Wrapper multi-model/agent generik:** bukan pembeda; nilai BaturPay ada pada kebenaran dan pengujian pembayaran, bukan pemilihan model.
