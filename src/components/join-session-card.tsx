'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function JoinSessionCard() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinedMsg, setJoinedMsg] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setJoinedMsg(null);
    try {
      const res = await fetch('/api/sessions/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Gagal bergabung ke sesi');
      setJoinedMsg(`Berhasil bergabung ke sesi (${json.participant?.simulatedRole ?? ''}).`);
      setJoinCode('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal bergabung');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Gabung Sesi Pelatihan</CardTitle>
        <CardDescription>Masukkan kode gabung yang diberikan oleh instruktur.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleJoin} className="flex flex-wrap items-center gap-2">
          <Input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Contoh: A7K9M2"
            className="max-w-xs uppercase"
            aria-label="Kode Gabung Sesi"
          />
          <Button type="submit" disabled={busy || joinCode.trim().length < 4}>
            Gabung Sesi
          </Button>
        </form>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        {joinedMsg ? <p className="mt-2 text-sm text-emerald-700">{joinedMsg}</p> : null}
      </CardContent>
    </Card>
  );
}
