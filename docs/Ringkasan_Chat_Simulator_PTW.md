# Ringkasan Chat: Simulator Permit to Work (PTW)

Dibuat: 17 November 2026. Gunakan file ini sebagai konteks awal jika melanjutkan di chat baru.

## 1. Konteks

**Tujuan:** aplikasi bahan ajar untuk pelatihan PTW. Klien ada di Oil & Gas, Pembangkit Listrik, dan Pertambangan.

**Bahan sumber:** diagram alir PTW (6 tahap), formulir Ijin Kerja Kontraktor FR-HSSE-0317, formulir JSA, dan repo referensi `Desilva/PermitToWork` (ASP.NET MVC lama, README kosong, hanya dipakai sebagai acuan alur).

**Arah produk:** simulator pelatihan, bukan sistem PTW operasional. Peserta memegang peran berbeda, menemukan kesalahan yang sengaja disisipkan, lalu mendapat skor otomatis. Instruktur memantau secara real-time. Seluruh data fiktif.

**Platform terpilih:** Opsi A, web app + PWA. Stack: Next.js (App Router) + TypeScript, Tailwind, shadcn/ui, Prisma + PostgreSQL, Auth.js, XState v5, Playwright (PDF dan e2e), Vitest, next-intl. Untuk MVP berupa satu aplikasi monolit.

**Alat pengembangan:** Antigravity (Planning mode, Implementation Plan dulu, lalu eksekusi per milestone).

## 2. Hasil yang sudah dibuat

| Hasil | Status |
|---|---|
| Dokumen konsep untuk klien (Word + PDF, sekitar 9 halaman) | Selesai |
| PRD sebagai Claude Doc, 17 bagian (https://claude.ai/artifact/2VnJE9i2UZQ82qT95nDTxE) | Selesai. `PRD.md` perlu diekspor sendiri (Export, Markdown, simpan di `docs/PRD.md`) |
| `AGENTS.md` versi terbaru (root proyek) | Selesai |
| Prompt M0, M1, dan balasan konfirmasi ke Antigravity | Selesai. M0 dan M1 tampaknya sudah berjalan |
| Panduan Penggunaan PDF (3 halaman) untuk calon pengguna | Selesai |
| Balasan persetujuan Plan M2 | Draf ada di bagian 5, belum dikirim |

## 3. Keputusan penting

### M0 (D-01 sampai D-06, sudah ada di PRD bagian 17.1)

- XState v5; tabel transisi (const bertipe di `src/lib`) adalah satu-satunya sumber kebenaran, validasi server memakai tabel yang sama.
- Hash kata sandi: `bcryptjs` cost 12, dibungkus di `src/lib/password.ts`.
- `Tenant` adalah tabel root. `SUPER_ADMIN` tetap punya `tenantId` non-null (tenant sistem). Akses lintas-tenant hanya lewat helper eksplisit yang menulis `AuditLog`.
- Transisi ke `EXPIRED` hanya oleh aktor `SYSTEM`, tidak dapat dipicu lewat API atau UI.
- `SUSPENDED` ke `ACTIVE`: komentar minimal 10 karakter dan harus sebelum `validTo`; jika lewat, izin menjadi `EXPIRED`.
- Penamaan berkas: `AGENTS.md` di root, PRD di `docs/PRD.md`.

### M1 (D-10 sampai D-25, sudah ada di PRD bagian 17.2)

- Dependensi `signature_pad` dan `playwright`; Chromium di Docker dan CI. PDF: input di-escape dan jaringan diblokir saat render.
- ISSUER menyetujui tiap izin tambahan sebelum penerbitan.
- Data PTW, JSA, dan izin tambahan read-only setelah `SUBMITTED` (editable hanya pada `DRAFT` dan `RETURNED`).
- Template formulir berupa JSON schema dengan label dwibahasa `{ id, en }`; pemetaan izin tambahan hanya lewat `triggersAdditionalPermit`.
- `B3_EXCAVATION` tetap satu enum.
- Optimistic locking pada transisi dan update draf (HTTP 409).
- `getEffectiveRole(user, session)` sebagai satu-satunya pintu pengecekan peran.
- Waktu disimpan UTC, ditampilkan di zona waktu tenant (default Asia/Jakarta).
- Tanda tangan hanya PNG dengan batas 200 KB, hanya oleh peran yang sesuai.
- Seed 1 skenario minimal dan 1 sesi demo; `Permit` wajib terikat `sessionId`.
- FR-35 (daftar periksa persiapan dan pasca-pekerjaan) dan FR-31 versi minimal ("Menunggu tindakan Anda").
- **D-20 masih menggantung:** bentuk penyimpanan daftar periksa FR-35 menunggu usulan agent.

### M2 (belum dicatat di PRD)

- Skor sementara hanya tampil di dashboard instruktur.
- Peserta tidak melihat skor atau benar/salah per flag saat berlatih. Umpan balik baru terbuka setelah "Selesaikan Latihan" atau sesi `COMPLETED`. Status izin `SUBMITTED` atau `CLOSED` tidak dipakai sebagai pemicu, karena izin bisa `RETURNED` lalu diajukan ulang sehingga kunci jawaban bocor.
- Instruktur read-only di halaman izin; FR-12 (ambil alih peran) dikerjakan paling akhir.
- `scoringWeights` disimpan di `Tenant.settings` (4 bobot, jumlah 100). Satu kolom nullable `Participant.finalizedAt` lewat migrasi additive kecil bila perlu.
- `seededErrorsJson` dan `explanation` (kunci jawaban) hanya untuk instruktur sesi itu, `TENANT_ADMIN`, dan `SUPER_ADMIN`.

## 4. Instruksi dan aturan yang berlaku

- Agent wajib membaca bagian 17 PRD (Decision Log) sebelum tiap milestone. Jika bertentangan dengan bagian lain, bagian 17 menang.
- Alur kerja agent: Implementation Plan dulu, tunggu persetujuan, baru eksekusi per milestone (M0 sampai M3).
- Setiap keputusan baru dicatat di bagian 17 dengan ID berlanjut (D-xx).
- Jika PRD ambigu atau bertentangan, agent mencatat pertanyaan, tidak menebak.
- Server adalah sumber kebenaran; RBAC dan isolasi tenant dicek di server.
- Setiap halaman memuat banner "Alat Pelatihan — Data Simulasi"; PDF diberi watermark "SIMULASI — BUKAN IZIN KERJA RESMI".

## 5. Draf terakhir: balasan persetujuan Plan M2 (siap kirim ke Antigravity)

Plan M2 dari Antigravity sudah baik, tetapi ada empat celah: kunci jawaban skenario bisa bocor ke peserta, cara menilai per peserta belum ditentukan, tanggal skenario bisa kedaluwarsa, dan alur gabung dengan kode tidak ada. Draf berikut menutup semuanya.

```text
Plan M2 disetujui dengan jawaban dan tambahan berikut. Perbarui Implementation Plan,
lalu tunggu persetujuan saya untuk BAGIAN SPESIFIKASI PENILAIAN (tambahan B) sebelum
menulis kode penilaian.

JAWABAN
1. Umpan balik (FR-43):
   - Skor sementara tampil di dashboard instruktur (SSE): setuju.
   - Peserta TIDAK melihat skor maupun benar/salah per flag selama berlatih
     (mencegah tebak-tebakan).
   - Detail umpan balik (ditemukan, terlewat, penjelasan) terbuka untuk peserta hanya
     setelah (a) peserta menekan "Selesaikan Latihan" (flag peserta itu terkunci),
     atau (b) Session berstatus COMPLETED.
   - Jangan memakai status izin SUBMITTED/CLOSED sebagai pemicu: izin bisa RETURNED dan
     diajukan ulang sehingga kunci jawaban bocor.
2. Instruktur read-only pada halaman izin: setuju. FR-12 (ambil alih peran) adalah P1:
   kerjakan paling akhir dan jangan menahan M2. Jika dikerjakan: berlaku per sesi, dan
   setiap aksi mencatat actorId instruktur + actingRole di Transition dan AuditLog.
3. DDL: setuju scoringWeights di Tenant.settings (validasi Zod: 4 bobot, jumlah = 100).
   Pengecualian: jika butuh penanda finalize per peserta, tambahkan satu kolom nullable
   Participant.finalizedAt lewat migrasi additive kecil dan tampilkan di plan. Jangan
   diakali lewat JSON.

TAMBAHAN WAJIB
A. Keamanan kunci jawaban: seededErrorsJson dan explanation hanya boleh keluar ke
   INSTRUCTOR (sesi terkait), TENANT_ADMIN, SUPER_ADMIN. Peserta tidak boleh menerimanya
   lewat API, SSE, export, HTML, maupun bundle JS halaman peserta. GET /api/scenarios
   hanya untuk peran pengelola. Stream dan export hanya untuk instruktur sesi itu.
B. Spesifikasi penilaian (tulis di plan, saya review dulu):
   - Tambah ke skema seededErrors: component (COMPLETENESS | HAZARD_IDENTIFICATION |
     PROCEDURE | ADDITIONAL_PERMIT_ISOLATION), relevantRoles[] (peran yang diharapkan
     menemukannya), dan acceptedFieldPaths[] (path yang dianggap cocok).
   - Jelaskan rumus tiap komponen per peserta pada izin bersama, termasuk bagaimana
     komponen "Kepatuhan prosedur" dihitung dari log Transition (mis. pemberi izin yang
     menyetujui izin yang masih memuat kesalahan CRITICAL dikenai pengurangan).
   - Kecocokan flag ditentukan oleh fieldPath. Kolom reason tidak dinilai otomatis,
     hanya disimpan untuk debrief instruktur.
   - Penalti tanda palsu memiliki lantai 0 per komponen. Skor selalu 0-100.
C. Waktu skenario: initialDataJson memakai offset relatif (mis. mulai = saat sesi dibuat,
   selesai = +8 jam), diselesaikan saat createSession dan resetSession. Jangan memakai
   tanggal tetap karena guard APPROVED -> ACTIVE akan gagal.
D. Alur gabung: tambahkan POST /api/sessions/join. joinCode acak 6-8 karakter tanpa
   karakter ambigu, unik, dengan rate limit; hanya untuk pengguna tenant yang sama; tidak
   berlaku setelah sesi ditutup.
E. Peran efektif: getEffectiveRole menurunkan sesi dari permit.sessionId lalu membaca
   Participant.simulatedRole. Pengguna yang bukan peserta sesi itu mendapat 403.
   Instruktur sesi itu read-only. Perbarui seed dan tes M1 agar akun demo terdaftar
   sebagai peserta sesi demo, dan tes e2e M1 harus tetap hijau. Tulis di plan aturan
   saat peran ditukar (mis. applicantId pada izin ikut berpindah, dicatat di AuditLog).
F. Reset sesi: satu transaksi; mempertahankan Participant dan penugasan peran; menaikkan
   versi sesi sehingga klien yang sedang mengedit menerima 409 yang jelas dan memuat
   ulang; UI meminta konfirmasi eksplisit; hanya instruktur sesi itu.
G. Flag: fieldPath divalidasi terhadap template (tolak path tak dikenal); reason wajib
   minimal 10 karakter; batas jumlah flag per izin (mis. 50); flag terkunci setelah
   finalize.
H. Ekspor CSV: cegah CSV injection (sel yang diawali = + - @ tab atau CR diberi awalan
   apostrof), karena teks reason berasal dari peserta; UTF-8 dengan BOM agar terbaca
   benar di Excel.
I. SSE: autentikasi lewat cookie sesi, cek tenant dan instruktur, interval 3-5 detik,
   kirim ringkasan perubahan (bukan seluruh data), dan sediakan fallback polling.
J. Seed dan konten: skenario dan template adalah CONTOH ILUSTRATIF yang wajib divalidasi
   pakar K3 (beri penanda di data). Tambahkan tes konsistensi: setiap seededError
   fieldPath harus ada di template schema yang dipakai skenario, dan tiap skenario memuat
   kesalahan sesuai PRD bagian 9.

PENGUJIAN TAMBAHAN
- Negatif: peserta memanggil /api/scenarios, stream, dan export -> 403 atau tanpa
  seededErrors.
- Umpan balik tidak tampil sebelum finalize dan tampil sesudahnya.
- Skor: bobot kustom, penalti tanda palsu, lantai 0, finalize mengunci flag.
- Reset mengembalikan kondisi awal skenario, mempertahankan peserta, dan memicu 409
  pada klien yang berversi lama.
- Isolasi tenant untuk semua rute sesi.
- Tes CSV injection.
- Seluruh tes e2e M1 tetap hijau.

KRITERIA SELESAI M2 (PRD bagian 14)
Instruktur menjalankan sesi dengan 3 skenario dan melihat skor per peserta; lint,
typecheck, unit, dan e2e hijau di CI.
```

## 6. Pekerjaan yang masih terbuka

1. **Kirim balasan M2** (bagian 5) ke Antigravity, lalu periksa spesifikasi penilaian (tambahan B) bersama pakar K3 sebelum kode ditulis.
2. **Ekspor ulang PRD ke `docs/PRD.md`.** Versi di proyek mungkin belum memuat bagian 17.
3. **Catat keputusan M2 di PRD** sebagai bagian 17.5 (D-30 dan seterusnya), dan **tutup D-20** (bentuk penyimpanan daftar periksa FR-35).
4. **Konfirmasi ke klien:** ambang kerja di ketinggian (2 m di diagram alir vs 1,8 m di formulir; sementara 1,8 m dan dapat dikonfigurasi), serta apakah izin Penggalian dan B3 dipisah.
5. **Sebelum membagikan Panduan PDF:** kata sandi demo, URL Vercel, dan semua email akun ikut tercetak, dan kalimat "hadir di M2/M3" mengungkap fitur yang belum ada.
6. **Pertanyaan lama yang belum terjawab:** regulasi K3 per sektor, bahasa final (Indonesia saja atau dwibahasa), LMS klien beserta standar integrasinya, dan skala peserta per sesi.
7. **Fase berikutnya:** M3 (PWA offline, QR verifikasi, laporan, i18n lengkap), lalu integrasi LMS dan SSO.

## 7. Poin klarifikasi dari dokumen sumber

- Ambang kerja di ketinggian: diagram alir menyebut lebih dari 2 m, formulir menyebut lebih dari 1,8 m.
- Penomoran daftar periksa di formulir melompat dari 1 ke 3 dan nomor 3 muncul dua kali; versi digital dinomori ulang 1 sampai 8.
- Izin "Penggalian Bahan Berbahaya Beracun (B3)" tampak menggabungkan dua jenis pekerjaan.
- Rujukan regulasi K3 berbeda per sektor dan perlu divalidasi dengan klien. Seluruh skenario dan template adalah contoh ilustratif yang wajib divalidasi pakar K3.
