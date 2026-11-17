'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getLocalizedText,
  interpolateLocalizedText,
  type FormFieldSchema,
  type FormSectionSchema,
} from '@/modules/permit/template-schema';

interface DynamicFormRendererProps {
  sections: FormSectionSchema[];
  values: Record<string, unknown>;
  locale: string;
  heightThresholdMeters: number;
  readOnly?: boolean;
  onChange: (key: string, value: unknown) => void;
}

export function DynamicFormRenderer({
  sections,
  values,
  locale,
  heightThresholdMeters,
  readOnly = false,
  onChange,
}: DynamicFormRendererProps) {
  const renderField = (field: FormFieldSchema) => {
    const label = getLocalizedText(
      interpolateLocalizedText(field.label, { heightThresholdMeters }),
      locale,
    );
    const val = values[field.key];

    if (field.type === 'yesno') {
      const current = typeof val === 'string' ? val : '';
      const notesKey = `${field.key}_notes`;
      const notesVal = typeof values[notesKey] === 'string' ? (values[notesKey] as string) : '';

      return (
        <div key={field.key} className="space-y-2 rounded-md border border-slate-200 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Label htmlFor={`${field.key}-yes`} className="text-sm font-medium text-slate-800">
              {label} {field.required ? <span className="text-red-600">*</span> : null}
            </Label>
            <div className="flex items-center gap-4 shrink-0">
              <label className="inline-flex items-center gap-1.5 text-sm">
                <input
                  id={`${field.key}-yes`}
                  type="radio"
                  name={field.key}
                  value="YES"
                  checked={current === 'YES'}
                  disabled={readOnly}
                  onChange={() => onChange(field.key, 'YES')}
                />
                <span>{locale === 'en' ? 'Yes' : 'Ya'}</span>
              </label>
              <label className="inline-flex items-center gap-1.5 text-sm">
                <input
                  id={`${field.key}-no`}
                  type="radio"
                  name={field.key}
                  value="NO"
                  checked={current === 'NO'}
                  disabled={readOnly}
                  onChange={() => onChange(field.key, 'NO')}
                />
                <span>{locale === 'en' ? 'No' : 'Tidak'}</span>
              </label>
            </div>
          </div>

          {field.requireNotesOnYes && current === 'YES' ? (
            <div className="pt-1">
              <Input
                placeholder={locale === 'en' ? 'Remarks / details...' : 'Keterangan tambahan...'}
                value={notesVal}
                disabled={readOnly}
                onChange={(e) => onChange(notesKey, e.target.value)}
                aria-label={`${label} - notes`}
              />
            </div>
          ) : null}
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={field.key}>
            {label} {field.required ? <span className="text-red-600">*</span> : null}
          </Label>
          <textarea
            id={field.key}
            rows={3}
            disabled={readOnly}
            value={typeof val === 'string' ? val : ''}
            onChange={(e) => onChange(field.key, e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 disabled:bg-slate-100"
          />
        </div>
      );
    }

    if (field.type === 'datetime') {
      const strVal = typeof val === 'string' ? val.slice(0, 16) : '';
      return (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={field.key}>
            {label} {field.required ? <span className="text-red-600">*</span> : null}
          </Label>
          <Input
            id={field.key}
            type="datetime-local"
            disabled={readOnly}
            value={strVal}
            onChange={(e) => onChange(field.key, e.target.value)}
          />
        </div>
      );
    }

    return (
      <div key={field.key} className="space-y-1.5">
        <Label htmlFor={field.key}>
          {label} {field.required ? <span className="text-red-600">*</span> : null}
        </Label>
        <Input
          id={field.key}
          type={field.type === 'number' ? 'number' : 'text'}
          disabled={readOnly}
          value={val === undefined || val === null ? '' : String(val)}
          onChange={(e) =>
            onChange(
              field.key,
              field.type === 'number' && e.target.value !== ''
                ? Number(e.target.value)
                : e.target.value,
            )
          }
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <section key={section.key} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="border-b border-slate-200 pb-2 text-base font-semibold text-[#0f2942]">
            {getLocalizedText(section.title, locale)}
          </h3>
          <div className="space-y-3">{section.fields.map(renderField)}</div>
        </section>
      ))}
    </div>
  );
}
