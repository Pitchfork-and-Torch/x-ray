# X-Ray v3 - Anchored Reality

**See your feed through reality.**

Privacy-first mixed-reality social feed: world-anchored posts over live camera passthrough, Demo Reality, Shared Reality data rooms, on-device insights, and a local gallery. Camera and captures never leave the device unless you export them.

- **Live:** https://x-ray.jonbailey.xyz/
- **Signaling:** https://xray-signal.jonbailey.xyz/
- **Original experimental app:** https://x-ray.grok.me/
- **Concept:** [@suddenlyjon](https://x.com/suddenlyjon)
- **License:** MIT
- **Version:** 3.1.0

## What's new in v3

- **Anchored Reality** - device orientation locks the depth stack into the room
- **Re-anchor** - reset origin when you change locations
- **Moments** - short local AR video clips (plus stills)
- **IndexedDB gallery** - larger local library; migrates v2 captures
- **Shared Reality** - ephemeral data-channel rooms (no camera share)
- **Ambient tint** - cards pick up room lighting from the camera
- **Optional client-side xAI key** for richer private insights

See [CHANGELOG.md](./CHANGELOG.md) and design notes in [docs/X-RAY-V3-DESIGN.md](./docs/X-RAY-V3-DESIGN.md).

## What's new in v3.1

- **Across Devices** - Shared Reality rooms signal through `xray-signal.jonbailey.xyz`
- Poll cursor so ICE candidates are not replayed
- Guest-first, no accounts, no TURN daemon

## Privacy

- `getUserMedia` streams stay in the browser tab
- Motion sensors are processed on-device only
- Captures live in IndexedDB / downloads on this device
- Shared Reality syncs handles, anchors, and reactions - never video frames
- No required accounts, no telemetry from this static host
- Optional xAI key is stored only in your browser and sent only to api.x.ai when you tap Enrich

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
powershell -ExecutionPolicy Bypass -File $env:USERPROFILE\x-ray\workers\signal\deploy.ps1
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
    main.js
    sensors/           # orientation + fusion
    render/            # CSS 3D depth stack
    ...
  sw.js
workers/signal/        # optional ephemeral WebRTC signaling
```

World lock uses CSS 3D transforms driven by sensor fusion (not Three.js). Sensors denied → enhanced scroll/pointer parallax.

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
