'use client';

import { Role } from '@prisma/client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TenantSettings } from '@/lib/datetime';

interface TenantUserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
}

export function TenantAdminConsole({
  initialSettings,
  initialUsers,
}: {
  initialSettings: TenantSettings;
  initialUsers: TenantUserRow[];
}) {
  const [heightThreshold, setHeightThreshold] = useState(
    initialSettings.heightThresholdMeters ?? 1.8,
  );
  const [timezone, setTimezone] = useState(initialSettings.timezone ?? 'Asia/Jakarta');
  const [defaultLocale, setDefaultLocale] = useState<'id' | 'en'>(
    initialSettings.defaultLocale === 'en' ? 'en' : 'id',
  );
  const [weights, setWeights] = useState(initialSettings.scoringWeights);
  const [users, setUsers] = useState<TenantUserRow[]>(initialUsers);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<Role>(Role.APPLICANT);

  const [msg, setMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErrMsg(null);
    try {
      const res = await fetch('/api/tenant/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          heightThresholdMeters: Number(heightThreshold),
          timezone,
          defaultLocale,
          scoringWeights: weights,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Gagal menyimpan pengaturan');
      setMsg('Pengaturan tenant berhasil disimpan.');
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErrMsg(null);
    try {
      const res = await fetch('/api/tenant/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Gagal menambahkan pengguna');
      setUsers((prev) => [...prev, json.user]);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setMsg('Pengguna baru berhasil ditambahkan.');
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Gagal menambahkan pengguna');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (u: TenantUserRow) => {
    const res = await fetch(`/api/tenant/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    if (res.ok) {
      const json = await res.json();
      setUsers((prev) => prev.map((item) => (item.id === u.id ? json.user : item)));
    }
  };

  return (
    <div className="space-y-6">
      {errMsg ? (
        <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {errMsg}
        </div>
      ) : null}
      {msg ? (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          {msg}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pengaturan Tenant (FR-25 & Bobot Penilaian)</CardTitle>
          <CardDescription>
            Atur ambang kerja di ketinggian, zona waktu, dan bobot skor (total harus 100).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="height-threshold">Ambang Ketinggian (meter)</Label>
                <Input
                  id="height-threshold"
                  type="number"
                  step="0.1"
                  value={heightThreshold}
                  onChange={(e) => setHeightThreshold(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tenant-timezone">Zona Waktu</Label>
                <Input
                  id="tenant-timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tenant-locale">Bahasa Bawaan</Label>
                <select
                  id="tenant-locale"
                  value={defaultLocale}
                  onChange={(e) => setDefaultLocale(e.target.value as 'id' | 'en')}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                >
                  <option value="id">Indonesia (id)</option>
                  <option value="en">English (en)</option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="w-comp">Kelengkapan (%)</Label>
                <Input
                  id="w-comp"
                  type="number"
                  value={weights.documentCompleteness}
                  onChange={(e) =>
                    setWeights({ ...weights, documentCompleteness: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="w-haz">Bahaya (%)</Label>
                <Input
                  id="w-haz"
                  type="number"
                  value={weights.hazardIdentification}
                  onChange={(e) =>
                    setWeights({ ...weights, hazardIdentification: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="w-proc">Prosedur (%)</Label>
                <Input
                  id="w-proc"
                  type="number"
                  value={weights.procedureCompliance}
                  onChange={(e) =>
                    setWeights({ ...weights, procedureCompliance: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="w-add">Izin Tambahan (%)</Label>
                <Input
                  id="w-add"
                  type="number"
                  value={weights.additionalPermitsAndIsolation}
                  onChange={(e) =>
                    setWeights({
                      ...weights,
                      additionalPermitsAndIsolation: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <Button type="submit" disabled={busy} data-testid="save-tenant-settings-btn">
              Simpan Pengaturan Tenant
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kelola Pengguna Tenant (FR-04)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCreateUser} className="grid gap-3 sm:grid-cols-5">
            <Input
              placeholder="Nama"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <Input
              placeholder="Email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
            <Input
              placeholder="Kata sandi (min 8)"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <select
              aria-label="Peran pengguna baru"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as Role)}
              className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm"
            >
              <option value={Role.APPLICANT}>APPLICANT</option>
              <option value={Role.SUPERVISOR}>SUPERVISOR</option>
              <option value={Role.ISSUER}>ISSUER</option>
              <option value={Role.COORDINATOR}>COORDINATOR</option>
              <option value={Role.INSTRUCTOR}>INSTRUCTOR</option>
              <option value={Role.TENANT_ADMIN}>TENANT_ADMIN</option>
            </select>
            <Button type="submit" disabled={busy}>
              Tambah Pengguna
            </Button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="p-2">Nama</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Peran</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100">
                    <td className="p-2">{u.name}</td>
                    <td className="p-2">{u.email}</td>
                    <td className="p-2">{u.role}</td>
                    <td className="p-2">{u.isActive ? 'Aktif' : 'Nonaktif'}</td>
                    <td className="p-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleActive(u)}
                      >
                        {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
