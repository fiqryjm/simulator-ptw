# AGENTS.md — Simulator PTW

## Konteks
Aplikasi pelatihan Permit to Work (PTW) untuk Oil & Gas, Pembangkit Listrik, Pertambangan.
Ini ALAT PELATIHAN, bukan sistem izin kerja operasional. Semua data fiktif.
Sumber kebenaran produk: docs/PRD.md. Jika ada konflik, PRD menang; jangan mengarang kebutuhan.

## Stack
Next.js (App Router) + React + TypeScript strict, Tailwind CSS, shadcn/ui,
React Hook Form + Zod, XState, PostgreSQL + Prisma, Auth.js, SSE, Serwist (PWA),
Playwright (PDF + e2e), Vitest, next-intl (id default, en).

## Aturan wajib
- Server adalah sumber kebenaran. Semua transisi status izin divalidasi di server
  sesuai tabel PRD bagian 5. Tolak transisi di luar tabel.
- Setiap tabel dan query memakai tenantId. Tidak boleh ada kebocoran data antar-tenant.
- RBAC dicek di server untuk setiap aksi, bukan hanya di UI.
- Validasi semua input dengan Zod di server.
- Template formulir disimpan sebagai JSON schema di database, jangan hardcode field.
- Ambang ketinggian (default 1,8 m) harus dapat dikonfigurasi per tenant.
- Semua teks UI lewat next-intl; bahasa default Indonesia.
- Setiap halaman menampilkan banner "Alat Pelatihan — Data Simulasi"; PDF diberi watermark
  "SIMULASI — BUKAN IZIN KERJA RESMI".
- Tulis unit test untuk state machine dan penilaian (target cakupan >= 80%).
- Jangan menambah dependensi besar tanpa alasan; jelaskan di rencana.
- Jangan menyimpan rahasia di repo; gunakan .env dan sediakan .env.example.
- Aksesibilitas WCAG 2.1 AA; status tidak boleh hanya dibedakan dengan warna.

## Gaya kode
- TypeScript strict, tanpa `any` kecuali dijustifikasi.
- Modul per domain: src/modules/{permit,jsa,session,scoring,scenario}; util di src/lib.
- Commit kecil dengan pesan jelas. Jalankan lint, typecheck, dan test sebelum menyatakan selesai.

## Cara kerja
- Selalu buat rencana (Implementation Plan) sebelum mengubah banyak file.
- Kerjakan per milestone (M0 sampai M3 di PRD bagian 14). Jangan melompat.
- Setelah tiap milestone: ringkas apa yang selesai, apa yang belum, dan cara menjalankan.