import { state } from "./state.js";

const MOODS = [
  { re: /neon|night|led|dark/i, label: "nocturnal" },
  { re: /ocean|water|horizon|gold/i, label: "golden hour" },
  { re: /market|pulse|rhythm|city/i, label: "urban energy" },
  { re: /fog|low|haze|desert/i, label: "soft atmosphere" },
  { re: /lock|anchor|spatial|room/i, label: "spatial coaching" },
];

export function localInsight(card) {
  const body = card?.dataset?.body || card?.querySelector?.(".post-body")?.textContent || "";
  const base = card?.dataset?.insight || "";
  const tips = [];

  let mood = "neutral";
  for (const m of MOODS) {
    if (m.re.test(body)) {
      mood = m.label;
      break;
    }
  }
  tips.push(`Mood: ${mood}`);

  const luma = state.ambient.luma;
  if (state.mode === "live") {
    if (luma > 0.55) tips.push("Bright scene - try glass blend ~65 and high contrast outdoors.");
    else if (luma < 0.18) tips.push("Low light - high contrast helps cards read.");
    else tips.push("Mid light - ambient tint is matching the room.");
  } else {
    tips.push("Ambient demo - enable Live camera for room-matched tint.");
  }

  if (state.lock.status === "active" && state.lock.available) {
    tips.push("World lock on. Re-anchor after you change rooms.");
  } else {
    tips.push("Scroll depth mode. Enable world lock for room pinning.");
  }

  if (base) tips.push(base);
  return tips.join(" · ");
}

export async function enrichWithXai(text, apiKey) {
  if (!apiKey) throw new Error("no-key");
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-2-latest",
      temperature: 0.4,
      max_tokens: 120,
      messages: [
        {
          role: "system",
          content:
            "You write one short private on-device insight bubble for an AR social feed (max 2 sentences). No preamble.",
        },
        {
          role: "user",
          content: `Post: ${text}\nContext: X-Ray mixed reality feed, privacy-first.`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error("api-" + res.status);
  const data = await res.json();
  const out = data.choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error("empty");
  return out;
}
