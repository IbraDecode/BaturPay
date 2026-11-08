# Batas keselamatan, keamanan, dan kepatuhan

## Batas produk

BaturPay tahap ini adalah software developer sandbox sintetis. Tidak melakukan acquiring, memindahkan/menahan dana, menerbitkan QRIS yang dapat dibayar, memproses transaksi nyata, atau menyediakan settlement. Label UI/API/docs harus menyebut simulasi secara eksplisit. Dokumen ini bukan nasihat hukum atau konfirmasi status perizinan.

**Kontrol teknis:** live gate di `packages/core/src/mode.ts`. Operasi bertanda uang riil memanggil `assertLiveAllowed()` dan gagal-tertutup (HTTP 451) kecuali `BATURPAY_MODE=production` **dan** `LIVE_PAYMENTS_ENABLED=true` **dan** `GO_LIVE_ATTESTATION` terisi. Tidak ada prompt atau tool agent yang dapat membukanya.

## Kontrol agent

- Agent tidak menerima secret produksi atau data konsumen nyata.
- Agent menjalankan CLI/simulator hanya pada workspace sandbox; kredensial dipisah dan dibatasi.
- Permintaan agent adalah input tidak tepercaya: validasi otorisasi dan skema di server.
- MCP/API mengikuti hak workspace; mulai dari operasi baca saja dan catat semua operasi mutatif sandbox.
- Tidak ada “agent approval” untuk tindakan finansial. Test lulus bukan persetujuan kepatuhan.
- Simpan trace agent terpisah dari event simulator, dengan redaksi, retensi, serta kontrol akses.

## Risiko teknis khusus

Webhook simulator dapat menjadi primitive SSRF: blok IP privat/loopback/metadata pada URL publik, lakukan DNS resolution/revalidation, batasi redirect, protocol dan port, gunakan egress proxy/isolasi. Untuk pengembangan lokal sediakan sink khusus, bukan akses jaringan bebas.

HMAC webhook wajib mencakup body canonical dan timestamp; penerima harus dapat mendeteksi replay, deduplicate event ID, dan tidak mempercayai redirect browser. Jangan tulis secret/signature lengkap atau payload sensitif ke log.

## Peta kepatuhan yang perlu ditelaah profesional

Sebelum ada provider integration atau uang nyata, tentukan aktivitas sebenarnya, peran para pihak, alur dana, tanggung jawab merchant/KYC, pengaduan, privasi dan retensi data, kebutuhan badan usaha/PSE, serta kewajiban/izin/persetujuan BI yang berlaku. Istilah “Merchant Aggregator”, “PJP”, “acquirer”, dan “payment gateway” tidak boleh menjadi klaim pemasaran tanpa klasifikasi hukum faktual dan persetujuan relevan.

## Rujukan primer untuk verifikasi

- Bank Indonesia — Peraturan sistem pembayaran: https://www.bi.go.id/id/publikasi/peraturan/Default.aspx
- Bank Indonesia — ketentuan QRIS: https://www.bi.go.id/id/fungsi-utama/sistem-pembayaran/ritel/kanal-layanan/qris/default.aspx
- UU 27/2022 Pelindungan Data Pribadi — JDIH BPK: https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022
- Komdigi — PSE Lingkup Privat: https://pse.komdigi.go.id/

Pastikan nomor, versi, keberlakuan, aturan turunan, serta penerapan pada aktivitas BaturPay diverifikasi ulang pada sumber resmi/penasihat; jangan menyalin status tanggal dari blueprint lama tanpa pemeriksaan.
