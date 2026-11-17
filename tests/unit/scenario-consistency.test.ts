import { Industry, Role } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { AuthorizationError, type SessionUser } from '@/lib/rbac';
import { DEFAULT_PTW_TEMPLATE_SCHEMA } from '@/modules/permit/default-templates';
import { DEFAULT_MVP_SCENARIOS } from '@/modules/scenario/default-scenarios';
import {
  getValidFieldPathsForTemplate,
  listScenariosForManager,
  resolveScenarioDates,
} from '@/modules/scenario/service';

describe('M2 Scenario Library & Consistency', () => {
  it('includes 3 illustrative MVP scenarios across Oil & Gas, Power Plant, and Mining', () => {
    const industries = DEFAULT_MVP_SCENARIOS.map((s) => s.industry);
    expect(industries).toContain(Industry.OIL_AND_GAS);
    expect(industries).toContain(Industry.POWER_PLANT);
    expect(industries).toContain(Industry.MINING);

    for (const sc of DEFAULT_MVP_SCENARIOS) {
      expect(sc.initialData.isIllustrativeExample).toBe(true);
      expect(sc.seededErrors.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('ensures every seededError fieldPath & acceptedFieldPaths exists in template schema', () => {
    const validPaths = getValidFieldPathsForTemplate(DEFAULT_PTW_TEMPLATE_SCHEMA);
    for (const sc of DEFAULT_MVP_SCENARIOS) {
      for (const err of sc.seededErrors) {
        expect(validPaths.has(err.fieldPath), `Unknown fieldPath: ${err.fieldPath}`).toBe(true);
        for (const alt of err.acceptedFieldPaths) {
          expect(validPaths.has(alt), `Unknown acceptedFieldPath: ${alt}`).toBe(true);
        }
      }
    }
  });

  it('resolves relative scenario offsets into valid UTC Date bounds', () => {
    const base = new Date('2026-11-17T05:00:00.000Z');
    const sc = DEFAULT_MVP_SCENARIOS[0]!;
    const { validFrom, validTo } = resolveScenarioDates(sc.initialData, base);
    expect(validTo.getTime()).toBeGreaterThan(validFrom.getTime());
    expect(validFrom.getTime()).toBeLessThanOrEqual(base.getTime());
  });

  it('blocks participant roles from calling listScenariosForManager (403)', async () => {
    const applicant: SessionUser = {
      id: 'u1',
      email: 'app@demo.ptw.local',
      name: 'App',
      role: Role.APPLICANT,
      tenantId: 't1',
    };
    await expect(listScenariosForManager(applicant)).rejects.toThrow(AuthorizationError);
  });
});
