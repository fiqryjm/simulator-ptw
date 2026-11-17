'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FlagItem {
  id: string;
  fieldPath: string;
  reason: string;
  at: string;
}

interface FeedbackPayload {
  totalScore: number | null;
  breakdown: {
    documentCompleteness: number;
    hazardIdentification: number;
    procedureCompliance: number;
    additionalPermitsAndIsolation: number;
  } | null;
  foundErrors: Array<{ id: string; fieldPath: string; description: string; explanation: string }>;
  missedErrors: Array<{ id: string; fieldPath: string; description: string; explanation: string }>;
  falsePositives: Array<{ id: string; fieldPath: string; reason: string }>;
}

export function ErrorFlagPanel({
  permitId,
  sessionId,
  availableFieldPaths,
  isInstructor,
}: {
  permitId: string;
  sessionId: string;
  availableFieldPaths: string[];
  isInstructor: boolean;
}) {
  const [flags, setFlags] = useState<FlagItem[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackPayload | null>(null);
  const [fieldPath, setFieldPath] = useState(availableFieldPaths[0] ?? 'ptw.add_hot_work');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFlags = useCallback(async () => {
    const res = await fetch(`/api/permits/${permitId}/flags`);
    if (!res.ok) return;
    const data = await res.json();
    setFlags(data.flags ?? []);
    setUnlocked(Boolean(data.unlocked));
    setFeedback(data.feedback ?? null);
  }, [permitId]);

  useEffect(() => {
    void loadFlags();
  }, [loadFlags]);

  const handleAddFlag = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/permits/${permitId}/flags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldPath, reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Gagal menandai kesalahan');
      setReason('');
      await loadFlags();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menandai kesalahan');
    } finally {
      setBusy(false);
    }
  };

  const handleFinalize = async () => {
    if (
      !window.confirm(
        'Setelah menekan Selesaikan Latihan, seluruh tanda kesalahan Anda akan dikunci dan umpan balik ditampilkan. Lanjutkan?',
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/finalize`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Gagal menyelesaikan latihan');
      await loadFlags();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyelesaikan latihan');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Deteksi Kesalahan Tersembunyi (Flagging)</CardTitle>
        <CardDescription>
          Tandai bagian formulir yang mengandung kesalahan atau kelalaian K3 beserta alasannya.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isInstructor && !unlocked ? (
          <div className="space-y-3 rounded-md border border-slate-200 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="flag-field-path">Bagian Formulir (fieldPath)</Label>
                <select
                  id="flag-field-path"
                  value={fieldPath}
                  onChange={(e) => setFieldPath(e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                >
                  {availableFieldPaths.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="flag-reason">Alasan (minimal 10 karakter)</Label>
                <Input
                  id="flag-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Jelaskan mengapa bagian ini salah atau berisiko..."
                />
              </div>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={handleAddFlag}
                data-testid="submit-flag-btn"
              >
                Tandai Kesalahan
              </Button>
              <Button
                type="button"
                size="sm"
                variant="accent"
                disabled={busy}
                onClick={handleFinalize}
                data-testid="finalize-training-btn"
              >
                Selesaikan Latihan
              </Button>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-800">
            Daftar Tanda Anda ({flags.length})
          </h4>
          {flags.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada kesalahan yang ditandai.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {flags.map((f) => (
                <li key={f.id} className="rounded border border-slate-200 p-2">
                  <code className="text-xs font-semibold text-[#0f2942]">{f.fieldPath}</code>
                  <div className="text-slate-700">{f.reason}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {unlocked && feedback ? (
          <div
            data-testid="feedback-panel"
            className="space-y-3 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm"
          >
            <div className="text-base font-bold text-[#0f2942]">
              Umpan Balik & Skor Akhir: {feedback.totalScore ?? 0} / 100
            </div>
            {feedback.breakdown ? (
              <div className="grid gap-2 sm:grid-cols-4">
                <div>Kelengkapan: {feedback.breakdown.documentCompleteness}</div>
                <div>Identifikasi Bahaya: {feedback.breakdown.hazardIdentification}</div>
                <div>Kepatuhan Prosedur: {feedback.breakdown.procedureCompliance}</div>
                <div>Izin Tambahan & Isolasi: {feedback.breakdown.additionalPermitsAndIsolation}</div>
              </div>
            ) : null}

            <div>
              <strong>Kesalahan Ditemukan ({feedback.foundErrors.length}):</strong>
              <ul className="mt-1 list-disc pl-5">
                {feedback.foundErrors.map((e) => (
                  <li key={e.id}>
                    <strong>{e.description}</strong> — {e.explanation}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <strong>Kesalahan Terlewat ({feedback.missedErrors.length}):</strong>
              <ul className="mt-1 list-disc pl-5">
                {feedback.missedErrors.map((e) => (
                  <li key={e.id}>
                    <strong>{e.description}</strong> — {e.explanation}
                  </li>
                ))}
              </ul>
            </div>

            {feedback.falsePositives.length > 0 ? (
              <div>
                <strong>Tanda Palsu ({feedback.falsePositives.length}):</strong>
                <ul className="mt-1 list-disc pl-5">
                  {feedback.falsePositives.map((fp) => (
                    <li key={fp.id}>
                      <code>{fp.fieldPath}</code>: {fp.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
