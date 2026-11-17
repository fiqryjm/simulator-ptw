import {
  FormTemplateType,
  Industry,
  Prisma,
  PrismaClient,
  Role,
  SessionStatus,
} from '@prisma/client';
import { hashPassword } from '../src/lib/password';
import {
  DEFAULT_ADDITIONAL_PERMIT_TEMPLATES,
  DEFAULT_JSA_TEMPLATE_SCHEMA,
  DEFAULT_PTW_TEMPLATE_SCHEMA,
} from '../src/modules/permit/default-templates';
import { DEFAULT_MVP_SCENARIOS } from '../src/modules/scenario/default-scenarios';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'SimulasiPtw2026!';

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const systemTenant = await prisma.tenant.upsert({
    where: { slug: 'system' },
    update: {},
    create: {
      name: 'Platform Sistem PTW',
      slug: 'system',
      isSystem: true,
      industries: [Industry.OIL_AND_GAS, Industry.POWER_PLANT, Industry.MINING],
      settings: {
        heightThresholdMeters: 1.8,
        timezone: 'Asia/Jakarta',
        defaultLocale: 'id',
        scoringWeights: {
          documentCompleteness: 25,
          hazardIdentification: 30,
          procedureCompliance: 25,
          additionalPermitsAndIsolation: 20,
        },
      },
    },
  });

  const demoTenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: { name: 'PT Simulator PtW FJM' },
    create: {
      name: 'PT Simulator PtW FJM',
      slug: 'demo',
      isSystem: false,
      industries: [Industry.OIL_AND_GAS, Industry.POWER_PLANT, Industry.MINING],
      settings: {
        heightThresholdMeters: 1.8,
        timezone: 'Asia/Jakarta',
        defaultLocale: 'id',
        scoringWeights: {
          documentCompleteness: 25,
          hazardIdentification: 30,
          procedureCompliance: 25,
          additionalPermitsAndIsolation: 20,
        },
      },
    },
  });

  const seedUsers: Array<{
    email: string;
    name: string;
    role: Role;
    tenantId: string;
  }> = [
    {
      email: 'applicant@demo.ptw.local',
      name: 'Budi Pemohon',
      role: Role.APPLICANT,
      tenantId: demoTenant.id,
    },
    {
      email: 'supervisor@demo.ptw.local',
      name: 'Sari Pengawas',
      role: Role.SUPERVISOR,
      tenantId: demoTenant.id,
    },
    {
      email: 'issuer@demo.ptw.local',
      name: 'Hendra Pemberi Izin',
      role: Role.ISSUER,
      tenantId: demoTenant.id,
    },
    {
      email: 'coordinator@demo.ptw.local',
      name: 'Dewi Koordinator',
      role: Role.COORDINATOR,
      tenantId: demoTenant.id,
    },
    {
      email: 'instructor@demo.ptw.local',
      name: 'Agus Instruktur',
      role: Role.INSTRUCTOR,
      tenantId: demoTenant.id,
    },
    {
      email: 'admin@demo.ptw.local',
      name: 'Rina Admin Tenant',
      role: Role.TENANT_ADMIN,
      tenantId: demoTenant.id,
    },
    {
      email: 'superadmin@system.ptw.local',
      name: 'Super Admin Sistem',
      role: Role.SUPER_ADMIN,
      tenantId: systemTenant.id,
    },
  ];

  const createdUsers: Record<string, { id: string; role: Role }> = {};

  for (const userData of seedUsers) {
    const u = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        name: userData.name,
        role: userData.role,
        tenantId: userData.tenantId,
      },
      create: {
        email: userData.email,
        name: userData.name,
        passwordHash,
        role: userData.role,
        tenantId: userData.tenantId,
        isActive: true,
      },
    });
    createdUsers[userData.role] = { id: u.id, role: u.role };
  }

  // Seed FormTemplates for all 3 industries on demoTenant
  const templateIdsByIndustry: Record<Industry, string[]> = {
    OIL_AND_GAS: [],
    POWER_PLANT: [],
    MINING: [],
  };

  for (const industry of [Industry.OIL_AND_GAS, Industry.POWER_PLANT, Industry.MINING]) {
    const existingPtw = await prisma.formTemplate.findFirst({
      where: { tenantId: demoTenant.id, type: FormTemplateType.PTW, industry },
    });
    if (!existingPtw) {
      const created = await prisma.formTemplate.create({
        data: {
          tenantId: demoTenant.id,
          type: FormTemplateType.PTW,
          industry,
          schemaJson: DEFAULT_PTW_TEMPLATE_SCHEMA as unknown as Prisma.InputJsonValue,
          version: 1,
        },
      });
      templateIdsByIndustry[industry].push(created.id);
    } else {
      templateIdsByIndustry[industry].push(existingPtw.id);
    }

    const existingJsa = await prisma.formTemplate.findFirst({
      where: { tenantId: demoTenant.id, type: FormTemplateType.JSA, industry },
    });
    if (!existingJsa) {
      const created = await prisma.formTemplate.create({
        data: {
          tenantId: demoTenant.id,
          type: FormTemplateType.JSA,
          industry,
          schemaJson: DEFAULT_JSA_TEMPLATE_SCHEMA as unknown as Prisma.InputJsonValue,
          version: 1,
        },
      });
      templateIdsByIndustry[industry].push(created.id);
    } else {
      templateIdsByIndustry[industry].push(existingJsa.id);
    }

    const existingAddCount = await prisma.formTemplate.count({
      where: { tenantId: demoTenant.id, type: FormTemplateType.ADDITIONAL, industry },
    });
    if (existingAddCount === 0) {
      for (const addSchema of DEFAULT_ADDITIONAL_PERMIT_TEMPLATES) {
        await prisma.formTemplate.create({
          data: {
            tenantId: demoTenant.id,
            type: FormTemplateType.ADDITIONAL,
            industry,
            schemaJson: addSchema as unknown as Prisma.InputJsonValue,
            version: 1,
          },
        });
      }
    }
  }

  // Seed 3 MVP illustrative scenarios (with seededErrorsJson)
  for (const scDef of DEFAULT_MVP_SCENARIOS) {
    const existing = await prisma.scenario.findFirst({
      where: { tenantId: demoTenant.id, title: scDef.title },
    });
    if (!existing) {
      await prisma.scenario.create({
        data: {
          tenantId: demoTenant.id,
          title: scDef.title,
          industry: scDef.industry,
          description: scDef.description,
          initialDataJson: scDef.initialData as unknown as Prisma.InputJsonValue,
          seededErrorsJson: scDef.seededErrors as unknown as Prisma.InputJsonValue,
          templateIds: templateIdsByIndustry[scDef.industry],
        },
      });
    }
  }

  // Keep clean baseline scenario & active session DEMO-M1 for M1 lifecycle compatibility
  let baseScenario = await prisma.scenario.findFirst({
    where: { tenantId: demoTenant.id, title: 'Simulasi Dasar PTW — Oil & Gas' },
  });

  if (!baseScenario) {
    baseScenario = await prisma.scenario.create({
      data: {
        tenantId: demoTenant.id,
        title: 'Simulasi Dasar PTW — Oil & Gas',
        industry: Industry.OIL_AND_GAS,
        description: 'Skenario latihan alur izin kerja dasar dari DRAFT hingga CLOSED.',
        initialDataJson: {},
        seededErrorsJson: [],
        templateIds: templateIdsByIndustry[Industry.OIL_AND_GAS],
      },
    });
  }

  const instructor = createdUsers[Role.INSTRUCTOR];
  if (instructor) {
    const session = await prisma.session.upsert({
      where: { joinCode: 'DEMO-M1' },
      update: { status: SessionStatus.ACTIVE },
      create: {
        tenantId: demoTenant.id,
        scenarioId: baseScenario.id,
        instructorId: instructor.id,
        joinCode: 'DEMO-M1',
        status: SessionStatus.ACTIVE,
        startedAt: new Date(),
      },
    });

    const participantRoles: Role[] = [
      Role.APPLICANT,
      Role.SUPERVISOR,
      Role.ISSUER,
      Role.COORDINATOR,
    ];

    for (const r of participantRoles) {
      const u = createdUsers[r];
      if (!u) continue;
      await prisma.participant.upsert({
        where: { sessionId_userId: { sessionId: session.id, userId: u.id } },
        update: { simulatedRole: r },
        create: {
          tenantId: demoTenant.id,
          sessionId: session.id,
          userId: u.id,
          simulatedRole: r,
        },
      });
    }
  }

  console.log('Seed completed: tenants, 7 role users, 3-sector templates, 3 MVP scenarios, and default session.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
