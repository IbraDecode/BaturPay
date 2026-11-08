# Integrasi Coding Agent

BaturPay bekerja dengan coding agent mana pun melalui antarmuka terbuka: **CLI** dan **server MCP**. Tidak ada ketergantungan pada satu model atau harness. OpenCode dan Hermes adalah contoh host yang dapat memakai keduanya; integrasi tidak dibatasi ke sana.

## Prinsip

- Agent hanya menyentuh **sandbox**. Tidak ada tool uang riil.
- Server MCP tidak memiliki akses shell atau berkas; kemampuan tunggalnya adalah memanggil API sandbox.
- Otorisasi, validasi, dan audit ditegakkan di server, bukan pada prompt atau instruksi agent.
- Agent menyiapkan perubahan; manusia meninjau sebelum merge/deploy.

## Cara memakai CLI dari agent

```bash
export BATURPAY_API_URL=http://localhost:4000
export BATURPAY_API_KEY=sk_sandbox_...
npm run cli -- scenarios
npm run cli -- invoice:create --external-id INV-AGENT-1 --amount 50000
npm run cli -- run --invoice <id> --scenario out_of_order --export ci-report.xml
```

Alur disarankan: buat invoice → daftarkan endpoint lokal → jalankan skenario kegagalan → `dispatch` → periksa `deliveries` → jalankan test integrasi terhadap handler webhook Anda.

## Cara memakai server MCP

```bash
BATURPAY_API_URL=http://localhost:4000 BATURPAY_API_KEY=sk_sandbox_... npm run mcp
```

Tool yang diekspos:

| Tool | Jenis | Fungsi |
|---|---|---|
| `baturpay_health` | read | Status API + status live gate |
| `baturpay_list_scenarios` | read | Katalog skenario |
| `baturpay_get_contract` | read | Versi kontrak + OpenAPI |
| `baturpay_get_invoice` | read | Ambil invoice |
| `baturpay_create_invoice` | tulis (sandbox) | Buat invoice sandbox |
| `baturpay_run_scenario` | tulis (sandbox) | Jalankan skenario deterministik |

Tool bersifat idempoten bila memungkinkan dan ditandai `readOnlyHint` pada tool baca sesuai spesifikasi MCP.

## Pola kerja yang aman

1. Minta agent menulis handler webhook + verifikasi tanda tangan.
2. Jalankan skenario `duplicate_webhook`, `out_of_order`, `slow_timeout` untuk membuktikan idempotensi.
3. Cek bahwa handler tidak pernah mempercayai redirect browser sebagai bukti pembayaran.
4. Tambahkan `run --export report.xml` ke CI agar regresi terdeteksi.

## Yang TIDAK boleh dilakukan agent

- Menyentuh kredensial produksi atau data pelanggan nyata.
- Mengaktifkan `LIVE_PAYMENTS_ENABLED` atau mengisi `GO_LIVE_ATTESTATION`.
- Menganggap "test hijau" sebagai persetujuan kepatuhan.
