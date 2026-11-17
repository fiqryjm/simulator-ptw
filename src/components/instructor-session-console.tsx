'use client';

import { Role, SessionStatus } from '@prisma/client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PermitStatusBadge } from '@/components/permit-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ScenarioOption {
  id: string;
  title: string;
  industry: string;
}

interface TenantUserOption {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface SessionListItem {
  id: string;
  joinCode: string;
  status: SessionStatus;
  scenario: { title: string; industry: string };
}

interface LiveSessionSummary {
  id: string;
  joinCode: string;
  status: SessionStatus;
  version: number;
  scenario: { title: string; industry: string };
  permits: Array<{ id: string; status: string; currentVersion: number }>;
  participants: Array<{
    id: string;
    name: string;
    simulatedRole: Role;
    finalizedAt: string | null;
    flagCount: number;
    totalScore: number;
  }>;
  missedErrorsSummary: Array<{
    id: string;
    fieldPath: string;
    severity: string;
    description: string;
  }>;
  updatedAt: string;
}

const SIMULATED_ROLES: Role[] = [
  Role.APPLICANT,
  Role.SUPERVISOR,
  Role.ISSUER,
  Role.COORDINATOR,
];

export function InstructorSessionConsole({
  scenarios,
  tenantUsers,
  initialSessions,
  initialSelectedSessionId,
}: {
  scenarios: ScenarioOption[];
  tenantUsers: TenantUserOption[];
  initialSessions: SessionListItem[];
  initialSelectedSessionId?: string;
}) {
  const [sessions, setSessions] = useState<SessionListItem[]>(initialSessions);
  const [selectedScenarioId, setSelectedScenarioId] = useState(scenarios[0]?.id ?? '');
  const [activeSessionId, setActiveSessionId] = useState(
    initialSelectedSessionId ?? initialSessions[0]?.id ?? '',
  );
  const [summary, setSummary] = useState<LiveSessionSummary | null>(null);
  const [sseStatus, setSseStatus] = useState<'connected' | 'polling'>('connected');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchSummaryOnce = useCallback(async (sessionId: string) => {
    if (!sessionId) return;
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (res.ok) {
      const json = await res.json();
      setSummary(json.summary);
    }
  }, []);

  useEffect(() => {
    if (!activeSessionId) return;
    void fetchSummaryOnce(activeSessionId);

    const es = new EventSource(`/api/sessions/${activeSessionId}/stream`);
    es.addEventListener('summary', (evt) => {
      setSseStatus('connected');
      try {
        const parsed = JSON.parse((evt as MessageEvent).data) as Partial<LiveSessionSummary>;
        setSummary((prev) => (prev ? { ...prev, ...parsed } : (parsed as LiveSessionSummary)));
      } catch {
        // ignore parse error
      }
    });
    es.onerror = () => {
      setSseStatus('polling');
    };

    // Fallback polling when SSE is unavailable
    const poll = setInterval(() => {
      if (es.readyState === EventSource.CLOSED) {
        setSseStatus('polling');
        void fetchSummaryOnce(activeSessionId);
      }
    }, 6000);

    return () => {
      es.close();
      clearInterval(poll);
    };
  }, [activeSessionId, fetchSummaryOnce]);

  const handleCreateSession = async () => {
    if (!selectedScenarioId) return;
    setBusy(true);
    setMessage(null);
    try {
      const defaultParticipants = tenantUsers
        .filter((u) => SIMULATED_ROLES.includes(u.role))
        .map((u) => ({ userId: u.id, simulatedRole: u.role }));

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: selectedScenarioId,
          participants: defaultParticipants,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Gagal membuat sesi');

      const sc = scenarios.find((s) => s.id === selectedScenarioId);
      const newItem: SessionListItem = {
        id: json.session.id,
        joinCode: json.session.joinCode,
        status: json.session.status,
        scenario: { title: sc?.title ?? 'Skenario', industry: sc?.industry ?? '' },
      };
      setSessions((prev) => [newItem, ...prev]);
      setActiveSessionId(json.session.id);
      setMessage(`Sesi baru dibuat dengan kode gabung: ${json.session.joinCode}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Gagal membuat sesi');
    } finally {
      setBusy(false);
    }
  };

  const handleSwapRole = async (participantId: string, simulatedRole: Role) => {
    if (!activeSessionId) return;
    const res = await fetch(`/api/sessions/${activeSessionId}/participants`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, simulatedRole }),
    });
    if (res.ok) {
      await fetchSummaryOnce(activeSessionId);
    }
  };

  const handleReset = async () => {
    if (!activeSessionId || !summary) return;
    if (
      !window.confirm(
        'Reset sesi akan mengembalikan izin, JSA, tanda tangan, dan skor ke kondisi awal skenario. Lanjutkan?',
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${activeSessionId}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedVersion: summary.version }),
      });
      if (res.ok) {
        setMessage('Sesi berhasil di-reset ke kondisi awal skenario.');
        await fetchSummaryOnce(activeSessionId);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    if (!activeSessionId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${activeSessionId}/close`, { method: 'POST' });
      if (res.ok) {
        setMessage('Sesi ditutup. Umpan balik kini terbuka bagi seluruh peserta.');
        await fetchSummaryOnce(activeSessionId);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buat Sesi Pelatihan Baru (FR-10)</CardTitle>
          <CardDescription>
            Pilih skenario dari perpustakaan 3 sektor untuk memulai simulasi kelas.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Pilih Skenario"
            value={selectedScenarioId}
            onChange={(e) => setSelectedScenarioId(e.target.value)}
            className="h-10 min-w-[280px] rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            {scenarios.map((sc) => (
              <option key={sc.id} value={sc.id}>
                [{sc.industry}] {sc.title}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="accent"
            disabled={busy || !selectedScenarioId}
            onClick={handleCreateSession}
            data-testid="create-session-btn"
          >
            Buat Sesi & Mulai
          </Button>
          {message ? <p className="w-full text-sm text-slate-700">{message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Sesi</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {sessions.map((s) => (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant={s.id === activeSessionId ? 'default' : 'outline'}
              onClick={() => setActiveSessionId(s.id)}
            >
              {s.joinCode} · {s.scenario.title} ({s.status})
            </Button>
          ))}
        </CardContent>
      </Card>

      {summary ? (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                Monitor Real-Time Sesi: {summary.joinCode} ({summary.status})
              </CardTitle>
              <CardDescription>
                Mode pemantauan: {sseStatus === 'connected' ? 'SSE Live' : 'Polling'} · v
                {summary.version}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={`/api/sessions/${summary.id}/export`}>
                <Button type="button" size="sm" variant="outline">
                  Ekspor CSV
                </Button>
              </a>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={handleReset}
                data-testid="reset-session-btn"
              >
                Reset Sesi
              </Button>
              <Button
                type="button"
                size="sm"
                variant="accent"
                disabled={busy || summary.status === SessionStatus.COMPLETED}
                onClick={handleClose}
                data-testid="close-session-btn"
              >
                Tutup Sesi
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Posisi Izin Kerja</h4>
              {summary.permits.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded border border-slate-200 p-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">#{p.id.slice(-8)}</span>
                    <PermitStatusBadge status={p.status as never} />
                    <span className="text-xs text-slate-500">v{p.currentVersion}</span>
                  </div>
                  <Link href={`/permits/${p.id}`}>
                    <Button size="sm" variant="outline">
                      Pantau (Read-Only)
                    </Button>
                  </Link>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Peserta, Peran & Skor Sementara</h4>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="p-2">Nama</th>
                      <th className="p-2">Peran Simulasi</th>
                      <th className="p-2">Flag</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Skor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.participants.map((p) => (
                      <tr key={p.id} className="border-b border-slate-100">
                        <td className="p-2 font-medium">{p.name}</td>
                        <td className="p-2">
                          <select
                            aria-label={`Peran untuk ${p.name}`}
                            value={p.simulatedRole}
                            onChange={(e) => handleSwapRole(p.id, e.target.value as Role)}
                            className="h-8 rounded border border-slate-300 bg-white px-2 text-xs"
                          >
                            {SIMULATED_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">{p.flagCount}</td>
                        <td className="p-2">{p.finalizedAt ? 'Selesai' : 'Berlatih'}</td>
                        <td className="p-2 font-bold text-[#0f2942]" data-testid={`score-${p.name}`}>
                          {p.totalScore.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <h4 className="font-semibold">
                Kesalahan Belum Ditemukan ({summary.missedErrorsSummary.length})
              </h4>
              {summary.missedErrorsSummary.length === 0 ? (
                <p className="text-emerald-700">Seluruh kesalahan skenario sudah terdeteksi.</p>
              ) : (
                <ul className="list-disc pl-5 text-slate-700">
                  {summary.missedErrorsSummary.map((e) => (
                    <li key={e.id}>
                      [{e.severity}] <code>{e.fieldPath}</code>: {e.description}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
