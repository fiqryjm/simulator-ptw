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
