import type { PermitStatus } from '@/lib/permit-state-machine';

export interface PermitModuleSummary {
  id: string;
  tenantId: string;
  status: PermitStatus;
}
