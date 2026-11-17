import { z } from 'zod';

export const DEFAULT_TIMEZONE = 'Asia/Jakarta';

export const DEFAULT_SCORING_WEIGHTS = {
  documentCompleteness: 25,
  hazardIdentification: 30,
  procedureCompliance: 25,
  additionalPermitsAndIsolation: 20,
} as const;

export const scoringWeightsSchema = z
  .object({
    documentCompleteness: z.number().min(0).max(100),
    hazardIdentification: z.number().min(0).max(100),
    procedureCompliance: z.number().min(0).max(100),
    additionalPermitsAndIsolation: z.number().min(0).max(100),
  })
  .refine(
    (w) =>
      w.documentCompleteness +
        w.hazardIdentification +
        w.procedureCompliance +
        w.additionalPermitsAndIsolation ===
      100,
    { message: 'Total bobot penilaian harus tepat 100' },
  );

export type ScoringWeights = z.infer<typeof scoringWeightsSchema>;

export interface TenantSettings {
  heightThresholdMeters?: number;
  timezone?: string;
  defaultLocale?: string;
  scoringWeights: ScoringWeights;
}

export function parseTenantSettings(settings: unknown): TenantSettings {
  if (!settings || typeof settings !== 'object') {
    return {
      heightThresholdMeters: 1.8,
      timezone: DEFAULT_TIMEZONE,
      scoringWeights: { ...DEFAULT_SCORING_WEIGHTS },
    };
  }
  const record = settings as Record<string, unknown>;
  const parsedWeights = scoringWeightsSchema.safeParse(record.scoringWeights);

  return {
    heightThresholdMeters:
      typeof record.heightThresholdMeters === 'number' ? record.heightThresholdMeters : 1.8,
    timezone:
      typeof record.timezone === 'string' && record.timezone ? record.timezone : DEFAULT_TIMEZONE,
    defaultLocale: typeof record.defaultLocale === 'string' ? record.defaultLocale : 'id',
    scoringWeights: parsedWeights.success ? parsedWeights.data : { ...DEFAULT_SCORING_WEIGHTS },
  };
}

export function getTenantTimezone(settings: unknown): string {
  return parseTenantSettings(settings).timezone ?? DEFAULT_TIMEZONE;
}

/**
 * Formats a UTC Date or ISO string in the tenant's configured timezone.
 */
export function formatInTenantTimezone(
  date: Date | string,
  timezone: string = DEFAULT_TIMEZONE,
  locale: string = 'id-ID',
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) {
    return '-';
  }
  try {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'id-ID', {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

export function parseDateInput(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}
