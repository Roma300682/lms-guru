/**
 * IndexedDB storage helper for large file attachments (Word, Excel, PDF).
 * Avoids localStorage 5MB quota limitations by storing binary dataUrls in IndexedDB
 * while keeping metadata lightweight in state and localStorage.
 */

const DB_NAME = 'GuruMapelLMS_Storage';
const DB_VERSION = 1;
const STORE_NAME = 'file_attachments';

// In-memory cache for fast synchronous retrieval
const memoryCache = new Map<string, string>();

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Save file attachment dataUrl into IndexedDB and memory cache
 */
export async function saveFileAttachment(fileId: string, dataUrl: string): Promise<void> {
  if (!fileId || !dataUrl) return;
  memoryCache.set(fileId, dataUrl);

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(dataUrl, fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB save failed, keeping in memory cache:', err);
  }
}

/**
 * Retrieve file attachment dataUrl by fileId
 */
export async function getFileAttachment(fileId: string): Promise<string | null> {
  if (!fileId) return null;

  if (memoryCache.has(fileId)) {
    return memoryCache.get(fileId) || null;
  }

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(fileId);

      request.onsuccess = () => {
        const result = request.result as string | undefined;
        if (result) {
          memoryCache.set(fileId, result);
          resolve(result);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Remove file attachment from IndexedDB and memory cache
 */
export async function deleteFileAttachment(fileId: string): Promise<void> {
  if (!fileId) return;
  memoryCache.delete(fileId);

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore error
  }
}
