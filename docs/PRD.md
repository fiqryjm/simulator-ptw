# PRD — Simulator Permit to Work (PTW)

Versi 1.0 · 17 November 2026 · Status: draf untuk review · Platform: web app + PWA

## 1. Ringkasan Produk

Simulator PTW adalah aplikasi web progresif (PWA) untuk pelatihan sistem izin kerja (Permit to Work) di sektor Oil & Gas, Pembangkit Listrik, dan Pertambangan. Peserta menjalankan alur PTW yang realistis, mengisi formulir PTW dan JSA digital, dan menemukan kesalahan yang sengaja disisipkan pada skenario. Instruktur memantau kelas secara langsung dan mendapat laporan penilaian otomatis.

Aplikasi ini adalah alat pelatihan. Aplikasi ini **bukan** sistem PTW operasional dan tidak menggantikan sistem izin kerja resmi klien. Seluruh data bersifat fiktif dan dapat direset.

**Dokumen sumber:** diagram alir PTW (6 tahap), formulir Ijin Kerja Kontraktor FR-HSSE-0317, dan formulir Job Safety Analysis (JSA).

## 2. Tujuan dan Metrik Keberhasilan

| Tujuan | Metrik | Target MVP |
| --- | --- | --- |
| Peserta berlatih memutuskan, bukan hanya membaca | Persentase peserta yang menyelesaikan minimal satu skenario penuh | ≥ 90% per sesi |
| Kesalahan tersembunyi dapat ditemukan dan diukur | Waktu rata-rata menyelesaikan skenario; tingkat deteksi kesalahan | Terukur per peserta dan per kelas |
| Instruktur dapat memandu tanpa kertas | Instruktur menjalankan satu sesi penuh tanpa bantuan teknis | 100% pada uji penerimaan |
| Satu platform untuk tiga sektor | Jumlah sektor yang berjalan dari mesin yang sama | 3 sektor, 1 skenario per sektor |

## 3. Pengguna dan Peran

| Peran | Kode | Hak utama |
| --- | --- | --- |
| Pemohon / Penerima Izin | `APPLICANT` | Membuat dan mengajukan PTW dan JSA, menyiapkan tempat kerja, memulai dan menyelesaikan pekerjaan |
| Pengawas Pekerjaan | `SUPERVISOR` | Mereview dan menyetujui, mengembalikan, atau menolak pengajuan |
| Pemberi Izin | `ISSUER` | Menerbitkan izin (tanda tangan), memverifikasi penutupan, menangguhkan izin |
| Koordinator Pengawasan | `COORDINATOR` | Mencatat pengawasan selama izin aktif |
| Instruktur | `INSTRUCTOR` | Membuat sesi, memilih skenario, menugaskan peran, memantau, mengambil alih peran, melihat laporan |
| Admin Klien | `TENANT_ADMIN` | Mengelola pengguna, template formulir, dan pengaturan perusahaan |
| Super Admin | `SUPER_ADMIN` | Mengelola tenant dan perpustakaan skenario global |

Setiap peserta dalam satu sesi memegang tepat satu peran simulasi pada satu waktu. Instruktur dapat menukar peran.

## 4. Ruang Lingkup

**Dalam lingkup MVP:** autentikasi dan peran, sesi pelatihan, formulir PTW dan JSA digital, izin tambahan, alur persetujuan multi-peran, tanda tangan digital, mesin skenario dengan kesalahan tersisip, penilaian otomatis, dashboard instruktur, cetak PDF dengan QR code, mode offline untuk pengisian draf, multi-tenant, bahasa Indonesia dan Inggris.

**Di luar lingkup MVP:** integrasi sistem operasional atau sensor, SSO perusahaan klien, integrasi LMS (xAPI/SCORM/LTI, fase 3), aplikasi native, denah interaktif konflik pekerjaan (fase 2).

## 5. Alur Kerja dan State Machine

Status izin (nilai enum dalam kode, label tampilan dalam bahasa Indonesia):

| Status | Label | Arti |
| --- | --- | --- |
| `DRAFT` | Draf | Pemohon sedang mengisi |
| `SUBMITTED` | Diajukan | Menunggu review pengawas |
| `PENDING_ISSUANCE` | Menunggu Penerbitan | Disetujui pengawas, menunggu pemberi izin |
| `APPROVED` | Disetujui | Izin diterbitkan, belum dimulai |
| `ACTIVE` | Aktif | Tempat kerja siap, pekerjaan berlangsung |
| `COMPLETED` | Selesai | Lokasi diperiksa aman, menunggu verifikasi |
| `CLOSED` | Ditutup | Diverifikasi dan diarsipkan |
| `RETURNED` | Dikembalikan | Perlu perbaikan oleh pemohon |
| `REJECTED` | Ditolak | Tidak dapat dilanjutkan |
| `SUSPENDED` | Ditangguhkan | Dihentikan sementara oleh pemberi izin |
| `EXPIRED` | Kedaluwarsa | Melewati waktu berlaku |

Transisi yang diizinkan (selain itu harus ditolak server):

| Dari | Ke | Pelaku | Guard (syarat) |
| --- | --- | --- | --- |
| `DRAFT` | `SUBMITTED` | `APPLICANT` | Semua field wajib terisi; JSA terlampir; izin tambahan dibuat untuk setiap jawaban «Ya»; tanda tangan penerima ada |
| `SUBMITTED` | `PENDING_ISSUANCE` | `SUPERVISOR` | Review selesai dengan catatan metode dan dampak ke aktivitas lain |
| `SUBMITTED` | `RETURNED` | `SUPERVISOR` | Komentar wajib |
| `SUBMITTED` | `REJECTED` | `SUPERVISOR` | Alasan wajib |
| `RETURNED` | `SUBMITTED` | `APPLICANT` | Perbaikan dilakukan; riwayat versi tersimpan |
| `PENDING_ISSUANCE` | `APPROVED` | `ISSUER` | Tanda tangan pemberi izin; seluruh izin tambahan berstatus disetujui |
| `PENDING_ISSUANCE` | `RETURNED` / `REJECTED` | `ISSUER` | Alasan wajib |
| `APPROVED` | `ACTIVE` | `APPLICANT` | Daftar periksa persiapan tempat kerja selesai; waktu sekarang berada dalam periode berlaku |
| `ACTIVE` | `SUSPENDED` | `ISSUER` | Alasan wajib |
| `SUSPENDED` | `ACTIVE` | `ISSUER` | Kondisi dipulihkan, dicatat |
| `ACTIVE` | `COMPLETED` | `APPLICANT` | Pemeriksaan lokasi pasca-pekerjaan selesai |
| `COMPLETED` | `CLOSED` | `ISSUER` | Verifikasi dan arsip |
| `APPROVED` / `ACTIVE` | `EXPIRED` | Sistem | Waktu selesai terlewati tanpa penutupan |

Selama `ACTIVE`, `COORDINATOR` dapat menambahkan catatan pengawasan berstempel waktu.

## 6. Kebutuhan Fungsional

Prioritas: **P0** wajib MVP, **P1** MVP jika waktu memungkinkan, **P2** fase berikutnya.

### 6.1 Akun, peran, dan tenant

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| FR-01 | Login dengan email dan kata sandi; sesi aman | P0 |
| FR-02 | Kontrol akses berbasis peran sesuai bagian 3 | P0 |
| FR-03 | Seluruh data terikat `tenantId`; satu tenant tidak dapat melihat data tenant lain | P0 |
| FR-04 | Admin klien mengundang dan menonaktifkan pengguna | P1 |
| FR-05 | Bahasa antarmuka Indonesia (default) dan Inggris | P1 |

### 6.2 Sesi pelatihan

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| FR-10 | Instruktur membuat sesi: pilih skenario, industri, daftar peserta, kode gabung | P0 |
| FR-11 | Instruktur menugaskan dan menukar peran simulasi peserta | P0 |
| FR-12 | Mode instruktur mengambil alih peran tertentu | P1 |
| FR-13 | Reset sesi mengembalikan semua izin dan data ke kondisi awal skenario | P0 |
| FR-14 | Mode ruang kelas: satu perangkat dipakai bergantian dengan pergantian peran cepat | P1 |

### 6.3 Formulir PTW dan JSA

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| FR-20 | Formulir PTW digital sesuai bagian 8.1 | P0 |
| FR-21 | Formulir JSA digital sesuai bagian 8.2, dengan jumlah langkah kerja dinamis | P0 |
| FR-22 | Jawaban «Ya» pada izin tambahan otomatis membuat sub-formulir izin terkait | P0 |
| FR-23 | Tanda tangan digital (kanvas) dengan stempel waktu dan identitas penanda tangan | P0 |
| FR-24 | Template formulir disimpan sebagai JSON schema per tenant dan industri; perubahan template tidak memerlukan perubahan kode | P0 |
| FR-25 | Ambang kerja di ketinggian dapat dikonfigurasi per tenant (default 1,8 m) | P1 |
| FR-26 | Versi formulir: setiap perubahan setelah pengajuan menyimpan versi baru | P1 |

### 6.4 Alur persetujuan

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| FR-30 | Transisi status hanya sesuai tabel bagian 5, divalidasi di server | P0 |
| FR-31 | Notifikasi dalam aplikasi untuk peran berikutnya | P0 |
| FR-32 | Komentar wajib pada pengembalian dan penolakan | P0 |
| FR-33 | Kedaluwarsa otomatis oleh sistem | P1 |
| FR-34 | Catatan pengawasan selama izin aktif | P1 |
| FR-35 | Daftar periksa persiapan tempat kerja dan pemeriksaan lokasi pasca-pekerjaan | P0 |

### 6.5 Skenario dan penilaian

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| FR-40 | Perpustakaan skenario per industri dengan data awal, dokumen awal, dan daftar kesalahan tersembunyi (bagian 9) | P0 |
| FR-41 | Peserta menandai kesalahan yang ditemukan pada bagian formulir (flag) dan memberi alasan | P0 |
| FR-42 | Penilaian otomatis sesuai bagian 9 | P0 |
| FR-43 | Umpan balik setelah submit: kesalahan yang ditemukan, terlewat, dan penjelasan | P0 |
| FR-44 | Instruktur membuat atau mengedit skenario lewat editor berbasis JSON | P2 |

### 6.6 Dashboard dan laporan

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| FR-50 | Dashboard instruktur real-time (SSE): posisi tiap izin, peran peserta, skor sementara | P0 |
| FR-51 | Laporan per peserta dan per kelas; ekspor CSV | P1 |
| FR-52 | Daftar kesalahan yang paling sering terlewat per sesi | P1 |
| FR-53 | Denah lokasi dan konflik pekerjaan simultan (SIMOPS) | P2 |

### 6.7 PDF, QR, dan PWA

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| FR-60 | Cetak PDF izin yang menyerupai FR-HSSE-0317, dengan watermark «SIMULASI — BUKAN IZIN KERJA RESMI» | P0 |
| FR-61 | QR code pada PDF membuka halaman verifikasi status izin | P1 |
| FR-62 | PWA dapat dipasang; pengisian draf berjalan offline dan sinkron saat daring | P1 |
| FR-63 | Seluruh halaman menampilkan label «Alat Pelatihan» | P0 |

## 7. Model Data

Semua tabel memiliki `id`, `tenantId`, `createdAt`, `updatedAt`. Basis data: PostgreSQL.

| Entitas | Atribut penting |
| --- | --- |
| `Tenant` | name, industries\[\], settings (mis. heightThresholdMeters) |
| `User` | email, name, passwordHash, role, tenantId |
| `FormTemplate` | type (PTW, JSA, ADDITIONAL), industry, schemaJson, version |
| `Scenario` | title, industry, description, initialDataJson, seededErrorsJson, templateIds |
| `Session` | scenarioId, instructorId, joinCode, status, startedAt, endedAt |
| `Participant` | sessionId, userId, simulatedRole |
| `Permit` | sessionId, applicantId, status, dataJson, validFrom, validTo, currentVersion |
| `PermitVersion` | permitId, version, dataJson, changedBy |
| `AdditionalPermit` | permitId, type (LOTO, HEIGHT, B3\_EXCAVATION, CONFINED\_SPACE, HOT\_WORK), dataJson, status |
| `JsaRecord` | permitId, dataJson (langkah kerja, bahaya, pengendalian, daftar periksa) |
| `Signature` | permitId, role, userId, imageData, signedAt |
| `Transition` | permitId, fromStatus, toStatus, actorId, comment, at |
| `SupervisionNote` | permitId, authorId, text, at |
| `ErrorFlag` | permitId, participantId, seededErrorId, fieldPath, reason, at |
| `Score` | sessionId, participantId, totalScore, breakdownJson |
| `AuditLog` | actorId, action, entity, entityId, at, metadataJson |

## 8. Spesifikasi Formulir

### 8.1 Formulir PTW (FR-HSSE-0317)

**Informasi umum:** Nama Perusahaan, Departemen Pengguna, Lokasi Kerja, Uraian Kerja, Tanggal/Jam mulai, Tanggal/Jam selesai (selesai harus setelah mulai).

**Daftar periksa (Ya/Tidak, wajib semua):**

1. Pekerja telah terlatih dan berkompeten untuk pekerjaan ini?
2. Pengawas pekerjaan ini telah memiliki pengetahuan/kecakapan yang dibutuhkan untuk mengawasi pekerjaan ini?
3. Apakah pekerjaan ini memiliki Standard Operations Procedure (SOP)?
4. Penilaian Risiko (Job Safety Analysis) telah dilakukan? (Lampirkan)
5. Penilaian Risiko telah mencakup rencana pertolongan darurat?
6. Peralatan kerja dan peralatan keselamatan dalam kondisi layak dan aman digunakan?
7. Pekerjaan ini menggunakan peralatan khusus yang terdaftar (misal: crane, boiler, dll)?
8. Pekerjaan ini telah dikomunikasikan dengan pengawas dan pegawai?

Catatan: formulir kertas melompati nomor 2 dan memakai nomor 3 dua kali; versi digital dinomori ulang 1 sampai 8.

**Izin tambahan (Ya/Tidak + keterangan; «Ya» membuat sub-formulir):** Lock Out Tag Out; Kerja di Ketinggian (> 1,8 m, dapat dikonfigurasi); Penggalian / Bahan Berbahaya Beracun (B3); Memasuki Ruang Terbatas; Kerja Panas.

**Bahaya K3L berisiko tinggi (Ya/Tidak + keterangan):** Api (bahan mudah menyala/terbakar); Percikan bunga api, pemotongan, penggerindaan; Debu/kabut/asap atau bahan kimia berbahaya; Sumber energi (listrik, uap, mekanis); Kerja pada ketinggian/lubang terbuka; Akses, jalan keluar, dan pergerakan terbatas.

**Pernyataan dan tanda tangan:** Penerima Izin menyatakan lokasi kerja telah diperiksa dan semua tindakan pencegahan akan dipatuhi. Pemberi Izin menyatakan prosedur keselamatan telah diperiksa dan izin diberikan. Masing-masing: nama, tanda tangan, tanggal/jam.

### 8.2 Formulir JSA

**Header:** nama pengawas, kontraktor, tanggal, tanda tangan pengawas, lokasi kerja.

**Langkah kerja (dinamis, minimal 1, bawaan 3):** setiap langkah berisi aktivitas, bahaya potensial (pilih kode bahaya + teks), dan prosedur kerja aman yang direkomendasikan (APD, alat).

**Kode bahaya:** A Sengatan listrik; B Jatuh dari ketinggian; C Kerja di atas kepala; D Pengangkatan manual/mekanis; E Material kasar/tajam; F Permukaan licin/tidak rata; G Mesin berputar/bergerak; H Permukaan panas; I Titik jepit; J Partikel terbang; K Lalu lintas kendaraan; L Lalu lintas kereta; M Asap las; N Busur las; O Galian; P Cat timbal; Q Debu silika; R Asbes; S Posisi kerja buruk; T Kebisingan; U Bahan mudah terbakar; V Bahan kimia (tinjau MSDS); W Akses terbatas/ruang terbatas; X Pencahayaan buruk; Y Tekanan panas/dingin; Z Udara bertekanan; AA Gerakan berulang; BB Lainnya.

**Daftar periksa Ya/Tidak (N/Y):**

- Pencegahan kebakaran: selimut api, tirai las, bahan mudah terbakar disingkirkan, APAR sesuai, LEL diukur, petugas pengawas api terlatih.
- APD: pelindung wajah, kacamata, pelindung telinga, sarung tangan khusus bahaya, sepatu boot karet, helm, peralatan proteksi jatuh, pelindung pernapasan, pelindung kaki/metatarsal, shower darurat, eye wash, perlengkapan flash listrik, lainnya.
- Peralatan bertenaga: GFCI, Lock Out/Tag Out, kabel dan alat listrik diperiksa, jalur tegangan tinggi teridentifikasi, pipa panas diberi insulasi sementara, kabel/selang ditinggikan 7 kaki.
- Izin diperlukan: Line Break, Confined Space Entry, lainnya.
- Platform kerja: scaffold, JLG/scissors lift (sertifikat operator), tangga (diperiksa dan diikat), lainnya.
- Penahanan interior: rambu, pintu masuk area disegel, poly 6 kaki, HVAC mati dan disegel, tack pad dan runner.
- Penahanan eksterior: perimeter 30 kaki dan rambu, pintu dan jendela dalam 20 kaki tertutup, poly 10 kaki, alat ditata di area penahanan, dalam 10 kaki dari batas lahan (penahanan vertikal).
- Barikade: kuning (waspada), merah (bahaya), barikade keras.

**Sign-in/sign-out kru:** setiap anggota kru menandatangani masuk («Saya memahami tindakan pencegahan keselamatan dan memiliki pelatihan») dan keluar («Saya bekerja dengan aman hari ini dan TIDAK cedera»).

Label dwibahasa (Indonesia/Inggris); bawaan bahasa Indonesia.

## 9. Skenario dan Penilaian

**Struktur skenario (JSON):** judul, industri, narasi situasi, data awal PTW dan JSA, peran yang dibutuhkan, `seededErrors[]` dengan `id`, `fieldPath`, `description`, `severity` (LOW/MEDIUM/HIGH/CRITICAL), `points`, `explanation`.

**Skenario MVP (ilustratif, divalidasi pakar K3 klien):**

| Industri | Skenario | Kesalahan tersisip (contoh) |
| --- | --- | --- |
| Oil & Gas | Pengelasan di dekat jalur proses | Uji gas (LEL) tidak dicatat; pengawas api tidak ditugaskan; izin kerja panas tidak dilampirkan |
| Pembangkit Listrik | Perawatan panel listrik | Titik isolasi energi tidak lengkap; LOTO belum dilampirkan; kabel tidak diperiksa |
| Pertambangan | Penggalian dekat jalur angkut | Barikade dan pengaturan lalu lintas tidak ada; JSA tidak memuat bahaya galian (kode O) dan lalu lintas (kode K) |

**Komponen skor (bobot dapat dikonfigurasi per tenant):**

| Komponen | Dinilai dari | Bobot awal |
| --- | --- | --- |
| Kelengkapan dokumen | Field wajib dan lampiran terisi benar | 25% |
| Identifikasi bahaya | Kesalahan bahaya yang ditemukan dan dikendalikan | 30% |
| Kepatuhan prosedur | Urutan alur dan peran yang benar | 25% |
| Izin tambahan dan isolasi | Izin tambahan yang tepat dipilih; isolasi energi diperhatikan | 20% |

Penalti: tanda palsu (flag pada bagian yang benar) mengurangi skor. Umpan balik tampil setelah peserta menyelesaikan atau instruktur menutup sesi.

## 10. Kebutuhan Non-Fungsional

| Kategori | Kebutuhan |
| --- | --- |
| Kinerja | LCP < 2,5 detik pada 4G; dukung 50 pengguna bersamaan per sesi |
| Keandalan | Cadangan basis data harian; pemulihan < 4 jam |
| Keamanan | Validasi input di server (Zod); proteksi OWASP Top 10; kata sandi di-hash (argon2 atau bcrypt); rate limiting pada login; cookie sesi aman |
| Privasi | Tanpa data operasional nyata; data peserta minimal (nama, email) |
| Aksesibilitas | WCAG 2.1 AA; kontras tinggi; navigasi keyboard |
| Kompatibilitas | Chrome, Edge, Safari, Firefox versi terbaru; layar mulai 360 px |
| Offline | Draf formulir tersimpan lokal (IndexedDB) dan sinkron saat daring |
| Lokasi data | Dapat dihosting di Indonesia (AWS Jakarta atau penyedia lokal) |
| Jejak audit | Seluruh transisi, tanda tangan, dan perubahan data tercatat |
| Pemeliharaan | Cakupan uji unit untuk state machine dan penilaian ≥ 80% |

## 11. Arsitektur dan Tech Stack

Untuk MVP dipakai satu aplikasi monolit agar cepat dibangun dan mudah dipelihara; pemisahan backend dapat dilakukan setelah beban dan tim berkembang.

| Lapisan | Pilihan |
| --- | --- |
| Framework | Next.js (App Router), React, TypeScript |
| UI | Tailwind CSS, shadcn/ui |
| Formulir | React Hook Form, Zod; signature\_pad untuk tanda tangan |
| State machine | XState (logika dibagi antara klien dan server; server adalah sumber kebenaran) |
| Basis data | PostgreSQL, Prisma ORM |
| Autentikasi | Auth.js dengan RBAC |
| Real-time | Server-Sent Events untuk dashboard |
| PWA | Serwist (service worker), IndexedDB untuk draf offline |
| PDF | Playwright (HTML ke PDF) |
| i18n | next-intl (id, en) |
| Pengujian | Vitest (unit), Playwright (end-to-end) |
| Operasional | Docker, GitHub Actions, Sentry |

Struktur folder yang disarankan: `src/app` (rute), `src/modules/{permit,jsa,session,scoring,scenario}`, `src/lib` (state machine, rbac, pdf), `prisma`, `tests`, `docs`.

## 12. Desain Antarmuka

- Bahasa visual bersih dan fungsional; warna aksen oranye keselamatan, biru tua sebagai warna utama.
- Responsif: laptop (kelas), tablet, dan ponsel.
- Formulir panjang dipecah menjadi langkah (stepper) dengan indikator kelengkapan.
- Status izin selalu terlihat dengan lencana berwarna dan label teks (tidak hanya warna).
- Pergantian peran di mode kelas tidak lebih dari dua ketukan.
- Banner tetap: «Alat Pelatihan — Data Simulasi».

## 13. Konfigurasi per Industri dan Tenant

Template formulir, daftar periksa tambahan, dan perpustakaan skenario dipilih per industri. Pengaturan tenant: nama dan logo, ambang ketinggian, bobot penilaian, bahasa bawaan, durasi berlaku izin bawaan.

## 14. Rencana Rilis dan Kriteria Penerimaan

| Rilis | Isi | Kriteria selesai |
| --- | --- | --- |
| M0 | Kerangka proyek, autentikasi, RBAC, tenant, CI | Login berjalan; pengujian otomatis lulus di CI |
| M1 | State machine, formulir PTW dan JSA, tanda tangan, PDF | Satu izin dapat berjalan dari `DRAFT` sampai `CLOSED` oleh peran berbeda |
| M2 | Sesi, skenario, kesalahan tersisip, penilaian, dashboard | Instruktur menjalankan sesi dengan 3 skenario dan melihat skor |
| M3 | PWA offline, bahasa, QR, laporan | Draf offline tersinkron; laporan dapat diekspor |

**Kriteria penerimaan utama (Given/When/Then):**

- Given izin berstatus `DRAFT` dengan jawaban «Ya» pada Kerja Panas tanpa sub-formulir, when pemohon menekan Ajukan, then sistem menolak dan menunjuk bagian yang kurang.
- Given izin `SUBMITTED`, when pengguna berperan `APPLICANT` mencoba menyetujui, then server menolak dengan kode 403.
- Given skenario dengan kesalahan LEL tidak dicatat, when peserta menandai bagian yang benar dengan alasan, then skor identifikasi bahaya bertambah dan umpan balik muncul.
- Given tenant A dan tenant B, when pengguna tenant A meminta izin milik tenant B, then respons 404 atau 403.
- Given instruktur menekan Reset, then semua izin dan skor sesi kembali ke kondisi awal skenario.
- Given perangkat offline, when pemohon mengisi draf, then draf tersimpan dan tersinkron saat daring tanpa kehilangan data.

## 15. Risiko dan Pertanyaan Terbuka

| Risiko | Mitigasi |
| --- | --- |
| Konten dianggap prosedur resmi | Watermark, banner, validasi pakar K3 |
| Perbedaan formulir antar-klien | Template JSON schema per tenant |
| Jaringan buruk di lokasi pelatihan | PWA offline, mode ruang kelas |
| Konflik state pada sesi bersamaan | Server sebagai sumber kebenaran; pengunci optimistis berdasarkan versi |

**Pertanyaan terbuka:**

1. Ambang ketinggian: 2 m (diagram alir) atau 1,8 m (formulir)? Bawaan sementara 1,8 m, dapat dikonfigurasi.
2. Apakah izin «Penggalian» dan «B3» dipisah menjadi dua izin tambahan?
3. Regulasi K3 yang dirujuk per sektor untuk konten skenario.
4. Bahasa final: Indonesia saja atau dwibahasa.
5. LMS klien dan standar integrasinya (fase 3).
6. Jumlah peserta per sesi dan kondisi jaringan.

## 16. Glosarium

- **PTW:** Permit to Work, izin kerja.
- **JSA:** Job Safety Analysis, analisis keselamatan kerja.
- **LOTO:** Lock Out Tag Out, isolasi dan penguncian sumber energi.
- **LEL:** Lower Explosive Limit, batas bawah ledakan.
- **SIMOPS:** Simultaneous Operations, pekerjaan simultan di area yang sama.
- **B3:** Bahan Berbahaya dan Beracun.
- **PWA:** Progressive Web App.
- **RBAC:** Role-Based Access Control.

## 17. Keputusan Teknis (Decision Log)

Bagian ini mencatat keputusan yang diambil selama pengembangan. Jika ada konflik dengan bagian lain dalam PRD, bagian ini yang berlaku. Agent pengembang wajib membaca bagian ini sebelum memulai milestone berikutnya.

### 17.1 Keputusan Milestone M0 (kerangka proyek)

| ID | Keputusan | Alasan dan catatan |
| --- | --- | --- |
| D-01 | Memakai XState v5. Tabel transisi (const bertipe di `src/lib`) adalah satu-satunya sumber kebenaran; mesin XState dibangun dari tabel itu, dan validasi server memakai tabel yang sama. | Mencegah dua definisi alur yang bisa berbeda antara klien dan server. |
| D-02 | Hash kata sandi memakai `bcryptjs` dengan cost factor 12, dibungkus dalam satu modul `src/lib/password.ts`. | Pure JS, portabel di Windows dan Docker tanpa build native. Modul pembungkus memudahkan pindah ke argon2 nanti. Sesuai bagian 10 (argon2 atau bcrypt). |
| D-03 | `Tenant` adalah tabel root (memakai `id`). Pengguna `SUPER_ADMIN` tetap memiliki `tenantId` non-null, terikat ke tenant sistem saat seed. Akses lintas-tenant hanya lewat helper eksplisit (mis. `withCrossTenantAccess`) yang selalu menulis `AuditLog`. | Tidak ada query tanpa `tenantId`; akses lintas-tenant selalu terlacak. |
| D-04 | Transisi `APPROVED` atau `ACTIVE` ke `EXPIRED` dilakukan oleh aktor khusus `SYSTEM`, bukan peran pengguna. Aktor ini tidak dapat dipicu lewat API atau UI, hanya dari fungsi internal atau job terjadwal. | Pengguna tidak boleh memicu kedaluwarsa secara manual. Pada M0 cukup definisi transisi dan unit test; job terjadwal dibangun kemudian. |
| D-05 | Transisi `SUSPENDED` ke `ACTIVE` (oleh `ISSUER`) mensyaratkan komentar non-kosong minimal 10 karakter dan waktu sekarang masih sebelum `validTo`. Jika `validTo` sudah lewat, izin menjadi `EXPIRED`, bukan `ACTIVE`. Komentar disimpan di tabel `Transition`. | Mencegah izin yang sudah lewat masa berlakunya dihidupkan kembali lewat pemulihan. Memperjelas guard di bagian 5. |
| D-06 | Penamaan berkas: `AGENTS.md` berada di root proyek; PRD berada di `docs/PRD.md`. Semua rujukan di `AGENTS.md` dan README mengarah ke `docs/PRD.md`. | `AGENTS.md` di root adalah berkas yang dibaca agent sebagai aturan tetap. Nama tanpa spasi lebih aman untuk terminal dan CI. |

### 17.2 Keputusan Milestone M1 (formulir, alur, tanda tangan, PDF)

| ID | Keputusan | Alasan dan catatan |
| --- | --- | --- |
| D-10 | Dependensi baru: `signature_pad` dan `playwright` (dependencies); `@playwright/test` tetap di devDependencies. Chromium dipasang di Docker dan CI, dengan langkah instalasi didokumentasikan di README. | Diperlukan untuk tanda tangan digital dan PDF sisi server. |
| D-11 | Template PDF wajib meng-escape semua input pengguna, dan saat render semua permintaan jaringan selain konten milik aplikasi diblokir. | Mencegah injeksi HTML dan SSRF. |
| D-12 | `ISSUER` menyetujui setiap sub-formulir izin tambahan di halaman detail sebelum menerbitkan izin utama (`PENDING_ISSUANCE` ke `APPROVED`). `ISSUER` tidak dapat menyetujui izin tambahan yang field wajibnya belum lengkap. | Sesuai guard bagian 5. |
| D-13 | Data PTW, JSA, dan izin tambahan bersifat read-only setelah `SUBMITTED`; hanya dapat diedit pada `DRAFT` dan `RETURNED`. Saat izin `RETURNED` diedit, izin tambahan yang datanya berubah kembali ke `DRAFT` dan persetujuan sebelumnya dibatalkan. Izin tambahan yang jawabannya diubah menjadi Tidak hanya boleh dihapus jika berstatus `DRAFT`. | Menjaga integritas dokumen yang sedang ditinjau. |
| D-14 | Seed M1: satu `Scenario` minimal (tanpa kesalahan tersisip) dan satu `Session` aktif pada tenant demo, semua peran terwakili oleh peserta seed. Pembuatan `Permit` wajib terikat `sessionId`. | CRUD sesi dan skenario baru dibangun di M2; M1 tetap dapat diuji penuh. |
| D-15 | Satu enum `B3_EXCAVATION` dipertahankan. Pemetaan jawaban formulir ke tipe izin tambahan hanya didefinisikan di satu tempat: `triggersAdditionalPermit` pada schema template. | Klien belum memutuskan apakah izin penggalian dan B3 dipisah (pertanyaan terbuka no. 2); pemisahan nanti cukup perubahan data template. |
| D-16 | Template formulir tanpa field yang di-hardcode. `FormTemplate.schemaJson` mendefinisikan section, field (`text`, `textarea`, `datetime`, `yesno`, `checklist`, `number`), aturan wajib, dan `triggersAdditionalPermit`. UI dan validator server membaca schema yang sama; ambang ketinggian diinterpolasi dari `heightThresholdMeters` per tenant. | Memenuhi FR-24. |
| D-17 | Label pada `schemaJson` dwibahasa dengan bentuk objek `{ id, en }`, bukan string tunggal. | Mendukung FR-05. |
| D-18 | Sinkronisasi izin tambahan otomatis: setiap kali PTW disimpan, server memastikan `AdditionalPermit` bertipe terkait ada untuk jawaban Ya dan menghapus yang masih `DRAFT` jika jawaban menjadi Tidak. | Memenuhi FR-22. |
| D-19 | Versi formulir: pada transisi `RETURNED` ke `SUBMITTED`, snapshot `dataJson` disimpan ke `PermitVersion` dan `currentVersion` bertambah satu. | Memenuhi FR-26. |
| D-20 | Daftar periksa persiapan tempat kerja (guard `APPROVED` ke `ACTIVE`) dan pemeriksaan lokasi pasca-pekerjaan (guard `ACTIVE` ke `COMPLETED`) diimplementasikan sebagai daftar periksa Ya/Tidak berbasis template (FR-35). Item dwibahasa didefinisikan di `FormTemplate.schemaJson.lifecycleChecklists` (`workplacePrep`, `postWorkInspection`). Saat transisi, server memvalidasi payload lewat `validateLifecycleChecklist()` lalu menyimpannya di kolom `Transition.payloadJson` (`Json?`) bersama audit log. | Mencerminkan tahap 3 dan 5 diagram alir. Status: ditutup 17 November 2026 sesuai implementasi. Tidak ada tabel baru; jawaban daftar periksa melekat pada transisi yang dijaganya. |
| D-21 | Notifikasi versi minimal (FR-31): dashboard tiap peran menampilkan jumlah dan daftar izin berstatus Menunggu tindakan Anda. Tabel notifikasi terpisah belum dibuat. | Cukup untuk MVP. |
| D-22 | Optimistic locking pada `transitionPermit` dan `updatePermitDraft`. Konflik versi mengembalikan HTTP 409 dengan pesan jelas. | Mengatasi risiko konflik state pada aksi bersamaan (bagian 15). |
| D-23 | Semua pengecekan hak akses permit melewati satu fungsi `getEffectiveRole(user, session)`. Di M1 fungsi ini mengembalikan `User.role`; di M2 diganti ke `Participant.simulatedRole`. | PRD mendefinisikan peran per sesi; mencegah pembongkaran kode saat M2. |
| D-24 | Waktu disimpan dalam UTC dan ditampilkan pada zona waktu tenant (`settings.timezone`, bawaan Asia/Jakarta). Waktu selesai harus setelah waktu mulai; `validFrom` dan `validTo` diambil dari kedua field itu. | Konsistensi lintas perangkat dan zona waktu. |
| D-25 | Tanda tangan: hanya data URL PNG dengan batas ukuran 200 KB; hanya pengguna dengan peran yang sesuai yang dapat menandatangani untuk perannya. | Validasi ketat di server. |

### 17.3 Pengujian wajib M1

- Unit test validator Zod dinamis dari JSON schema, termasuk interpolasi ambang ketinggian.
- Unit test guard transisi dan isolasi tenant.
- Negatif RBAC: `APPLICANT` mencoba menyetujui dan `SUPERVISOR` mencoba menerbitkan, hasilnya 403.
- Isolasi tenant pada semua route permit: tenant A meminta izin tenant B, hasilnya 404 atau 403.
- Konflik versi menghasilkan 409; PATCH data PTW setelah `SUBMITTED` ditolak.
- E2E siklus penuh `DRAFT` sampai `CLOSED` oleh peran berbeda, mencakup JSA, izin tambahan otomatis, tanda tangan digital, dua daftar periksa FR-35, dan bukti PDF (respons `application/pdf`, ukuran lebih dari 0, teks watermark ada).

### 17.4 Dampak pada bagian lain PRD

| Bagian | Dampak |
| --- | --- |
| 5 (State Machine) | Guard `SUSPENDED` ke `ACTIVE` mengikuti D-05; pelaku `EXPIRED` adalah aktor `SYSTEM` (D-04). |
| 6.4 (FR-31, FR-35) | Cakupan MVP mengikuti D-20 (ditutup) dan D-21. |
| 10 (Keamanan) | Hash kata sandi: bcrypt (D-02); keamanan PDF mengikuti D-11. |
| 11 (Arsitektur) | Backend berupa satu aplikasi Next.js (monolit) untuk MVP; XState mengikuti D-01. |
| 15 (Pertanyaan terbuka) | No. 1 (ambang ketinggian) tetap terbuka dengan bawaan 1,8 m; no. 2 (pemisahan izin B3 dan penggalian) tetap terbuka, dengan dampak minimal berkat D-15. |

Keputusan baru dari M2 dan seterusnya ditambahkan sebagai bagian 17.5 dan seterusnya dengan penomoran ID yang berlanjut.

### 17.5 Keputusan Milestone M2 (sesi, skenario, penilaian, dashboard)

Disetujui pemilik produk pada 17 November 2026. D-36 dan D-39 mencatat implementasi M2 yang sudah berjalan. Keduanya masih menunggu review pakar K3 dan perbaikan temuan di D-45.

| ID | Keputusan | Alasan dan catatan |
| --- | --- | --- |
| D-30 | Skor sementara hanya tampil di dashboard instruktur (SSE). Peserta tidak melihat skor selama berlatih. | Mencegah peserta menebak-nebak berdasarkan perubahan skor. |
| D-31 | Selama berlatih, peserta tidak melihat skor maupun benar/salah per flag. Umpan balik (ditemukan, terlewat, penjelasan) terbuka hanya setelah (a) peserta menekan «Selesaikan Latihan», atau (b) `Session` berstatus `COMPLETED`. Status izin `SUBMITTED` atau `CLOSED` tidak dipakai sebagai pemicu. | Izin bisa `RETURNED` lalu diajukan ulang, sehingga pemicu berbasis status izin membocorkan kunci jawaban. Menggantikan frasa «setelah submit» pada FR-43. |
| D-32 | Instruktur read-only di halaman izin. FR-12 (ambil alih peran) tetap P1, dikerjakan paling akhir, dan tidak menahan M2. Jika dikerjakan: berlaku per sesi, dan setiap aksi mencatat `actorId` instruktur serta `actingRole` di `Transition` dan `AuditLog`. | Menjaga jejak audit tetap jujur saat instruktur bertindak atas nama peran lain. |
| D-33 | `scoringWeights` disimpan di `Tenant.settings`, divalidasi Zod: tepat 4 bobot (komponen bagian 9), jumlah 100. | Memenuhi bagian 13 tanpa tabel baru. |
| D-34 | Kolom nullable `Participant.finalizedAt` ditambahkan lewat migrasi additive. Penanda finalize tidak disimpan di JSON. Setelah finalize, flag peserta terkunci. | Penanda ini dipakai untuk otorisasi umpan balik (D-31), jadi harus berupa kolom yang dapat di-query dan diaudit. |
| D-35 | `seededErrorsJson` dan `explanation` hanya keluar ke `INSTRUCTOR` sesi terkait, `TENANT_ADMIN`, dan `SUPER_ADMIN`. Peserta tidak menerimanya lewat API, SSE, export, HTML, maupun bundle JS halaman peserta. `GET /api/scenarios` hanya untuk peran pengelola; stream dan export hanya untuk instruktur sesi itu. | Kunci jawaban yang bocor membuat penilaian tidak bermakna. |
| D-36 | Skema `seededErrors` (bagian 9) ditambah `component` (`COMPLETENESS` \| `HAZARD_IDENTIFICATION` \| `PROCEDURE` \| `ADDITIONAL_PERMIT_ISOLATION`), `relevantRoles[]`, `acceptedFieldPaths[]`, dan `fixRule?`. Kecocokan flag ditentukan oleh `fieldPath`; `reason` tidak dinilai otomatis dan hanya disimpan untuk debrief. Implementasi final (`computeParticipantScore()` di `src/modules/scoring/service.ts` setelah perbaikan D-45): (1) Transisi peserta diidentifikasi dari `Transition.actorId`, sehingga tukar peran tidak mengubah skor riwayat dan aksi tiap peran historis tetap dinilai. (2) Komponen tanpa `seededError` relevan (dan bukan komponen wajib peran) dikeluarkan dari perhitungan, dan bobot komponen aktif dinormalisasi ulang; jika semua komponen kosong, `totalScore = 0`. (3) `COORDINATOR` dinilai pada `PROCEDURE` dari `SupervisionNote` (`authorId`) yang dibuat selama rentang izin berstatus `ACTIVE` (`>= 1` catatan = 100, `0` = 0). (4) `SUPERVISOR` (`SUBMITTED -> PENDING_ISSUANCE`) dan `ISSUER` (`PENDING_ISSUANCE -> APPROVED`) dikenai penalti `-30` per error `CRITICAL` yang **belum diperbaiki** pada data aktual `Permit`/`AdditionalPermit`/`JsaRecord` saat transisi terjadi (disimpan sebagai `unfixedCriticalErrorIds` di `Transition.payloadJson`). (5) Tanda palsu (`fpPenalty = 10 × jumlah`) mengurangi komponen sesuai bobot penalti; setiap komponen berlantai 0 dan skor total 0–100. | Izin dipakai bersama beberapa peran, sehingga penilaian per peserta perlu aturan eksplisit. Status: selesai diperbarui sesuai D-45; menunggu review akhir pakar K3. |
| D-37 | `initialDataJson` memakai offset waktu relatif (mis. mulai = saat sesi dibuat, selesai = +8 jam), yang dihitung menjadi waktu absolut saat `createSession` dan `resetSession`. | Tanggal tetap akan membuat guard `APPROVED` ke `ACTIVE` gagal. |
| D-38 | `POST /api/sessions/join`: `joinCode` acak 6–8 karakter tanpa karakter ambigu, unik, dan diberi rate limit. Hanya untuk pengguna dari tenant yang sama, dan tidak berlaku setelah sesi ditutup. | Melengkapi FR-10 (kode gabung). |
| D-39 | Melanjutkan D-23: `getEffectiveRole` mengambil sesi dari `permit.sessionId`, lalu membaca `Participant.simulatedRole`. Bukan peserta sesi itu: 403. Instruktur sesi itu: read-only. Seed dan tes M1 disesuaikan, dan e2e M1 tetap hijau. Tukar peran (`swapParticipantRole()` di `src/modules/session/service.ts`): hanya **`INSTRUCTOR` pemilik sesi** (bukan `TENANT_ADMIN`, per D-47). Dalam satu transaksi: `Participant.simulatedRole` diperbarui; jika peran baru `APPLICANT`, hanya `Permit` milik pemohon sebelumnya (`applicantId === previousApplicantUserId`) yang dipindahkan ke pengguna baru sambil menaikkan `Permit.currentVersion + 1` (memicu 409 pada klien lama); `AuditLog` mencatat `SWAP_PARTICIPANT_ROLE` dengan `{ fromRole, toRole, changedPermitIds }`. Setelah itu skor sesi dihitung ulang tanpa mengubah skor aksi historis (`Transition.actorId`). | Peran ditentukan per sesi (bagian 3). Status: selesai diperbarui sesuai D-45 dan D-47. |
| D-40 | Reset sesi (FR-13) berjalan dalam satu transaksi. `Participant` dan penugasan peran dipertahankan, dan versi sesi dinaikkan sehingga klien lama menerima 409 yang jelas lalu memuat ulang. UI meminta konfirmasi eksplisit. Hanya instruktur sesi itu yang boleh menjalankannya. | Reset bersifat destruktif dan dapat terjadi saat peserta masih mengedit. |
| D-41 | Flag (FR-41): `fieldPath` divalidasi terhadap template dan path yang tidak dikenal ditolak; `reason` minimal 10 karakter; maksimal 50 flag per izin; flag terkunci setelah finalize. | Mencegah data sampah dan flag massal untuk menebak. |
| D-42 | Ekspor CSV: sel yang diawali `=`, `+`, `-`, `@`, tab, atau CR diberi awalan apostrof; file memakai UTF-8 dengan BOM. | Teks `reason` berasal dari peserta (CSV injection); BOM agar terbaca benar di Excel. |
| D-43 | SSE dashboard (FR-50): autentikasi lewat cookie sesi, disertai cek tenant dan instruktur sesi; interval 3–5 detik; yang dikirim hanya ringkasan perubahan; tersedia fallback polling. | Ringan untuk 50 pengguna per sesi (bagian 10) dan tetap jalan di jaringan yang memblokir stream. |
| D-44 | Skenario dan template diberi penanda data CONTOH ILUSTRATIF yang wajib divalidasi pakar K3. Tes konsistensi: setiap `fieldPath` pada `seededErrors` (termasuk `acceptedFieldPaths`) ada di template schema skenario itu, dan tiap skenario memuat kesalahan sesuai bagian 9. | Mitigasi risiko «konten dianggap prosedur resmi» (bagian 15). |
| D-45 | Temuan review atas D-36 dan D-39 yang wajib diperbaiki: (1) Kepatuhan prosedur dihitung per peserta dari `Transition.actorId`, bukan dicocokkan dengan peran peserta saat ini, sehingga tukar peran tidak mengubah skor riwayat. (2) Komponen tanpa error yang relevan bagi peran peserta tidak diberi nilai gratis. Komponen itu dikeluarkan dari perhitungan, dan bobot sisanya dinormalisasi ulang. (3) Peran yang memang tidak melakukan transisi (`COORDINATOR`) dinilai dari `SupervisionNote`, bukan otomatis 0. (4) Penalti persetujuan berlaku untuk error `CRITICAL` yang belum diperbaiki di data izin, bukan sekadar belum di-flag. Menyetujui error yang sudah di-flag tetapi belum diperbaiki justru dikenai penalti. (5) Tukar peran ke `APPLICANT` hanya memindahkan `applicantId` dari izin milik pemohon sebelumnya, dan menaikkan versi izin terkait sehingga klien lama menerima 409. (6) Tes unit untuk semua kasus di atas. | Hasil review 17 November 2026. **Status: selesai** (diimplementasikan & teruji pada unit test cakupan > 90% di `src/modules/scoring/service.ts`). Butir 2–4 tetap terbuka untuk konfirmasi akhir pakar K3. |
| D-46 | Flag yang cocok dengan `seededError` tetapi tidak relevan bagi peran peserta (`relevantRoles`) diabaikan: bukan tanda palsu dan tidak menambah poin komponen. | Adil bagi peserta yang jeli menemukan kesalahan lintas peran tanpa memberi poin di luar cakupan perannya. |
| D-47 | Hanya `INSTRUCTOR` pemilik sesi yang boleh menukar peran peserta (`swapParticipantRole`); `TENANT_ADMIN` ditolak dengan `403`. Memperjelas D-39. | Pemisahan tugas (*separation of duties*): instruktur mengelola jalannya sesi, `TENANT_ADMIN` mengelola pengguna & pengaturan tenant. |

### 17.6 Pengujian wajib M2

- Negatif: peserta memanggil `/api/scenarios`, stream, dan export, hasilnya 403 atau respons tanpa `seededErrors`.
- Umpan balik tidak tampil sebelum finalize dan tampil sesudahnya.
- Skor: bobot kustom, penalti tanda palsu, lantai 0, dan finalize mengunci flag.
- Reset mengembalikan kondisi awal skenario, mempertahankan peserta, dan memicu 409 pada klien berversi lama.
- Isolasi tenant untuk semua rute sesi, termasuk join.
- CSV injection.
- Konsistensi `fieldPath` skenario terhadap template (D-44).
- Seluruh e2e M1 tetap hijau.
- Kriteria selesai (bagian 14): instruktur menjalankan sesi dengan 3 skenario dan melihat skor per peserta; lint, typecheck, unit, dan e2e hijau di CI.

### 17.7 Dampak M2 pada bagian lain PRD

| Bagian | Dampak |
| --- | --- |
| 6.2 (FR-10, FR-12, FR-13) | Kode gabung mengikuti D-38; FR-12 mengikuti D-32; reset mengikuti D-40. |
| 6.5 (FR-41, FR-43) | Flag mengikuti D-41. Frasa «setelah submit» pada FR-43 diganti oleh D-31. |
| 6.6 (FR-50, FR-51) | SSE mengikuti D-43; skor sementara hanya untuk instruktur (D-30); CSV mengikuti D-42. |
| 7 (Model Data) | `Participant` mendapat `finalizedAt` (D-34). `Tenant.settings` memuat `scoringWeights` (D-33). |
| 9 (Skenario dan Penilaian) | Struktur `seededErrors` ditambah sesuai D-36; data awal memakai waktu relatif (D-37); «umpan balik setelah peserta menyelesaikan» berarti finalize (D-31). |
| 13 (Konfigurasi) | Bobot penilaian per tenant disimpan sesuai D-33. |
| 6.4 (FR-35) | Penyimpanan daftar periksa mengikuti D-20 (ditutup). |
| 7 (Model Data) | `Transition` mendapat `actorRole` dan `payloadJson` (D-20). |
