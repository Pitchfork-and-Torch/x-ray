# X-Ray 4.0 Grounded Reality

Addendum to v3. v3 shipped CSS 3D world lock. v4 does not revisit Three.js.

## What shipped

- Place Memory in IndexedDB database `xray-v3` version 2, store `places`. Gallery store is not wiped.
- Feed Bay store `feed`. Import is local. No social API.
- Shared Reality application messages `v: 4` (anchors, reactions, notes, ghosts) over the existing data channel and same-tab BroadcastChannel. `v: 3` presence, handles, and reactions are still accepted.
- Surface pins, creator notes, Local Pulse fields, optional WebXR hit-test when the browser has `immersive-ar`.

## Invariants

- No accounts. No TURN daemon. No camera upload.
- This host does not fetch X.
- Signaling worker still stores SDP and ICE only (2 hour TTL). It rejects application anchor posts.
- Anchors sync only while the data channel is up. NAT may block rooms.
- WebXR is optional. CSS 3D remains the default. This is not SLAM and not a 3D scan.
- Places store orientation-relative `az` / `el` / `plane` plus an origin yaw and pitch.

## Place

```
Place { id, name, created, updated, origin: { yaw0, pitch0 }, cards, source }
card { id, az, el, plane, source, pinned, post }
```

Cap 20 places. Oldest updated record is dropped. Deep links: `/?place=ID`, `/?places=1`.

## Deep links kept

`/?demo=1` `/?xray=1` `/?room=CODE` `/?room=@a,@b` `/?lock=0` `/?whatsnew=1`

Added: `/?feed=owned` `/?import=1`. `/?xr=1` only reveals plane hit-test when the browser supports it.

## Out of scope

Live X fetch, accounts, TURN, a bundler, React, a Three.js port, visual SLAM, locale fan-out, and deploying from this change unless asked.
