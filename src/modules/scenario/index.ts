export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SeededErrorDefinition {
  id: string;
  fieldPath: string;
  description: string;
  severity: ErrorSeverity;
  points: number;
  explanation: string;
}
