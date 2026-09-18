# xray-signal

Ephemeral WebRTC signaling for X-Ray Shared Reality.

- **Stores:** room SDP offer/answer + ICE candidates only
- **TTL:** 2 hours (KV expiration)
- **Never stores:** camera media, captures, post text
- **Live:** https://xray-signal.jonbailey.xyz/

## Deploy

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

Point the app meta tag `xray-signal` (or `window.__XRAY_SIGNAL__`) at the worker URL.

Without this worker, Shared Reality still works for same-browser tabs via `BroadcastChannel`.

Local tests (no deploy):

```powershell
node .\scripts\test_signal_worker.mjs
node .\scripts\test_webrtc_room.mjs
```

Poll cursor is still a millisecond `t` compared with `> since`. Same-ms ICE is stamped `last.t + 1` so candidates are not dropped. POST `/signal` requires a live room, a `from` field, and type `answer` / `ice` / `offer`. First answer wins. This host does not talk to the X API.
