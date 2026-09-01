# Changelog

## 3.1.1 - Honesty pass (2026-09-01)

- Versions, README, PWA, and AEO/privacy copy match the shipped on-device app
- Copy no longer claims a live X feed, Shared Reality anchor/reaction sync, or "no telemetry"
- Privacy text lists what is not uploaded (camera, photos, motion) and the optional paths that can leave the browser
- Restored missing `applyLocale` export so the ES module graph boots
- Removed dead ES/PT/JA switcher (EN-only while i18n is paused)
- Footer version rot (`v3.0.1`) fixed; PWA cache bumped to 3.1.1

## 3.1.0 - Across Devices (2026-08-28)

- Live Cloudflare Worker signaling at https://xray-signal.jonbailey.xyz/
- Shared Reality rooms work across phones (SDP + ICE only, 2 hour TTL)
- Same-tab BroadcastChannel fallback unchanged
- Camera and captures still never leave the device

## 3.0.0 - Anchored Reality (2026-07-31)

### Core

- **World lock** using DeviceOrientation / AbsoluteOrientationSensor with iOS permission gesture
- **Re-anchor** control resets spatial origin
- Lock badge: WORLD LOCK / SCROLL DEPTH / CALIBRATING
- Graceful **scroll + pointer parallax** when sensors missing or denied
- **Ambient tint** from live camera average color

### Capture & storage

- Gallery moved to **IndexedDB** (migrates v2 localStorage stills)
- **Moments**: short on-device AR clips via MediaRecorder (2-6s, default 3s)
- Watermark: `X-Ray v3 · on-device`

### Shared Reality 2.0

- Optional WebRTC **data-channel** rooms (handles, presence, reactions)
- Ephemeral invite codes / `?room=CODE`
- Optional `xray-signal` Cloudflare Worker for cross-device SDP; BroadcastChannel local fallback
- No camera/video sharing

### Insights & polish

- Local heuristic insight bubbles (long-press / double-tap)
- Optional **client-only** xAI API key for richer insights
- Pinch to scale depth separation
- Spatial audio cues (off by default)
- Onboarding, What's new, Privacy, Changelog sheets
- ES modules under `public/assets/app/`
- PWA cache bump to v3.0.0

## 2.0.0

- Responsive network host, EN/ES/PT/JA, walk-safe chrome, Demo Reality, local still gallery, PWA shell
