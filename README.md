# Simulator Permit to Work (PTW)

Aplikasi web + PWA untuk pelatihan sistem Permit to Work (PTW) pada sektor Oil & Gas, Pembangkit Listrik, dan Pertambangan. Spesifikasi produk mengacu pada [docs/PRD.md](docs/PRD.md).

> **Perhatian:** Ini adalah **Alat Pelatihan — Data Simulasi**, bukan sistem izin kerja operasional.

## Prasyarat

- Node.js 22+ & npm
- Docker & Docker Compose (untuk PostgreSQL lokal)

## Cara Menjalankan Lokal

1. **Salin variabel lingkungan**

   ```bash
   cp .env.example .env
   ```

   Pastikan `AUTH_SECRET` diisi dengan string acak yang aman (misalnya dari `openssl rand -base64 32`).

2. **Jalankan PostgreSQL lokal**

   ```bash
   docker compose up -d
   ```

3. **Instal dependensi, browser Chromium (untuk PDF & E2E), dan generate Prisma Client**

   ```bash
   npm install
   npx playwright install chromium
   npx prisma generate
   ```

4. **Jalankan migrasi & seed database**

   ```bash
   npx prisma migrate dev --name init
   npm run db:seed
   ```

5. **Jalankan server pengembangan**

   ```bash
   npm run dev
   ```

   Buka `http://localhost:3000` (bahasa default: Indonesia; gunakan `/en` untuk bahasa Inggris).

## Akun Demo Hasil Seed

Semua akun seed menggunakan kata sandi default: `SimulasiPtw2026!`

| Peran | Email | Tenant |
| --- | --- | --- |
| `APPLICANT` | `applicant@demo.ptw.local` | PT Simulator PtW FJM |
| `SUPERVISOR` | `supervisor@demo.ptw.local` | PT Simulator PtW FJM |
| `ISSUER` | `issuer@demo.ptw.local` | PT Simulator PtW FJM |
| `COORDINATOR` | `coordinator@demo.ptw.local` | PT Simulator PtW FJM |
| `INSTRUCTOR` | `instructor@demo.ptw.local` | PT Simulator PtW FJM |
| `TENANT_ADMIN` | `admin@demo.ptw.local` | PT Simulator PtW FJM |
| `SUPER_ADMIN` | `superadmin@system.ptw.local` | Platform Sistem PTW |

## Perintah Pengujian & Kualitas Kode

- **Lint:** `npm run lint`
- **Format check:** `npm run format:check`
- **Typecheck:** `npm run typecheck`
- **Unit test (Vitest):** `npm test`
- **E2E test (Playwright):** `npm run test:e2e` (pastikan server dev dan DB berjalan)
