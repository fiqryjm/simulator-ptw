# Catatan Progres Pengembangan — Simulator Permit to Work (PTW)

Dokumen ini mencatat progres pengembangan aplikasi **Simulator PTW** berdasarkan [docs/PRD.md](PRD.md) dan aturan pada [AGENTS.md](../AGENTS.md).

---

## Ringkasan Status Saat Ini

| Milestone / Tahap | Status | Keterangan |
| --- | --- | --- |
| **M0 — Kerangka Proyek** | Selesai | Next.js 15, Prisma 16 entitas, Auth.js v5, RBAC 7 peran, multi-tenant, state machine, `next-intl` (`id`/`en`), CI |
| **M1 — Alur Inti PTW, JSA & PDF** | Selesai | FormTemplate JSON schema dwibahasa, izin tambahan otomatis, JSA digital, `signature_pad`, alur `DRAFT`–`CLOSED`, FR-35, PDF ber-watermark |
| **Infrastruktur Cloud (Neon + Vercel)** | Selesai | Neon Postgres (`production`) terhubung (`pooled` + `direct`), migrasi & seed diterapkan, deploy Vercel berjalan |
| **M2 — Sesi, Skenario & Penilaian** | Belum dimulai | CRUD sesi pelatihan, 3 skenario industri + kesalahan tersisip, flagging, penilaian otomatis, dashboard instruktur SSE |
| **M3 — PWA Offline, QR & Laporan** | Belum dimulai | Mode offline IndexedDB + Serwist, QR verifikasi pada PDF, ekspor laporan CSV |

---

## Rincian Progres yang Telah Diselesaikan

### 1. Milestone M0 — Kerangka Proyek & Fondasi Keamanan
- **Inisialisasi Stack:** Next.js 15 (App Router, TypeScript strict), Tailwind CSS v4, komponen dasar shadcn/ui (`src/components/ui/*`), ESLint, Prettier, Vitest, dan Playwright.
- **Database & Multi-Tenant:** Skema 16 entitas di [prisma/schema.prisma](../prisma/schema.prisma) (`Tenant`, `User`, `FormTemplate`, `Scenario`, `Session`, `Participant`, `Permit`, `PermitVersion`, `AdditionalPermit`, `JsaRecord`, `Signature`, `Transition`, `SupervisionNote`, `ErrorFlag`, `Score`, `AuditLog`) dengan `tenantId` wajib pada seluruh tabel di bawah `Tenant`.
- **Autentikasi & RBAC:**
  - Auth.js v5 Credentials provider ([src/lib/auth.ts](../src/lib/auth.ts)) dengan hashing `bcryptjs` cost factor 12 ([src/lib/password.ts](../src/lib/password.ts)) dan rate limiter login ([src/lib/rate-limit.ts](../src/lib/rate-limit.ts)).
  - Kontrol akses server melalui `requireRole()`, `assertRole()`, `assertTenantAccess()`, `getEffectiveRole()` ([src/lib/rbac.ts](../src/lib/rbac.ts), [src/lib/server-auth.ts](../src/lib/server-auth.ts)) dan `withCrossTenantAccess()` ([src/lib/prisma.ts](../src/lib/prisma.ts)).
- **State Machine Izin:** Tabel transisi bertipe `PERMIT_TRANSITIONS` sebagai satu-satunya sumber kebenaran yang digunakan bersama XState v5 ([src/lib/permit-state-machine.ts](../src/lib/permit-state-machine.ts)), termasuk aktor khusus `SYSTEM` untuk `EXPIRED` dan guard `SUSPENDED -> ACTIVE`.
- **i18n & Banner Simulasi:** `next-intl` dengan bahasa default Indonesia (`id`) dan dukungan Inggris (`en`), serta banner tetap *"Alat Pelatihan — Data Simulasi"* di setiap halaman.
- **CI GitHub Actions:** [.github/workflows/ci.yml](../.github/workflows/ci.yml) menjalankan `lint`, `typecheck`, dan unit test pada setiap push/PR (status hijau di GitHub).

### 2. Milestone M1 — Formulir PTW/JSA, Alur Persetujuan & Cetak PDF
- **FormTemplate Berbasis JSON Schema:** Template dwibahasa (`{ id, en }`) disimpan di database dan divalidasi secara dinamis di server ([src/modules/permit/template-schema.ts](../src/modules/permit/template-schema.ts)), termasuk interpolasi `heightThresholdMeters` per tenant (default `1,8 m`) dan pemetaan `triggersAdditionalPermit`.
- **Sub-Formulir Izin Tambahan Otomatis:** Jawaban `"Ya"` pada `LOTO`, `HEIGHT`, `B3_EXCAVATION`, `CONFINED_SPACE`, atau `HOT_WORK` otomatis membuat sub-formulir terkait; persetujuan `ISSUER` mensyaratkan seluruh field wajib terisi lengkap.
- **Formulir JSA Digital:** Langkah kerja dinamis (minimal 1), 28 kode bahaya (`A`–`BB`), daftar periksa K3, dan sign-in/sign-out kru ([src/modules/jsa/service.ts](../src/modules/jsa/service.ts)).
- **Tanda Tangan Digital:** Kanvas `signature_pad` dengan validasi server ketat (hanya PNG data URL, maksimal 200 KB, hanya untuk peran yang sesuai).
- **Alur Penuh `DRAFT` → `CLOSED` & Optimistic Locking:**
  - Data PTW, JSA, dan izin tambahan bersifat *read-only* setelah `SUBMITTED` (hanya dapat diedit pada `DRAFT` atau `RETURNED`).
  - Pengecekan versi (`expectedVersion`) mengembalikan HTTP `409` saat terjadi konflik edit bersamaan.
  - Dukungan daftar periksa FR-35 (*Persiapan Tempat Kerja* dan *Pemeriksaan Pasca-Pekerjaan*) yang tersimpan pada `Transition.payloadJson`.
  - Catatan pengawasan lapangan oleh `COORDINATOR` selama status `ACTIVE`.
  - Daftar *"Menunggu Tindakan Anda"* pada dashboard tiap peran (FR-31 minimal).
- **Cetak PDF Simulasi:** Endpoint `/api/permits/[id]/pdf` ([src/lib/pdf.ts](../src/lib/pdf.ts)) merender PDF menyerupai FR-HSSE-0317 menggunakan Playwright dengan escaping HTML anti-XSS, pemblokiran jaringan anti-SSRF, dan watermark `"SIMULASI — BUKAN IZIN KERJA RESMI"`.

### 3. Integrasi Database Cloud (Neon) & Deployment (Vercel)
- Menghubungkan proyek ke **Neon** (`orange-shadow-05032268`, branch `production`, region Singapura) dengan pemisahan `DATABASE_URL` (pooled) untuk aplikasi dan `DATABASE_URL_UNPOOLED` (direct) untuk migrasi Prisma (`directUrl` di `prisma/schema.prisma`).
- Migrasi `20261117055444_m1_init` dan seed data demo (**PT Simulator PtW FJM**, 7 akun peran, template formulir, skenario dasar, dan sesi `DEMO-M1`) telah diterapkan ke Neon.
- Aplikasi berhasil di-deploy dan berjalan di Vercel (`https://simulator-ptw.vercel.app`) dengan `trustHost: true` pada Auth.js dan `postinstall: prisma generate`.

---

## Status Pengujian Terakhir

- **Unit Test (`npm test` / Vitest):** 6 file test, 24 test lulus (state machine, RBAC & isolasi tenant, rate limiting, password hashing, validator template JSON schema & PDF escaping, serta guard & optimistic locking pada permit service).
- **Typecheck & Lint (`npm run typecheck`, `npm run lint`):** Lulus tanpa error maupun warning.
- **Build Produksi (`npm run build`):** Lulus untuk seluruh 23 rute App Router.
- **End-to-End (`tests/e2e/auth-dashboard.spec.ts`):** Lulus terhadap server produksi yang terhubung ke Neon Postgres. *(E2E penuh `tests/e2e/permit-lifecycle.spec.ts` telah disiapkan untuk dijalankan terhadap server lokal.)*
