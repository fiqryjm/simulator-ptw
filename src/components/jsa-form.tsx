'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_JSA_TEMPLATE_SCHEMA } from '@/modules/permit/default-templates';

export interface JsaFormState {
  supervisorName: string;
  contractorName: string;
  date: string;
  workLocation: string;
  steps: Array<{
    activity: string;
    hazardCode: string;
    hazardDescription: string;
    controlMeasure: string;
  }>;
  checklists: {
    firePrevention: 'YES' | 'NO';
    ppe: 'YES' | 'NO';
    poweredEquipment: 'YES' | 'NO';
    workPlatform: 'YES' | 'NO';
    barricades: 'YES' | 'NO';
  };
  crew: Array<{
    name: string;
    signedIn: boolean;
    signedOut: boolean;
  }>;
}

const EMPTY_JSA: JsaFormState = {
  supervisorName: '',
  contractorName: '',
  date: new Date().toISOString().slice(0, 10),
  workLocation: '',
  steps: [
    {
      activity: '',
      hazardCode: 'A',
      hazardDescription: '',
      controlMeasure: '',
    },
  ],
  checklists: {
    firePrevention: 'YES',
    ppe: 'YES',
    poweredEquipment: 'YES',
    workPlatform: 'YES',
    barricades: 'YES',
  },
  crew: [{ name: '', signedIn: true, signedOut: false }],
};

export function JsaForm({
  initialData,
  readOnly,
  onSave,
}: {
  initialData?: Partial<JsaFormState> | null;
  readOnly: boolean;
  onSave: (data: JsaFormState) => Promise<void>;
}) {
  const [form, setForm] = useState<JsaFormState>({
    ...EMPTY_JSA,
    ...(initialData ?? {}),
    steps:
      initialData?.steps && initialData.steps.length > 0 ? initialData.steps : EMPTY_JSA.steps,
    crew: initialData?.crew && initialData.crew.length > 0 ? initialData.crew : EMPTY_JSA.crew,
    checklists: {
      ...EMPTY_JSA.checklists,
      ...(initialData?.checklists ?? {}),
    },
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await onSave(form);
      setMessage('JSA berhasil disimpan.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Gagal menyimpan JSA');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="border-b border-slate-200 pb-2 text-base font-semibold text-[#0f2942]">
        Job Safety Analysis (JSA)
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="jsa-supervisor">Nama Pengawas</Label>
          <Input
            id="jsa-supervisor"
            disabled={readOnly}
            value={form.supervisorName}
            onChange={(e) => setForm({ ...form, supervisorName: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="jsa-contractor">Kontraktor</Label>
          <Input
            id="jsa-contractor"
            disabled={readOnly}
            value={form.contractorName}
            onChange={(e) => setForm({ ...form, contractorName: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="jsa-date">Tanggal JSA</Label>
          <Input
            id="jsa-date"
            type="date"
            disabled={readOnly}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="jsa-location">Lokasi Kerja</Label>
          <Input
            id="jsa-location"
            disabled={readOnly}
            value={form.workLocation}
            onChange={(e) => setForm({ ...form, workLocation: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-800">Langkah Kerja</h4>
          {!readOnly ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setForm({
                  ...form,
                  steps: [
                    ...form.steps,
                    { activity: '', hazardCode: 'A', hazardDescription: '', controlMeasure: '' },
                  ],
                })
              }
            >
              + Tambah Langkah
            </Button>
          ) : null}
        </div>

        {form.steps.map((step, idx) => (
          <div key={idx} className="grid gap-2 rounded border border-slate-200 p-3 sm:grid-cols-4">
            <Input
              placeholder={`Aktivitas ${idx + 1}`}
              disabled={readOnly}
              value={step.activity}
              onChange={(e) => {
                const next = [...form.steps];
                next[idx] = { ...step, activity: e.target.value };
                setForm({ ...form, steps: next });
              }}
            />
            <select
              aria-label={`Kode bahaya langkah ${idx + 1}`}
              disabled={readOnly}
              value={step.hazardCode}
              onChange={(e) => {
                const next = [...form.steps];
                next[idx] = { ...step, hazardCode: e.target.value };
                setForm({ ...form, steps: next });
              }}
              className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm"
            >
              {DEFAULT_JSA_TEMPLATE_SCHEMA.hazardCodes.map((hc) => (
                <option key={hc.code} value={hc.code}>
                  {hc.code} - {hc.label.id}
                </option>
              ))}
            </select>
            <Input
              placeholder="Bahaya potensial"
              disabled={readOnly}
              value={step.hazardDescription}
              onChange={(e) => {
                const next = [...form.steps];
                next[idx] = { ...step, hazardDescription: e.target.value };
                setForm({ ...form, steps: next });
              }}
            />
            <Input
              placeholder="Prosedur kerja aman"
              disabled={readOnly}
              value={step.controlMeasure}
              onChange={(e) => {
                const next = [...form.steps];
                next[idx] = { ...step, controlMeasure: e.target.value };
                setForm({ ...form, steps: next });
              }}
            />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-800">Sign-in Kru</h4>
        {form.crew.map((member, idx) => (
          <div key={idx} className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Nama Anggota Kru"
              className="max-w-xs"
              disabled={readOnly}
              value={member.name}
              onChange={(e) => {
                const next = [...form.crew];
                next[idx] = { ...member, name: e.target.value };
                setForm({ ...form, crew: next });
              }}
            />
            <label className="inline-flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={member.signedIn}
                onChange={(e) => {
                  const next = [...form.crew];
                  next[idx] = { ...member, signedIn: e.target.checked };
                  setForm({ ...form, crew: next });
                }}
              />
              <span>Sign-in</span>
            </label>
          </div>
        ))}
      </div>

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}

      {!readOnly ? (
        <Button type="button" onClick={handleSave} disabled={saving} data-testid="save-jsa-btn">
          {saving ? 'Menyimpan JSA...' : 'Simpan JSA'}
        </Button>
      ) : null}
    </section>
  );
}
