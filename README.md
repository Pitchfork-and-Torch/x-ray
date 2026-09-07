# X-Ray 3.1.1 - Across Devices

**See your feed through reality.**

Spatial posts over live camera, on this device. World lock pins a depth stack of sample (or handle-labeled) cards in the room. Demo Reality, Shared Reality signaling rooms, on-device insights, and a local gallery. Camera frames and captures are not uploaded.

- **Live:** https://x-ray.jonbailey.xyz/
- **Signaling:** https://xray-signal.jonbailey.xyz/
- **Original experimental app:** https://x-ray.grok.me/
- **Concept:** [@suddenlyjon](https://x.com/suddenlyjon)
- **License:** MIT
- **Version:** 3.1.1 (`VERSION` + [CHANGELOG.md](./CHANGELOG.md))

## What's new in 3.1.1

Honesty pass only. No new product features.

- Versions, README, PWA, and AEO/privacy copy match the shipped app
- This host does not fetch X
- Shared Reality copy lists what the data channel actually sends (SDP/ICE, presence, handle labels)
- Privacy copy states what is not uploaded, and the optional paths that can leave the browser
- Missing `applyLocale` export restored so the module graph boots (EN only; locale fan-out still paused)
- Stale footer `v3.0.1` and dead ES/PT/JA switcher removed

## What's new in v3.1

- **Across Devices** - Shared Reality rooms signal through `xray-signal.jonbailey.xyz`
- Poll cursor so ICE candidates are not replayed
- Guest-first, no accounts, no TURN daemon

## What's new in v3

- **Anchored Reality** - device orientation locks the depth stack into the room
- **Re-anchor** - reset origin when you change locations
- **Moments** - short local AR video clips (plus stills)
- **IndexedDB gallery** - larger local library; migrates v2 captures
- **Shared Reality** - ephemeral data-channel rooms (no camera share)
- **Ambient tint** - cards pick up room lighting from the camera
- **Optional client-side xAI key** for richer private insights

See [CHANGELOG.md](./CHANGELOG.md) and design notes in [docs/X-RAY-V3-DESIGN.md](./docs/X-RAY-V3-DESIGN.md).

## Privacy

This site does **not** upload:

- Camera frames (`getUserMedia` stays in the tab)
- Motion / orientation
- Gallery stills or Moments

What can leave the browser:

- Shared Reality: SDP, ICE, presence, and handle labels (never video)
- Optional Enrich: post text to `api.x.ai` only if you paste a key and tap Enrich
- Visit counts on `hits.jonbailey.xyz` (page loads, not camera)

No accounts. No TURN daemon. Signaling stores SDP and ICE only (2 hour TTL).

## Quick start

Open `public/index.html` over **HTTPS** (camera and sensors need a secure context), or:

```powershell
npx --yes serve public
```

Deploy Pages:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

### Shared Reality signaling

Cross-device rooms use the Worker in `workers/signal/` (live at https://xray-signal.jonbailey.xyz/).

```powershell
powershell -ExecutionPolicy Bypass -File .\workers\signal\deploy.ps1
```

Set the worker URL in `public/index.html` meta `xray-signal`. Without it, same-browser tabs still work via BroadcastChannel. The worker stores SDP and ICE only (2 hour TTL). No camera media.

## Deep links

| URL | Effect |
|-----|--------|
| `/?demo=1` | Open Demo Reality |
| `/?xray=1` | Open stage (live camera preferred) |
| `/?room=CODE` | Join Shared Reality room |
| `/?room=@a,@b` | Seed vector handles (v2 compat) |
| `/?lock=0` | Force scroll-depth (no world lock) |
| `/?whatsnew=1` | Open What's new |

## Architecture

Static PWA (Cloudflare Pages), zero build:

```
public/
  index.html
  assets/styles.css
  assets/app/          # ES modules
    main-v302.js       # current entry
    sensors/           # orientation + fusion
    render/            # CSS 3D depth stack
    ...
  sw.js
workers/signal/        # optional ephemeral WebRTC signaling
```

World lock uses CSS 3D transforms driven by sensor fusion (not Three.js). Sensors denied -> enhanced scroll/pointer parallax.

Public copy is EN-only while i18n fan-out is paused.

## Browser notes

| Feature | Notes |
|---------|--------|
| World lock | iOS requires a tap on **Enable world lock** |
| Moments | Needs MediaRecorder; falls back to stills |
| Shared Reality | WebRTC + STUN; NAT may block some networks |
| Desktop | Pointer parallax; use a phone for true world lock |

## Keyboard (stage open)

| Key | Action |
|-----|--------|
| Esc | Close sheet / exit stage |
| R | Re-anchor |
| Space | Still capture (when focus on body) |

## Credits

Concept and experimental product direction by [@suddenlyjon](https://x.com/suddenlyjon).  
Network host and v3 Anchored Reality: Pitchfork-and-Torch.

## Support

Use [GitHub Issues](https://github.com/Pitchfork-and-Torch/x-ray/issues) only.
