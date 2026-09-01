# xray-signal

Ephemeral WebRTC signaling for X-Ray Shared Reality.

- **Stores:** room SDP offer/answer + ICE candidates only
- **TTL:** 2 hours (KV expiration)
- **Never stores:** camera media, captures, post text
- **Live:** https://xray-signal.jonbailey.xyz/

## Deploy

```powershell
powershell -ExecutionPolicy Bypass -File $env:USERPROFILE\x-ray\workers\signal\deploy.ps1
```

Point the app meta tag `xray-signal` (or `window.__XRAY_SIGNAL__`) at the worker URL.

Without this worker, Shared Reality still works for same-browser tabs via `BroadcastChannel`.
