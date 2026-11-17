# AGENTS.md — Simulator PTW

## Konteks
Aplikasi pelatihan Permit to Work (PTW) untuk Oil & Gas, Pembangkit Listrik, Pertambangan.
Ini ALAT PELATIHAN, bukan sistem izin kerja operasional. Semua data fiktif.

Sumber kebenaran produk: `docs/PRD.md`. Jika ada konflik, PRD menang; jangan mengarang kebutuhan.
**Baca bagian 17 (Decision Log) di `docs/PRD.md` sebelum memulai setiap milestone.
Jika bagian 17 bertentangan dengan bagian lain PRD, bagian 17 yang berlaku.
Catat setiap keputusan teknis baru di bagian 17 dengan ID berlanjut (D-xx).**

## Stack
Next.js (App Router) + React + TypeScript strict, Tailwind CSS, shadcn/ui,
React Hook Form + Zod, XState v5, PostgreSQL + Prisma, Auth.js, SSE, Serwist (PWA),
Playwright (PDF + e2e), Vitest, next-intl (id default, en).

## Aturan wajib
- Server adalah sumber kebenaran. Semua transisi status izin divalidasi di server
  sesuai tabel PRD bagian 5. Tolak transisi di luar tabel.
- Tabel transisi (const bertipe di `src/lib`) adalah SATU-SATUNYA definisi alur;
  mesin XState dan validasi server dibangun dari tabel yang sama.
- Setiap tabel dan query memakai `tenantId`. Tidak boleh ada kebocoran data antar-tenant.
  `Tenant` adalah tabel root (memakai `id`). `SUPER_ADMIN` tetap punya `tenantId` non-null
  (tenant sistem); akses lintas-tenant hanya lewat helper eksplisit yang menulis `AuditLog`.
- RBAC dicek di server untuk setiap aksi, bukan hanya di UI. Semua pengecekan hak akses
  permit melewati `getEffectiveRole(user, session)`.
- Transisi ke `EXPIRED` hanya oleh aktor `SYSTEM`; tidak boleh dapat dipicu lewat API atau UI.
- Validasi semua input dengan Zod di server.
- Template formulir disimpan sebagai JSON schema di database; jangan hardcode field.
  Label field dwibahasa `{ id, en }`.
- Ambang ketinggian (default 1,8 m) harus dapat dikonfigurasi per tenant.
- Data PTW, JSA, dan izin tambahan read-only setelah `SUBMITTED` (editable hanya pada
  `DRAFT` dan `RETURNED`).
- Optimistic locking pada transisi dan update draf; konflik versi mengembalikan HTTP 409.
- Waktu disimpan dalam UTC, ditampilkan pada zona waktu tenant (default Asia/Jakarta).
- Hash kata sandi memakai `bcryptjs` (cost 12) lewat `src/lib/password.ts`.
- PDF: escape semua input pengguna dan blokir permintaan jaringan saat render.
- Semua teks UI lewat next-intl; bahasa default Indonesia.
- Setiap halaman menampilkan banner "Alat Pelatihan — Data Simulasi"; PDF diberi watermark
  "SIMULASI — BUKAN IZIN KERJA RESMI".
- Tulis unit test untuk state machine dan penilaian (target cakupan >= 80%).
- Jangan menambah dependensi besar tanpa alasan; jelaskan di rencana.
- Jangan menyimpan rahasia di repo; gunakan `.env` dan sediakan `.env.example`.
- Aksesibilitas WCAG 2.1 AA; status tidak boleh hanya dibedakan dengan warna.

## Gaya kode
- TypeScript strict, tanpa `any` kecuali dijustifikasi.
- Modul per domain: `src/modules/{permit,jsa,session,scoring,scenario}`; util di `src/lib`.
- Commit kecil dengan pesan jelas. Jalankan lint, typecheck, dan test sebelum menyatakan selesai.

## Cara kerja
- Selalu buat rencana (Implementation Plan) sebelum mengubah banyak file, lalu tunggu
  persetujuan.
- Kerjakan per milestone (M0 sampai M3 di PRD bagian 14). Jangan melompat.
- Jika PRD ambigu atau bertentangan, jangan menebak: catat sebagai pertanyaan di plan.
- Setelah tiap milestone: ringkas apa yang selesai, apa yang belum, dan cara menjalankan.
