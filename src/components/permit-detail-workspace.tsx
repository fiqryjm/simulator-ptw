'use client';

import { AdditionalPermitStatus, PermitStatus, Role } from '@prisma/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DynamicFormRenderer } from '@/components/dynamic-form-renderer';
import { ErrorFlagPanel } from '@/components/error-flag-panel';
import { JsaForm, type JsaFormState } from '@/components/jsa-form';
import { OfflineSyncIndicator } from '@/components/offline-sync-indicator';
import { PermitStatusBadge } from '@/components/permit-status-badge';
import { SignaturePadField } from '@/components/signature-pad-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatInTenantTimezone } from '@/lib/datetime';
import {
  getLocalizedText,
  interpolateLocalizedText,
  type AdditionalPermitTemplateSchema,
  type PtwTemplateSchema,
} from '@/modules/permit/template-schema';

export interface PermitDetailPayload {
  permit: {
    id: string;
    status: PermitStatus;
    currentVersion: number;
    validFrom: string;
    validTo: string;
    dataJson: Record<string, unknown>;
    applicant: { name: string; email: string };
    session: { id: string; scenario: { title: string } };
    additionalPermits: Array<{
      id: string;
      type: string;
      status: AdditionalPermitStatus;
      dataJson: Record<string, unknown>;
    }>;
    jsaRecords: Array<{ dataJson: Partial<JsaFormState> }>;
    signatures: Array<{
      role: Role;
      imageData: string;
      signedAt: string;
      user: { name: string };
    }>;
    transitions: Array<{
      id: string;
      fromStatus: PermitStatus;
      toStatus: PermitStatus;
      actorRole: string;
      comment: string | null;
      at: string;
    }>;
    supervisionNotes: Array<{
      id: string;
      text: string;
      at: string;
      author: { name: string };
    }>;
  };
  ptwTemplate: PtwTemplateSchema;
  additionalTemplates: Record<string, AdditionalPermitTemplateSchema>;
  tenantSettings: { heightThresholdMeters?: number; timezone?: string };
}

export function PermitDetailWorkspace({
  initialDetail,
  effectiveRole,
  locale,
  availableFieldPaths = [],
}: {
  initialDetail: PermitDetailPayload;
  effectiveRole: Role;
  locale: string;
  availableFieldPaths?: string[];
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<PermitDetailPayload>(initialDetail);
  const [ptwData, setPtwData] = useState<Record<string, unknown>>(
    initialDetail.permit.dataJson ?? {},
  );
  const [additionalDataMap, setAdditionalDataMap] = useState<
    Record<string, Record<string, unknown>>
  >(() => {
    const map: Record<string, Record<string, unknown>> = {};
    for (const ap of initialDetail.permit.additionalPermits) {
      map[ap.id] = ap.dataJson ?? {};
    }
    return map;
  });
  const [comment, setComment] = useState('');
  const [prepChecklist, setPrepChecklist] = useState<Record<string, unknown>>({});
  const [postChecklist, setPostChecklist] = useState<Record<string, unknown>>({});
  const [supervisionText, setSupervisionText] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { permit, ptwTemplate, additionalTemplates, tenantSettings } = detail;
  const heightThreshold = tenantSettings.heightThresholdMeters ?? 1.8;
  const timezone = tenantSettings.timezone ?? 'Asia/Jakarta';
  const isEditable =
    effectiveRole === Role.APPLICANT &&
    (permit.status === PermitStatus.DRAFT || permit.status === PermitStatus.RETURNED);

  const refreshDetail = async () => {
    const res = await fetch(`/api/permits/${permit.id}`);
    if (res.ok) {
      const next = (await res.json()) as PermitDetailPayload;
      setDetail(next);
      setPtwData(next.permit.dataJson ?? {});
      const map: Record<string, Record<string, unknown>> = {};
      for (const ap of next.permit.additionalPermits) {
        map[ap.id] = ap.dataJson ?? {};
      }
      setAdditionalDataMap(map);
    }
    router.refresh();
  };

  const handleSaveDraft = async () => {
    setBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/permits/${permit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedVersion: permit.currentVersion,
          dataJson: ptwData,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? 'Gagal menyimpan draf PTW');
      }
      setStatusMessage('Draf PTW berhasil disimpan.');
      await refreshDetail();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal menyimpan draf');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAdditional = async (additionalId: string) => {
    setBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/permits/${permit.id}/additional/${additionalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataJson: additionalDataMap[additionalId] ?? {} }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Gagal menyimpan izin tambahan');
      setStatusMessage('Sub-formulir izin tambahan disimpan.');
      await refreshDetail();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal menyimpan izin tambahan');
    } finally {
      setBusy(false);
    }
  };

  const handleIssuerAdditionalDecision = async (
    additionalId: string,
    decision: 'APPROVED' | 'REJECTED',
  ) => {
    setBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/permits/${permit.id}/additional/${additionalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Gagal memproses izin tambahan');
      setStatusMessage(`Izin tambahan ${decision}.`);
      await refreshDetail();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal memproses izin tambahan');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveJsa = async (jsaData: JsaFormState) => {
    const res = await fetch(`/api/permits/${permit.id}/jsa`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsaData),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Gagal menyimpan JSA');
    await refreshDetail();
  };

  const handleSaveSignature = async (role: Role, imageData: string) => {
    const res = await fetch(`/api/permits/${permit.id}/signatures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, imageData }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Gagal menyimpan tanda tangan');
    await refreshDetail();
  };

  const handleTransition = async (
    toStatus: PermitStatus,
    extraPayload?: { checklist?: Record<string, unknown>; verifiedAndArchived?: boolean },
  ) => {
    setBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/permits/${permit.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toStatus,
          expectedVersion: permit.currentVersion,
          comment: comment || undefined,
          payload: extraPayload,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Transisi status ditolak');
      setComment('');
      setStatusMessage(`Status izin berhasil diubah ke ${toStatus}.`);
      await refreshDetail();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal mengubah status');
    } finally {
      setBusy(false);
    }
  };

  const handleAddNote = async () => {
    setBusy(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/permits/${permit.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: supervisionText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Gagal menambah catatan');
      setSupervisionText('');
      await refreshDetail();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal menambah catatan');
    } finally {
      setBusy(false);
    }
  };

  const applicantSig = permit.signatures.find((s) => s.role === Role.APPLICANT);
  const issuerSig = permit.signatures.find((s) => s.role === Role.ISSUER);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#0f2942]">Izin Kerja #{permit.id.slice(-8)}</h1>
            <PermitStatusBadge status={permit.status} />
            <span className="text-xs text-slate-500">v{permit.currentVersion}</span>
          </div>
          <p className="text-sm text-slate-600">
            Skenario: {permit.session.scenario.title} · Pemohon: {permit.applicant.name}
          </p>
          <p className="text-xs text-slate-500">
            Berlaku: {formatInTenantTimezone(permit.validFrom, timezone, locale)} —{' '}
            {formatInTenantTimezone(permit.validTo, timezone, locale)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              Kembali ke Dashboard
            </Button>
          </Link>
          <a href={`/api/permits/${permit.id}/pdf`} target="_blank" rel="noreferrer">
            <Button variant="accent" size="sm" data-testid="download-pdf-btn">
              Cetak PDF (Simulasi)
            </Button>
          </a>
        </div>
      </div>

      {errorMessage ? (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMessage}
        </div>
      ) : null}
      {statusMessage ? (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {statusMessage}
        </div>
      ) : null}

      <OfflineSyncIndicator
        permitId={permit.id}
        expectedVersion={permit.currentVersion}
        currentData={ptwData}
        isEditable={isEditable}
        onSynced={refreshDetail}
      />

      {/* PTW Dynamic Form */}
      <DynamicFormRenderer
        sections={ptwTemplate.sections}
        values={ptwData}
        locale={locale}
        heightThresholdMeters={heightThreshold}
        readOnly={!isEditable}
        onChange={(key, value) => setPtwData((prev) => ({ ...prev, [key]: value }))}
      />

      {isEditable ? (
        <div>
          <Button type="button" onClick={handleSaveDraft} disabled={busy} data-testid="save-draft-btn">
            Simpan Draf PTW
          </Button>
        </div>
      ) : null}

      {/* Auto-generated Additional Permits */}
      {permit.additionalPermits.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#0f2942]">Sub-Formulir Izin Tambahan</h2>
          {permit.additionalPermits.map((ap) => {
            const tpl = additionalTemplates[ap.type];
            const title = tpl
              ? getLocalizedText(
                  interpolateLocalizedText(tpl.title, { heightThresholdMeters: heightThreshold }),
                  locale,
                )
              : ap.type;

            return (
              <Card key={ap.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{title}</CardTitle>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold">
                    {ap.status}
                  </span>
                </CardHeader>
                <CardContent className="space-y-4">
                  {tpl ? (
                    <DynamicFormRenderer
                      sections={[{ key: ap.type, title: tpl.title, fields: tpl.fields }]}
                      values={additionalDataMap[ap.id] ?? {}}
                      locale={locale}
                      heightThresholdMeters={heightThreshold}
                      readOnly={!isEditable}
                      onChange={(key, value) =>
                        setAdditionalDataMap((prev) => ({
                          ...prev,
                          [ap.id]: { ...(prev[ap.id] ?? {}), [key]: value },
                        }))
                      }
                    />
                  ) : null}

                  {isEditable ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleSaveAdditional(ap.id)}
                      disabled={busy}
                      data-testid={`save-additional-${ap.type}`}
                    >
                      Simpan {ap.type}
                    </Button>
                  ) : null}

                  {effectiveRole === Role.ISSUER && permit.status === PermitStatus.PENDING_ISSUANCE ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleIssuerAdditionalDecision(ap.id, 'APPROVED')}
                        disabled={busy}
                        data-testid={`approve-additional-${ap.type}`}
                      >
                        Setujui {ap.type}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleIssuerAdditionalDecision(ap.id, 'REJECTED')}
                        disabled={busy}
                      >
                        Tolak {ap.type}
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* JSA Form */}
      <JsaForm
        initialData={permit.jsaRecords[0]?.dataJson ?? null}
        readOnly={!isEditable}
        onSave={handleSaveJsa}
      />

      {/* Signatures */}
      <div className="grid gap-4 md:grid-cols-2">
        <SignaturePadField
          title="Tanda Tangan Penerima Izin (APPLICANT)"
          existingImageData={applicantSig?.imageData}
          disabled={!isEditable}
          onSave={(img) => handleSaveSignature(Role.APPLICANT, img)}
        />
        <SignaturePadField
          title="Tanda Tangan Pemberi Izin (ISSUER)"
          existingImageData={issuerSig?.imageData}
          disabled={
            effectiveRole !== Role.ISSUER || permit.status !== PermitStatus.PENDING_ISSUANCE
          }
          onSave={(img) => handleSaveSignature(Role.ISSUER, img)}
        />
      </div>

      {/* Role-specific Workflow Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aksi Alur Kerja ({effectiveRole})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {effectiveRole === Role.APPLICANT &&
          (permit.status === PermitStatus.DRAFT || permit.status === PermitStatus.RETURNED) ? (
            <Button
              type="button"
              variant="accent"
              disabled={busy}
              onClick={() => handleTransition(PermitStatus.SUBMITTED)}
              data-testid="submit-permit-btn"
            >
              {permit.status === PermitStatus.RETURNED ? 'Ajukan Ulang Izin' : 'Ajukan Izin'}
            </Button>
          ) : null}

          {effectiveRole === Role.SUPERVISOR && permit.status === PermitStatus.SUBMITTED ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="supervisor-comment">
                  Catatan Review Metode & Dampak / Alasan Pengembalian atau Penolakan
                </Label>
                <Input
                  id="supervisor-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Isi catatan metode kerja dan dampak ke aktivitas lain..."
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => handleTransition(PermitStatus.PENDING_ISSUANCE)}
                  data-testid="supervisor-approve-btn"
                >
                  Setujui Review (Ke Pemberi Izin)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => handleTransition(PermitStatus.RETURNED)}
                >
                  Kembalikan ke Pemohon
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => handleTransition(PermitStatus.REJECTED)}
                >
                  Tolak Izin
                </Button>
              </div>
            </div>
          ) : null}

          {effectiveRole === Role.ISSUER && permit.status === PermitStatus.PENDING_ISSUANCE ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="issuer-comment">Catatan / Alasan (wajib jika mengembalikan/menolak)</Label>
                <Input
                  id="issuer-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="accent"
                  disabled={busy}
                  onClick={() => handleTransition(PermitStatus.APPROVED)}
                  data-testid="issuer-issue-btn"
                >
                  Terbitkan Izin (APPROVED)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => handleTransition(PermitStatus.RETURNED)}
                >
                  Kembalikan
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => handleTransition(PermitStatus.REJECTED)}
                >
                  Tolak
                </Button>
              </div>
            </div>
          ) : null}

          {effectiveRole === Role.APPLICANT && permit.status === PermitStatus.APPROVED ? (
            <div className="space-y-4">
              <DynamicFormRenderer
                sections={[
                  {
                    key: 'workplacePrep',
                    title: {
                      id: 'FR-35: Daftar Periksa Persiapan Tempat Kerja',
                      en: 'FR-35: Workplace Preparation Checklist',
                    },
                    fields: ptwTemplate.lifecycleChecklists.workplacePrep,
                  },
                ]}
                values={prepChecklist}
                locale={locale}
                heightThresholdMeters={heightThreshold}
                onChange={(k, v) => setPrepChecklist((prev) => ({ ...prev, [k]: v }))}
              />
              <Button
                type="button"
                variant="accent"
                disabled={busy}
                onClick={() =>
                  handleTransition(PermitStatus.ACTIVE, { checklist: prepChecklist })
                }
                data-testid="activate-permit-btn"
              >
                Mulai Pekerjaan (ACTIVE)
              </Button>
            </div>
          ) : null}

          {effectiveRole === Role.ISSUER && permit.status === PermitStatus.ACTIVE ? (
            <div className="space-y-3">
              <Input
                placeholder="Alasan penangguhan..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => handleTransition(PermitStatus.SUSPENDED)}
              >
                Tangguhkan Izin (SUSPENDED)
              </Button>
            </div>
          ) : null}

          {effectiveRole === Role.ISSUER && permit.status === PermitStatus.SUSPENDED ? (
            <div className="space-y-3">
              <Input
                placeholder="Catatan pemulihan (minimal 10 karakter)..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <Button
                type="button"
                disabled={busy}
                onClick={() => handleTransition(PermitStatus.ACTIVE)}
              >
                Aktifkan Kembali (ACTIVE)
              </Button>
            </div>
          ) : null}

          {effectiveRole === Role.APPLICANT && permit.status === PermitStatus.ACTIVE ? (
            <div className="space-y-4">
              <DynamicFormRenderer
                sections={[
                  {
                    key: 'postWorkInspection',
                    title: {
                      id: 'FR-35: Pemeriksaan Lokasi Pasca-Pekerjaan',
                      en: 'FR-35: Post-Work Site Inspection',
                    },
                    fields: ptwTemplate.lifecycleChecklists.postWorkInspection,
                  },
                ]}
                values={postChecklist}
                locale={locale}
                heightThresholdMeters={heightThreshold}
                onChange={(k, v) => setPostChecklist((prev) => ({ ...prev, [k]: v }))}
              />
              <Button
                type="button"
                variant="accent"
                disabled={busy}
                onClick={() =>
                  handleTransition(PermitStatus.COMPLETED, { checklist: postChecklist })
                }
                data-testid="complete-permit-btn"
              >
                Selesaikan Pekerjaan (COMPLETED)
              </Button>
            </div>
          ) : null}

          {effectiveRole === Role.ISSUER && permit.status === PermitStatus.COMPLETED ? (
            <Button
              type="button"
              variant="accent"
              disabled={busy}
              onClick={() =>
                handleTransition(PermitStatus.CLOSED, { verifiedAndArchived: true })
              }
              data-testid="close-permit-btn"
            >
              Verifikasi & Tutup Izin (CLOSED)
            </Button>
          ) : null}

          {effectiveRole === Role.COORDINATOR && permit.status === PermitStatus.ACTIVE ? (
            <div className="space-y-2">
              <Label htmlFor="coord-note">Catatan Pengawasan Lapangan</Label>
              <Input
                id="coord-note"
                value={supervisionText}
                onChange={(e) => setSupervisionText(e.target.value)}
                placeholder="Catat hasil pengawasan selama izin aktif..."
              />
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={handleAddNote}
                data-testid="add-supervision-note-btn"
              >
                Tambah Catatan Pengawasan
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Error Flagging & Feedback (M2) */}
      <ErrorFlagPanel
        permitId={permit.id}
        sessionId={permit.session.id}
        availableFieldPaths={availableFieldPaths}
        isInstructor={
          effectiveRole === Role.INSTRUCTOR ||
          effectiveRole === Role.TENANT_ADMIN ||
          effectiveRole === Role.SUPER_ADMIN
        }
      />

      {/* Supervision Notes & Transition History */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Catatan Pengawasan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {permit.supervisionNotes.length === 0 ? (
              <p className="text-slate-500">Belum ada catatan pengawasan.</p>
            ) : (
              permit.supervisionNotes.map((n) => (
                <div key={n.id} className="rounded border border-slate-200 p-2">
                  <div className="text-xs text-slate-500">
                    {n.author.name} · {formatInTenantTimezone(n.at, timezone, locale)}
                  </div>
                  <div>{n.text}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Riwayat Transisi Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {permit.transitions.length === 0 ? (
              <p className="text-slate-500">Belum ada transisi.</p>
            ) : (
              permit.transitions.map((t) => (
                <div key={t.id} className="rounded border border-slate-200 p-2">
                  <div className="font-semibold">
                    {t.fromStatus} &rarr; {t.toStatus} ({t.actorRole})
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatInTenantTimezone(t.at, timezone, locale)}
                  </div>
                  {t.comment ? <div className="text-slate-700">{t.comment}</div> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
