// Local-first storage (DD-001): the library lives in the browser's IndexedDB on
// the client's own machine — no server. Shared across the extension's contexts
// (library tab, popup, background) because they share one extension origin.

const DB_NAME = 'my-links';
const DB_VERSION = 3;
const STORE = 'links';
const SEARCHES = 'searches'; // SCN-020 saved views
const COPIES = 'copies';     // SCN-016/017 saved page copies (readable / PDF), keyed by linkId

export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        os.createIndex('norm', 'norm', { unique: false });
        os.createIndex('savedAt', 'savedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(SEARCHES)) db.createObjectStore(SEARCHES, { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains(COPIES)) db.createObjectStore(COPIES, { keyPath: 'linkId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode, store = STORE) {
  return db.transaction(store, mode).objectStore(store);
}

export async function allLinks() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const rq = tx(db, 'readonly').getAll();
    rq.onsuccess = () => resolve(rq.result || []);
    rq.onerror = () => reject(rq.error);
  });
}

export async function putLink(link) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const rq = tx(db, 'readwrite').put(link);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}

export async function findByNorm(norm) {
  const links = await allLinks();
  return links.find((l) => l.norm === norm) || null;
}

export async function deleteLink(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const rq = tx(db, 'readwrite').delete(id);
    rq.onsuccess = () => resolve();
    rq.onerror = () => reject(rq.error);
  });
}

// --- Saved searches (SCN-020) ---
export async function allSearches() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const rq = tx(db, 'readonly', SEARCHES).getAll();
    rq.onsuccess = () => resolve(rq.result || []);
    rq.onerror = () => reject(rq.error);
  });
}
export async function putSearch(s) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const rq = tx(db, 'readwrite', SEARCHES).put(s);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}
export async function deleteSearch(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const rq = tx(db, 'readwrite', SEARCHES).delete(id);
    rq.onsuccess = () => resolve();
    rq.onerror = () => reject(rq.error);
  });
}

// --- Saved page copies (SCN-016/017) ---
export async function putCopy(copy) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const rq = tx(db, 'readwrite', COPIES).put(copy);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}
export async function allCopies() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const rq = tx(db, 'readonly', COPIES).getAll();
    rq.onsuccess = () => resolve(rq.result || []);
    rq.onerror = () => reject(rq.error);
  });
}
export async function getCopy(linkId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const rq = tx(db, 'readonly', COPIES).get(linkId);
    rq.onsuccess = () => resolve(rq.result || null);
    rq.onerror = () => reject(rq.error);
  });
}
export async function deleteCopy(linkId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const rq = tx(db, 'readwrite', COPIES).delete(linkId);
    rq.onsuccess = () => resolve();
    rq.onerror = () => reject(rq.error);
  });
}
