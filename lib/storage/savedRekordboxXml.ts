"use client";

const DB_NAME = "playlist-shopper";
const DB_VERSION = 1;
const STORE_NAME = "saved-rekordbox-xml";
const RECORD_ID = "current";

export type SavedRekordboxXmlMeta = {
  filename: string;
  uploadedAt: string;
  lastModified: number;
  size: number;
  type: string;
};

type SavedRekordboxXmlRecord = {
  id: typeof RECORD_ID;
  blob: Blob;
  meta: SavedRekordboxXmlMeta;
};

export type SavedRekordboxXml = {
  file: File;
  meta: SavedRekordboxXmlMeta;
};

function ensureIndexedDb() {
  if (typeof indexedDB === "undefined") {
    throw new Error("Saved XML storage is not available in this browser.");
  }
}

function openSavedXmlDb(): Promise<IDBDatabase> {
  ensureIndexedDb();

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open saved XML storage."));
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openSavedXmlDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = run(store);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(request.error ?? new Error("Saved XML storage failed."));
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => {
          db.close();
          reject(transaction.error ?? new Error("Saved XML storage failed."));
        };
        transaction.onabort = () => {
          db.close();
          reject(transaction.error ?? new Error("Saved XML storage failed."));
        };
      }),
  );
}

function toFile(record: SavedRekordboxXmlRecord): File {
  return new File([record.blob], record.meta.filename, {
    type: record.meta.type || "text/xml",
    lastModified: record.meta.lastModified,
  });
}

export async function saveRekordboxXmlFile(
  file: File,
): Promise<SavedRekordboxXmlMeta> {
  const meta: SavedRekordboxXmlMeta = {
    filename: file.name,
    uploadedAt: new Date().toISOString(),
    lastModified: file.lastModified,
    size: file.size,
    type: file.type || "text/xml",
  };
  const record: SavedRekordboxXmlRecord = {
    id: RECORD_ID,
    blob: file.slice(0, file.size, meta.type),
    meta,
  };

  await withStore("readwrite", (store) => store.put(record));
  return meta;
}

export async function getSavedRekordboxXmlMeta(): Promise<SavedRekordboxXmlMeta | null> {
  const record = await withStore<SavedRekordboxXmlRecord | undefined>(
    "readonly",
    (store) => store.get(RECORD_ID),
  );
  return record?.meta ?? null;
}

export async function getSavedRekordboxXml(): Promise<SavedRekordboxXml | null> {
  const record = await withStore<SavedRekordboxXmlRecord | undefined>(
    "readonly",
    (store) => store.get(RECORD_ID),
  );
  if (!record) return null;

  return {
    file: toFile(record),
    meta: record.meta,
  };
}

export async function deleteSavedRekordboxXml(): Promise<void> {
  await withStore("readwrite", (store) => store.delete(RECORD_ID));
}
