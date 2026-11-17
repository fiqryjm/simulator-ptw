import { FormTemplateType, Industry, Prisma, PrismaClient, Role, SessionStatus } from '@prisma/client';
import { hashPassword } from '../src/lib/password';
import {
  DEFAULT_ADDITIONAL_PERMIT_TEMPLATES,
  DEFAULT_JSA_TEMPLATE_SCHEMA,
  DEFAULT_PTW_TEMPLATE_SCHEMA,
} from '../src/modules/permit/default-templates';

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
      settings: { heightThresholdMeters: 1.8, timezone: 'Asia/Jakarta', defaultLocale: 'id' },
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
      settings: { heightThresholdMeters: 1.8, timezone: 'Asia/Jakarta', defaultLocale: 'id' },
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

  // Seed FormTemplates for demoTenant (OIL_AND_GAS default)
  const existingPtwTemplate = await prisma.formTemplate.findFirst({
    where: {
      tenantId: demoTenant.id,
      type: FormTemplateType.PTW,
      industry: Industry.OIL_AND_GAS,
    },
  });

  const templateIds: string[] = [];

  if (!existingPtwTemplate) {
    const ptwTpl = await prisma.formTemplate.create({
      data: {
        tenantId: demoTenant.id,
        type: FormTemplateType.PTW,
        industry: Industry.OIL_AND_GAS,
        schemaJson: DEFAULT_PTW_TEMPLATE_SCHEMA as unknown as Prisma.InputJsonValue,
        version: 1,
      },
    });
    templateIds.push(ptwTpl.id);
  } else {
    templateIds.push(existingPtwTemplate.id);
  }

  const existingJsaTemplate = await prisma.formTemplate.findFirst({
    where: {
      tenantId: demoTenant.id,
      type: FormTemplateType.JSA,
      industry: Industry.OIL_AND_GAS,
    },
  });

  if (!existingJsaTemplate) {
    const jsaTpl = await prisma.formTemplate.create({
      data: {
        tenantId: demoTenant.id,
        type: FormTemplateType.JSA,
        industry: Industry.OIL_AND_GAS,
        schemaJson: DEFAULT_JSA_TEMPLATE_SCHEMA as unknown as Prisma.InputJsonValue,
        version: 1,
      },
    });
    templateIds.push(jsaTpl.id);
  }

  const existingAdditionalCount = await prisma.formTemplate.count({
    where: {
      tenantId: demoTenant.id,
      type: FormTemplateType.ADDITIONAL,
      industry: Industry.OIL_AND_GAS,
    },
  });

  if (existingAdditionalCount === 0) {
    for (const addSchema of DEFAULT_ADDITIONAL_PERMIT_TEMPLATES) {
      await prisma.formTemplate.create({
        data: {
          tenantId: demoTenant.id,
          type: FormTemplateType.ADDITIONAL,
          industry: Industry.OIL_AND_GAS,
          schemaJson: addSchema as unknown as Prisma.InputJsonValue,
          version: 1,
        },
      });
    }
  }

  // Seed 1 minimal Scenario & 1 active Session for M1
  let scenario = await prisma.scenario.findFirst({
    where: { tenantId: demoTenant.id, title: 'Simulasi Dasar PTW — Oil & Gas' },
  });

  if (!scenario) {
    scenario = await prisma.scenario.create({
      data: {
        tenantId: demoTenant.id,
        title: 'Simulasi Dasar PTW — Oil & Gas',
        industry: Industry.OIL_AND_GAS,
        description: 'Skenario latihan alur izin kerja dasar dari DRAFT hingga CLOSED.',
        initialDataJson: {},
        seededErrorsJson: [],
        templateIds,
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
        scenarioId: scenario.id,
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
      Role.INSTRUCTOR,
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

  console.log('Seed completed: tenants, 7 role users, form templates, and default active session.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
