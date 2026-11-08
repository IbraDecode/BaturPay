# Model Keamanan

## Aset yang dilindungi

- API key workspace (kredensial).
- Rahasia tanda tangan webhook.
- Integritas status/event transaksi (kebenaran data).
- Data dalam transit dan saat tersimpan.
- Integritas sistem (tidak dieksploitasi menjadi SSRF / RCE).

## Ancaman & kontrol

| Ancaman | Kontrol |
|---|---|
| Pencurian kredensial | Hash + prefix; verifikasi konstan-waktu; secret tampil sekali; rotasi/cabut |
| Replay webhook | Timestamp di dalam payload yang ditandatangani + toleransi + dedup eventId |
| Webhook palsu | HMAC-SHA256; perbandingan konstan-waktu |
| SSRF lewat URL webhook | Blok skema non-http, kredensial di URL, IP privat/loopback/link-local, resolusi DNS; allowlist eksplisit |
| Retry storm | Backoff eksponensial + batas percobaan + DLQ |
| Transaksi ganda | Idempotency-Key keras (key sama + body beda = konflik) |
| Ledger salah | Uang integer minor; pembayaran ≠ settlement |
| Kebocoran data di log | Payload webhook bertanda `simulated`; tidak menuliskan secret mentah |
| Abuso agent | MCP/CLI tanpa akses shell/berkas; tool sandbox-only; otorisasi di server |
| Role/privilege berlebih | Scopes key; pemisahan rute admin |

## Batas kepercayaan

- Klien (web, CLI, agent) **tidak tepercaya**: semua validasi di server.
- Agent coding **tidak tepercaya**: instruksinya bukan kontrol keamanan.
- Endpoint webhook pelanggan **tidak tepercaya**: diverifikasi dan dibatasi.
- Live gate adalah kontrol terakhir: menolak operasi uang riil secara default.

## Praktik yang wajib diterapkan saat operasional

- Ganti seluruh rahasia default; gunakan secret manager.
- TLS di depan (Nginx/ingress) + HSTS.
- Rotasi kunci berkala; cabut yang tidak terpakai.
- Rate limit & WAF di tepi jaringan.
- Audit akses dan pinjaman waktu (least privilege) pada database.
- Review dependensi & pemindaian kerentanan otomatis di CI.
- Uji penetrasi berkala sebelum aktivitas produksi.

## Pelaporan kerentanan

Temukan masalah keamanan? Jangan buka issue publik. Hubungi maintainer melalui kanal privat yang dicantumkan di repositori dan sertakan langkah reproduksi.
