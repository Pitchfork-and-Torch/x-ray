/* X-Ray v4 - Grounded Reality */
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
  activeLayoutCards,
  ensureMutableLayout,
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
  probeSignal,
  isSignalLive,
  getPeerId,
  setRoomOpenHandler,
} from "./webrtc-room.js";
import {
  PLACE_DEFAULTS,
  layoutFromPlace,
  listPlaces,
  placeFromLayout,
  restorePlace,
  savePlaceRecord,
  deletePlaceRecord,
} from "./places.js";
import {
  MAX_FEED_BYTES,
  exportFeedJson,
  loadOwnedFeed,
  mergeFeed,
  parseFeedText,
  saveOwnedFeed,
} from "./owned-feed.js";
import {
  MAX_SHARE_BYTES,
  buildAnchors,
  buildBye,
  buildNoteShare,
  buildPresence,
  buildReaction,
  ghostsFromMessage,
  parseShare,
  shareByteLength,
} from "./share-protocol.js";
import { gazeAngles, pinCard } from "./pins.js";
import { createNote } from "./notes.js";
import { probeImmersiveAr, startHitTest } from "./xr-hit.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function toast(msg) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("is-on");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("is-on"), 2200);
}

function announce(extra) {
  const live = $("#lockLive");
  if (!live) return;
  const lock = $("#lockBadge")?.textContent || "";
  live.textContent = extra ? `${lock}. ${extra}` : lock;
}

function handlesList() {
  return (state.settings.handles || "")
    .split(/[,;\s]+/)
    .map((h) => h.trim())
    .filter(Boolean);
}

function updateChips() {
  const place = $("#placeChip");
  const feed = $("#feedChip");
  if (place) {
    if (state.place && state.place.name) {
      place.hidden = false;
      place.textContent = state.place.name;
    } else {
      place.hidden = true;
      place.textContent = "";
    }
  }
  if (feed) {
    const n = state.feedSource === "owned" ? state.ownedCards.length : activeLayoutCards().length;
    feed.textContent = state.feedSource === "owned" ? `FEED OWNED ${n}` : "FEED DEMO";
  }
  $$("[data-feed-mode]").forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.dataset.feedMode === state.feedSource ? "true" : "false");
  });
}

function pulseLockMode() {
  if (state.xrOn) return "WEBXR";
  if (state.lock.status === "calibrating") return "CALIBRATING";
  if (state.lock.status === "active" && state.lock.available && state.settings.worldLock) return "WORLD LOCK";
  return "SCROLL DEPTH";
}

function updatePulse() {
  const version = `v${VERSION}`;
  const cache = "xray-v4.0.0";
  const cam = state.cameraPerm || "not requested";
  const feed =
    state.feedSource === "owned" ? `FEED OWNED ${state.ownedCards.length}` : "FEED DEMO";
  const room = state.room.id
    ? `${state.room.id} · ${state.room.peers.length} peers · ${state.room.channel}`
    : "none";
  const signal = state.signalLive || isSignalLive() ? "live" : "dead";
  const write = (sel, text) => $$(sel).forEach((el) => {
    el.textContent = text;
  });
  write(".pulse-version", version);
  write(".pulse-cache", cache);
  write(".pulse-camera", cam);
  write(".pulse-lock", pulseLockMode());
  write(".pulse-feed", feed);
  write(".pulse-places", String(state.placesCount || 0));
  write(".pulse-room", room);
  write(".pulse-signal", signal);
  const camEl = $("#pulse-camera");
  if (camEl) camEl.textContent = cam;
  updateChips();
}

function applyPrefs() {
  const s = state.settings;
  document.documentElement.classList.toggle("reduced-motion", !!s.reducedMotion);
  document.documentElement.classList.toggle("high-contrast", !!s.highContrast);
  document.documentElement.classList.toggle("battery-saver", !!s.batterySaver);
  document.documentElement.style.setProperty("--glass-blend", String(s.blend / 100));
  document.documentElement.style.setProperty("--depth-scale", String(s.depthScale || 1));

  $$(".post-card").forEach((card) => {
    card.style.setProperty("--card-alpha", String(0.45 + s.blend / 180));
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
  updateChips();
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
        updatePulse();
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
    announce(t(state, "toastLockOff"));
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
    announce(t(state, "toastLockDenied"));
    $("#btnEnableLock")?.classList.remove("is-hidden");
    return false;
  }
  state.lock.available = true;
  if (state.holdOrigin) {
    state.holdOrigin = false;
    state.lock.status = "active";
  } else {
    reanchor();
    state.lock.status = "active";
  }
  updateLockBadge();
  $("#btnEnableLock")?.classList.add("is-hidden");
  toast(t(state, "toastLockOn"));
  announce(t(state, "toastLockOn"));
  return true;
}

function showStage() {
  $("#arRoot").classList.add("is-open");
  $("#arRoot").setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  buildPosts();
  applyLocale(state);
  applyPrefs();
  startLoop();
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

function openAr(preferLive) {
  state.arOpen = true;
  if (preferLive) {
    showStage();
    startCamera().then((r) => {
      updatePulse();
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
    showStage();
    setMode("demo", true);
    toast(t(state, "toastDemo"));
  }
}

function closeAr() {
  state.arOpen = false;
  stopLoop();
  stopCamera();
  stopOrientation();
  disposeAudio();
  void endXr();
  if (state.room.id) {
    const bye = parseShare(buildBye(getPeerId()));
    if (bye.ok) roomSend(bye.msg);
  }
  void leaveRoom();
  $("#arRoot").classList.remove("is-open");
  $("#arRoot").setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  closeSheets();
  state.lock.status = "fallback";
  state.lock.available = false;
  updatePulse();
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

let sheetReturnFocus = null;

function openSheet(id) {
  const prev = document.activeElement;
  closeSheets({ restore: false });
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("is-open");
  el.setAttribute("aria-hidden", "false");
  const sheet = el.querySelector(".sheet");
  if (sheet) {
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    if (!sheet.hasAttribute("tabindex")) sheet.setAttribute("tabindex", "-1");
    const title = sheet.querySelector("h2, h3");
    if (title) {
      if (!title.id) title.id = id + "-title";
      sheet.setAttribute("aria-labelledby", title.id);
    }
    sheet.focus();
  }
  sheetReturnFocus = prev && prev !== document.body ? prev : null;
}

function closeSheets(opts) {
  $$(".sheet-backdrop").forEach((el) => {
    el.classList.remove("is-open");
    el.setAttribute("aria-hidden", "true");
  });
  const back = sheetReturnFocus;
  sheetReturnFocus = null;
  if ((!opts || opts.restore !== false) && back && typeof back.focus === "function") {
    back.focus();
  }
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
    grid.innerHTML = `<p class="empty-state">${t(state, "emptyGallery")}</p>`;
    return;
  }
  grid.innerHTML = list
    .map((item) => {
      if (item.kind === "moment") {
        return `<a href="${item.dataUrl}" download="xray-${item.id}.webm" class="gallery-item is-video"><video src="${item.dataUrl}" muted playsinline></video><span class="tag">Moment</span></a>`;
      }
      return `<a href="${item.dataUrl}" download="xray-${item.id}.png" class="gallery-item"><img src="${item.dataUrl}" alt="X-Ray capture" /></a>`;
    })
    .join("");
}

function showInsightOnCard(card) {
  if (!card) return;
  const slot = card.querySelector("[data-insight-slot]");
  if (!slot) return;
  const text = localInsight(card);
  slot.textContent = text;
  slot.hidden = false;
  card.classList.add("is-insight-open");
}

function focusCard(card) {
  $$(".post-card").forEach((el) => el.classList.toggle("is-focused", el === card));
}

function focusedCard() {
  return document.querySelector(".post-card.is-focused:not(.is-ghost)");
}

async function persistActivePlace() {
  if (!state.place) return;
  const next = placeFromLayout({
    id: state.place.id,
    name: state.place.name,
    created: state.place.created,
    origin: { yaw0: state.lock.yaw0, pitch0: state.lock.pitch0 },
    source: state.feedSource === "owned" ? "owned" : state.place.source || "demo",
    cards: activeLayoutCards(),
  });
  const saved = await savePlaceRecord(next);
  if (saved.record) state.place = saved.record;
  state.placesCount = saved.places.length;
  state.settings.activePlaceId = state.place ? state.place.id : "";
  saveSettings();
  updatePulse();
}

async function reanchorAndSave() {
  if (!state.lock.available) {
    await tryEnableWorldLock(true);
    return;
  }
  reanchor();
  updateLockBadge();
  if (state.place) {
    state.place.origin = { yaw0: state.lock.yaw0, pitch0: state.lock.pitch0 };
    state.place.updated = Date.now();
    await persistActivePlace();
  }
  toast(t(state, "toastReanchor"));
  announce(t(state, "toastReanchor"));
}

function applyPlace(place, opts = {}) {
  const restored = restorePlace(place);
  if (!restored) {
    toast("Could not open that place");
    return;
  }
  state.place = restored;
  state.holdOrigin = true;
  state.lock.yaw0 = restored.origin.yaw0;
  state.lock.pitch0 = restored.origin.pitch0;
  state.layout = layoutFromPlace(restored);
  if (restored.source === "owned") state.feedSource = "owned";
  state.settings.activePlaceId = restored.id;
  state.settings.feedSource = state.feedSource;
  saveSettings();
  if (state.arOpen) buildPosts();
  updateChips();
  updatePulse();
  if (!opts.silent) toast(restored.name);
}

async function refreshPlacesList() {
  const list = await listPlaces();
  state.placesCount = list.length;
  const root = $("#placesList");
  if (!root) return list;
  if (!list.length) {
    root.innerHTML = `<p class="empty-state">No places yet. Save this room to keep the pins on this device.</p>`;
    updatePulse();
    return list;
  }
  root.innerHTML = list
    .map((place) => {
      const name = String(place.name || "Room")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;");
      const id = String(place.id).replace(/"/g, "");
      return `<div class="place-row"><button type="button" class="btn btn-secondary" data-open-place="${id}">${name}</button><button type="button" class="btn btn-ghost" data-rename-place="${id}">Rename</button><button type="button" class="btn btn-ghost" data-delete-place="${id}">Delete</button></div>`;
    })
    .join("");
  updatePulse();
  return list;
}

async function saveCurrentPlace() {
  try {
  const name = ($("#placeNameInput")?.value || "Room").trim() || "Room";
  const record = placeFromLayout({
    id: state.place && state.place.name === name ? state.place.id : undefined,
    name,
    created: state.place && state.place.name === name ? state.place.created : Date.now(),
    origin: { yaw0: state.lock.yaw0, pitch0: state.lock.pitch0 },
    source: state.feedSource === "owned" ? "owned" : "demo",
    cards: ensureMutableLayout(),
  });
  const saved = await savePlaceRecord(record);
  if (!saved.record) {
    toast("Could not save place");
    return;
  }
  state.place = saved.record;
  state.placesCount = saved.places.length;
  state.settings.activePlaceId = saved.record.id;
  saveSettings();
  await refreshPlacesList();
  updateChips();
  toast(saved.evicted > 0 ? `Saved ${saved.record.name}. Oldest place removed.` : `Saved ${saved.record.name}`);
  } catch (_) {
    toast("Could not save place");
  }
}

function layoutHasOwnedText() {
  return activeLayoutCards().some((card) => card.source === "owned" || card.source === "note");
}

function anchorsMessage() {
  let msg = buildAnchors({
    peerId: getPeerId(),
    origin: { yaw0: state.lock.yaw0, pitch0: state.lock.pitch0 },
    cards: activeLayoutCards(),
    placeName: state.place?.name || "",
    includeBody: true,
  });
  if (shareByteLength(msg) > MAX_SHARE_BYTES) {
    msg = buildAnchors({
      peerId: getPeerId(),
      origin: { yaw0: state.lock.yaw0, pitch0: state.lock.pitch0 },
      cards: activeLayoutCards(),
      placeName: state.place?.name || "",
      includeBody: false,
    });
  }
  const parsed = parseShare(msg);
  return parsed.ok ? parsed.msg : null;
}

function shareNotice() {
  const el = $("#shareTextNotice");
  if (!el) return;
  const text = layoutHasOwnedText()
    ? "This room can send handle labels and short card text from your feed. Camera never leaves. Anchors sync only while the data channel is up. NAT may block rooms. No TURN server."
    : "Anchors and handle labels sync only while the data channel is up. NAT may block rooms. No TURN server. Camera never leaves.";
  el.textContent = text;
}

function publishRoom(alsoAnchors) {
  const presence = parseShare(buildPresence(getPeerId(), handlesList()));
  if (presence.ok) roomSend(presence.msg);
  if (alsoAnchors || state.room.role === "host") {
    const anchors = anchorsMessage();
    if (anchors) roomSend(anchors);
  }
  shareNotice();
  updatePulse();
}

function rememberPeer(peerId) {
  if (!peerId || peerId === getPeerId()) return;
  const peers = new Set(state.room.peers);
  peers.add(peerId);
  state.room.peers = [...peers];
  state.room.peerCount = state.room.peers.length;
}

function burst(card, mark) {
  if (!card) return;
  const el = card.querySelector(".react-burst");
  if (el) {
    el.textContent = mark || "✦";
    el.hidden = false;
  }
  card.classList.add("is-react");
  setTimeout(() => {
    if (el) el.hidden = true;
    card.classList.remove("is-react");
  }, 900);
}

function onRoomMessage(raw) {
  const parsed = parseShare(raw);
  if (!parsed.ok) return;
  const msg = parsed.msg;
  if (msg.peerId && msg.peerId === getPeerId()) return;

  if (msg.type === "presence") {
    rememberPeer(msg.peerId);
    if (state.room.role === "host") {
      const anchors = anchorsMessage();
      if (anchors) roomSend(anchors);
    }
    const el = $("#roomStatus");
    if (el) el.textContent = `${state.room.id || ""} · ${state.room.peers.length} ${t(state, "peerHere")}`;
    announce("Room connected");
    updatePulse();
  }
  if (msg.type === "bye" && msg.peerId) {
    state.room.peers = state.room.peers.filter((id) => id !== msg.peerId);
    state.room.peerCount = state.room.peers.length;
    state.ghosts = (state.ghosts || []).filter((g) => g.peerId !== msg.peerId);
    if (state.arOpen) buildPosts();
    updatePulse();
  }
  if (msg.type === "handles" && msg.handles?.length) {
    state.settings.handles = msg.handles.join(", ");
    saveSettings();
    buildPosts();
  }
  if (msg.type === "anchor" || msg.type === "place" || msg.type === "ghost" || msg.type === "note") {
    const ghosts = ghostsFromMessage(msg);
    const peerId = msg.peerId || "peer";
    state.ghosts = (state.ghosts || []).filter((g) => g.peerId !== peerId).concat(ghosts);
    if (state.arOpen) buildPosts();
    announce("Peer anchors updated");
  }
  if (msg.type === "reaction") {
    const card =
      (msg.cardId && document.querySelector(`[data-id="${String(msg.cardId).replace(/"/g, "")}"]`)) ||
      focusedCard();
    burst(card, msg.reaction || "✦");
  }
}

function roomStatusLine(signalOk) {
  if (!state.room.id) return isSignalLive() ? t(state, "signalLive") : t(state, "signalLocal");
  const path = signalOk ? t(state, "signalLiveShort") : t(state, "signalLocalShort");
  return `${state.room.id} · ${path} · ${state.room.channel}`;
}

function showInvite(url) {
  const el = $("#inviteUrl");
  if (el) el.textContent = url || "";
  shareNotice();
}

async function refreshSignalLine() {
  const live = await probeSignal();
  state.signalLive = live;
  const rs = $("#roomStatus");
  if (rs && !state.room.id) rs.textContent = live ? t(state, "signalLive") : t(state, "signalLocal");
  updatePulse();
  return live;
}

function pinFocused() {
  const el = focusedCard();
  if (!el) {
    toast("Focus a card, then pin.");
    return;
  }
  const id = el.dataset.id;
  const layout = ensureMutableLayout();
  const idx = layout.findIndex((card) => String(card.id) === String(id));
  if (idx < 0) {
    toast("Focus a card, then pin.");
    return;
  }
  const next = pinCard(layout[idx], gazeAngles(state.lock, state.pointerParallax));
  if (!next) return;
  layout[idx] = next;
  state.layout = layout;
  buildPosts();
  document.querySelector(`[data-id="${String(id).replace(/"/g, "")}"]`)?.classList.add("is-focused");
  void persistActivePlace();
  if (state.feedSource === "owned") {
    state.ownedCards = layout.filter((card) => card.source !== "demo");
    void saveOwnedFeed(state.ownedCards);
  }
  toast("Pinned");
}

async function dropNoteFromSheet() {
  const text = $("#noteInput")?.value || "";
  const note = createNote(text, gazeAngles(state.lock, state.pointerParallax));
  if (!note) {
    toast("Write a note first");
    return;
  }
  const layout = ensureMutableLayout();
  layout.push(note);
  state.layout = layout;
  state.ownedCards = mergeFeed(state.ownedCards, [note], "merge");
  state.ownedCount = state.ownedCards.length;
  await saveOwnedFeed(state.ownedCards);
  await persistActivePlace();
  buildPosts();
  const shared = parseShare(buildNoteShare(getPeerId(), note));
  if (shared.ok && state.room.id) roomSend(shared.msg);
  if ($("#noteInput")) $("#noteInput").value = "";
  closeSheets();
  toast("Note dropped");
}

async function setFeedSource(source) {
  if (source === "owned") {
    if (!state.ownedCards.length) {
      toast("Import a file you already have.");
      openSheet("feedSheet");
      return;
    }
    state.feedSource = "owned";
    state.layout = state.ownedCards.map((card) => ({ ...card }));
  } else {
    state.feedSource = "demo";
    state.layout = null;
  }
  state.settings.feedSource = state.feedSource;
  saveSettings();
  if (state.arOpen) buildPosts();
  updateChips();
  updatePulse();
}

async function importFeedText(text, mode) {
  const parsed = parseFeedText(text);
  if (!parsed.ok) {
    const map = {
      "network-url": "This host does not fetch X. Import a file you already have.",
      "too-large": "That paste is over 400 KB.",
      html: "HTML was rejected. Paste JSON, NDJSON, or a markdown list.",
      parse: "Could not read that feed.",
      empty: "No cards in that feed.",
    };
    toast(map[parsed.error] || "Could not read that feed.");
    return;
  }
  state.ownedCards = mergeFeed(state.ownedCards, parsed.cards, mode === "replace" ? "replace" : "merge");
  state.ownedCount = state.ownedCards.length;
  await saveOwnedFeed(state.ownedCards);
  state.feedSource = "owned";
  state.settings.feedSource = "owned";
  state.layout = state.ownedCards.map((card) => ({ ...card }));
  saveSettings();
  if (state.arOpen) buildPosts();
  updateChips();
  updatePulse();
  toast(parsed.truncated ? `Imported ${state.ownedCards.length} cards. Extra cards were capped.` : `Imported ${parsed.cards.length} cards.`);
}

function exportFeed() {
  const cards = state.ownedCards.length ? state.ownedCards : activeLayoutCards();
  const blob = new Blob([exportFeedJson(cards)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "xray-feed.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Feed downloaded on this device");
}

async function cyclePlaces() {
  const list = await listPlaces();
  state.placesCount = list.length;
  if (!list.length) {
    toast("No places yet");
    openSheet("placesSheet");
    return;
  }
  const idx = list.findIndex((place) => place.id === state.place?.id);
  applyPlace(list[(idx + 1) % list.length]);
}

function reactFocused() {
  const card = focusedCard();
  if (!card) {
    toast("Focus a card, then react.");
    return;
  }
  burst(card, "✦");
  if (!state.room.id) return;
  const msg = parseShare(buildReaction(getPeerId(), card.dataset.id, "✦"));
  if (msg.ok) roomSend(msg.msg);
}

async function maybeStartXr() {
  if (state.settings.reducedMotion || state.settings.batterySaver) {
    toast("WebXR is off while reduced motion or battery saver is on.");
    return;
  }
  const started = await startHitTest({
    reducedMotion: state.settings.reducedMotion,
    batterySaver: state.settings.batterySaver,
    onSelect: (angles) => {
      const el = focusedCard();
      if (!el) return;
      const layout = ensureMutableLayout();
      const idx = layout.findIndex((card) => String(card.id) === String(el.dataset.id));
      if (idx < 0) return;
      layout[idx] = pinCard(layout[idx], angles);
      state.layout = layout;
      buildPosts();
      toast("Pinned on a detected plane");
      void persistActivePlace();
    },
  });
  state.xrOn = !!started.ok;
  if (!started.ok) {
    state.xrOn = false;
    toast("WebXR hit-test is not available. Pins stay orientation-relative.");
  } else {
    toast("WebXR hit-test on. CSS world lock is still the default if you leave.");
    state.xrSession = started.session;
  }
  updatePulse();
}

async function endXr() {
  state.xrOn = false;
  try {
    await state.xrSession?.end();
  } catch (_) {}
  state.xrSession = null;
}

function bind() {
  $("#btnDemo")?.addEventListener("click", () => {
    if (!state.settings.seenOnboarding400) openSheet("onboardingSheet");
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
    void refreshSignalLine();
    showInvite(roomInviteUrl());
    openSheet("vectorsSheet");
  });
  $("#btnReanchor")?.addEventListener("click", () => void reanchorAndSave());
  $("#btnEnableLock")?.addEventListener("click", () => void tryEnableWorldLock(true));
  $("#btnFeed")?.addEventListener("click", () => openSheet("feedSheet"));
  $("#btnFeedLanding")?.addEventListener("click", () => openSheet("feedSheet"));
  $("#btnPlaces")?.addEventListener("click", () => {
    void refreshPlacesList();
    openSheet("placesSheet");
  });
  $("#btnPlacesLanding")?.addEventListener("click", () => {
    void refreshPlacesList();
    openSheet("placesSheet");
  });
  $("#btnPlacesSettings")?.addEventListener("click", () => {
    void refreshPlacesList();
    openSheet("placesSheet");
  });
  $("#btnFeedSettings")?.addEventListener("click", () => openSheet("feedSheet"));
  $("#btnPin")?.addEventListener("click", pinFocused);
  $("#btnNote")?.addEventListener("click", () => openSheet("noteSheet"));
  $("#btnPulse")?.addEventListener("click", () => {
    void refreshSignalLine().then(() => {
      updatePulse();
      openSheet("privacySheet");
    });
  });
  $("#btnDropNote")?.addEventListener("click", () => void dropNoteFromSheet());
  $("#btnSavePlace")?.addEventListener("click", () => void saveCurrentPlace());
  $("#btnReact")?.addEventListener("click", reactFocused);
  $("#btnXr")?.addEventListener("click", () => void maybeStartXr());

  $$(".mode-pill").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });
  $$("[data-feed-mode]").forEach((btn) => {
    btn.addEventListener("click", () => void setFeedSource(btn.dataset.feedMode));
  });

  $("#blendSlider")?.addEventListener("input", (e) => {
    state.settings.blend = Number(e.target.value);
    saveSettings();
    applyPrefs();
  });

  $("#feedScroll")?.addEventListener("scroll", onFeedScroll, { passive: true });

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
        void endXr();
      }
      if (key === "batterySaver" && e.target.checked) void endXr();
      if (key === "worldLock" && e.target.checked && state.arOpen) void tryEnableWorldLock(true);
      if (key === "worldLock" && !e.target.checked) {
        state.lock.status = "off";
        stopOrientation();
        state.lock.available = false;
        toast(t(state, "toastLockOff"));
        announce(t(state, "toastLockOff"));
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
    const msg = parseShare({
      v: 4,
      type: "handles",
      peerId: getPeerId(),
      handles: handlesList(),
      t: Date.now(),
    });
    if (msg.ok && state.room.id) roomSend(msg.msg);
    closeSheets();
    toast(t(state, "apply"));
  });

  $("#btnCreateRoom")?.addEventListener("click", async () => {
    try {
      const r = await createRoom(onRoomMessage, () => updatePulse());
      if ($("#roomCodeInput")) $("#roomCodeInput").value = r.id;
      publishRoom(true);
      showInvite(r.inviteUrl);
      toast(t(state, "toastRoom"));
      announce("Room connected");
      const el = $("#roomStatus");
      if (el) el.textContent = roomStatusLine(r.signalOk);
      updatePulse();
    } catch (_) {
      toast(t(state, "toastRoomFail"));
      announce("Room failed");
    }
  });

  $("#btnJoinRoom")?.addEventListener("click", async () => {
    try {
      const id = $("#roomCodeInput").value.trim();
      await joinRoom(id, onRoomMessage, () => updatePulse());
      publishRoom(false);
      showInvite(roomInviteUrl());
      toast(t(state, "toastRoomJoin"));
      announce("Room connected");
      const el = $("#roomStatus");
      if (el) el.textContent = roomStatusLine(isSignalLive());
    } catch (_) {
      toast(t(state, "toastRoomFail"));
      announce("Room failed");
    }
  });

  $("#btnCopyInvite")?.addEventListener("click", async () => {
    const url = roomInviteUrl() || `${location.origin}/?room=${$("#roomCodeInput")?.value.trim() || ""}`;
    showInvite(url);
    try {
      await navigator.clipboard.writeText(url);
      toast(t(state, "copyInvite"));
    } catch (_) {
      toast(url);
    }
  });

  $("#btnLeaveRoom")?.addEventListener("click", async () => {
    const bye = parseShare(buildBye(getPeerId()));
    if (bye.ok) roomSend(bye.msg);
    await leaveRoom();
    state.ghosts = [];
    if (state.arOpen) buildPosts();
    if ($("#roomStatus")) $("#roomStatus").textContent = "";
    showInvite("");
    toast(t(state, "leaveRoom"));
    updatePulse();
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
  $("#btnPrivacy")?.addEventListener("click", () => {
    updatePulse();
    openSheet("privacySheet");
  });
  $("#btnChangelog")?.addEventListener("click", () => openSheet("changelogSheet"));

  $("#btnOnboardContinue")?.addEventListener("click", async () => {
    state.settings.seenOnboarding400 = true;
    state.settings.seenOnboarding = true;
    saveSettings();
    closeSheets();
    openAr(false);
    await tryEnableWorldLock(true);
  });
  $("#btnOnboardSkip")?.addEventListener("click", () => {
    state.settings.seenOnboarding400 = true;
    state.settings.seenOnboarding = true;
    state.settings.worldLock = false;
    saveSettings();
    closeSheets();
    openAr(false);
  });

  $("#btnImportFeed")?.addEventListener("click", () => {
    void importFeedText($("#feedPaste")?.value || "", $("#feedMergeMode")?.value || "merge");
  });
  $("#btnReplaceFeed")?.addEventListener("click", () => {
    void importFeedText($("#feedPaste")?.value || "", "replace");
  });
  $("#btnExportFeed")?.addEventListener("click", exportFeed);
  $("#btnComposeCard")?.addEventListener("click", () => {
    const name = $("#composeName")?.value || "Note";
    const handle = $("#composeHandle")?.value || "@local";
    const body = $("#composeBody")?.value || "";
    const payload = JSON.stringify([{ name, handle, body, source: "owned" }]);
    void importFeedText(payload, "merge");
  });
  $("#feedFile")?.addEventListener("change", () => {
    const file = $("#feedFile").files && $("#feedFile").files[0];
    if (!file) return;
    if (file.size > MAX_FEED_BYTES) {
      toast("That file is over 400 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if ($("#feedPaste")) $("#feedPaste").value = String(reader.result || "");
      toast("File read on this device. Choose Merge or Replace.");
    };
    reader.onerror = () => toast("Could not read that file.");
    reader.readAsText(file);
  });

  $("#placesList")?.addEventListener("click", async (e) => {
    const open = e.target.closest?.("[data-open-place]");
    const rename = e.target.closest?.("[data-rename-place]");
    const del = e.target.closest?.("[data-delete-place]");
    const list = await listPlaces();
    if (open) {
      const place = list.find((item) => item.id === open.dataset.openPlace);
      if (place) {
        applyPlace(place);
        if (!state.arOpen) openAr(false);
        closeSheets();
      }
    }
    if (rename) {
      const place = list.find((item) => item.id === rename.dataset.renamePlace);
      const name = ($("#placeNameInput")?.value || "").trim();
      if (!place || !name) {
        toast("Type a new name, then Rename.");
        return;
      }
      place.name = name;
      place.updated = Date.now();
      await savePlaceRecord(place);
      if (state.place && state.place.id === place.id) state.place.name = name;
      await refreshPlacesList();
      updateChips();
    }
    if (del) {
      const id = del.dataset.deletePlace;
      const left = await deletePlaceRecord(id);
      state.placesCount = left.length;
      if (state.place && state.place.id === id) {
        state.place = null;
        state.settings.activePlaceId = "";
        saveSettings();
      }
      await refreshPlacesList();
      updateChips();
    }
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
    a.download = state.lastCaptureKind === "moment" ? `xray-${Date.now()}.webm` : `xray-${Date.now()}.png`;
    a.click();
  });

  $("#btnShare")?.addEventListener("click", async () => {
    if (!state.lastCapture || !navigator.share) return;
    try {
      const res = await fetch(state.lastCapture);
      const blob = await res.blob();
      const ext = state.lastCaptureKind === "moment" ? "webm" : "png";
      const file = new File([blob], `xray-capture.${ext}`, { type: blob.type });
      await navigator.share({ files: [file], title: "X-Ray", text: "Mixed-reality capture, on-device" });
      toast(t(state, "toastShare"));
    } catch (_) {}
  });

  let pressTimer = 0;
  $("#feedInner")?.addEventListener("pointerdown", (e) => {
    const card = e.target.closest?.(".post-card");
    if (!card || card.classList.contains("is-ghost")) return;
    focusCard(card);
    pressTimer = setTimeout(() => showInsightOnCard(card), 480);
  });
  $("#feedInner")?.addEventListener("pointerup", () => clearTimeout(pressTimer));
  $("#feedInner")?.addEventListener("pointercancel", () => clearTimeout(pressTimer));
  $("#feedInner")?.addEventListener("click", (e) => {
    if (e.target.closest?.(".post-card")) return;
    if (focusedCard()) pinFocused();
  });
  $("#feedInner")?.addEventListener("dblclick", (e) => {
    const card = e.target.closest?.(".post-card");
    if (!card || card.classList.contains("is-ghost")) return;
    focusCard(card);
    showInsightOnCard(card);
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
      return;
    }
    const typing = e.target && e.target.closest && e.target.closest("input, textarea, select");
    if (typing || $$(".sheet-backdrop.is-open").length) return;
    if (!state.arOpen) return;
    const key = e.key.toLowerCase();
    if (key === "r") {
      e.preventDefault();
      void reanchorAndSave();
    }
    if (key === "p") {
      e.preventDefault();
      pinFocused();
    }
    if (key === "l") {
      e.preventDefault();
      void cyclePlaces();
    }
    if (key === "n") {
      e.preventDefault();
      openSheet("noteSheet");
    }
    if (key === "f") {
      e.preventDefault();
      openSheet("feedSheet");
    }
    if (key === "i") {
      e.preventDefault();
      showInsightOnCard(focusedCard());
    }
    if (e.key === " " && e.target === document.body) {
      e.preventDefault();
      void doCaptureStill();
    }
  });

  bindGestures({
    onDepthScale: () => {
      document.documentElement.style.setProperty("--depth-scale", String(state.settings.depthScale || 1));
      applyWorldTransform();
    },
  });

  if (!navigator.share) {
    const s = $("#btnShare");
    if (s) s.hidden = true;
  }
  if (!momentsSupported()) {
    const m = $("#btnMoment");
    if (m) m.hidden = true;
  }
}

async function applyDeepLinks() {
  try {
    const params = new URLSearchParams(location.search);
    if (params.get("whatsnew") === "1") openSheet("whatsNewSheet");
    if (params.get("places") === "1") {
      await refreshPlacesList();
      openSheet("placesSheet");
    }
    if (params.get("import") === "1") openSheet("feedSheet");
    if (params.get("feed") === "owned") await setFeedSource("owned");
    const placeId = params.get("place");
    if (placeId) {
      const list = await listPlaces();
      const place = list.find((item) => item.id === placeId);
      if (place) applyPlace(place, { silent: true });
      else toast("That place is not on this device.");
    }
    if (params.get("demo") === "1") openAr(false);
    else if (params.get("xray") === "1" || params.get("connect") === "1") openAr(true);
    else if (placeId) openAr(false);
    const room = params.get("room");
    if (room) {
      if (room.includes("@") || room.includes(",")) {
        state.settings.handles = decodeURIComponent(room).replace(/[+|]/g, ",");
        saveSettings();
        openAr(false);
      } else {
        openAr(false);
        joinRoom(room, onRoomMessage, () => updatePulse())
          .then(() => {
            publishRoom(false);
            toast(t(state, "toastRoomJoin"));
            announce("Room connected");
          })
          .catch(() => {
            toast(t(state, "toastRoomFail"));
            announce("Room failed");
          });
      }
    }
    if (params.get("lock") === "0") {
      state.settings.worldLock = false;
      saveSettings();
      applyPrefs();
    }
    if (params.get("xr") === "1") {
      const ok = await probeImmersiveAr();
      const btn = $("#btnXr");
      if (btn) btn.hidden = !ok;
      if (!ok) toast("WebXR hit-test is not available on this browser.");
    }
    const keys = ["demo", "xray", "connect", "room", "lock", "whatsnew", "place", "places", "feed", "import", "xr"];
    if ([...params.keys()].some((k) => keys.includes(k))) {
      keys.forEach((k) => params.delete(k));
      const q = params.toString();
      history.replaceState({}, "", location.pathname + (q ? `?${q}` : "") + location.hash);
    }
  } catch (_) {}
}

async function init() {
  loadSettings();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    state.settings.reducedMotion = true;
  }
  document.documentElement.dataset.appVersion = VERSION;
  document.querySelectorAll("span[data-xray-version]").forEach((el) => {
    el.textContent = `v${VERSION}`;
  });

  setRoomOpenHandler(() => {
    if (state.room.role === "host") {
      const anchors = anchorsMessage();
      if (anchors) roomSend(anchors);
    }
    announce("Room connected");
    updatePulse();
  });

  applyLocale(state);
  applyPrefs();
  bind();
  updatePulse();

  const defaults = $("#placeDefaults");
  if (defaults) {
    defaults.innerHTML = PLACE_DEFAULTS.map((name) => `<option value="${name}"></option>`).join("");
  }

  try {
    await migrateLegacyGallery();
    state.settings.apiKey = await loadApiKey();
    state.ownedCards = await loadOwnedFeed();
    state.ownedCount = state.ownedCards.length;
    const notes = state.ownedCards.filter((card) => card.source === "note");
    if (state.feedSource === "owned" && state.ownedCards.length) {
      state.layout = state.ownedCards.map((card) => ({ ...card }));
    } else if (notes.length) {
      state.layout = ensureMutableLayout().concat(notes);
    }
    const places = await listPlaces();
    state.placesCount = places.length;
    if (state.settings.activePlaceId) {
      const active = places.find((place) => place.id === state.settings.activePlaceId);
      if (active) applyPlace(active, { silent: true });
    }
  } catch (_) {}

  await applyDeepLinks();
  updatePulse();

  const xrOk = await probeImmersiveAr();
  const xrBtn = $("#btnXr");
  if (xrBtn) xrBtn.hidden = !xrOk || state.settings.reducedMotion || state.settings.batterySaver;

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  if (!state.settings.seenWhatsNew400) {
    setTimeout(() => {
      if (!state.arOpen && !state.settings.seenWhatsNew400) {
        openSheet("whatsNewSheet");
        state.settings.seenWhatsNew400 = true;
        state.settings.seenWhatsNew = true;
        saveSettings();
      }
    }, 600);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
