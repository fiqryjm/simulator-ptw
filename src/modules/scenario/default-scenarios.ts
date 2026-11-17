import { Industry, Role } from '@prisma/client';
import { z } from 'zod';

export const scoringComponentSchema = z.enum([
  'COMPLETENESS',
  'HAZARD_IDENTIFICATION',
  'PROCEDURE',
  'ADDITIONAL_PERMIT_ISOLATION',
]);

export type ScoringComponent = z.infer<typeof scoringComponentSchema>;

export const seededErrorSchema = z.object({
  id: z.string().min(1),
  fieldPath: z.string().min(1),
  acceptedFieldPaths: z.array(z.string().min(1)).min(1),
  component: scoringComponentSchema,
  relevantRoles: z.array(z.nativeEnum(Role)).min(1),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  points: z.number().positive(),
  description: z.string().min(1),
  explanation: z.string().min(1),
});

export type SeededError = z.infer<typeof seededErrorSchema>;

export const scenarioInitialDataSchema = z.object({
  isIllustrativeExample: z.boolean().default(true),
  validationNotice: z
    .string()
    .default('CONTOH ILUSTRATIF — WAJIB DIVALIDASI PAKAR K3 SEBELUM PELATIHAN RESMI'),
  validFromOffsetMinutes: z.number().default(0),
  validToOffsetMinutes: z.number().default(480),
  ptwData: z.record(z.unknown()).default({}),
  jsaData: z.record(z.unknown()).optional(),
});

export type ScenarioInitialData = z.infer<typeof scenarioInitialDataSchema>;

export interface DefaultScenarioDefinition {
  title: string;
  industry: Industry;
  description: string;
  initialData: ScenarioInitialData;
  seededErrors: SeededError[];
}

export const DEFAULT_MVP_SCENARIOS: DefaultScenarioDefinition[] = [
  {
    title: 'Pengelasan di Dekat Jalur Proses (Oil & Gas)',
    industry: Industry.OIL_AND_GAS,
    description:
      'CONTOH ILUSTRATIF (validasi pakar K3): Pekerjaan pengelasan penyangga pipa di area fasilitas pemrosesan hidrokarbon.',
    initialData: {
      isIllustrativeExample: true,
      validationNotice: 'CONTOH ILUSTRATIF — WAJIB DIVALIDASI PAKAR K3 SEBELUM PELATIHAN RESMI',
      validFromOffsetMinutes: -15,
      validToOffsetMinutes: 480,
      ptwData: {
        companyName: 'PT Kontraktor Migas Simulasi',
        userDepartment: 'Pemeliharaan Proses',
        workLocation: 'Area Separator V-201',
        workDescription: 'Pengelasan braket penyangga pipa di dekat jalur proses aktif',
        chk_1_trained_workers: 'YES',
        chk_2_competent_supervisor: 'YES',
        chk_3_has_sop: 'YES',
        chk_4_jsa_attached: 'YES',
        chk_5_emergency_plan: 'YES',
        chk_6_equipment_safe: 'YES',
        chk_7_registered_special_equipment: 'NO',
        chk_8_communicated: 'YES',
        add_loto: 'NO',
        add_height: 'NO',
        add_b3_excavation: 'NO',
        add_confined_space: 'NO',
        add_hot_work: 'NO',
        haz_fire: 'YES',
        haz_fire_notes: 'Terdapat jalur hidrokarbon di sekitar lokasi',
        haz_sparks: 'YES',
        haz_sparks_notes: 'Aktivitas pengelasan menghasilkan percikan api',
        haz_dust_chemical: 'NO',
        haz_energy: 'NO',
        haz_height_opening: 'NO',
        haz_restricted_access: 'NO',
      },
      jsaData: {
        supervisorName: 'Sari Pengawas',
        contractorName: 'PT Kontraktor Migas Simulasi',
        date: '2026-11-17',
        workLocation: 'Area Separator V-201',
        steps: [
          {
            activity: 'Pengelasan braket pipa penyangga',
            hazardCode: 'N',
            hazardDescription: 'Busur & percikan api las dekat jalur proses',
            controlMeasure: 'Gunakan APD las standar',
          },
        ],
        checklists: {
          firePrevention: 'NO',
          ppe: 'YES',
          poweredEquipment: 'YES',
          workPlatform: 'YES',
          barricades: 'YES',
        },
        crew: [{ name: 'Budi', signedIn: true, signedOut: false }],
      },
    },
    seededErrors: [
      {
        id: 'err_og_hot_work_permit',
        fieldPath: 'ptw.add_hot_work',
        acceptedFieldPaths: ['ptw.add_hot_work', 'ptw.add_hot_work_notes'],
        component: 'ADDITIONAL_PERMIT_ISOLATION',
        relevantRoles: [Role.APPLICANT, Role.SUPERVISOR, Role.ISSUER],
        severity: 'CRITICAL',
        points: 35,
        description: 'Izin Kerja Panas (Hot Work) tidak dipilih pada formulir PTW',
        explanation:
          'Pekerjaan pengelasan di area proses hidrokarbon wajib melampirkan Izin Kerja Panas (add_hot_work = Ya).',
      },
      {
        id: 'err_og_lel_missing',
        fieldPath: 'additional.HOT_WORK.lelReadingPercent',
        acceptedFieldPaths: [
          'additional.HOT_WORK.lelReadingPercent',
          'ptw.haz_fire',
          'jsa.checklists.firePrevention',
        ],
        component: 'ADDITIONAL_PERMIT_ISOLATION',
        relevantRoles: [Role.APPLICANT, Role.SUPERVISOR, Role.ISSUER],
        severity: 'CRITICAL',
        points: 35,
        description: 'Hasil uji gas LEL tidak dicatat sebelum kerja panas',
        explanation:
          'Pengukuran Lower Explosive Limit (LEL) wajib dicatat dan bernilai 0% sebelum kerja panas di dekat jalur proses.',
      },
      {
        id: 'err_og_fire_watcher',
        fieldPath: 'additional.HOT_WORK.fireWatcherAssigned',
        acceptedFieldPaths: [
          'additional.HOT_WORK.fireWatcherAssigned',
          'jsa.checklists.firePrevention',
        ],
        component: 'HAZARD_IDENTIFICATION',
        relevantRoles: [Role.APPLICANT, Role.SUPERVISOR, Role.ISSUER, Role.COORDINATOR],
        severity: 'HIGH',
        points: 30,
        description: 'Petugas pengawas api (Fire Watcher) dan pencegahan kebakaran belum ditugaskan',
        explanation:
          'Setiap kerja panas harus diawasi Fire Watcher terlatih dan dilengkapi APAR siap pakai.',
      },
    ],
  },
  {
    title: 'Perawatan Panel Listrik (Pembangkit Listrik)',
    industry: Industry.POWER_PLANT,
    description:
      'CONTOH ILUSTRATIF (validasi pakar K3): Perawatan berkala dan pengencangan terminasi panel distribusi tegangan menengah.',
    initialData: {
      isIllustrativeExample: true,
      validationNotice: 'CONTOH ILUSTRATIF — WAJIB DIVALIDASI PAKAR K3 SEBELUM PELATIHAN RESMI',
      validFromOffsetMinutes: -15,
      validToOffsetMinutes: 480,
      ptwData: {
        companyName: 'PT Jasa Kelistrikan Simulasi',
        userDepartment: 'Operasi & Pemeliharaan Listrik',
        workLocation: 'Ruang Switchgear Unit 2',
        workDescription: 'Inspeksi dan pengencangan busbar panel distribusi 6.6 kV',
        chk_1_trained_workers: 'YES',
        chk_2_competent_supervisor: 'YES',
        chk_3_has_sop: 'YES',
        chk_4_jsa_attached: 'YES',
        chk_5_emergency_plan: 'YES',
        chk_6_equipment_safe: 'NO',
        chk_7_registered_special_equipment: 'NO',
        chk_8_communicated: 'YES',
        add_loto: 'NO',
        add_height: 'NO',
        add_b3_excavation: 'NO',
        add_confined_space: 'NO',
        add_hot_work: 'NO',
        haz_fire: 'NO',
        haz_sparks: 'NO',
        haz_dust_chemical: 'NO',
        haz_energy: 'YES',
        haz_energy_notes: 'Panel bertegangan 6.6 kV',
        haz_height_opening: 'NO',
        haz_restricted_access: 'NO',
      },
      jsaData: {
        supervisorName: 'Sari Pengawas',
        contractorName: 'PT Jasa Kelistrikan Simulasi',
        date: '2026-11-17',
        workLocation: 'Ruang Switchgear Unit 2',
        steps: [
          {
            activity: 'Membuka kompartemen panel dan inspeksi terminasi',
            hazardCode: 'A',
            hazardDescription: 'Sengatan listrik & busur api listrik',
            controlMeasure: 'Gunakan sarung tangan berisolasi',
          },
        ],
        checklists: {
          firePrevention: 'YES',
          ppe: 'YES',
          poweredEquipment: 'NO',
          workPlatform: 'YES',
          barricades: 'YES',
        },
        crew: [{ name: 'Budi', signedIn: true, signedOut: false }],
      },
    },
    seededErrors: [
      {
        id: 'err_pp_loto_missing',
        fieldPath: 'ptw.add_loto',
        acceptedFieldPaths: ['ptw.add_loto', 'ptw.add_loto_notes'],
        component: 'ADDITIONAL_PERMIT_ISOLATION',
        relevantRoles: [Role.APPLICANT, Role.SUPERVISOR, Role.ISSUER],
        severity: 'CRITICAL',
        points: 35,
        description: 'Izin tambahan LOTO belum dilampirkan untuk pekerjaan panel bertegangan',
        explanation:
          'Pekerjaan pada sumber energi listrik 6.6 kV wajib mengaktifkan izin tambahan Lock Out Tag Out (LOTO).',
      },
      {
        id: 'err_pp_isolation_points',
        fieldPath: 'additional.LOTO.isolationPoints',
        acceptedFieldPaths: ['additional.LOTO.isolationPoints', 'ptw.haz_energy'],
        component: 'ADDITIONAL_PERMIT_ISOLATION',
        relevantRoles: [Role.APPLICANT, Role.SUPERVISOR, Role.ISSUER],
        severity: 'CRITICAL',
        points: 35,
        description: 'Titik isolasi energi dan verifikasi zero-energy tidak lengkap',
        explanation:
          'Seluruh breaker hulu/hilir dan verifikasi tegangan nol (try-out) wajib didokumentasikan pada sub-formulir LOTO.',
      },
      {
        id: 'err_pp_cable_check',
        fieldPath: 'ptw.chk_6_equipment_safe',
        acceptedFieldPaths: ['ptw.chk_6_equipment_safe', 'jsa.checklists.poweredEquipment'],
        component: 'COMPLETENESS',
        relevantRoles: [Role.APPLICANT, Role.SUPERVISOR],
        severity: 'HIGH',
        points: 30,
        description: 'Kabel dan peralatan kerja listrik belum dinyatakan diperiksa/layak',
        explanation:
          'Daftar periksa kelayakan alat (no. 6) dan peralatan bertenaga pada JSA tidak boleh dibiarkan Tidak.',
      },
    ],
  },
  {
    title: 'Penggalian Dekat Jalur Angkut (Pertambangan)',
    industry: Industry.MINING,
    description:
      'CONTOH ILUSTRATIF (validasi pakar K3): Penggalian parit drainase di sisi jalan angkut hauling tambang aktif.',
    initialData: {
      isIllustrativeExample: true,
      validationNotice: 'CONTOH ILUSTRATIF — WAJIB DIVALIDASI PAKAR K3 SEBELUM PELATIHAN RESMI',
      validFromOffsetMinutes: -15,
      validToOffsetMinutes: 480,
      ptwData: {
        companyName: 'PT Tambang Sipil Simulasi',
        userDepartment: 'Infrastruktur Tambang',
        workLocation: 'Sisi Jalan Hauling KM 4',
        workDescription: 'Penggalian parit drainase kedalaman 2 meter di dekat jalur angkut dump truck',
        chk_1_trained_workers: 'YES',
        chk_2_competent_supervisor: 'YES',
        chk_3_has_sop: 'YES',
        chk_4_jsa_attached: 'YES',
        chk_5_emergency_plan: 'YES',
        chk_6_equipment_safe: 'YES',
        chk_7_registered_special_equipment: 'YES',
        chk_8_communicated: 'YES',
        add_loto: 'NO',
        add_height: 'NO',
        add_b3_excavation: 'YES',
        add_b3_excavation_notes: 'Penggalian parit 2 meter',
        add_confined_space: 'NO',
        add_hot_work: 'NO',
        haz_fire: 'NO',
        haz_sparks: 'NO',
        haz_dust_chemical: 'NO',
        haz_energy: 'NO',
        haz_height_opening: 'YES',
        haz_height_opening_notes: 'Terdapat galian terbuka',
        haz_restricted_access: 'NO',
      },
      jsaData: {
        supervisorName: 'Sari Pengawas',
        contractorName: 'PT Tambang Sipil Simulasi',
        date: '2026-11-17',
        workLocation: 'Sisi Jalan Hauling KM 4',
        steps: [
          {
            activity: 'Penggalian parit dengan ekskavator di sisi jalan hauling',
            hazardCode: 'E',
            hazardDescription: 'Material tanah keras',
            controlMeasure: 'Gunakan helm dan sepatu keselamatan',
          },
        ],
        checklists: {
          firePrevention: 'YES',
          ppe: 'YES',
          poweredEquipment: 'YES',
          workPlatform: 'YES',
          barricades: 'NO',
        },
        crew: [{ name: 'Budi', signedIn: true, signedOut: false }],
      },
    },
    seededErrors: [
      {
        id: 'err_mn_barricades',
        fieldPath: 'jsa.checklists.barricades',
        acceptedFieldPaths: ['jsa.checklists.barricades', 'ptw.haz_restricted_access'],
        component: 'HAZARD_IDENTIFICATION',
        relevantRoles: [Role.APPLICANT, Role.SUPERVISOR, Role.COORDINATOR],
        severity: 'CRITICAL',
        points: 35,
        description: 'Barikade dan pengaturan lalu lintas di sekitar galian tidak tersedia',
        explanation:
          'Pekerjaan di sisi jalur hauling aktif wajib memasang barikade keras/rambu peringatan serta pengaturan lalu lintas.',
      },
      {
        id: 'err_mn_excavation_code',
        fieldPath: 'jsa.steps[0].hazardCode',
        acceptedFieldPaths: ['jsa.steps[0].hazardCode', 'ptw.add_b3_excavation'],
        component: 'HAZARD_IDENTIFICATION',
        relevantRoles: [Role.APPLICANT, Role.SUPERVISOR],
        severity: 'HIGH',
        points: 35,
        description: 'JSA belum mencantumkan kode bahaya Galian (kode O)',
        explanation:
          'Langkah kerja penggalian wajib mengidentifikasi bahaya Galian (kode O) dan pengendalian longsor/shoring.',
      },
      {
        id: 'err_mn_traffic_code',
        fieldPath: 'jsa.steps[0].controlMeasure',
        acceptedFieldPaths: ['jsa.steps[0].controlMeasure', 'jsa.steps[0].hazardCode'],
        component: 'HAZARD_IDENTIFICATION',
        relevantRoles: [Role.APPLICANT, Role.SUPERVISOR, Role.ISSUER],
        severity: 'HIGH',
        points: 30,
        description: 'Bahaya lalu lintas kendaraan tambang (kode K) belum dikendalikan di JSA',
        explanation:
          'JSA harus memuat bahaya lalu lintas kendaraan (kode K) dan pengendalian berupa spotter/flagman serta pembatas jarak aman.',
      },
    ],
  },
];
