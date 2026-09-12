/* X-Ray v3 app state */
export const VERSION = "3.2.0";

export const STORAGE_KEY = "xray-v3-settings";
export const LOCALE_KEY = "xray-v3-locale";
export const GALLERY_LEGACY_KEY = "xray-v2-gallery";
export const IDB_NAME = "xray-v3";
export const IDB_STORE = "gallery";
export const API_KEY_STORE = "secrets";

/** @type {import('./types.js').AppState} */
export const state = {
  locale: "en",
  arOpen: false,
  mode: "demo", // demo | live
  stream: null,
  version: VERSION,
  settings: {
    walkSafe: true,
    showInsights: true,
    batterySaver: false,
    reducedMotion: false,
    highContrast: false,
    worldLock: true,
    spatialAudio: false,
    blend: 72,
    handles: "",
    depthScale: 1,
    momentSeconds: 3,
    apiKey: "",
    seenWhatsNew: false,
    seenOnboarding: false,
  },
  lock: {
    status: "fallback", // off | requesting | active | fallback | calibrating
    yaw0: 0,
    pitch0: 0,
    yaw: 0,
    pitch: 0,
    filtYaw: 0,
    filtPitch: 0,
    available: false,
  },
  scrollHideTimer: null,
  lastCapture: null,
  lastCaptureKind: "still",
  ambient: { r: 20, g: 24, b: 32, luma: 0.12 },
  room: {
    id: null,
    role: null,
    peers: [],
    connected: false,
  },
  rafId: 0,
  pointerParallax: { x: 0, y: 0 },
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) Object.assign(state.settings, JSON.parse(raw));
  } catch (_) {}
  // migrate v2 settings
  try {
    const v2 = localStorage.getItem("xray-v2-settings");
    if (v2 && !localStorage.getItem(STORAGE_KEY)) {
      const old = JSON.parse(v2);
      Object.assign(state.settings, {
        walkSafe: old.walkSafe ?? true,
        showInsights: old.showInsights ?? true,
        batterySaver: old.batterySaver ?? false,
        reducedMotion: old.reducedMotion ?? false,
        highContrast: old.highContrast ?? false,
        blend: old.blend ?? 72,
        handles: old.handles || "",
      });
      saveSettings();
    }
  } catch (_) {}
  try {
    const loc = localStorage.getItem(LOCALE_KEY) || localStorage.getItem("xray-v2-locale");
    if (loc) state.locale = loc;
  } catch (_) {}
}

export function saveSettings() {
  try {
    const copy = { ...state.settings };
    // never persist api key in the general settings blob name that looks syncable long-term
    // key is stored separately via gallery-idb secrets; strip from settings dump
    delete copy.apiKey;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
  } catch (_) {}
}

export function saveLocale(loc) {
  state.locale = loc;
  try {
    localStorage.setItem(LOCALE_KEY, loc);
  } catch (_) {}
}
