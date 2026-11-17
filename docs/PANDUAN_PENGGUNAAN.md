# Panduan Penggunaan — Simulator Permit to Work (PTW)

> **Penting:** Aplikasi ini adalah **Alat Pelatihan — Data Simulasi**, bukan sistem izin kerja operasional resmi. Seluruh data di dalamnya bersifat fiktif.

---

## 1. Mengakses Aplikasi & Memilih Bahasa

- **Versi Online (Vercel):** Buka `https://simulator-ptw.vercel.app`
- **Versi Lokal:** Jalankan `npm run dev`, lalu buka `http://localhost:3000` (atau port yang Anda tentukan).
- **Bahasa Antarmuka:**
  - Bahasa bawaan adalah **Bahasa Indonesia** (`/login`, `/dashboard`).
  - Untuk beralih ke **Bahasa Inggris**, klik tautan **English** di halaman login atau tambahkan awalan `/en` pada URL (misalnya `/en/login`).

---

## 2. Akun Demo & Peran Pengguna

Semua akun demo pada tenant **PT Simulator PtW FJM** menggunakan kata sandi default: `SimulasiPtw2026!`

| Peran | Email | Tanggung Jawab dalam Simulasi |
| --- | --- | --- |
| `APPLICANT` (Pemohon) | `applicant@demo.ptw.local` | Membuat draf PTW, mengisi JSA & izin tambahan, menandatangani, mengajukan izin, persiapan kerja, dan menyelesaikan pekerjaan |
| `SUPERVISOR` (Pengawas) | `supervisor@demo.ptw.local` | Mereview pengajuan PTW, memberi catatan metode & dampak, menyetujui ke Pemberi Izin, mengembalikan, atau menolak |
| `ISSUER` (Pemberi Izin) | `issuer@demo.ptw.local` | Menyetujui sub-formulir izin tambahan, menandatangani & menerbitkan izin, menangguhkan/mengaktifkan kembali, dan menutup izin |
| `COORDINATOR` (Koordinator) | `coordinator@demo.ptw.local` | Menambahkan catatan pengawasan berstempel waktu selama izin berstatus `Aktif` |
| `INSTRUCTOR` (Instruktur) | `instructor@demo.ptw.local` | Memantau pelatihan *(fitur sesi & skor real-time hadir di M2)* |
| `TENANT_ADMIN` (Admin Klien) | `admin@demo.ptw.local` | Administrasi tenant *(fitur lengkap hadir di M2/M3)* |
| `SUPER_ADMIN` | `superadmin@system.ptw.local` | Pengelolaan platform lintas tenant |

---

## 3. Alur Lengkap Simulasi Izin Kerja (`DRAFT` → `CLOSED`)

Untuk menjalankan satu siklus izin kerja penuh, pengguna bergantian masuk sesuai perannya masing-masing:

### Tahap 1 — Pembuatan & Pengajuan Izin (`APPLICANT`)
1. Masuk menggunakan akun `applicant@demo.ptw.local`.
2. Di dashboard, klik tombol **Buat PTW Baru**.
3. Lengkapi seluruh field wajib pada **Formulir PTW**:
   - **Informasi Umum:** Nama Perusahaan, Departemen Pengguna, Lokasi Kerja, Uraian Kerja, Tanggal/Jam Mulai, dan Tanggal/Jam Selesai *(waktu selesai harus setelah waktu mulai)*.
   - **Daftar Periksa Keselamatan (1–8):** Jawab seluruh pertanyaan *Ya/Tidak*.
   - **Izin Tambahan:** Jika Anda memilih **Ya** pada salah satu jenis (*LOTO, Kerja di Ketinggian, Penggalian/B3, Ruang Terbatas, Kerja Panas*) dan mengisi keterangannya, klik **Simpan Draf PTW** — sub-formulir izin tambahan akan otomatis muncul di bawahnya.
   - **Bahaya K3L Berisiko Tinggi:** Jawab seluruh pertanyaan *Ya/Tidak* (beri keterangan jika *Ya*).
4. Jika ada **Sub-Formulir Izin Tambahan**, isi semua field wajibnya lalu klik **Simpan [TIPE]**.
5. Isi formulir **Job Safety Analysis (JSA)**:
   - Lengkapi header (Nama Pengawas, Kontraktor, Tanggal, Lokasi Kerja).
   - Tambahkan minimal 1 **Langkah Kerja** beserta **Kode Bahaya (`A`–`BB`)**, **Bahaya Potensial**, dan **Prosedur Kerja Aman** (gunakan `+ Tambah Langkah` jika perlu).
   - Pastikan minimal 1 anggota kru dicentang **Sign-in**, lalu klik **Simpan JSA**.
6. Gambar tanda tangan pada kotak **Tanda Tangan Penerima Izin (APPLICANT)** lalu klik **Simpan Tanda Tangan**.
7. Klik **Ajukan Izin** (`DRAFT` → `SUBMITTED`).
   - *Catatan:* Setelah diajukan, data PTW, JSA, dan izin tambahan menjadi **read-only** kecuali izin dikembalikan (`RETURNED`).

### Tahap 2 — Review Pengawas (`SUPERVISOR`)
1. Keluar, lalu masuk menggunakan akun `supervisor@demo.ptw.local`.
2. Di panel **Menunggu Tindakan Anda**, klik **Buka Izin** pada izin berstatus **Diajukan**.
3. Isi kolom **Catatan Review Metode & Dampak**, lalu pilih salah satu aksi:
   - **Setujui Review (Ke Pemberi Izin)** (`SUBMITTED` → `PENDING_ISSUANCE`)
   - **Kembalikan ke Pemohon** (`SUBMITTED` → `RETURNED`, komentar wajib)
   - **Tolak Izin** (`SUBMITTED` → `REJECTED`, alasan wajib)

### Tahap 3 — Penerbitan Izin (`ISSUER`)
1. Masuk menggunakan akun `issuer@demo.ptw.local`, lalu buka izin berstatus **Menunggu Penerbitan**.
2. Jika izin memiliki **Sub-Formulir Izin Tambahan**, klik **Setujui [TIPE]** pada masing-masing izin tambahan *(semua izin tambahan harus disetujui terlebih dahulu)*.
3. Gambar tanda tangan pada kotak **Tanda Tangan Pemberi Izin (ISSUER)** lalu klik **Simpan Tanda Tangan**.
4. Klik **Terbitkan Izin (APPROVED)**.

### Tahap 4 — Persiapan Tempat Kerja & Pekerjaan Aktif (`APPLICANT` & `COORDINATOR`)
1. Masuk kembali sebagai `applicant@demo.ptw.local` dan buka izin berstatus **Disetujui**.
2. Isi **Daftar Periksa Persiapan Tempat Kerja (FR-35)**, lalu klik **Mulai Pekerjaan (ACTIVE)**.
   - *Syarat server:* waktu sekarang harus berada dalam rentang `Tanggal/Jam Mulai` hingga `Tanggal/Jam Selesai`.
3. Selama berstatus **Aktif**:
   - `coordinator@demo.ptw.local` dapat masuk untuk menambahkan **Catatan Pengawasan Lapangan** berstempel waktu.
   - `issuer@demo.ptw.local` dapat menangguhkan izin sementara (**Tangguhkan Izin**) jika ditemukan kondisi tidak aman, lalu mengaktifkannya kembali dengan catatan pemulihan minimal 10 karakter sebelum waktu berlaku habis.

### Tahap 5 — Penyelesaian & Penutupan Izin (`APPLICANT` → `ISSUER`)
1. Masuk sebagai `applicant@demo.ptw.local` pada izin berstatus **Aktif**.
2. Isi **Pemeriksaan Lokasi Pasca-Pekerjaan (FR-35)**, lalu klik **Selesaikan Pekerjaan (COMPLETED)**.
3. Masuk sebagai `issuer@demo.ptw.local` pada izin berstatus **Selesai**, lalu klik **Verifikasi & Tutup Izin (CLOSED)**.

---

## 4. Mencetak PDF Izin Kerja

Pada halaman detail izin mana pun, klik tombol **Cetak PDF (Simulasi)** di kanan atas untuk mengunduh/membuka dokumen PDF berformat FR-HSSE-0317 lengkap dengan tanda tangan, riwayat transisi, dan watermark **`SIMULASI — BUKAN IZIN KERJA RESMI`**.

*(Catatan: Generasi PDF menggunakan Playwright Chromium membutuhkan lingkungan runtime Node/Docker dengan Chromium terpasang.)*
