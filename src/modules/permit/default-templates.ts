import type {
  AdditionalPermitTemplateSchema,
  PtwTemplateSchema,
} from '@/modules/permit/template-schema';

/**
 * Default PTW FormTemplate JSON schema matching PRD Section 8.1 (FR-HSSE-0317)
 * plus FR-35 lifecycle checklists (workplacePrep & postWorkInspection).
 * All labels are bilingual ({ id, en }).
 */
export const DEFAULT_PTW_TEMPLATE_SCHEMA: PtwTemplateSchema = {
  sections: [
    {
      key: 'generalInfo',
      title: { id: 'Informasi Umum', en: 'General Information' },
      fields: [
        {
          key: 'companyName',
          label: { id: 'Nama Perusahaan', en: 'Company Name' },
          type: 'text',
          required: true,
        },
        {
          key: 'userDepartment',
          label: { id: 'Departemen Pengguna', en: 'User Department' },
          type: 'text',
          required: true,
        },
        {
          key: 'workLocation',
          label: { id: 'Lokasi Kerja', en: 'Work Location' },
          type: 'text',
          required: true,
        },
        {
          key: 'workDescription',
          label: { id: 'Uraian Kerja', en: 'Work Description' },
          type: 'textarea',
          required: true,
        },
        {
          key: 'validFrom',
          label: { id: 'Tanggal / Jam Mulai', en: 'Start Date / Time' },
          type: 'datetime',
          required: true,
        },
        {
          key: 'validTo',
          label: { id: 'Tanggal / Jam Selesai', en: 'End Date / Time' },
          type: 'datetime',
          required: true,
        },
      ],
    },
    {
      key: 'safetyChecklist',
      title: { id: 'Daftar Periksa Keselamatan (1–8)', en: 'Safety Checklist (1–8)' },
      fields: [
        {
          key: 'chk_1_trained_workers',
          label: {
            id: '1. Pekerja telah terlatih dan berkompeten untuk pekerjaan ini?',
            en: '1. Are workers trained and competent for this job?',
          },
          type: 'yesno',
          required: true,
        },
        {
          key: 'chk_2_competent_supervisor',
          label: {
            id: '2. Pengawas pekerjaan ini telah memiliki pengetahuan/kecakapan yang dibutuhkan untuk mengawasi pekerjaan ini?',
            en: '2. Does the work supervisor possess the required knowledge/competence to supervise this job?',
          },
          type: 'yesno',
          required: true,
        },
        {
          key: 'chk_3_has_sop',
          label: {
            id: '3. Apakah pekerjaan ini memiliki Standard Operations Procedure (SOP)?',
            en: '3. Does this work have a Standard Operating Procedure (SOP)?',
          },
          type: 'yesno',
          required: true,
        },
        {
          key: 'chk_4_jsa_attached',
          label: {
            id: '4. Penilaian Risiko (Job Safety Analysis) telah dilakukan? (Lampirkan)',
            en: '4. Has a Risk Assessment (Job Safety Analysis) been conducted? (Attach)',
          },
          type: 'yesno',
          required: true,
        },
        {
          key: 'chk_5_emergency_plan',
          label: {
            id: '5. Penilaian Risiko telah mencakup rencana pertolongan darurat?',
            en: '5. Does the Risk Assessment include an emergency response plan?',
          },
          type: 'yesno',
          required: true,
        },
        {
          key: 'chk_6_equipment_safe',
          label: {
            id: '6. Peralatan kerja dan peralatan keselamatan dalam kondisi layak dan aman digunakan?',
            en: '6. Are work tools and safety equipment in serviceable and safe condition?',
          },
          type: 'yesno',
          required: true,
        },
        {
          key: 'chk_7_registered_special_equipment',
          label: {
            id: '7. Pekerjaan ini menggunakan peralatan khusus yang terdaftar (misal: crane, boiler, dll)?',
            en: '7. Does this work use registered special equipment (e.g. crane, boiler, etc.)?',
          },
          type: 'yesno',
          required: true,
        },
        {
          key: 'chk_8_communicated',
          label: {
            id: '8. Pekerjaan ini telah dikomunikasikan dengan pengawas dan pegawai?',
            en: '8. Has this work been communicated with supervisors and personnel?',
          },
          type: 'yesno',
          required: true,
        },
      ],
    },
    {
      key: 'additionalPermits',
      title: { id: 'Izin Tambahan Diperlukan', en: 'Additional Permits Required' },
      fields: [
        {
          key: 'add_loto',
          label: { id: 'Lock Out Tag Out (LOTO)', en: 'Lock Out Tag Out (LOTO)' },
          type: 'yesno',
          required: true,
          triggersAdditionalPermit: 'LOTO',
          requireNotesOnYes: true,
        },
        {
          key: 'add_height',
          label: {
            id: 'Kerja di Ketinggian (> {{heightThresholdMeters}} m)',
            en: 'Work at Height (> {{heightThresholdMeters}} m)',
          },
          type: 'yesno',
          required: true,
          triggersAdditionalPermit: 'HEIGHT',
          requireNotesOnYes: true,
        },
        {
          key: 'add_b3_excavation',
          label: {
            id: 'Penggalian / Bahan Berbahaya Beracun (B3)',
            en: 'Excavation / Hazardous & Toxic Materials (B3)',
          },
          type: 'yesno',
          required: true,
          triggersAdditionalPermit: 'B3_EXCAVATION',
          requireNotesOnYes: true,
        },
        {
          key: 'add_confined_space',
          label: { id: 'Memasuki Ruang Terbatas', en: 'Confined Space Entry' },
          type: 'yesno',
          required: true,
          triggersAdditionalPermit: 'CONFINED_SPACE',
          requireNotesOnYes: true,
        },
        {
          key: 'add_hot_work',
          label: { id: 'Kerja Panas', en: 'Hot Work' },
          type: 'yesno',
          required: true,
          triggersAdditionalPermit: 'HOT_WORK',
          requireNotesOnYes: true,
        },
      ],
    },
    {
      key: 'highRiskHazards',
      title: { id: 'Bahaya K3L Berisiko Tinggi', en: 'High-Risk HSE Hazards' },
      fields: [
        {
          key: 'haz_fire',
          label: {
            id: 'Api (bahan mudah menyala/terbakar)',
            en: 'Fire (flammable/combustible materials)',
          },
          type: 'yesno',
          required: true,
          requireNotesOnYes: true,
        },
        {
          key: 'haz_sparks',
          label: {
            id: 'Percikan bunga api, pemotongan, penggerindaan',
            en: 'Sparks, cutting, grinding',
          },
          type: 'yesno',
          required: true,
          requireNotesOnYes: true,
        },
        {
          key: 'haz_dust_chemical',
          label: {
            id: 'Debu/kabut/asap atau bahan kimia berbahaya',
            en: 'Dust/mist/fumes or hazardous chemicals',
          },
          type: 'yesno',
          required: true,
          requireNotesOnYes: true,
        },
        {
          key: 'haz_energy',
          label: {
            id: 'Sumber energi (listrik, uap, mekanis)',
            en: 'Energy sources (electrical, steam, mechanical)',
          },
          type: 'yesno',
          required: true,
          requireNotesOnYes: true,
        },
        {
          key: 'haz_height_opening',
          label: {
            id: 'Kerja pada ketinggian / lubang terbuka',
            en: 'Work at height / open holes',
          },
          type: 'yesno',
          required: true,
          requireNotesOnYes: true,
        },
        {
          key: 'haz_restricted_access',
          label: {
            id: 'Akses, jalan keluar, dan pergerakan terbatas',
            en: 'Restricted access, egress, and movement',
          },
          type: 'yesno',
          required: true,
          requireNotesOnYes: true,
        },
      ],
    },
  ],
  lifecycleChecklists: {
    workplacePrep: [
      {
        key: 'prep_area_cleared',
        label: {
          id: 'Area kerja telah diamankan, dibersihkan, dan diberi barikade/rambu sesuai rencana?',
          en: 'Has the work area been secured, cleared, and barricaded/signed per plan?',
        },
        type: 'yesno',
        required: true,
      },
      {
        key: 'prep_toolbox_meeting',
        label: {
          id: 'Toolbox meeting / pengarahan keselamatan sebelum kerja telah dilaksanakan?',
          en: 'Has the pre-work toolbox safety briefing been conducted?',
        },
        type: 'yesno',
        required: true,
      },
      {
        key: 'prep_ppe_verified',
        label: {
          id: 'Seluruh APD dan peralatan keselamatan di lokasi telah diperiksa dan siap?',
          en: 'Are all PPE and on-site safety equipment inspected and ready?',
        },
        type: 'yesno',
        required: true,
      },
    ],
    postWorkInspection: [
      {
        key: 'post_housekeeping',
        label: {
          id: 'Area kerja telah dibersihkan dan dirapikan (housekeeping) pasca-pekerjaan?',
          en: 'Has the work area been cleaned and tidied (housekeeping) post-work?',
        },
        type: 'yesno',
        required: true,
      },
      {
        key: 'post_equipment_safe',
        label: {
          id: 'Peralatan telah dimatikan/diamankan dan tidak ada potensi bahaya tersisa?',
          en: 'Have tools/equipment been shut down/secured with no remaining hazards?',
        },
        type: 'yesno',
        required: true,
      },
      {
        key: 'post_crew_signed_out',
        label: {
          id: 'Seluruh anggota kru telah melakukan sign-out dan dinyatakan aman tanpa cedera?',
          en: 'Have all crew members signed out and been confirmed safe without injury?',
        },
        type: 'yesno',
        required: true,
      },
    ],
  },
};

export const DEFAULT_ADDITIONAL_PERMIT_TEMPLATES: AdditionalPermitTemplateSchema[] = [
  {
    type: 'LOTO',
    title: { id: 'Izin Tambahan: Lock Out Tag Out (LOTO)', en: 'Additional Permit: Lock Out Tag Out (LOTO)' },
    fields: [
      {
        key: 'isolationPoints',
        label: { id: 'Titik Isolasi Energi', en: 'Energy Isolation Points' },
        type: 'textarea',
        required: true,
      },
      {
        key: 'lockNumbers',
        label: { id: 'Nomor Gembok & Tag LOTO', en: 'LOTO Lock & Tag Numbers' },
        type: 'text',
        required: true,
      },
      {
        key: 'zeroEnergyVerified',
        label: { id: 'Verifikasi Zero Energy (Try-Out) dilakukan?', en: 'Zero Energy Verification (Try-Out) performed?' },
        type: 'yesno',
        required: true,
      },
    ],
  },
  {
    type: 'HEIGHT',
    title: {
      id: 'Izin Tambahan: Kerja di Ketinggian (> {{heightThresholdMeters}} m)',
      en: 'Additional Permit: Work at Height (> {{heightThresholdMeters}} m)',
    },
    fields: [
      {
        key: 'estimatedHeightMeters',
        label: { id: 'Perkiraan Ketinggian Kerja (meter)', en: 'Estimated Working Height (meters)' },
        type: 'number',
        required: true,
      },
      {
        key: 'fallProtectionSystem',
        label: { id: 'Sistem Proteksi Jatuh (Full Body Harness / Lifeline)', en: 'Fall Protection System (Full Body Harness / Lifeline)' },
        type: 'text',
        required: true,
      },
      {
        key: 'scaffoldOrPlatformInspected',
        label: { id: 'Perancah / platform kerja telah diperiksa dan diberi tag hijau?', en: 'Scaffold / work platform inspected and green-tagged?' },
        type: 'yesno',
        required: true,
      },
    ],
  },
  {
    type: 'B3_EXCAVATION',
    title: {
      id: 'Izin Tambahan: Penggalian / B3',
      en: 'Additional Permit: Excavation / Hazardous Materials (B3)',
    },
    fields: [
      {
        key: 'excavationDepthOrB3Type',
        label: { id: 'Kedalaman Galian / Jenis Bahan B3', en: 'Excavation Depth / B3 Material Type' },
        type: 'text',
        required: true,
      },
      {
        key: 'undergroundUtilitiesChecked',
        label: { id: 'Utilitas bawah tanah / MSDS telah diperiksa?', en: 'Underground utilities / MSDS verified?' },
        type: 'yesno',
        required: true,
      },
      {
        key: 'shoringOrContainmentPlan',
        label: { id: 'Rencana Penyangga / Penahanan Tumpahan', en: 'Shoring / Spill Containment Plan' },
        type: 'textarea',
        required: true,
      },
    ],
  },
  {
    type: 'CONFINED_SPACE',
    title: { id: 'Izin Tambahan: Memasuki Ruang Terbatas', en: 'Additional Permit: Confined Space Entry' },
    fields: [
      {
        key: 'spaceIdentifier',
        label: { id: 'Identitas Ruang Terbatas', en: 'Confined Space Identifier' },
        type: 'text',
        required: true,
      },
      {
        key: 'oxygenPercent',
        label: { id: 'Kadar Oksigen (%)', en: 'Oxygen Level (%)' },
        type: 'number',
        required: true,
      },
      {
        key: 'standbyPersonAssigned',
        label: { id: 'Petugas jaga (standby person) & komunikasi siap?', en: 'Standby person & communication ready?' },
        type: 'yesno',
        required: true,
      },
    ],
  },
  {
    type: 'HOT_WORK',
    title: { id: 'Izin Tambahan: Kerja Panas', en: 'Additional Permit: Hot Work' },
    fields: [
      {
        key: 'hotWorkMethod',
        label: { id: 'Metode Kerja Panas (Las / Gerinda / Potong)', en: 'Hot Work Method (Welding / Grinding / Cutting)' },
        type: 'text',
        required: true,
      },
      {
        key: 'lelReadingPercent',
        label: { id: 'Hasil Uji Gas LEL (%)', en: 'LEL Gas Test Reading (%)' },
        type: 'number',
        required: true,
      },
      {
        key: 'fireWatcherAssigned',
        label: { id: 'Pengawas Api (Fire Watcher) & APAR tersedia di lokasi?', en: 'Fire Watcher & fire extinguisher available on site?' },
        type: 'yesno',
        required: true,
      },
    ],
  },
];

export const DEFAULT_JSA_TEMPLATE_SCHEMA = {
  hazardCodes: [
    { code: 'A', label: { id: 'Sengatan listrik', en: 'Electrical shock' } },
    { code: 'B', label: { id: 'Jatuh dari ketinggian', en: 'Fall from height' } },
    { code: 'C', label: { id: 'Kerja di atas kepala', en: 'Overhead work' } },
    { code: 'D', label: { id: 'Pengangkatan manual/mekanis', en: 'Manual/mechanical lifting' } },
    { code: 'E', label: { id: 'Material kasar/tajam', en: 'Rough/sharp materials' } },
    { code: 'F', label: { id: 'Permukaan licin/tidak rata', en: 'Slippery/uneven surface' } },
    { code: 'G', label: { id: 'Mesin berputar/bergerak', en: 'Rotating/moving machinery' } },
    { code: 'H', label: { id: 'Permukaan panas', en: 'Hot surfaces' } },
    { code: 'I', label: { id: 'Titik jepit', en: 'Pinch points' } },
    { code: 'J', label: { id: 'Partikel terbang', en: 'Flying particles' } },
    { code: 'K', label: { id: 'Lalu lintas kendaraan', en: 'Vehicle traffic' } },
    { code: 'L', label: { id: 'Lalu lintas kereta', en: 'Rail traffic' } },
    { code: 'M', label: { id: 'Asap las', en: 'Welding fumes' } },
    { code: 'N', label: { id: 'Busur las', en: 'Welding arc' } },
    { code: 'O', label: { id: 'Galian', en: 'Excavation' } },
    { code: 'P', label: { id: 'Cat timbal', en: 'Lead paint' } },
    { code: 'Q', label: { id: 'Debu silika', en: 'Silica dust' } },
    { code: 'R', label: { id: 'Asbes', en: 'Asbestos' } },
    { code: 'S', label: { id: 'Posisi kerja buruk', en: 'Awkward posture' } },
    { code: 'T', label: { id: 'Kebisingan', en: 'Noise' } },
    { code: 'U', label: { id: 'Bahan mudah terbakar', en: 'Flammable materials' } },
    { code: 'V', label: { id: 'Bahan kimia (tinjau MSDS)', en: 'Chemicals (review MSDS)' } },
    { code: 'W', label: { id: 'Akses terbatas/ruang terbatas', en: 'Restricted/confined space' } },
    { code: 'X', label: { id: 'Pencahayaan buruk', en: 'Poor lighting' } },
    { code: 'Y', label: { id: 'Tekanan panas/dingin', en: 'Heat/cold stress' } },
    { code: 'Z', label: { id: 'Udara bertekanan', en: 'Compressed air' } },
    { code: 'AA', label: { id: 'Gerakan berulang', en: 'Repetitive motion' } },
    { code: 'BB', label: { id: 'Lainnya', en: 'Other' } },
  ],
};
