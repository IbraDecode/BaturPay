# PRD — BaturPay Payment Developer Workbench (Sandbox MVP)

**Versi:** 0.1 • **Status:** Draft untuk validasi • **Batas:** simulasi saja.

## Masalah

Developer sulit menguji perilaku asinkron pembayaran dengan aman dan berulang: webhook duplikat/terlambat, timeout ambigu, retry, expiry, serta rekonsiliasi. Contoh “happy path” saja tidak membuktikan integrasi tahan terhadap kegagalan. Coding-agent mempercepat penulisan kode tetapi perlu kontrak dan tes nyata agar tidak mengarang semantik.

## Pengguna utama

1. Backend developer yang mengintegrasikan invoice/payment.
2. QA engineer yang menguji event dan status.
3. Coding-agent yang bekerja di repo developer dengan izin terbatas.

## Sasaran MVP

- Membuat sandbox project dan API key sandbox.
- Membuat invoice simulasi dengan external reference dan idempotency key.
- Menggerakkan status melalui simulator; menyediakan skenario success, failure, expired, pending, duplicate/late webhook, timeout/mismatch.
- Melihat event timeline dan mencoba ulang webhook secara aman.
- Menjalankan conformance tests lokal/CI dari kontrak versi tertentu.
- Menyediakan panduan agent untuk implementasi dan test, tanpa mengeksekusi transaksi nyata.

## Bukan sasaran

Transaksi atau QRIS riil; settlement/payout/refund nyata; penyimpanan dana; onboarding merchant produksi; akses provider live; pemrosesan PAN/CVV; klaim sebagai PJP/aggregator.

## Alur inti

1. Pengguna membuat workspace sandbox dan melihat banner “SIMULASI — TIDAK ADA UANG BERPINDAH”.
2. Mengambil secret yang hanya tampil sekali; dapat dirotasi/dicabut.
3. Membuat invoice memakai API/SDK contoh. Semua nominal berdenominasi IDR integer.
4. Memilih skenario dari panel/CLI, atau mengirim event uji dari kode.
5. Menerima webhook dengan signature sandbox, timestamp, event ID, dan delivery attempt.
6. Memeriksa status kanonis melalui API; redirect browser bukan bukti pembayaran.
7. Menjalankan ulang suite dan mengekspor laporan JSON/JUnit untuk CI.

## Functional requirements

- **FR-1 API:** REST `/v1/sandbox/invoices`, `GET /v1/sandbox/invoices/{id}`, event simulator, webhook delivery history.
- **FR-2 Idempotency:** key dengan ruang lingkup workspace + operasi; request replay identik memberi hasil yang konsisten; payload berbeda pada key sama ditolak.
- **FR-3 State machine:** CREATED → PENDING → SUCCEEDED/FAILED/EXPIRED; transisi invalid ditolak. Event provider simulasi tidak boleh langsung dianggap saldo/settlement.
- **FR-4 Webhooks:** HMAC signature, event ID unik, timestamp, retry dengan backoff, deduplication, dead-letter visibility, replay manual terbatas.
- **FR-5 Simulator:** deterministik per scenario/seed; menguji duplikasi, reorder, delay, timeout, expiry, dan nominal/reference mismatch.
- **FR-6 SDK/docs:** contoh TypeScript dan cURL, OpenAPI, fixture, migration/changelog.
- **FR-7 Agent guide:** instruksi opsional untuk coding-agent generik, tugas terbatas, langkah uji dan larangan menaruh rahasia. Tidak perlu memasang agent tertentu.
- **FR-8 Audit:** aktivitas key, konfigurasi skenario, replay, dan perubahan setting dicatat tanpa menyimpan secret mentah.
- **FR-9 UX:** sandbox selalu memiliki host, badge, warna, dan data sintetis tersendiri.

## Kriteria penerimaan

- Invoice request dengan idempotency key sama tidak membuat invoice ganda.
- Key sama dengan payload berbeda menghasilkan konflik terdefinisi.
- Webhook signature salah/expired ditolak; delivery berulang dapat didedup oleh klien.
- Browser redirect success tanpa event/API verifikasi tidak mengubah status kanonis.
- Event out-of-order tidak menurunkan status terminal tanpa aturan eksplisit.
- Semua kasus suite menghasilkan fixture dan laporan yang dapat diulang.
- Tidak tersedia endpoint atau secret produksi dalam build MVP.
- Pengujian tidak memakai identitas/data finansial nyata.

## User stories penting

- Sebagai backend developer, saya ingin membuat invoice sandbox dari contoh minimal agar integrasi pertama cepat.
- Sebagai QA, saya ingin menunda dan menggandakan webhook agar handler idempoten dapat diuji.
- Sebagai developer, saya ingin melihat alasan sebuah event ditolak dan jejak state yang lengkap.
- Sebagai pemelihara SDK, saya ingin membuktikan kompatibilitas adapter terhadap kontrak yang sama di CI.
- Sebagai pengguna coding-agent, saya ingin agent mengubah kode di branch lokal dan menjalankan tes tanpa melihat rahasia.

## Metrik

Time-to-first-success sandbox, suite pass rate, coverage skenario negatif, diagnosis time, agent suggestion acceptance (bukan ukuran tunggal), serta hasil wawancara dan konversi pilot.

## Risiko produk

Simulator terlalu “bahagia”; agent memberi rasa aman palsu; developer salah mengira sandbox sebagai QRIS aktual; kontrak generic menghapus perbedaan provider; biaya/kompleksitas mendahului validasi pasar. Mitigasi: uji kontrak dari sumber primer provider, visualisasi simulasi yang kuat, dan discovery sebelum produksi.
