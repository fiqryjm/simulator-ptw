import type { AdditionalPermitType } from '@prisma/client';
import { z } from 'zod';

export interface LocalizedText {
  id: string;
  en: string;
}

export type FieldType = 'text' | 'textarea' | 'datetime' | 'yesno' | 'number';

export interface FormFieldSchema {
  key: string;
  label: LocalizedText;
  type: FieldType;
  required?: boolean;
  triggersAdditionalPermit?: AdditionalPermitType;
  requireNotesOnYes?: boolean;
}

export interface FormSectionSchema {
  key: string;
  title: LocalizedText;
  fields: FormFieldSchema[];
}

export interface PtwTemplateSchema {
  sections: FormSectionSchema[];
  lifecycleChecklists: {
    workplacePrep: FormFieldSchema[];
    postWorkInspection: FormFieldSchema[];
  };
}

export interface AdditionalPermitTemplateSchema {
  type: AdditionalPermitType;
  title: LocalizedText;
  fields: FormFieldSchema[];
}

export function getLocalizedText(text: LocalizedText, locale: string): string {
  return locale === 'en' ? text.en : text.id;
}

export function interpolateLocalizedText(
  text: LocalizedText,
  settings: { heightThresholdMeters?: number },
): LocalizedText {
  const threshold = String(settings.heightThresholdMeters ?? 1.8);
  return {
    id: text.id.replaceAll('{{heightThresholdMeters}}', threshold),
    en: text.en.replaceAll('{{heightThresholdMeters}}', threshold),
  };
}

export function flattenPtwFields(schema: PtwTemplateSchema): FormFieldSchema[] {
  return schema.sections.flatMap((section) => section.fields);
}

/**
 * Validates form data dynamically against a list of FormFieldSchema definitions.
 */
export function validateDynamicFields(
  fields: readonly FormFieldSchema[],
  data: Record<string, unknown>,
  options: { enforceRequired: boolean },
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const val = data[field.key];

    if (field.type === 'yesno') {
      if (val !== undefined && val !== null && val !== '' && val !== 'YES' && val !== 'NO') {
        errors[field.key] = 'Nilai harus YES atau NO';
        continue;
      }
      if (options.enforceRequired && field.required && val !== 'YES' && val !== 'NO') {
        errors[field.key] = 'Pilihan Ya/Tidak wajib diisi';
        continue;
      }
      if (options.enforceRequired && field.requireNotesOnYes && val === 'YES') {
        const noteKey = `${field.key}_notes`;
        const noteVal = data[noteKey];
        if (typeof noteVal !== 'string' || noteVal.trim().length === 0) {
          errors[noteKey] = 'Keterangan wajib diisi jika memilih Ya';
        }
      }
      continue;
    }

    if (field.type === 'number') {
      if (val !== undefined && val !== null && val !== '') {
        const num = typeof val === 'number' ? val : Number(val);
        if (Number.isNaN(num)) {
          errors[field.key] = 'Harus berupa angka yang valid';
          continue;
        }
      } else if (options.enforceRequired && field.required) {
        errors[field.key] = 'Field angka ini wajib diisi';
      }
      continue;
    }

    if (field.type === 'datetime') {
      if (val !== undefined && val !== null && val !== '') {
        const d = new Date(String(val));
        if (Number.isNaN(d.getTime())) {
          errors[field.key] = 'Format tanggal/jam tidak valid';
          continue;
        }
      } else if (options.enforceRequired && field.required) {
        errors[field.key] = 'Tanggal/jam wajib diisi';
      }
      continue;
    }

    // text | textarea
    if (options.enforceRequired && field.required) {
      if (typeof val !== 'string' || val.trim().length === 0) {
        errors[field.key] = 'Field ini wajib diisi';
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Extracts all AdditionalPermitType values triggered by "YES" answers in PTW data.
 * Mapping lives exclusively in the template's `triggersAdditionalPermit` property.
 */
export function extractTriggeredAdditionalPermits(
  schema: PtwTemplateSchema,
  data: Record<string, unknown>,
): AdditionalPermitType[] {
  const triggered = new Set<AdditionalPermitType>();
  for (const field of flattenPtwFields(schema)) {
    if (field.triggersAdditionalPermit && data[field.key] === 'YES') {
      triggered.add(field.triggersAdditionalPermit);
    }
  }
  return Array.from(triggered);
}

/**
 * Validates that every item in a lifecycle checklist (FR-35) is answered YES or NO
 * and all required items are answered YES (or completed).
 */
export function validateLifecycleChecklist(
  fields: readonly FormFieldSchema[],
  checklistData: Record<string, unknown>,
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const val = checklistData[field.key];
    if (val !== 'YES' && val !== 'NO') {
      errors[field.key] = 'Daftar periksa wajib dijawab';
    } else if (field.required && val !== 'YES') {
      errors[field.key] = 'Item wajib ini harus dipastikan Ya sebelum melanjutkan';
    }
  }
  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export const ptwTemplateSchemaValidator = z.object({
  sections: z.array(
    z.object({
      key: z.string(),
      title: z.object({ id: z.string(), en: z.string() }),
      fields: z.array(
        z.object({
          key: z.string(),
          label: z.object({ id: z.string(), en: z.string() }),
          type: z.enum(['text', 'textarea', 'datetime', 'yesno', 'number']),
          required: z.boolean().optional(),
          triggersAdditionalPermit: z
            .enum(['LOTO', 'HEIGHT', 'B3_EXCAVATION', 'CONFINED_SPACE', 'HOT_WORK'])
            .optional(),
          requireNotesOnYes: z.boolean().optional(),
        }),
      ),
    }),
  ),
  lifecycleChecklists: z.object({
    workplacePrep: z.array(z.any()),
    postWorkInspection: z.array(z.any()),
  }),
});
