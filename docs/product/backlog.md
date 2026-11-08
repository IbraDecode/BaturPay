# Backlog awal BaturPay

## Discovery (sebelum implementasi besar)
- [ ] Wawancarai 8–12 backend developer/QA tentang webhook, retry, dan reconciliation.
- [ ] Uji prototipe CLI + scenario runner tanpa dashboard.
- [ ] Validasi apakah suite conformance CI punya pemilik anggaran.
- [ ] Tetapkan kontrak internal dan batas simulasi yang mudah dibedakan.

## Sandbox MVP
- [ ] Monorepo dasar, lint, test, CI, dependency scanning.
- [ ] Contract registry terversi (OpenAPI) dan schema validation.
- [ ] Workspace dan sandbox API key (hash, one-time reveal, revoke, rotate).
- [ ] Invoice API dengan amount integer, currency, external ID, idempotency.
- [ ] State machine dan event store append-only.
- [ ] Seeded scenario engine (success/failure/pending/expiry/timeout).
- [ ] Webhook signing, delivery retries, duplicate/late/out-of-order scenarios.
- [ ] CLI untuk create/run/inspect/export (tanpa agent wajib).
- [ ] JUnit/JSON report dan fixtures CI.
- [ ] Dashboard run timeline sederhana.
- [ ] Audit dan sanitasi data.
- [ ] SSRF/egress controls untuk webhook simulator.

## Agent-ready (setelah core stabil)
- [ ] Repo instructions generik dengan cara menjalankan tes dan larangan secret/live actions.
- [ ] Agent Skills opsional untuk webhook, idempotency, dan tes integrasi.
- [ ] Evaluasi skill pada OpenCode, Hermes, serta format umum yang didukung; dokumentasikan batas kompatibilitas.
- [ ] MCP read-only: contract lookup, docs, run inspection.
- [ ] MCP simulator sandbox dengan policy, workspace auth, limits, audit.
- [ ] Eval regression pada artefak kode dan hasil suite, bukan penilaian bahasa semata.

## Belum masuk roadmap
- [ ] Adapter provider sandbox, hanya setelah ada kebutuhan dan dokumentasi resmi/izin partner.
- [ ] QRIS produksi, settlement, payout, transaksi nyata.
- [ ] A2A atau orkestrasi multi-agent lintas organisasi.
