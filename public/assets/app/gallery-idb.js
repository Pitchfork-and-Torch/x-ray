import { IDB_NAME, IDB_STORE, API_KEY_STORE, GALLERY_LEGACY_KEY } from "./state.js";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(API_KEY_STORE)) {
        db.createObjectStore(API_KEY_STORE, { keyPath: "k" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function migrateLegacyGallery() {
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(GALLERY_LEGACY_KEY) || "[]");
  } catch (_) {
    return;
  }
  if (!list.length) return;
  for (const item of list) {
    await putCapture({
      id: item.id || Date.now() + Math.random(),
      kind: "still",
      dataUrl: item.dataUrl,
      createdAt: item.id || Date.now(),
      mime: "image/png",
    });
  }
  try {
    localStorage.removeItem(GALLERY_LEGACY_KEY);
  } catch (_) {}
}

export async function putCapture(item) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(item);
    tx.oncomplete = () => {
      prune(db).then(resolve).catch(resolve);
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function prune(db) {
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = (req.result || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      if (all.length <= 40) {
        resolve();
        return;
      }
      for (let i = 40; i < all.length; i++) {
        store.delete(all[i].id);
      }
      tx.oncomplete = () => resolve();
    };
    req.onerror = () => resolve();
  });
}

export async function listCaptures() {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).getAll();
      req.onsuccess = () => {
        const all = (req.result || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        resolve(all);
      };
      req.onerror = () => resolve([]);
    });
  } catch (_) {
    return [];
  }
}

export async function saveApiKey(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(API_KEY_STORE, "readwrite");
    if (!key) tx.objectStore(API_KEY_STORE).delete("xai");
    else tx.objectStore(API_KEY_STORE).put({ k: "xai", v: key });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadApiKey() {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(API_KEY_STORE, "readonly");
      const req = tx.objectStore(API_KEY_STORE).get("xai");
      req.onsuccess = () => resolve(req.result?.v || "");
      req.onerror = () => resolve("");
    });
  } catch (_) {
    return "";
  }
}
