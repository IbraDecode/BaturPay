# Kesiapan Produksi — Apa yang Siap dan Apa yang Sengaja Dibatasi

Dokumen ini jujur memisahkan **infrastruktur kelas produksi** yang sudah ada dari **aktivitas uang riil** yang secara sengaja tidak diaktifkan.

## Sudah kelas produksi

- **Kebenaran domain:** uang integer, state machine, idempotensi keras, pemisahan pembayaran vs settlement.
- **Keamanan:** API key di-hash + prefix, verifikasi konstan-waktu, rate limit, validasi input Zod, audit trail, anti-SSRF, tanda tangan webhook + anti-replay, rahasia tidak pernah ditampilkan ulang.
- **Ketahanan:** delivery at-least-once, retry backoff, DLQ, worker terpisah, graceful shutdown.
- **Observabilitas:** health/mode, log terstruktur (pino), audit, hasil run dapat diekspor (JUnit).
- **Operasional:** dua backend store, migrasi SQL, Docker + Nginx, CI (typecheck, test, compose, smoke Postgres).
- **Kontrak:** OpenAPI + skema Zod + fixture yang divalidasi test.

## Sengaja dibatasi (gated)

| Area | Status | Alasan |
|---|---|---|
| Transaksi uang riil | Diblokir | Perlu mitra PJP berizin + perizinan + review hukum |
| Adapter provider live | Tidak ada | Belum ada kontrak/ kerja sama dan izin |
| Payout / settlement / refund riil | Tidak ada | Aktivitas diatur; butuh struktur sah |
| Onboarding merchant produksi (KYC/KYB) | Tidak ada | Tanggung jawab harus ditetapkan kontraktual |
| QRIS produksi | Tidak ada | Simulasi saja pada tahap ini |

## Gerbang go-live (kode: `packages/core/src/mode.ts`)

Operasi uang riil hanya boleh berjalan bila **ketiganya** benar:
1. `BATURPAY_MODE=production`
2. `LIVE_PAYMENTS_ENABLED=true`
3. `GO_LIVE_ATTESTATION` diisi referensi persetujuan yang ditandatangani lewat proses kepatuhan

Jika salah satu tidak terpenuhi, `assertLiveAllowed()` melempar `LIVE_OPERATION_BLOCKED` (HTTP 451). Tidak ada prompt, hook, atau tool agent yang bisa membuka gerbang ini.

## Checklist sebelum go-live

- [ ] Klasifikasi aktivitas final (software vs aggregator vs lainnya) + review hukum.
- [ ] Perizinan/persetujuan yang relevan (termasuk jalur BI bila berlaku).
- [ ] Perjanjian kerja sama PJP: tanggung jawab onboarding, kontrak merchant, pengaduan, aliran dana.
- [ ] Kebijakan privasi + dasar pemrosesan + retensi (UU PDP).
- [ ] Penilaian kewajiban PSE bila berlaku.
- [ ] Program KYC/KYB dan matriks tanggung jawab.
- [ ] Prosedur pengaduan konsumen + SLA.
- [ ] Rencana respons insiden + uji pemulihan backup.
- [ ] Uji penetrasi & uji beban produksi.
- [ ] Manajemen rahasia produksi (bukan default `.env.example`).
- [ ] Atestasi go-live diterbitkan dan `LIVE_PAYMENTS_ENABLED` baru dinyalakan.

## Catatan

Materi ini bukan nasihat hukum dan bukan konfirmasi kepatuhan. Status, perizinan, dan penerapan ketentuan harus diverifikasi pada sumber resmi dan penasihat kompeten sebelum aktivitas produksi.
