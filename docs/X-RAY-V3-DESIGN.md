# X-Ray v3 Design Document - Anchored Reality

**Status:** Awaiting operator approval (no production implementation until explicit go)  
**Date:** 2026-07-31  
**Live host:** https://x-ray.jonbailey.xyz/  
**Source of truth (today):** `~\x-ray` (static Cloudflare Pages, zero build)  
**Concept:** @suddenlyjon · Network host: Pitchfork-and-Torch  

---

## 1. Product vision

### 1.1 What v2 is today

v2 is a polished, privacy-first PWA shell with:

- Live rear-camera passthrough (`getUserMedia`, tab-only)
- CSS 3D depth stack of post cards (near / mid / far via `translateZ` + scale + opacity)
- Walk-safe chrome (UI hides on scroll)
- Demo Reality sample posts, multi-handle vectors, insight bubbles
- Local still captures (canvas composite → `localStorage` gallery, max 24)
- EN / ES / PT / JA i18n, responsive layouts, installable SW cache
- **No** DeviceOrientation, **no** true world lock, **no** WebRTC, **no** video capture, **no** IndexedDB

Shared Reality is marketing language and deep-link handles (`/?room=@a,@b`), not co-presence.

### 1.2 What v3 must become

**Anchored Reality:** posts and depth vectors feel fixed in the physical room. When the user walks or turns the phone, the spatial feed stays locked relative to the environment (natural parallax and depth). Scroll still navigates feed content; the stack itself is embodied "in the room."

Metaphor upgrade:

| Layer | v2 | v3 |
|-------|----|----|
| Depth | UI parallax / z-order | World-anchored pose + depth planes |
| Motion | Scroll-only | Device orientation / motion fused with scroll |
| Lighting | Fixed glass | Ambient tint from camera average color |
| Co-presence | Link seeds only | Optional WebRTC data-channel rooms |
| Capture | Still PNG | Still + short local AR clip (MediaRecorder) |
| Insights | Static demo strings | Local heuristics + optional client-side API key |

### 1.3 Success metrics (product)

1. **Aha in under 30s:** first-time phone user opens Demo Reality, grants motion (if offered), and sees sample posts stay put while they turn the device.
2. **Never broken:** sensors denied → enhanced scroll-parallax depth stack; camera denied → ambient demo still excellent.
3. **Frame budget:** 30-60 fps on mid-range phones (target: iPhone 12 / Pixel 6 class); reduced-motion path under 16 ms main-thread where possible.
4. **Privacy zero-leak:** no camera/post upload by default; no telemetry; no required accounts.
5. **Walk-safe preserved:** chrome auto-hide while scrolling; outdoor high-contrast remains one toggle away.
6. **Installable offline shell:** demo + gallery + settings work offline after first visit.

---

## 2. UX flows

### 2.1 First-time entry

```
Landing (hero + privacy note)
  ├─ [Try Demo Reality] → AR stage, ambient background first, optional camera later
  └─ [Enter X-Ray]      → request camera (user gesture), then offer motion lock
```

**Onboarding sheet (first open only, dismissible, stored in settings):**

1. **See the feed in the room** - short animation of cards locking to space.
2. **Camera stays on this device** - explicit privacy line; no account.
3. **Motion sensors (optional)** - "We use orientation only on your phone so posts stay fixed in the room. Nothing is sent."
4. Primary CTA: **Enter Demo Reality**  
   Secondary: **Skip motion, use depth scroll**

Never block the core demo behind motion permission.

### 2.2 Permissions (non-scary copy)

| Permission | When asked | Why we ask (user-facing) | If denied |
|------------|------------|--------------------------|-----------|
| Camera | Enter X-Ray / Live mode | "Live view behind the feed. Never uploaded." | Ambient Demo Reality |
| Device orientation / motion | After stage open, on **Enable world lock** (user gesture) | "Keeps posts locked to the room as you turn." | Enhanced parallax fallback; badge = "Scroll depth" |
| Microphone | Only if user enables spatial audio | "Soft nearby cues only. Off by default." | Silent |
| Notifications | Never in v3 core | - | - |

**iOS Safari:** `DeviceOrientationEvent.requestPermission()` only after a clear button tap. Never auto-prompt on load. If permission API missing (desktop / Android Chrome), use passive `deviceorientation` / AbsoluteOrientationSensor with feature detection.

### 2.3 Demo Reality (world-lock demo)

- Open with rich sample posts at **fixed world positions** (azimuth/elevation or local 3D offsets), not only CSS z-order.
- Tutorial pulse on first lock: "Turn left/right - posts stay in place."
- **Lock badge** in chrome:
 - `WORLD LOCK` (green pulse) when sensors active and stable
 - `SCROLL DEPTH` (muted) in fallback
 - `CALIBRATING...` for first ~0.5s after re-anchor
- Scroll still pages content; depth plane assignment (near/mid/far) can shift with scroll index while **world pose** holds.

### 2.4 Re-anchor / Reset origin

- Control: **Re-anchor** (compass + crosshair icon) in AR chrome and Settings.
- Action: set current device pose as world origin; posts re-layout relative to that origin (same relative offsets).
- Toast: "Origin reset - feed re-centered."
- Haptic (if `navigator.vibrate`) short tick on success.

### 2.5 Shared Reality 2.0

```
Vectors / Share sheet
  → Create room → ephemeral 6-char code + URL ?room=CODE
  → Join room → paste code or open link
  → Peers see each other's vector handles, post anchors (relative), reactions (emoji burst)
  → Leave / room expires after idle (client-side timeout; no durable server store)
```

**Defaults:**

- Data channel only (no camera/video sharing)
- Optional "show peer presence dots" on depth stack
- Copy: "Co-presence is temporary. No media leaves your device unless you share a capture."

### 2.6 Capture → gallery

1. **Still** (existing, improved composite including world-offset card positions)
2. **Moment** (new): 2-4s MediaRecorder of stage canvas (video + cards drawn each frame) or `canvas.captureStream`
3. Review sheet: preview, Download, Share (Web Share API), Save to gallery
4. Gallery: stills + clips; IndexedDB; export only user-initiated

### 2.7 Insights

- **Default:** on-device heuristics (keyword mood, outdoor/indoor from camera luminance, depth-layer tips)
- **Optional:** user pastes xAI/Grok API key in Settings (stored only in `localStorage` / IndexedDB, never sent to X-Ray host). Call api.x.ai **from the browser** only when user taps **Enrich insight**. Key never leaves client except to xAI.

### 2.8 Accessibility & preferences (carry + expand)

| Pref | Behavior |
|------|----------|
| Reduced motion | Disable world-lock animation, sensor-driven motion, float loops; static depth stack + scroll |
| Battery saver | Cap to 30 fps, pause ambient matching, no video moments |
| High contrast | Outdoor-readable cards, thicker borders, larger type |
| Walk-safe chrome | Unchanged auto-hide on scroll |
| World lock | On / Off toggle (Off = fallback stack) |
| Spatial audio | Off by default |
| Glass blend | Existing slider |

Keyboard: Esc closes sheets / stage; Tab through chrome; R re-anchors when focused in stage; Space capture (when not in input).

---

## 3. Technical architecture

### 3.1 Stack decision (recommended)

**Keep zero-build static PWA** as the ship path (proven on CF Pages), but **modularize JS** for maintainability:

```
public/
  index.html
  assets/
    styles.css
    app/
      main.js              # shell, routing of modes, prefs
      i18n.js
      demo-posts.js
      camera.js
      sensors/
        orientation.js     # feature detect + iOS permission
        fusion.js          # complementary filter / simple AHRS
      render/
        depth-stack.js     # CSS 3D + pose → transform (default path)
        three-world.js     # OPTIONAL progressive: Three.js CSS3D/WebGL
      capture.js           # still + MediaRecorder moments
      gallery-idb.js       # IndexedDB primary, localStorage migrate
      insights.js          # heuristics + optional key
      webrtc-room.js       # data channel co-presence
      ambient.js           # camera average color → CSS vars
      ui.js                # sheets, toast, walk-safe, gestures
  sw.js
  manifest.webmanifest
```

**Rendering approach (primary):** CSS 3D transforms driven by sensor fusion, not a mandatory Three.js scene.

- Why: v2 already uses `preserve-3d` + `translateZ`; lowest payload; easier reduced-motion; easier capture via DOM/canvas hybrid.
- **Three.js:** optional progressive enhancement only if we hit a hard wall on multi-layer occlusion or need true billboards in perspective. Prefer **not** shipping Three.js in v1 of Anchored Reality unless needed for quality.

**If world-lock quality needs perspective camera math:** lightweight custom mat4 in ~150 lines beats full Three for this product. Revisit Three only for Shared Reality multi-peer 3D gizmos if CSS path fails QA.

### 3.2 Sensor fusion strategy

**Inputs (feature-detected, priority order):**

1. `AbsoluteOrientationSensor` (Generic Sensor API) - quaternion world frame when available
2. `DeviceOrientationEvent` (`alpha`, `beta`, `gamma`) - relative; re-anchor defines origin
3. `DeviceMotionEvent` - optional gyro rate for smoothing; not required for v3 MVP
4. None → fallback path

**Fusion algorithm (simple, documented):**

- Convert orientation to yaw/pitch (ignore roll for post layout stability, or apply light roll if stable)
- On **re-anchor:** store `yaw0`, `pitch0`
- Each frame: `dYaw = wrap(yaw - yaw0)`, `dPitch = pitch - pitch0`
- Apply complementary low-pass (alpha ~0.15 at 60 Hz) to reduce jitter
- Map to CSS:

```
feedWorld.style.transform =
  `rotateX(${clamp(dPitch * kPitch)}deg) rotateY(${-dYaw * kYaw}deg)`;
```

- Posts keep per-card `translateZ` depth and optional fixed azimuth offsets for "room placement"
- Scroll offset still translates cards along Y in **view space** so feed navigation remains natural

**Stability rails:**

- Deadzone ~0.4° before applying motion
- Clamp extreme pitch (looking at floor/sky) so cards do not flip unreadable
- Battery saver: 30 Hz sample + heavier filter
- Reduced motion: sensors offline; use scroll-parallax only

### 3.3 Enhanced fallback (no sensors)

When lock unavailable:

1. Keep near/mid/far z-stack
2. Add **pointer / scroll parallax** (subtle `rotateX/Y` from pointer on desktop; scroll velocity tilt on mobile)
3. Optional **camera optical flow light** is **out of scope** for v3 (too heavy / privacy-adjacent CV). Ambient color only.
4. UI honesty: badge always shows mode so users know they are not world-locked

### 3.4 Ambient world matching

- Sample video to offscreen 32×32 canvas every 250-500 ms (not every frame)
- Average RGB → CSS custom properties:

```
--ambient-tint: ...
--ambient-luma: ...
```

- Card glass, vignette, and accent cyan shift slightly toward scene lighting
- Disabled in battery saver / reduced motion / demo ambient gradient mode

### 3.5 Spatial audio (optional PE)

- Web Audio API panner nodes per "nearby" post (near plane only)
- Gain tied to distance metaphor + device yaw
- User toggle; default off; requires gesture to resume audio context
- No network streams

### 3.6 Shared Reality / WebRTC

**Goal:** ephemeral co-presence without a media server and with **minimal** signaling.

**Recommended signaling (pick one at implement time; design prefers A):**

| Option | Pros | Cons |
|--------|------|------|
| **A. PeerJS-free: public free STUN + manual SDP paste / short code via existing CF Worker** | Controlled | Needs tiny Worker |
| **B. Third-party free signaling (e.g. PeerJS cloud)** | Fast | Dependency / privacy narrative |
| **C. QR / copy full SDP** | Zero backend | Terrible UX |

**Decision lean:** **A lite** - one small Cloudflare Worker (or reuse an existing jonbailey worker path) for **ephemeral room codes only** (WebSocket or Durable Object room, TTL 2h, payloads = SDP + ICE + state JSON). **No video, no post bodies from camera.**

If operator wants **strict zero backend**, ship Shared Reality as **local multi-tab BroadcastChannel** + **manual room code over any chat** (copy invite JSON) first, then Worker as phase 3.1.

**Room state sync (data channel JSON):**

```json
{
  "v": 3,
  "type": "presence|anchor|reaction|handles",
  "peerId": "...",
  "handles": ["@a"],
  "origin": { "yaw0": 0, "pitch0": 0 },
  "reaction": "✨",
  "t": 1720000000
}
```

Peers map remote anchors into local view as ghost cards (lower opacity). No remote camera.

### 3.7 Storage

| Data | Store | Notes |
|------|-------|-------|
| Settings, locale, onboarding flags | `localStorage` | Small, sync |
| Gallery stills + clip blobs | **IndexedDB** (`xray-v3`) | Migrate v2 `xray-v2-gallery` once |
| Optional API key | IndexedDB encrypted-at-rest not available in browser; store with clear warning | User-owned |
| Room ID last used | sessionStorage | Ephemeral |

Gallery caps: 40 stills or ~80 MB soft budget; oldest eviction.

### 3.8 Capture pipeline

**Still:** composite video frame + positioned cards (use current world transform) + watermark "X-Ray v3 · on-device"

**Moment:**

1. `canvas` sized to stage; rAF draw video + cards for N seconds
2. `canvas.captureStream(30)` → `MediaRecorder` (`video/webm;codecs=vp9` fallback `vp8` / mp4 if available)
3. Blob → IndexedDB + download/share

iOS Safari: MediaRecorder support varies; if unavailable, disable Moment button with honest copy and keep stills.

### 3.9 Insights

**Local heuristics (always):**

- Luma band → outdoor / indoor tip
- Handle density → "try fewer vectors for walk-safe"
- Keyword sets on post body → mood label
- Lock state → coaching ("Re-anchor after you sit down")

**Optional remote:**

```
POST https://api.x.ai/v1/chat/completions
Authorization: Bearer <user key>
```

Only from client; only on explicit Enrich; never log key to our hosts.

### 3.10 i18n

- Keep embedded packs EN / ES / PT / JA for core strings
- New keys for lock badge, re-anchor, permissions, Shared Reality, moments, changelog
- **Standing operator hold:** if `~\.grok\i18n\PAUSE.txt` is active, implementation may ship EN-first for *new* strings and leave other locales partially English until resume (document in README). Existing v2 translations stay.

### 3.11 State model (conceptual)

```
AppState {
  locale, arOpen, mode: 'demo'|'live',
  lock: { status: 'off'|'requesting'|'active'|'fallback', yaw0, pitch0, filtered },
  stream, settings, galleryMeta,
  room: { id, peers, role: 'host'|'guest'|null },
  audio: { enabled },
  version: '3.0.0'
}
```

Single `requestAnimationFrame` loop when AR open: sample sensors → apply transform → optional ambient sample tick.

### 3.12 Gestures

| Gesture | Action |
|---------|--------|
| Pinch | Scale depth separation (CSS `--depth-scale`) |
| Double-tap card | Expand / focus card |
| Long-press card | Insight bubble |
| Two-finger rotate (optional) | Manual yaw offset if sensors off |
| Scroll | Feed navigate + walk-safe hide |
| Re-anchor button | Reset origin |

Implement pinch via Pointer Events (no extra libs).

---

## 4. Privacy model

### 4.1 Hard rules

1. Camera streams never leave the device except as user-exported still/clip files.
2. No telemetry SDKs, no analytics pixels, no required login.
3. Service worker caches **static assets only** (never media streams).
4. Shared Reality syncs **handles, anchors, reactions** only - not video frames.
5. Optional xAI key stays in client storage; documented risk: browser extensions can read storage.
6. Clear Privacy statement page section + in-app sheet.

### 4.2 Degradation matrix

| Condition | Experience |
|-----------|------------|
| No camera | Ambient mesh stage + full demo stack |
| No orientation | Enhanced scroll/pointer parallax; badge SCROLL DEPTH |
| iOS motion denied | Same as no orientation; one soft re-prompt entry in Settings only |
| No MediaRecorder | Stills only |
| No WebRTC | Shared Reality shows "unsupported"; invite copy still seeds handles |
| Reduced motion | Static depth, no sensor drive |
| Low light | Ambient tint + high-contrast recommendation toast once |
| Landscape / portrait | Recalc stage bounds; re-anchor suggested on major resize |
| Desktop | Pointer-parallax + optional phone QR "open on device for world lock" |

---

## 5. Visual language

### 5.1 Continuity from v2

- Dark base, cyan X accent (`#1d9bf0` family), glass cards, scanline / mesh ambient
- Logo lockup, bento marketing landing, device preview
- Outdoor-readable type hierarchy

### 5.2 v3 evolutions

- Version chrome: **X-Ray v3** + **Anchored Reality** eyebrow
- **Lock badge** as signature UI element
- Depth cards gain soft drop shadow that shifts with `dYaw` (fake light)
- Ambient themes (Tokyo neon rain, Rio ocean light, Lagos coast, Berlin grid, Seoul night) become **reactive presets**: base gradient + ambient sample blend
- Changelog sheet accessible from landing footer and Settings
- "What's new in v3" first-run card

### 5.3 Motion craft

- Prefer CSS transforms / opacity only (compositor-friendly)
- Springs: short 200-280 ms ease-out for chrome; no bounce on walk-safe
- World lock engage: 400 ms ease into filtered pose from identity

---

## 6. Browser support matrix

| Browser | Camera | World lock | Moments | WebRTC rooms | Notes |
|---------|--------|------------|---------|--------------|-------|
| iOS Safari 16.4+ | Yes | Yes after gesture permission | Partial | Yes (data) | Strict HTTPS; permission quirks |
| Chrome Android | Yes | deviceorientation / sensors | Good | Good | Secure context |
| Chrome desktop | Webcam | Fallback / pointer | Good | Good | No phone gyro |
| Firefox Android | Yes | Orientation varies | Varies | Varies | Feature detect |
| Samsung Internet | Yes | Yes typically | Good | Good | Test on mid-range |

**Baseline:** ES2020, modules or IIFE bundle without build; if modules, `type=module` + import map optional. Prefer native ES modules with relative paths (CF Pages serves fine) **or** single concatenated build if caching simplicity wins. Recommendation: **ES modules** under `/assets/app/` with `main.js` entry for cache granularity.

HTTPS required for camera, sensors, SW, WebRTC.

---

## 7. Performance budget

| Budget | Target |
|--------|--------|
| First load JS (compressed) | ≤ 80 KB for core path (no Three) |
| CSS | ≤ 30 KB |
| rAF work | ≤ 8 ms avg on mid phone when lock active |
| Sensor sample | 30-60 Hz; batch DOM write once per frame |
| Ambient sample | ≤ 4 Hz |
| Gallery IDB read | lazy on open sheet |
| LCP (landing) | Keep static hero text/CSS; no huge 3D on landing |

Battery saver: drop to 30 fps, pause ambient, hide far cards beyond N.

---

## 8. Accessibility plan

- `prefers-reduced-motion` media query forces reduced path even if toggle off
- Focus traps in sheets; `aria-modal`, labels on all icon buttons
- Lock status announced via polite live region when mode changes
- High contrast tokens; min 44px touch targets
- Keyboard map documented in README
- Captures alt text: "X-Ray capture {timestamp}"

---

## 9. Docs & ship deliverables (post-approval)

1. Modular source under `~\x-ray\public\`
2. README: setup, deploy (`deploy.ps1`), deep links, limitations
3. `CHANGELOG.md` v2 → v3
4. In-app **What's new** + Privacy statement
5. Version bump: `3.0.0` in SW cache, OG `?v=3.0.0`, JSON-LD, manifest
6. After live ship: update `~\.grok\LIVE-SITES.md` + registry; Ensure-TweetCard if OG art changes
7. i18n hold respected unless operator lifts it
8. Continuity sync note after ship

---

## 10. Implementation phases (after approval)

| Phase | Scope | Exit criteria |
|-------|-------|---------------|
| **P0** | Module split + version chrome + lock badge UI + re-anchor control | Structure green, v2 parity |
| **P1** | Sensor fusion + world-lock transforms + iOS permission + fallback parallax | Aha demo on phone |
| **P2** | Ambient tint + gestures + a11y + Demo Reality spatial samples | Polish |
| **P3** | IndexedDB gallery + MediaRecorder moments | Capture upgrade |
| **P4** | Insights heuristics + optional API key | Insights 2.0 |
| **P5** | Shared Reality data rooms (Worker or zero-backend path) | 2-device co-presence |
| **P6** | Docs, changelog, OG/PWA cache, deploy, LIVE-SITES | Shipped |

Phases P0-P2 are the **core product promise**. P3-P5 can ship in the same release if quality holds; otherwise tag `3.0.0` after P2 and iterate `3.1` for Shared Reality if signaling needs more time.

---

## 11. Open questions / trade-offs

| # | Question | Recommendation | Needs operator call? |
|---|----------|----------------|----------------------|
| 1 | Three.js vs CSS 3D for lock | **CSS 3D + custom pose math first** | Soft prefer; override if you want Three for brand reasons |
| 2 | Shared Reality signaling backend | **Tiny CF Worker ephemeral rooms** vs pure manual | **Yes** - privacy purity vs UX |
| 3 | ES modules vs single app.js | **ES modules** | Soft |
| 4 | Optional xAI insights in v3.0 | Include behind settings; default off | Soft |
| 5 | Spatial audio in v3.0 | Ship toggle + near cues; easy cut if janky | Soft |
| 6 | Video moments length | **3s default**, max 6s | Soft |
| 7 | i18n under global PAUSE | EN-first for *new* strings only | Standing hold already |
| 8 | Rename storage keys | `xray-v3-*` + migrate v2 gallery | Soft |

---

## 12. Deep links (planned)

| URL | Effect |
|-----|--------|
| `/?demo=1` | Demo Reality |
| `/?xray=1` | Stage, prefer live camera |
| `/?room=CODE` | Join Shared Reality room |
| `/?room=@a,@b` | Seed handles (v2 compat) |
| `/?lock=0` | Force fallback depth (debug / reduced) |
| `/?whatsnew=1` | Open What's new |

---

## 13. Risks

1. **iOS permission fatigue** - mitigate with Demo-first, motion only on explicit Enable.
2. **Jittery gyro** - deadzone + low-pass + re-anchor education.
3. **MediaRecorder gaps** - stills always work.
4. **WebRTC NAT** - STUN only may fail some mobile carriers; show honest "could not connect" + retry.
5. **Scope creep** - if Shared Reality blocks ship, cut to P5 post-3.0.
6. **localStorage gallery bloat** - migrate to IDB early (P3).

---

## 14. Approval gate

**No production implementation code until you approve this design** (or a revised version).

Please reply with one of:

- **Approve as written** - implement P0→ship path  
- **Approve with changes:** ...  
- **Decisions only:** answers to Q1-Q8 above  
- **Revise:** specific sections to rework  

---

*End of design document. File: `~\x-ray\docs\X-RAY-V3-DESIGN.md`*
