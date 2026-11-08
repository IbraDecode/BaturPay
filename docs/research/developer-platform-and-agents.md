# Riset: Developer Platform dan Coding Agents untuk BaturPay

**Tanggal riset:** 9 November 2026 • **Cakupan:** sumber primer vendor dan spesifikasi; tidak menginspeksi repo lain. • **Status:** analisis strategi, bukan validasi pasar.

## Kesimpulan eksekutif

Peluang paling kuat bukan wrapper pemilihan model atau orchestrator agent generik. BaturPay sebaiknya menjadi **Payment Integration Workbench**: lapisan kontrak, simulator deterministik, webhook lab, conformance/evaluation suite, dan bukti hasil yang dapat ditinjau. Manusia dan coding-agent memakai API, CLI, SDK, serta protokol standar yang sama. Pembayaran riil dilarang dalam MVP.

Agent ecosystems bergerak ke instruksi repo-native, skills terkomponisikan, tools terstruktur, hooks, sandbox, dan observability. Itu mendukung distribusi workflow; tetapi konfigurasi dan tingkat pengamanan tidak seragam antar-host. Dengan demikian aturan transaksi wajib ditegakkan di server, bukan mengandalkan prompt/hook agent.

## Temuan dan implikasi

### Instruksi serta skills dekat repo menjadi distribusi workflow

OpenAI Codex membaca `AGENTS.md` untuk memahami cara kerja proyek. GitHub Copilot mendukung instruksi repositori/path dan Agent Skills; Skills mengemas instruksi tugas beserta referensi atau skrip dan dapat dimuat sesuai kebutuhan. OpenCode memiliki agent/permission yang dapat dikonfigurasi; Hermes menyediakan skills, hooks, MCP, dan konteks proyek. Dukungan serta lokasi file spesifik per host.

**Implikasi:** sediakan petunjuk repo dan skills opsional yang ringkas, namun CLI, skrip, fixture, dan tes harus tetap bermanfaat tanpa LLM maupun agent vendor tertentu. OpenCode dan Hermes adalah integrasi opsional yang relevan. BaturPay tidak akan bergantung pada Claude atau menganggap fitur satu agent sebagai standar lintas platform.

### Permission, sandbox, approval berbeda dan tidak saling menggantikan

Dokumentasi OpenCode menunjukkan permission berjenjang (allow/deny/ask) pada tool; dokumen keamanan OpenAI membedakan approval dari sandbox teknis dan memperingatkan bahwa sandbox shell tidak otomatis membatasi tool MCP eksternal. Dokumentasi GitHub menjelaskan hooks untuk otomasi/kontrol, dengan perilaku yang berbeda menurut lingkungan lokal atau cloud.

**Implikasi:** server BaturPay harus menerapkan tenant authorization, allowlist tindakan, validasi schema, rate/amount limit sandbox, idempotensi, serta audit pada setiap panggilan. Hook dan instruksi hanya lapisan kenyamanan, bukan batas keselamatan. Jangan buat operasi pembayaran live yang dapat dipanggil agent pada MVP.

### Observability harus membuktikan alur pembayaran, bukan sekadar aktivitas model

Dokumentasi Hermes observer hooks mencontohkan korelasi session/task/tool call, status dan durasi, serta payload yang disanitasi. Itu pola desain berguna, bukan standar lintas vendor.

**Implikasi:** kaitkan run ID, scenario ID, contract version, API call simulasi, webhook delivery, test result, dan exception reconciliation. Pisahkan telemetry model dari catatan transaksi simulasi; redaksi rahasia sebelum data mencapai log.

## Pemilihan interoperabilitas

- **MCP** cocok untuk menyajikan tools/resources/prompts kepada agent. Mulai dari tools read-only (baca docs/schema, inspeksi run) lalu simulator terisolasi. Otorisasi, validasi, dan audit tetap tanggung jawab server.
- **A2A** ditujukan pada kolaborasi antarsistem agent; bukan prasyarat agar agent mengakses tool pembayaran. Pertimbangkan hanya bila ada use-case lintas organisasi yang terbukti.
- **ACP** adalah akronim ambigu dengan spesifikasi/proyek berbeda. Jangan klaim dukungan sebelum menetapkan protokol persis, pemilik, dan versi.
- **CLI/API** menjadi antarmuka utama yang stabil. MCP menjadi adaptor, bukan satu-satunya jalan.

## Peluang produk: BaturPay Integration Lab

1. **Executable contracts:** OpenAPI/schema, contoh SDK, simulator, fixtures, dan conformance tests berasal dari kontrak versi yang sama.
2. **Failure-first payment chaos lab:** uji timeout ambigu, webhook duplikat/terlambat/reordered, status tertunda/expired, mismatch nominal/reference, retry, dan rekonsiliasi.
3. **Deterministic replay:** setiap run dapat diputar ulang dengan scenario/seed dan hasilnya diekspor sebagai JUnit/JSON.
4. **Repo-native kits:** contoh integrasi dan skills task-specific untuk checkout, signature verification, idempotency, webhook, dan reconciliation. Instruksi selalu menyebut asumsi kontrak dan cara tes.
5. **Evidence-based debugging:** timeline menampilkan transisi status, attempt, signature validation, event dedup, serta discrepancy—bukan keputusan “agent menyatakan sukses”.
6. **Provider conformance:** adapter dapat diuji terhadap kontrak umum sambil mempertahankan perilaku provider yang spesifik; abstraksi tidak boleh menutupi perbedaan penting.
7. **Agent evaluation:** nilai artefak hasil (tes signature, retry/dedup, schema, simulator suite) alih-alih kefasihan jawaban model.

## Guardrails yang direkomendasikan

- Lingkungan sandbox terpisah dari produksi dalam endpoint, credential, UI, tipe data, dan kebijakan.
- Tidak ada data pembayaran/pribadi nyata atau secret ke prompt dan telemetry.
- Server memvalidasi actor, tenant, izin, operasi, input, idempotency, dan batas beban.
- Mulai dengan MCP read-only; tool yang mengubah sandbox state membutuhkan izin jelas, batas terukur, dan audit. Tidak ada tool transaksi live.
- Catat aktor, run ID, versi kontrak, skenario, tool, hasil, dan waktu; tetapkan akses/retensi.
- Agent tidak mengesahkan kepatuhan/regulasi; keputusan tersebut butuh pemilik dan penasihat yang kompeten.

## Roadmap eksperimen

1. Wawancarai developer/QA dan uji apakah pain point webhook/retry/reconciliation cukup bernilai.
2. MVP CLI + simulator deterministik + fixture webhook + suite signature/idempotency + artefak CI.
3. Tambahkan generator SDK/docs dari kontrak dan repo instructions/skills lintas host.
4. Tambahkan MCP untuk docs/run inspection, kemudian tool sandbox mutatif dengan policy ketat.
5. Bangun eval suite regresi untuk hasil integrasi, bukan model tertentu.
6. Multi-agent/A2A hanya bila ada kebutuhan terukur.

## Sumber primer

- OpenAI, Codex (repo instructions): https://openai.com/index/introducing-codex/
- GitHub Copilot, custom instructions: https://docs.github.com/en/copilot/concepts/prompting-and-context/custom-instructions
- GitHub Copilot, Agent Skills: https://docs.github.com/en/copilot/concepts/customizations/agent-skills
- VS Code, Agent Skills: https://code.visualstudio.com/docs/agent-customization/agent-skills
- OpenCode, Agents: https://opencode.ai/docs/agents/
- OpenCode, Permissions: https://opencode.ai/docs/permissions/
- OpenCode, MCP servers: https://opencode.ai/docs/mcp-servers/
- Hermes Agent, feature overview: https://hermes-agent.nousresearch.com/docs/user-guide/features/overview
- Hermes Agent, observer hooks: https://hermes-agent.nousresearch.com/docs/developer-guide/observer-hooks
- OpenAI, Running Codex safely: https://openai.com/index/running-codex-safely/
- OpenAI, Unrolling the Codex agent loop (MCP tool boundary): https://openai.com/index/unrolling-the-codex-agent-loop/
- GitHub Copilot, hooks reference: https://docs.github.com/en/copilot/reference/hooks-reference
- MCP, specification: https://modelcontextprotocol.io/specification/2025-11-25/index
- MCP, security best practices: https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices
- A2A, specification: https://a2a-protocol.org/latest/specification/
- A2A, comparison with MCP: https://a2a-protocol.org/latest/topics/a2a-and-mcp/
- ACP (example of separately named protocol): https://www.acp-protocol.dev/docs/reference/specification

## Catatan batas riset

Sumber vendor menjelaskan kapabilitas produknya sendiri dan dapat berubah. Mereka tidak membuktikan adanya permintaan pasar, interoperabilitas penuh, jaminan keamanan deployment, atau kelayakan legal model bisnis BaturPay. Verifikasi versi/dokumentasi saat implementasi dan lakukan wawancara pengguna sebelum menetapkan prioritas komersial.
