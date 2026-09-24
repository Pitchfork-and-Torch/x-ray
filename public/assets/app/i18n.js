/* X-Ray EN-only i18n (2026-08-11 fleet strip) */
export const I18N = {
  en: {
    kicker: "X-Ray v4 · Grounded Reality · Across Devices",
    title: "X-Ray",
    sub: "Your posts. Your room. On this device.",
    lede:
      "See your feed through reality. Import a file you already have. Cards lock into the room as you turn. Camera frames are not uploaded.",
    demo: "Try Demo Reality",
    enter: "Enter X-Ray",
    privacy: "Camera stays on-device. Captures stay in this browser.",
    f1: "Place Memory - orientation-relative pins on this device, not a 3D scan",
    f2: "Feed Bay, walk-safe chrome, and Shared Reality anchors across devices",
    f3: "On-device insight bubbles - optional private xAI key",
    f4: "Stills + short Moments - local gallery only",
    f5: "Responsive PWA · offline demo + gallery",
    openApp: "Original app",
    follow: "Follow @suddenlyjon",
    sectionHow: "How it works",
    howLede: "Point the camera. Lock the posts to the room. Scroll, capture, share from the device.",
    b1t: "World lock",
    b1p: "Motion sensors pin depth-stacked posts in physical space. Re-anchor anytime.",
    b2t: "Walk-safe chrome",
    b2p: "Controls tuck away while you scroll so the real world stays visible on the move.",
    b3t: "Local gallery",
    b3p: "Stills and short clips save only in this browser. Download or share from your device.",
    faqTitle: "FAQ",
    q1: "Does video leave my phone?",
    a1: "No. Camera frames stay in the tab. This site does not upload video, photos, or motion.",
    q2: "Is this the same as x-ray.grok.me?",
    a2: "This is the Anchored Reality network host (x-ray.jonbailey.xyz). The original experimental app remains at x-ray.grok.me.",
    q3: "Can I use real X handles?",
    a3: "No. This host does not fetch X. Import a file you already have. Vectors only stamp handle labels.",
    q4: "Why motion sensors?",
    a4: "Orientation is processed on this device so posts can stay locked in the room. Sensor data is not sent. Scroll depth works without sensors.",
    q6: "Does this fetch my X feed?",
    a6: "No. This host does not fetch X. Import a file you already have.",
    q7: "Do places remember the real wall?",
    a7: "They remember orientation-relative pins on this device. Not a 3D scan.",
    q5: "Do Shared Reality rooms work across phones?",
    a5: "Signaling at xray-signal.jonbailey.xyz stores SDP and ICE for two hours. Anchors sync only while the data channel is up. NAT may block rooms. Camera never goes to the worker. Same-browser tabs still work locally.",
    footer: "Built in the spirit of @suddenlyjon · Pitchfork-and-Torch network host",
    live: "Live camera",
    ambient: "Ambient demo",
    capture: "Capture",
    moment: "Moment",
    settings: "Settings",
    gallery: "Gallery",
    vectors: "Vectors",
    exit: "Exit",
    blend: "Glass blend",
    walkSafe: "Walk-safe chrome",
    insights: "Insight bubbles",
    battery: "Battery saver",
    reduced: "Reduced motion",
    contrast: "High contrast",
    worldLock: "World lock",
    spatialAudio: "Spatial audio cues",
    handlesHint: "Handles (comma-separated)",
    apply: "Apply vectors",
    close: "Close",
    download: "Download",
    share: "Share",
    neverUpload: "Not uploaded - stays on this device",
    captureTitle: "Mixed-reality capture",
    emptyGallery: "Captures you take stay here - on this device only.",
    toastCam: "Camera ready",
    toastDemo: "Demo Reality",
    toastCap: "Saved to local gallery",
    toastMoment: "Moment saved",
    toastDenied: "Camera blocked - ambient mode",
    toastShare: "Shared",
    toastReanchor: "Origin reset - feed re-centered",
    toastLockOn: "World lock active",
    toastLockOff: "Scroll depth mode",
    toastLockDenied: "Motion denied - scroll depth",
    toastRoom: "Room ready",
    toastRoomJoin: "Joined Shared Reality",
    toastRoomFail: "Could not connect room",
    reanchor: "Re-anchor",
    enableLock: "Enable world lock",
    lockWorld: "WORLD LOCK",
    lockScroll: "SCROLL DEPTH",
    lockCalib: "CALIBRATING",
    lockOff: "LOCK OFF",
    whatsNew: "What's new",
    whatsNewBody:
      "4.0.0 Grounded Reality: Place Memory, Owned Feed / Feed Bay, and Shared Reality anchors. This host does not fetch X. Import a file you already have. Camera frames stay on this device. Places remember orientation-relative pins, not a 3D scan.",
    onboardingTitle: "Your feed, your room",
    onboarding0: "Your feed, your room. Import locally. Camera stays here.",
    onboarding1: "Camera stays on this device. No account required.",
    onboarding2: "Motion sensors (optional) keep posts fixed as you turn.",
    onboarding3: "Denied sensors? Enhanced depth scroll still works.",
    continueDemo: "Enter Demo Reality",
    skipMotion: "Skip motion, use depth scroll",
    privacyTitle: "Privacy",
    privacyBody:
      "This site does not upload camera frames, photos, motion, imported posts, or place memory. No accounts. This host does not fetch X. Shared Reality can exchange SDP, ICE, presence, handle labels, and small v4 anchor JSON or reactions while a room is active. The signaling worker stores SDP and ICE only. If you save an xAI key and tap Enrich, post text goes to api.x.ai from your browser. A visit counter at hits.jonbailey.xyz records page loads, not camera.",
    sharedReality: "Shared Reality",
    createRoom: "Create room",
    joinRoom: "Join room",
    roomCode: "Room code",
    copyInvite: "Copy invite link",
    leaveRoom: "Leave room",
    roomHint:
      "Data only. No camera sharing. Anchors sync only while the data channel is up. NAT may block rooms. No TURN server. Rooms expire in 2 hours.",
    signalLive: "Signaling live - rooms work across devices.",
    signalLocal: "This browser only (signaling unreachable).",
    signalLiveShort: "across devices",
    signalLocalShort: "this browser only",
    apiKeyHint: "Optional xAI API key (stored in this browser; Enrich sends post text to api.x.ai only)",
    enrichInsight: "Enrich insight",
    saveKey: "Save key",
    clearKey: "Clear key",
    longPressInsight: "Long-press a card for insight",
    recording: "Recording...",
    peerHere: "peer in room",
    changelog: "Changelog",
  },
};

export function t(lang, key) {
  const pack = I18N.en || {};
  return pack[key] != null ? pack[key] : key;
}

export const SUPPORTED = ["en"];

/** EN-only while locale fan-out is paused. Restores the export main.js already imports. */
export function applyLocale(stateLike) {
  if (stateLike && typeof stateLike === "object") stateLike.locale = "en";
  document.documentElement.lang = "en";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const val = t("en", key);
    if (val != null && val !== key) el.textContent = val;
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    const val = t("en", key);
    if (val != null && val !== key) el.setAttribute("aria-label", val);
  });
  document.querySelectorAll(".locale-btn").forEach((btn) => {
    const on = btn.dataset.locale === "en";
    btn.hidden = !on;
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const row = document.querySelector(".locale-row");
  if (row) row.hidden = true;
}
