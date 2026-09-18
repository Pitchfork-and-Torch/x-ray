/**
 * X-Ray Shared Reality signaling (ephemeral).
 * Stores SDP offers/answers + ICE candidates in KV with short TTL.
 * Never stores camera media or post bodies.
 */

const TTL = 60 * 60 * 2; // 2 hours
const ROOM_RE = /^[A-HJ-NP-Z2-9]{4,8}$/;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json; charset=utf-8",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function roomKey(id) {
  return `room:${id}`;
}

function signalsKey(id) {
  return `signals:${id}`;
}

function parseRoomId(raw) {
  const id = String(raw || "").toUpperCase();
  return ROOM_RE.test(id) ? id : null;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    if (parts.length === 0 || (parts.length === 1 && parts[0] === "health")) {
      return json({
        ok: true,
        service: "xray-signal",
        version: 2,
        kv: Boolean(env.ROOMS),
        privacy: "SDP/ICE only. No media. TTL 2h.",
      });
    }

    if (parts[0] === "rooms" && parts.length === 2 && request.method === "PUT") {
      const id = parseRoomId(parts[1]);
      if (!id) return json({ error: "bad_room" }, 400);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "bad_json" }, 400);
      }
      const record = {
        id,
        offer: body.offer || null,
        host: body.host || null,
        answer: null,
        updated: Date.now(),
      };
      if (env.ROOMS) {
        await env.ROOMS.put(roomKey(id), JSON.stringify(record), { expirationTtl: TTL });
        await env.ROOMS.put(signalsKey(id), JSON.stringify([]), { expirationTtl: TTL });
      }
      return json({ ok: true, id, kv: Boolean(env.ROOMS) });
    }

    if (parts[0] === "rooms" && parts.length === 2 && request.method === "GET") {
      const id = parseRoomId(parts[1]);
      if (!id) return json({ error: "bad_room" }, 400);
      if (!env.ROOMS) return json({ id, offer: null, offline: true });
      const raw = await env.ROOMS.get(roomKey(id), { cacheTtl: 0 });
      if (!raw) return json({ error: "not_found" }, 404);
      const room = JSON.parse(raw);
      return json({ id: room.id, offer: room.offer, answer: room.answer });
    }

    if (
      parts[0] === "rooms" &&
      parts[2] === "signal" &&
      parts.length === 3 &&
      request.method === "POST"
    ) {
      const id = parseRoomId(parts[1]);
      if (!id) return json({ error: "bad_room" }, 400);
      let msg;
      try {
        msg = await request.json();
      } catch {
        return json({ error: "bad_json" }, 400);
      }
      msg.t = Date.now();
      if (!env.ROOMS) return json({ ok: true, local: true });

      if (msg.type === "answer" && msg.sdp) {
        const raw = await env.ROOMS.get(roomKey(id), { cacheTtl: 0 });
        if (raw) {
          const room = JSON.parse(raw);
          room.answer = msg.sdp;
          room.updated = Date.now();
          await env.ROOMS.put(roomKey(id), JSON.stringify(room), { expirationTtl: TTL });
        }
      }

      const sraw = (await env.ROOMS.get(signalsKey(id), { cacheTtl: 0 })) || "[]";
      let list = [];
      try {
        list = JSON.parse(sraw);
      } catch {
        list = [];
      }
      list.push(msg);
      if (list.length > 80) list = list.slice(-80);
      await env.ROOMS.put(signalsKey(id), JSON.stringify(list), { expirationTtl: TTL });
      return json({ ok: true });
    }

    if (
      parts[0] === "rooms" &&
      parts[2] === "poll" &&
      parts.length === 3 &&
      request.method === "GET"
    ) {
      const id = parseRoomId(parts[1]);
      if (!id) return json({ error: "bad_room" }, 400);
      const peer = url.searchParams.get("peer") || "";
      const since = Number(url.searchParams.get("since") || 0) || 0;
      if (!env.ROOMS) return json({ messages: [], cursor: since });
      const sraw = (await env.ROOMS.get(signalsKey(id), { cacheTtl: 0 })) || "[]";
      let list = [];
      try {
        list = JSON.parse(sraw);
      } catch {
        list = [];
      }
      const messages = list.filter(
        (m) => m.from && m.from !== peer && Number(m.t || 0) > since,
      );
      const cursor = messages.reduce((acc, m) => Math.max(acc, Number(m.t || 0)), since);
      return json({ messages, cursor });
    }

    return json({ error: "not_found" }, 404);
  },
};
