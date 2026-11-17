# Catatan Progres Pengembangan — Simulator Permit to Work (PTW)

Dokumen ini mencatat progres pengembangan aplikasi **Simulator PTW** berdasarkan [docs/PRD.md](PRD.md) dan aturan pada [AGENTS.md](../AGENTS.md).

---

## Ringkasan Status Saat Ini

| Milestone / Tahap | Status | Keterangan |
| --- | --- | --- |
| **M0 — Kerangka Proyek** | Selesai | Next.js 15, Prisma 16 entitas, Auth.js v5, RBAC 7 peran, multi-tenant, state machine, `next-intl` (`id`/`en`), CI |
| **M1 — Alur Inti PTW, JSA & PDF** | Selesai | FormTemplate JSON schema dwibahasa, izin tambahan otomatis, JSA digital, `signature_pad`, alur `DRAFT`–`CLOSED`, FR-35, PDF ber-watermark |
| **Infrastruktur Cloud (Neon + Vercel)** | Selesai | Neon Postgres (`production`) terhubung (`pooled` + `direct`), migrasi & seed diterapkan, deploy Vercel berjalan |
| **M2 — Sesi, Skenario & Penilaian** | Selesai | CRUD sesi pelatihan, 3 skenario industri + kesalahan tersisip, flagging, penilaian otomatis, dashboard instruktur SSE |
| **M3 — PWA Offline, QR & Laporan** | Selesai | PWA Serwist + IndexedDB sinkronisasi draf offline, QR verifikasi pada PDF & `/verify/[id]`, pengalih bahasa `ID | EN`, konsol `TENANT_ADMIN` |

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
- Migrasi `20261117055444_m1_init` & `20261117073103_m2_session_scoring` serta seed data demo (**PT Simulator PtW FJM**, 7 akun peran, template 3 sektor, 3 skenario MVP ilustratif, dan sesi `DEMO-M1`) telah diterapkan ke Neon.
- Aplikasi berhasil di-deploy ke Vercel (`https://simulator-ptw.vercel.app`) dengan `trustHost: true` pada Auth.js, `postinstall: prisma generate`, serta `@sparticuz/chromium` + `outputFileTracingIncludes` untuk generasi PDF serverless.

### 4. Milestone M2 — Sesi, Skenario 3 Sektor, Flagging, Penilaian & SSE
- **Perpustakaan Skenario 3 Sektor:** 3 skenario ilustratif (`OIL_AND_GAS`, `POWER_PLANT`, `MINING`) dengan offset waktu relatif dan `seededErrorsJson[]` (`component`, `relevantRoles[]`, `acceptedFieldPaths[]`, `severity`, `points`, `explanation`), terlindung hanya untuk `INSTRUCTOR`, `TENANT_ADMIN`, dan `SUPER_ADMIN` ([src/modules/scenario/service.ts](../src/modules/scenario/service.ts)).
- **Manajemen Sesi & Peran Efektif:** Pembuatan sesi dengan `joinCode` 6 karakter tanpa karakter ambigu, `POST /api/sessions/join` (rate-limited), penukaran peran peserta (`Participant.simulatedRole`) yang memindahkan `Permit.applicantId` dan mencatat `AuditLog`, serta `POST /api/sessions/[id]/reset` transaksional ([src/modules/session/service.ts](../src/modules/session/service.ts)).
- **Flagging & Penilaian Otomatis:** Validasi `fieldPath` terhadap schema template, `reason` ≥ 10 karakter, maks 50 flag/izin, terkunci setelah `finalizedAt` atau `COMPLETED`. Skor 4 komponen (bobot tenant jumlah = 100), penalti tanda palsu, dan pengurangan prosedural dari log `Transition` ([src/modules/scoring/service.ts](../src/modules/scoring/service.ts)).
- **Dashboard Instruktur Real-Time & Ekspor:** Stream SSE `/api/sessions/[id]/stream` dengan fallback polling serta ekspor CSV UTF-8 BOM anti-CSV injection.

### 5. Milestone M3 — PWA Offline, QR Verifikasi, Bahasa & Admin Tenant
- **PWA & Sinkronisasi Draf Offline:** Service worker Serwist (`/sw.js`), `manifest.webmanifest`, penyimpanan draf otomatis ke **IndexedDB** ([src/lib/offline-drafts.ts](../src/lib/offline-drafts.ts)), dan sinkronisasi otomatis saat kembali online dengan deteksi konflik `409`.
- **QR Code & Halaman Verifikasi:** QR code lokal (`qrcode`) disematkan pada PDF menuju `/verify/[id]` ([src/app/[locale]/verify/[id]/page.tsx](../src/app/%5Blocale%5D/verify/%5Bid%5D/page.tsx)) yang hanya menampilkan metadata status minimal dan disclaimer simulasi.
- **Pengalih Bahasa & Admin Tenant:** Switcher `ID | EN` pada banner atas seluruh halaman ([src/components/language-switcher.tsx](../src/components/language-switcher.tsx)), serta konsol `TENANT_ADMIN` ([src/components/tenant-admin-console.tsx](../src/components/tenant-admin-console.tsx)) untuk mengatur ambang ketinggian, zona waktu, bobot skor, dan pengguna tenant.

---

## Status Pengujian Terakhir

- **Typecheck & Lint (`npm run typecheck`, `npm run lint`):** Lulus tanpa error maupun warning.
- **Unit Test (`npm test` / Vitest):** **10 file test, 41 unit test lulus** (state machine, RBAC & isolasi tenant, rate limiting, password hashing, template JSON schema & PDF escaping, permit service & optimistic locking, konsistensi skenario 3 sektor, kalkulasi skor & CSV injection, session service, serta sinkronisasi offline & QR PDF).
- **Build Produksi (`npm run build`):** Lulus untuk seluruh 39 rute App Router + bundle service worker `/sw.js`.
- **End-to-End (`npx playwright test` terhadap Neon Postgres):** **4/4 E2E test lulus dalam 50,8 detik** (`auth-dashboard.spec.ts`, `permit-lifecycle.spec.ts`, `session-scoring.spec.ts`, dan `m3-pwa-verify-i18n.spec.ts`).
