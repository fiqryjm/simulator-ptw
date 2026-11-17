export interface OfflinePermitDraft {
  permitId: string;
  expectedVersion: number;
  dataJson: Record<string, unknown>;
  updatedAt: string;
}

const DB_NAME = 'simulator-ptw-offline';
const DB_VERSION = 1;
const STORE_NAME = 'permitDrafts';

function openDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'permitId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveOfflineDraft(draft: OfflinePermitDraft): Promise<void> {
  const db = await openDraftDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(draft);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineDraft(permitId: string): Promise<OfflinePermitDraft | null> {
  const db = await openDraftDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(permitId);
    req.onsuccess = () => resolve((req.result as OfflinePermitDraft | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearOfflineDraft(permitId: string): Promise<void> {
  const db = await openDraftDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(permitId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export type SyncDraftResult =
  | { status: 'synced' }
  | { status: 'conflict'; message: string }
  | { status: 'offline'; message: string }
  | { status: 'error'; message: string };

/**
 * Attempts to push a pending offline draft to the server PATCH endpoint.
 * Never overwrites server state silently on 409 conflict.
 */
export async function syncDraftPayload(
  draft: OfflinePermitDraft,
  fetchFn: typeof fetch = fetch,
): Promise<SyncDraftResult> {
  try {
    const res = await fetchFn(`/api/permits/${draft.permitId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedVersion: draft.expectedVersion,
        dataJson: draft.dataJson,
      }),
    });

    if (res.status === 409) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      return {
        status: 'conflict',
        message:
          json.error ??
          'Konflik versi: draf di server telah berubah. Muat ulang halaman sebelum menyimpan.',
      };
    }

    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      return {
        status: 'error',
        message: json.error ?? 'Gagal menyinkronkan draf offline',
      };
    }

    return { status: 'synced' };
  } catch {
    return {
      status: 'offline',
      message: 'Perangkat masih offline. Draf tetap tersimpan secara lokal.',
    };
  }
}
