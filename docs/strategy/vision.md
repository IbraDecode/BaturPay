# BaturPay — Visi dan Tesis Produk

**Status:** hipotesis strategis, untuk diuji. **Tanggal:** 9 November 2026.

## Ringkasan

BaturPay menargetkan ruang yang sering terabaikan oleh payment API: pengalaman membangun, menguji, memahami kegagalan, dan mengoperasikan integrasi pembayaran. Produk awal bukan “gateway baru”, melainkan **Payment Developer Workbench**: sandbox deterministik, kontrak API yang dapat dieksekusi, webhook lab, skenario gangguan, rekonsiliasi simulasi, serta alat agent-aware yang bekerja dalam batas izin eksplisit.

## Tesis dan peluang

Integrasi pembayaran umumnya melibatkan lebih dari membuat satu request: developer perlu menghadapi status asinkron, retry, idempotensi, webhook berulang/terlambat, timeout ambigu, rekonsiliasi, dan variasi antar-provider. Agent coding dapat mempercepat implementasi, tetapi tanpa simulasi realistis dan bukti yang dapat diuji, ia juga bisa mengarang perilaku provider atau menulis alur uang yang berbahaya.

Peluang BaturPay adalah menyatukan:

1. **Executable payment contracts** — OpenAPI/schema, contoh, simulator, dan test fixture berasal dari sumber kontrak versi sama.
2. **Payment chaos lab** — developer menyuntik timeout, duplikasi webhook, urutan event salah, status tertunda, dan mismatch settlement di sandbox.
3. **Agent-ready integration kit** — dokumentasi/skills untuk beragam agent memandu tugas yang terukur; test harness memverifikasi hasil sebelum merge.
4. **Evidence-based debugging** — timeline event, signature check, idempotency, state transition, serta rekonsiliasi được hiển thị sebagai bukti, bukan “agent bilang sukses”.
5. **Provider portability** — model internal dan adapter conformance tests mengurangi lock-in tanpa menyamarkan perbedaan provider.

## Pelanggan awal yang ingin diuji

- Developer independen dan tim engineering yang mengintegrasikan metode pembayaran.
- SaaS/platform yang perlu menguji webhook dan alur invoice.
- Konsultan/agency integrasi dan tim QA.
- Mitra pembayaran yang ingin menyediakan lingkungan demo/developer yang lebih baik.

Belum ada bukti willingness-to-pay. Validasi melalui wawancara, prototipe, dan pengukuran waktu integrasi sebelum investasi pada fitur produksi.

## Pembeda yang diusulkan

- Sandbox dapat diputar ulang (deterministic replay) berdasarkan seed dan skenario.
- “Failure-first onboarding”: jalur sukses dan kasus sulit hadir bersama sejak awal.
- Contract-to-test pipeline: perubahan API menghasilkan fixture/conformance tests dan contoh SDK terbarui.
- Integrasi coding-agent bersifat interoperabel, least-privilege, dapat diaudit, dan mati total untuk operasi dana riil.
- Protokol simulator terbuka/ekspor sehingga developer tidak terkunci di BaturPay.

## Prinsip produk

1. Mulai dari developer problem yang bisa dibuktikan, jangan menyamar sebagai PJP.
2. Sandbox harus jelas berbeda secara visual, kredensial, endpoint, dan tipe data dari produksi.
3. Tidak ada aliran dana, settlement, atau QRIS produksi pada MVP.
4. Simulasi QRIS bukan QRIS yang dapat dipindai/dibayar; labelnya selalu jelas.
5. Agen mengusulkan kode dan menjalankan test lokal/sandbox, bukan mengotorisasi pembayaran.
6. Agent/tool/provider dapat diganti; protokol standar diutamakan.
7. Kegagalan dan ketidakpastian terlihat, tidak disembunyikan demi demo.

## Ukuran keberhasilan discovery

- Waktu dari clone sampai integrasi sandbox berjalan.
- Persentase integrasi yang lulus conformance suite pada percobaan pertama.
- Persentase developer yang menyelesaikan skenario webhook/retry tanpa bantuan.
- Waktu diagnosis mismatch/timeout.
- Penggunaan ulang simulator di CI.
- Wawancara yang mengonfirmasi masalah dan willingness-to-pay.

## Bukan tujuan MVP

Menerima/memindahkan dana, menyimpan saldo, mengakuisisi merchant, QRIS produksi, payout/refund riil, keputusan KYC/KYB, ataupun agent yang mengoperasikan transaksi finansial.
