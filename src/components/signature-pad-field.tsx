'use client';

import { useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import { Button } from '@/components/ui/button';

interface SignaturePadFieldProps {
  title: string;
  existingImageData?: string | null;
  disabled?: boolean;
  onSave: (pngDataUrl: string) => Promise<void>;
}

export function SignaturePadField({
  title,
  existingImageData,
  disabled = false,
  onSave,
}: SignaturePadFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current || disabled) return;
    const pad = new SignaturePad(canvasRef.current, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: '#0f2942',
    });
    padRef.current = pad;
    return () => {
      pad.off();
      padRef.current = null;
    };
  }, [disabled]);

  const handleClear = () => {
    padRef.current?.clear();
    setError(null);
  };

  const handleSave = async () => {
    if (!padRef.current) return;
    if (padRef.current.isEmpty()) {
      setError('Silakan gambar tanda tangan terlebih dahulu.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const dataUrl = padRef.current.toDataURL('image/png');
      await onSave(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan tanda tangan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      {existingImageData ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-2">
          <div className="mb-1 text-xs text-slate-600">Tanda tangan tersimpan:</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={existingImageData}
            alt={title}
            className="max-h-24 rounded border border-slate-200 bg-white"
          />
        </div>
      ) : null}

      {!disabled ? (
        <div className="space-y-2">
          <canvas
            ref={canvasRef}
            width={420}
            height={140}
            aria-label={title}
            className="w-full max-w-[420px] touch-none rounded border border-slate-300 bg-white"
          />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleClear}>
              Hapus
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={handleSave}
              data-testid={`save-signature-${title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {saving ? 'Menyimpan...' : 'Simpan Tanda Tangan'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
