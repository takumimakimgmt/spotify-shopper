/**
 * IndexedDB を使ったBuylist状態管理
 * purchase_state / store_selected / notes / Apple制限カウント
 */

export type PurchaseState = 'need' | 'bought' | 'skipped' | 'ambiguous';
export type StoreSelected = 'beatport' | 'itunes' | 'bandcamp';

export interface TrackState {
  trackKeyPrimary: string; // ISRC or normalized key (from server)
  trackKeyFallback: string; // backup key (from server)
  trackKeyPrimaryType: 'isrc' | 'norm'; // UI hint: "isrc"=confident, "norm"=ambiguous
  title: string;
  artist: string;
  purchaseState: PurchaseState;
  storeSelected: StoreSelected;
  notes?: string;
  updatedAt: number;
}

export interface BuylistSnapshot {
  playlistId: string;
  playlistUrl: string;
  playlistName: string;
  tracks: TrackState[];
  createdAt: number;
  updatedAt: number;
}

export interface RateLimitState {
  appleRequestsToday: number;
  appleResetAt: number; // UTC timestamp
}

const DB_NAME = 'spotify-shopper';
const DB_VERSION = 1;
const BUYLIST_STORE = 'buylists';
const RATELIMIT_STORE = 'ratelimit';

let db: IDBDatabase | null = null;

/**
 * IndexedDB 初期化
 */
export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Buylist store: key = playlistId
      if (!database.objectStoreNames.contains(BUYLIST_STORE)) {
        const store = database.createObjectStore(BUYLIST_STORE, {
          keyPath: 'playlistId',
        });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // RateLimit store: single record
      if (!database.objectStoreNames.contains(RATELIMIT_STORE)) {
        database.createObjectStore(RATELIMIT_STORE);
      }
    };
  });
}

/**
 * Buylist を保存（プレイリスト単位）
 */
export async function saveBuylist(snapshot: BuylistSnapshot): Promise<void> {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const tx = db!.transaction([BUYLIST_STORE], 'readwrite');
    const store = tx.objectStore(BUYLIST_STORE);

    const data = {
      ...snapshot,
      updatedAt: Date.now(),
    };

    const request = store.put(data);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Buylist を取得（playlistIdで）
 */
export async function getBuylist(
  playlistId: string
): Promise<BuylistSnapshot | null> {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const tx = db!.transaction([BUYLIST_STORE], 'readonly');
    const store = tx.objectStore(BUYLIST_STORE);
    const request = store.get(playlistId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

/**
 * 特定トラックの状態を更新
 */
export async function updateTrackState(
  playlistId: string,
  trackKeyPrimary: string,
  updates: Partial<TrackState>
): Promise<void> {
  const snapshot = await getBuylist(playlistId);
  if (!snapshot) return;

  const trackIdx = snapshot.tracks.findIndex(
    (t) => t.trackKeyPrimary === trackKeyPrimary
  );
  if (trackIdx === -1) return;

  snapshot.tracks[trackIdx] = {
    ...snapshot.tracks[trackIdx],
    ...updates,
    updatedAt: Date.now(),
  };

  await saveBuylist(snapshot);
}

/**
 * トラック状態を取得
 */
export async function getTrackState(
  playlistId: string,
  trackKeyPrimary: string
): Promise<TrackState | null> {
  const snapshot = await getBuylist(playlistId);
  if (!snapshot) return null;

  return (
    snapshot.tracks.find((t) => t.trackKeyPrimary === trackKeyPrimary) || null
  );
}

/**
 * Apple 1日3回制限の状態を取得
 */
export async function getRateLimitState(): Promise<RateLimitState> {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const tx = db!.transaction([RATELIMIT_STORE], 'readonly');
    const store = tx.objectStore(RATELIMIT_STORE);
    const request = store.get('apple');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const data = request.result;

      // リセット時刻を確認（JST 00:00基準）
      const now = Date.now();
      const resetAt = data?.appleResetAt || getNextResetTime();

      if (now >= resetAt) {
        // リセット済み
        resolve({ appleRequestsToday: 0, appleResetAt: getNextResetTime() });
      } else {
        resolve(data || { appleRequestsToday: 0, appleResetAt: resetAt });
      }
    };
  });
}

/**
 * Apple リクエストカウント を increment
 */
export async function incrementAppleRequest(): Promise<RateLimitState> {
  if (!db) await initDB();

  return new Promise(async (resolve, reject) => {
    const current = await getRateLimitState();
    const updated: RateLimitState = {
      appleRequestsToday: current.appleRequestsToday + 1,
      appleResetAt: current.appleResetAt,
    };

    const tx = db!.transaction([RATELIMIT_STORE], 'readwrite');
    const store = tx.objectStore(RATELIMIT_STORE);
    const request = store.put(updated, 'apple');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(updated);
  });
}

/**
 * Apple リクエスト数をリセット
 */
export async function resetAppleRequest(): Promise<void> {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const tx = db!.transaction([RATELIMIT_STORE], 'readwrite');
    const store = tx.objectStore(RATELIMIT_STORE);
    const request = store.put(
      { appleRequestsToday: 0, appleResetAt: getNextResetTime() },
      'apple'
    );

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * 次の日付リセット時刻を計算（JST 00:00）
 */
function getNextResetTime(): number {
  const now = new Date();
  // JST（UTC+9）で次の00:00を計算
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const nextDay = new Date(
    jst.getFullYear(),
    jst.getMonth(),
    jst.getDate() + 1,
    0,
    0,
    0
  );
  return nextDay.getTime() - 9 * 60 * 60 * 1000; // UTC に戻す
}

/**
 * すべての Buylist を取得（履歴一覧用）
 */
export async function getAllBuylists(): Promise<BuylistSnapshot[]> {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const tx = db!.transaction([BUYLIST_STORE], 'readonly');
    const store = tx.objectStore(BUYLIST_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Buylist を削除
 */
export async function deleteBuylist(playlistId: string): Promise<void> {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const tx = db!.transaction([BUYLIST_STORE], 'readwrite');
    const store = tx.objectStore(BUYLIST_STORE);
    const request = store.delete(playlistId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
