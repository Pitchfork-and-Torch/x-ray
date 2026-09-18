/* X-Ray v3 - Anchored Reality */
import {
  state,
  VERSION,
  loadSettings,
  saveSettings,
  saveLocale,
} from "./state.js";
import { t, applyLocale } from "./i18n.js";
import { startCamera, stopCamera } from "./camera.js";
import {
  orientationSupported,
  needsOrientationPermission,
  startOrientation,
  stopOrientation,
} from "./sensors/orientation.js";
import { reanchor, ingestPose } from "./sensors/fusion.js";
import {
  buildPosts,
  applyWorldTransform,
  updateLockBadge,
} from "./render/depth-stack.js";
import { sampleAmbient, resetAmbient } from "./ambient.js";
import { captureStill, captureMoment, momentsSupported } from "./capture.js";
import {
  listCaptures,
  migrateLegacyGallery,
  loadApiKey,
  saveApiKey,
} from "./gallery-idb.js";
import { localInsight, enrichWithXai } from "./insights.js";
import { bindGestures } from "./gestures.js";
import {
  setSpatialAudioEnabled,
  updateSpatialAudio,
  disposeAudio,
} from "./audio-spatial.js";
import {
  createRoom,
  joinRoom,
  leaveRoom,
  roomInviteUrl,
  send as roomSend,
} from "./webrtc-room.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function toast(msg) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("is-on");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("is-on"), 1800);
}

function applyPrefs() {
  const s = state.settings;
  document.documentElement.classList.toggle("reduced-motion", !!s.reducedMotion);
  document.documentElement.classList.toggle("high-contrast", !!s.highContrast);
  document.documentElement.classList.toggle("battery-saver", !!s.batterySaver);
  document.documentElement.style.setProperty("--glass-blend", String(s.blend / 100));
  document.documentElement.style.setProperty("--depth-scale", String(s.depthScale || 1));

  $$(".post-card").forEach((card) => {
    card.style.setProperty(
      "--card-alpha",
      String(0.45 + s.blend / 180)
    );
  });

  const blend = $("#blendSlider");
  if (blend) blend.value = String(s.blend);

  const map = [
    ["setWalkSafe", "walkSafe"],
    ["setInsights", "showInsights"],
    ["setBattery", "batterySaver"],
    ["setReduced", "reducedMotion"],
    ["setContrast", "highContrast"],
    ["setWorldLock", "worldLock"],
    ["setSpatialAudio", "spatialAudio"],
  ];
  map.forEach(([id, key]) => {
    const el = $(`#${id}`);
    if (el) el.checked = !!s[key];
  });

  updateLockBadge();
  setSpatialAudioEnabled(!!s.spatialAudio && state.arOpen);
}

function setMode(mode, silent) {
  state.mode = mode;
  $$(".mode-pill").forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.dataset.mode === mode ? "true" : "false");
  });
  const label = $("#modeLabel");
  if (label) label.textContent = mode === "live" ? t(state, "live") : t(state, "ambient");
  if (!silent) {
    if (mode === "live") {
      startCamera().then((r) => {
        if (r.ok) toast(t(state, "toastCam"));
        else {
          setMode("demo", true);
          toast(t(state, "toastDenied"));
        }
      });
    } else {
      stopCamera();
      resetAmbient();
      toast(t(state, "toastDemo"));
    }
  }
}

function loop(now) {
  if (!state.arOpen) return;
  applyWorldTransform();
  sampleAmbient(now);
  updateSpatialAudio();
  const fpsWait = state.settings.batterySaver ? 33 : 0;
  if (fpsWait) {
    setTimeout(() => {
      state.rafId = requestAnimationFrame(loop);
    }, fpsWait);
  } else {
    state.rafId = requestAnimationFrame(loop);
  }
}

function startLoop() {
  cancelAnimationFrame(state.rafId);
  state.rafId = requestAnimationFrame(loop);
}

function stopLoop() {
  cancelAnimationFrame(state.rafId);
  state.rafId = 0;
}

async function tryEnableWorldLock(fromGesture) {
  if (state.settings.reducedMotion || !state.settings.worldLock) {
    state.lock.status = "fallback";
    state.lock.available = false;
    updateLockBadge();
    return false;
  }
  if (!orientationSupported()) {
    state.lock.status = "fallback";
    state.lock.available = false;
    updateLockBadge();
    return false;
  }
  if (needsOrientationPermission() && !fromGesture) {
    state.lock.status = "fallback";
    state.lock.available = false;
    updateLockBadge();
    $("#btnEnableLock")?.classList.remove("is-hidden");
    return false;
  }

  state.lock.status = "requesting";
  updateLockBadge();
  const res = await startOrientation((pose) => ingestPose(pose));
  if (!res.ok) {
    state.lock.status = "fallback";
    state.lock.available = false;
    updateLockBadge();
    toast(t(state, "toastLockDenied"));
    $("#btnEnableLock")?.classList.remove("is-hidden");
    return false;
  }
  state.lock.available = true;
  reanchor();
  state.lock.status = "active";
  updateLockBadge();
  $("#btnEnableLock")?.classList.add("is-hidden");
  toast(t(state, "toastLockOn"));
  return true;
}

function openAr(preferLive) {
  state.arOpen = true;
  $("#arRoot").classList.add("is-open");
  $("#arRoot").setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  buildPosts();
  applyLocale(state);
  applyPrefs();
  if (preferLive) {
    startCamera().then((r) => {
      if (r.ok) {
        setMode("live", true);
        toast(t(state, "toastCam"));
      } else {
        setMode("demo", true);
        toast(t(state, "toastDenied"));
      }
    });
  } else {
    stopCamera();
    setMode("demo", true);
    toast(t(state, "toastDemo"));
  }
  startLoop();
  // auto-try lock when no iOS permission gate
  if (state.settings.worldLock && !state.settings.reducedMotion) {
    if (!needsOrientationPermission()) {
      void tryEnableWorldLock(true);
    } else {
      state.lock.status = "fallback";
      updateLockBadge();
      $("#btnEnableLock")?.classList.remove("is-hidden");
    }
  }
  setTimeout(() => $("#btnExit")?.focus(), 50);
}

function closeAr() {
  state.arOpen = false;
  stopLoop();
  stopCamera();
  stopOrientation();
  disposeAudio();
  void leaveRoom();
  $("#arRoot").classList.remove("is-open");
  $("#arRoot").setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  closeSheets();
  state.lock.status = "fallback";
  state.lock.available = false;
}

function onFeedScroll() {
  if (!state.settings.walkSafe) {
    $$(".chrome").forEach((c) => c.classList.remove("is-hidden"));
    $("#arVignette")?.classList.remove("is-scrolling");
    return;
  }
  $$(".chrome").forEach((c) => c.classList.add("is-hidden"));
  $("#arVignette")?.classList.add("is-scrolling");
  clearTimeout(state.scrollHideTimer);
  state.scrollHideTimer = setTimeout(() => {
    $$(".chrome").forEach((c) => c.classList.remove("is-hidden"));
    $("#arVignette")?.classList.remove("is-scrolling");
  }, 900);
}

function openSheet(id) {
  closeSheets();
  const el = document.getElementById(id);
  if (el) {
    el.classList.add("is-open");
    el.setAttribute("aria-hidden", "false");
  }
}

function closeSheets() {
  $$(".sheet-backdrop").forEach((el) => {
    el.classList.remove("is-open");
    el.setAttribute("aria-hidden", "true");
  });
}

async function showCapturePreview(result) {
  const img = $("#captureImg");
  const vid = $("#captureVideo");
  if (result.kind === "moment") {
    if (img) img.hidden = true;
    if (vid) {
      vid.hidden = false;
      vid.src = result.dataUrl;
    }
  } else {
    if (vid) {
      vid.removeAttribute("src");
      vid.hidden = true;
    }
    if (img) {
      img.hidden = false;
      img.src = result.dataUrl;
    }
  }
  openSheet("captureSheet");
}

async function doCaptureStill() {
  const flash = $("#captureFlash");
  flash?.classList.remove("is-on");
  void flash?.offsetWidth;
  flash?.classList.add("is-on");
  const result = await captureStill();
  await showCapturePreview(result);
  toast(t(state, "toastCap"));
}

async function doCaptureMoment() {
  if (!momentsSupported()) {
    toast("Moments unavailable - still capture only");
    return doCaptureStill();
  }
  const label = $("#modeLabel");
  const prev = label?.textContent;
  if (label) label.textContent = t(state, "recording");
  try {
    const result = await captureMoment(state.settings.momentSeconds || 3);
    await showCapturePreview(result);
    toast(t(state, "toastMoment"));
  } catch (_) {
    toast("Moment failed");
  } finally {
    if (label) label.textContent = prev || t(state, "ambient");
  }
}

async function loadGalleryUi() {
  const grid = $("#galleryGrid");
  if (!grid) return;
  const list = await listCaptures();
  if (!list.length) {
    grid.innerHTML = `<p class="empty-state" data-i18n="emptyGallery">${t(state, "emptyGallery")}</p>`;
    return;
  }
  grid.innerHTML = list
    .map((item) => {
      if (item.kind === "moment") {
        return `<a href="${item.dataUrl}" download="xray-${item.id}.webm" class="gallery-item is-video"><video src="${item.dataUrl}" muted playsinline></video><span class="tag">Moment</span></a>`;
      }
      return `<a href="${item.dataUrl}" download="xray-${item.id}.png" class="gallery-item"><img src="${item.dataUrl}" alt="X-Ray capture ${item.id}" /></a>`;
    })
    .join("");
}

function showInsightOnCard(card) {
  const slot = card.querySelector("[data-insight-slot]");
  if (!slot) return;
  const text = localInsight(card);
  slot.textContent = text;
  slot.hidden = false;
  card.classList.add("is-insight-open");
}

function onRoomMessage(msg) {
  if (!msg || msg.v !== 3) return;
  if (msg.type === "presence") {
    const peers = new Set(state.room.peers);
    peers.add(msg.peerId);
    state.room.peers = [...peers];
    const el = $("#roomStatus");
    if (el) el.textContent = `${state.room.peers.length} ${t(state, "peerHere")}`;
  }
  if (msg.type === "reaction") {
    toast(`${msg.peerId?.slice(0, 4) || "peer"} ${msg.reaction || "✨"}`);
  }
  if (msg.type === "handles" && msg.handles?.length) {
    state.settings.handles = msg.handles.join(", ");
    saveSettings();
    buildPosts();
  }
}

function bind() {
  $("#btnDemo")?.addEventListener("click", () => {
    if (!state.settings.seenOnboarding) openSheet("onboardingSheet");
    else openAr(false);
  });
  $("#btnEnter")?.addEventListener("click", () => openAr(true));
  $("#btnExit")?.addEventListener("click", closeAr);
  $("#btnCapture")?.addEventListener("click", () => void doCaptureStill());
  $("#btnMoment")?.addEventListener("click", () => void doCaptureMoment());
  $("#btnSettings")?.addEventListener("click", async () => {
    const key = await loadApiKey();
    state.settings.apiKey = key;
    const input = $("#apiKeyInput");
    if (input) input.value = key ? "••••••••" : "";
    openSheet("settingsSheet");
  });
  $("#btnGallery")?.addEventListener("click", async () => {
    await loadGalleryUi();
    openSheet("gallerySheet");
  });
  $("#btnVectors")?.addEventListener("click", () => {
    $("#handlesInput").value = state.settings.handles || "";
    const rs = $("#roomStatus");
    if (rs) {
      rs.textContent = state.room.id
        ? `${state.room.id} · ${state.room.connected ? "connected" : "..."}`
        : "";
    }
    openSheet("vectorsSheet");
  });
  $("#btnReanchor")?.addEventListener("click", () => {
    if (state.lock.available) {
      reanchor();
      updateLockBadge();
      toast(t(state, "toastReanchor"));
    } else {
      void tryEnableWorldLock(true);
    }
  });
  $("#btnEnableLock")?.addEventListener("click", () => void tryEnableWorldLock(true));

  $$(".mode-pill").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  $("#blendSlider")?.addEventListener("input", (e) => {
    state.settings.blend = Number(e.target.value);
    saveSettings();
    applyPrefs();
  });

  $("#feedScroll")?.addEventListener("scroll", onFeedScroll, { passive: true });

  $$(".locale-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      saveLocale(btn.dataset.locale);
      applyLocale(state);
    });
  });

  const prefMap = [
    ["setWalkSafe", "walkSafe"],
    ["setInsights", "showInsights"],
    ["setBattery", "batterySaver"],
    ["setReduced", "reducedMotion"],
    ["setContrast", "highContrast"],
    ["setWorldLock", "worldLock"],
    ["setSpatialAudio", "spatialAudio"],
  ];
  prefMap.forEach(([id, key]) => {
    $(`#${id}`)?.addEventListener("change", (e) => {
      state.settings[key] = e.target.checked;
      if (key === "reducedMotion" && e.target.checked) {
        state.lock.status = "fallback";
        stopOrientation();
        state.lock.available = false;
      }
      if (key === "worldLock" && e.target.checked && state.arOpen) {
        void tryEnableWorldLock(true);
      }
      if (key === "worldLock" && !e.target.checked) {
        state.lock.status = "off";
        stopOrientation();
        state.lock.available = false;
        toast(t(state, "toastLockOff"));
      }
      if (key === "spatialAudio") setSpatialAudioEnabled(e.target.checked);
      if (key === "showInsights") buildPosts();
      saveSettings();
      applyPrefs();
    });
  });

  $("#btnApplyHandles")?.addEventListener("click", () => {
    state.settings.handles = $("#handlesInput").value.trim();
    saveSettings();
    buildPosts();
    roomSend({
      v: 3,
      type: "handles",
      peerId: "local",
      handles: state.settings.handles.split(/[,;\s]+/).filter(Boolean),
      t: Date.now(),
    });
    closeSheets();
    toast(t(state, "apply"));
  });

  $("#btnCreateRoom")?.addEventListener("click", async () => {
    try {
      const r = await createRoom(onRoomMessage, () => {
        const el = $("#roomStatus");
        if (el && state.room.id) {
          el.textContent = `${state.room.id} · ${state.room.connected ? "connected" : "waiting"}`;
        }
      });
      $("#roomCodeInput").value = r.id;
      toast(t(state, "toastRoom"));
      const el = $("#roomStatus");
      if (el) el.textContent = `${r.id}${r.signalOk ? "" : " (local)"}`;
    } catch (_) {
      toast(t(state, "toastRoomFail"));
    }
  });

  $("#btnJoinRoom")?.addEventListener("click", async () => {
    try {
      const id = $("#roomCodeInput").value.trim();
      await joinRoom(id, onRoomMessage, () => {});
      toast(t(state, "toastRoomJoin"));
    } catch (_) {
      toast(t(state, "toastRoomFail"));
    }
  });

  $("#btnCopyInvite")?.addEventListener("click", async () => {
    const url = roomInviteUrl() || `${location.origin}/?room=${$("#roomCodeInput").value.trim()}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(t(state, "copyInvite"));
    } catch (_) {
      toast(url);
    }
  });

  $("#btnLeaveRoom")?.addEventListener("click", async () => {
    await leaveRoom();
    $("#roomStatus").textContent = "";
    toast(t(state, "leaveRoom"));
  });

  $("#btnSaveKey")?.addEventListener("click", async () => {
    const v = $("#apiKeyInput").value.trim();
    if (v && !v.startsWith("•")) {
      await saveApiKey(v);
      state.settings.apiKey = v;
      toast(t(state, "saveKey"));
    }
  });
  $("#btnClearKey")?.addEventListener("click", async () => {
    await saveApiKey("");
    state.settings.apiKey = "";
    $("#apiKeyInput").value = "";
    toast(t(state, "clearKey"));
  });

  $("#btnWhatsNew")?.addEventListener("click", () => openSheet("whatsNewSheet"));
  $("#btnPrivacy")?.addEventListener("click", () => openSheet("privacySheet"));
  $("#btnChangelog")?.addEventListener("click", () => openSheet("changelogSheet"));

  $("#btnOnboardContinue")?.addEventListener("click", async () => {
    state.settings.seenOnboarding = true;
    saveSettings();
    closeSheets();
    openAr(false);
    await tryEnableWorldLock(true);
  });
  $("#btnOnboardSkip")?.addEventListener("click", () => {
    state.settings.seenOnboarding = true;
    state.settings.worldLock = false;
    saveSettings();
    closeSheets();
    openAr(false);
  });

  $$("[data-close-sheet]").forEach((btn) => btn.addEventListener("click", closeSheets));
  $$(".sheet-backdrop").forEach((bd) => {
    bd.addEventListener("click", (e) => {
      if (e.target === bd) closeSheets();
    });
  });

  $("#btnDownload")?.addEventListener("click", () => {
    if (!state.lastCapture) return;
    const a = document.createElement("a");
    a.href = state.lastCapture;
    a.download =
      state.lastCaptureKind === "moment"
        ? `xray-${Date.now()}.webm`
        : `xray-${Date.now()}.png`;
    a.click();
  });

  $("#btnShare")?.addEventListener("click", async () => {
    if (!state.lastCapture || !navigator.share) return;
    try {
      const res = await fetch(state.lastCapture);
      const blob = await res.blob();
      const ext = state.lastCaptureKind === "moment" ? "webm" : "png";
      const file = new File([blob], `xray-capture.${ext}`, { type: blob.type });
      await navigator.share({
        files: [file],
        title: "X-Ray",
        text: "Mixed-reality capture · on-device",
      });
      toast(t(state, "toastShare"));
    } catch (_) {}
  });

  // long-press / double-tap insights
  let pressTimer = 0;
  $("#feedInner")?.addEventListener("pointerdown", (e) => {
    const card = e.target.closest?.(".post-card");
    if (!card) return;
    pressTimer = setTimeout(() => showInsightOnCard(card), 480);
  });
  $("#feedInner")?.addEventListener("pointerup", () => clearTimeout(pressTimer));
  $("#feedInner")?.addEventListener("pointerleave", () => clearTimeout(pressTimer));
  $("#feedInner")?.addEventListener("dblclick", (e) => {
    const card = e.target.closest?.(".post-card");
    if (card) {
      card.classList.toggle("is-focused");
      showInsightOnCard(card);
    }
  });

  $("#btnEnrichInsight")?.addEventListener("click", async () => {
    const card = document.querySelector(".post-card.is-insight-open, .post-card.is-focused");
    if (!card) return;
    const key = state.settings.apiKey || (await loadApiKey());
    if (!key) {
      toast(t(state, "apiKeyHint"));
      return;
    }
    try {
      const body = card.querySelector(".post-body")?.textContent || "";
      const out = await enrichWithXai(body, key);
      const slot = card.querySelector("[data-insight-slot]");
      if (slot) {
        slot.textContent = out;
        slot.hidden = false;
      }
    } catch (_) {
      toast("Enrich failed");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if ($$(".sheet-backdrop.is-open").length) closeSheets();
      else if (state.arOpen) closeAr();
    }
    if (!state.arOpen) return;
    if (e.key === "r" || e.key === "R") {
      if (state.lock.available) {
        reanchor();
        updateLockBadge();
        toast(t(state, "toastReanchor"));
      }
    }
    if (e.key === " " && e.target === document.body) {
      e.preventDefault();
      void doCaptureStill();
    }
  });

  bindGestures({
    onDepthScale: () => {
      document.documentElement.style.setProperty(
        "--depth-scale",
        String(state.settings.depthScale || 1)
      );
      applyWorldTransform();
    },
  });

  // deep links
  try {
    const params = new URLSearchParams(location.search);
    if (params.get("whatsnew") === "1") openSheet("whatsNewSheet");
    if (params.get("demo") === "1") openAr(false);
    else if (params.get("xray") === "1" || params.get("connect") === "1") openAr(true);
    const room = params.get("room");
    if (room) {
      if (room.includes("@") || room.includes(",")) {
        state.settings.handles = decodeURIComponent(room).replace(/[+|]/g, ",");
        saveSettings();
        openAr(false);
      } else {
        openAr(false);
        joinRoom(room, onRoomMessage, () => {}).then(() => toast(t(state, "toastRoomJoin")));
      }
    }
    if (params.get("lock") === "0") {
      state.settings.worldLock = false;
      saveSettings();
    }
    if (
      [...params.keys()].some((k) =>
        ["demo", "xray", "connect", "room", "lock", "whatsnew"].includes(k)
      )
    ) {
      ["demo", "xray", "connect", "room", "lock", "whatsnew"].forEach((k) => params.delete(k));
      const q = params.toString();
      history.replaceState({}, "", location.pathname + (q ? `?${q}` : "") + location.hash);
    }
  } catch (_) {}

  if (!navigator.share) {
    const s = $("#btnShare");
    if (s) s.hidden = true;
  }
  if (!momentsSupported()) {
    const m = $("#btnMoment");
    if (m) m.hidden = true;
  }

  if (!state.settings.seenWhatsNew) {
    // soft prompt once on landing, not blocking
    setTimeout(() => {
      if (!state.arOpen && !state.settings.seenWhatsNew) {
        openSheet("whatsNewSheet");
        state.settings.seenWhatsNew = true;
        saveSettings();
      }
    }, 600);
  }
}

async function init() {
  loadSettings();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    state.settings.reducedMotion = true;
  }
  // Version labels only on explicit spans (never [data-version] alone - risk of root wipe).
  document.documentElement.dataset.appVersion = VERSION;
  document.querySelectorAll("span[data-xray-version]").forEach((el) => {
    el.textContent = `v${VERSION}`;
  });

  applyLocale(state);
  applyPrefs();
  bind();

  try {
    await migrateLegacyGallery();
    state.settings.apiKey = await loadApiKey();
  } catch (_) {}

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
