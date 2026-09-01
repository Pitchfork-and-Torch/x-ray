/**
 * Shared Reality 2.0 - data-channel only.
 * Signaling: optional Worker (SIGNAL_URL) + BroadcastChannel same-tab fallback.
 */
import { state } from "./state.js";

// Override via window.__XRAY_SIGNAL__ or meta tag if deployed
export function signalBase() {
  if (typeof window !== "undefined" && window.__XRAY_SIGNAL__) return window.__XRAY_SIGNAL__;
  const meta = document.querySelector('meta[name="xray-signal"]');
  if (meta?.content) return meta.content.replace(/\/$/, "");
  return "https://xray-signal.jonbailey.xyz";
}

const ICE = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];

let pc = null;
let dc = null;
let pollTimer = 0;
let bc = null;
let peerId = Math.random().toString(36).slice(2, 10);
let pollSince = 0;
let signalLive = false;

function code6() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[(Math.random() * alphabet.length) | 0];
  return s;
}

async function signalFetch(path, opts = {}) {
  const url = `${signalBase()}${path}`;
  try {
    const res = await fetch(url, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) throw new Error("signal-" + res.status);
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function probeSignal() {
  const data = await signalFetch("/");
  signalLive = !!(data && data.ok && data.service === "xray-signal");
  return signalLive;
}

export function isSignalLive() {
  return signalLive;
}

function setupPc(onMessage, onStatus) {
  pc = new RTCPeerConnection({ iceServers: ICE });
  pc.onicecandidate = async (ev) => {
    if (!ev.candidate || !state.room.id) return;
    const payload = {
      type: "ice",
      from: peerId,
      candidate: ev.candidate.toJSON(),
    };
    await signalFetch(`/rooms/${state.room.id}/signal`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    bc?.postMessage(payload);
  };
  pc.onconnectionstatechange = () => {
    state.room.connected = pc.connectionState === "connected";
    onStatus?.(pc.connectionState);
  };
  return pc;
}

function wireDc(channel, onMessage) {
  dc = channel;
  dc.onopen = () => {
    state.room.connected = true;
    send({
      v: 3,
      type: "presence",
      peerId,
      handles: (state.settings.handles || "").split(/[,;\s]+/).filter(Boolean),
      t: Date.now(),
    });
  };
  dc.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      onMessage?.(msg);
    } catch (_) {}
  };
}

export function send(obj) {
  if (dc && dc.readyState === "open") {
    dc.send(JSON.stringify(obj));
  }
  bc?.postMessage({ type: "dc", payload: obj });
}

export async function createRoom(onMessage, onStatus) {
  await leaveRoom();
  const id = code6();
  state.room = { id, role: "host", peers: [], connected: false };
  peerId = Math.random().toString(36).slice(2, 10);
  pollSince = 0;

  bc = new BroadcastChannel("xray-room-" + id);
  bc.onmessage = (ev) => handleSignal(ev.data, onMessage, onStatus, true);

  setupPc(onMessage, onStatus);
  wireDc(pc.createDataChannel("xray", { ordered: true }), onMessage);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const created = await signalFetch(`/rooms/${id}`, {
    method: "PUT",
    body: JSON.stringify({ offer: pc.localDescription, host: peerId }),
  });
  // polling for answer even if create soft-failed (local BC still works)
  pollTimer = setInterval(() => pollSignals(onMessage, onStatus), 1200);

  return {
    id,
    inviteUrl: `${location.origin}/?room=${id}`,
    signalOk: !!created,
  };
}

export async function joinRoom(id, onMessage, onStatus) {
  await leaveRoom();
  id = String(id || "")
    .trim()
    .toUpperCase();
  if (!id) throw new Error("no-id");
  state.room = { id, role: "guest", peers: [], connected: false };
  peerId = Math.random().toString(36).slice(2, 10);
  pollSince = 0;

  bc = new BroadcastChannel("xray-room-" + id);
  bc.onmessage = (ev) => handleSignal(ev.data, onMessage, onStatus, false);

  setupPc(onMessage, onStatus);
  pc.ondatachannel = (ev) => wireDc(ev.channel, onMessage);

  const room = await signalFetch(`/rooms/${id}`);
  if (room?.offer) {
    await pc.setRemoteDescription(room.offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await signalFetch(`/rooms/${id}/signal`, {
      method: "POST",
      body: JSON.stringify({ type: "answer", from: peerId, sdp: pc.localDescription }),
    });
  } else {
    // BroadcastChannel: announce join so host can re-offer locally
    bc.postMessage({ type: "join", from: peerId });
  }

  pollTimer = setInterval(() => pollSignals(onMessage, onStatus), 1200);
  return { id };
}

async function pollSignals(onMessage, onStatus) {
  if (!state.room.id) return;
  if (state.room.role === "host" && pc && !pc.currentRemoteDescription) {
    const room = await signalFetch(`/rooms/${state.room.id}`);
    if (room?.answer) {
      await handleSignal(
        { type: "answer", from: "signal", sdp: room.answer, t: Date.now() },
        onMessage,
        onStatus,
        true,
      );
    }
  }
  const data = await signalFetch(
    `/rooms/${state.room.id}/poll?peer=${encodeURIComponent(peerId)}&since=${pollSince}`,
  );
  if (!data?.messages) return;
  if (typeof data.cursor === "number" && data.cursor > pollSince) {
    pollSince = data.cursor;
  }
  for (const msg of data.messages) {
    const t = Number(msg.t || 0);
    if (t > pollSince) pollSince = t;
    await handleSignal(msg, onMessage, onStatus, state.room.role === "host");
  }
}

async function handleSignal(msg, onMessage, onStatus, isHost) {
  if (!msg || !pc) return;
  if (msg.type === "dc" && msg.payload) {
    onMessage?.(msg.payload);
    return;
  }
  if (msg.from === peerId) return;

  if (msg.type === "answer" && msg.sdp && isHost) {
    if (!pc.currentRemoteDescription) {
      await pc.setRemoteDescription(msg.sdp);
    }
  }
  if (msg.type === "offer" && msg.sdp && !isHost) {
    await pc.setRemoteDescription(msg.sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await signalFetch(`/rooms/${state.room.id}/signal`, {
      method: "POST",
      body: JSON.stringify({ type: "answer", from: peerId, sdp: pc.localDescription }),
    });
    bc?.postMessage({ type: "answer", from: peerId, sdp: pc.localDescription });
  }
  if (msg.type === "ice" && msg.candidate) {
    try {
      await pc.addIceCandidate(msg.candidate);
    } catch (_) {}
  }
  if (msg.type === "join" && isHost && pc.localDescription) {
    bc?.postMessage({ type: "offer", from: peerId, sdp: pc.localDescription });
  }
}

export async function leaveRoom() {
  clearInterval(pollTimer);
  pollTimer = 0;
  try {
    dc?.close();
  } catch (_) {}
  try {
    pc?.close();
  } catch (_) {}
  try {
    bc?.close();
  } catch (_) {}
  dc = null;
  pc = null;
  bc = null;
  pollSince = 0;
  state.room = { id: null, role: null, peers: [], connected: false };
}

export function roomInviteUrl() {
  if (!state.room.id) return "";
  return `${location.origin}/?room=${state.room.id}`;
}
