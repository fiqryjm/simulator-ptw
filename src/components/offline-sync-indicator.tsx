'use client';

import { Wifi, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  clearOfflineDraft,
  getOfflineDraft,
  saveOfflineDraft,
  syncDraftPayload,
} from '@/lib/offline-drafts';

export function OfflineSyncIndicator({
  permitId,
  expectedVersion,
  currentData,
  isEditable,
  onSynced,
}: {
  permitId: string;
  expectedVersion: number;
  currentData: Record<string, unknown>;
  isEditable: boolean;
  onSynced: () => Promise<void>;
}) {
  const [online, setOnline] = useState(true);
  const [pendingDraft, setPendingDraft] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const attemptSync = useCallback(async () => {
    const draft = await getOfflineDraft(permitId).catch(() => null);
    if (!draft) {
      setPendingDraft(false);
      return;
    }
    const result = await syncDraftPayload(draft);
    if (result.status === 'synced') {
      await clearOfflineDraft(permitId).catch(() => {});
      setPendingDraft(false);
      setConflictMessage(null);
      setSyncMessage('Draf offline berhasil disinkronkan.');
      await onSynced();
    } else if (result.status === 'conflict') {
      setConflictMessage(result.message);
      setSyncMessage(null);
    } else if (result.status === 'offline') {
      setSyncMessage(result.message);
    }
  }, [permitId, onSynced]);

  useEffect(() => {
    setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    getOfflineDraft(permitId)
      .then((d) => setPendingDraft(Boolean(d)))
      .catch(() => {});

    const handleOnline = () => {
      setOnline(true);
      void attemptSync();
    };
    const handleOffline = () => {
      setOnline(false);
      setSyncMessage('Mode offline aktif: perubahan draf disimpan ke IndexedDB lokal.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [permitId, attemptSync]);

  // Auto-save editable draft locally to IndexedDB
  useEffect(() => {
    if (!isEditable) return;
    const timer = setTimeout(() => {
      saveOfflineDraft({
        permitId,
        expectedVersion,
        dataJson: currentData,
        updatedAt: new Date().toISOString(),
      })
        .then(() => {
          if (!online) setPendingDraft(true);
        })
        .catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [permitId, expectedVersion, currentData, isEditable, online]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          data-testid="network-status-badge"
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-medium ${
            online
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-amber-300 bg-amber-50 text-amber-900'
          }`}
        >
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          <span>{online ? 'Online' : 'Offline (IndexedDB)'}</span>
        </span>
        {pendingDraft && online ? (
          <Button type="button" size="sm" variant="outline" onClick={attemptSync}>
            Sinkronkan Draf Offline
          </Button>
        ) : null}
        {syncMessage ? <span className="text-slate-600">{syncMessage}</span> : null}
      </div>

      {conflictMessage ? (
        <div
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800"
        >
          {conflictMessage}
        </div>
      ) : null}
    </div>
  );
}
