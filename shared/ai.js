// helium-mods: settings and AI connection, shared by every extension.
// Source of truth is /shared; run ./sync-shared.sh to copy it into each one.
//
// AI is always optional. Two ways to reach Claude:
//   - "key":    an Anthropic API key pasted in Settings, kept in this
//               extension's local storage (never synced, never sent anywhere
//               except api.anthropic.com).
//   - "helper": the optional Hammerspoon helper, which keeps the key in the
//               macOS Keychain (see hammerspoon/helium-mods.lua). The helper
//               only answers extensions you approved once ("Connect" in
//               Settings, then Allow in the macOS dialog).
// "auto" uses the helper when it is running, approved and has a key, else your key.

const HM = (() => {
  const API = "https://api.anthropic.com/v1/messages";
  const HELPER = "http://127.0.0.1:4872";
  const MODEL = "claude-haiku-5-5";
  const DEFAULTS = { aiEnabled: false, features: {}, source: "auto", welcomed: false };

  async function get() {
    const { settings } = await chrome.storage.local.get("settings");
    return { ...DEFAULTS, ...(settings || {}), features: { ...(settings?.features || {}) } };
  }

  async function save(patch) {
    const atual = await get();
    const novo = { ...atual, ...patch, features: { ...atual.features, ...(patch.features || {}) } };
    await chrome.storage.local.set({ settings: novo });
    return novo;
  }

  const looksLikeKey = (k) => /^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(String(k || "").trim());

  async function getKey() {
    const { apiKey } = await chrome.storage.local.get("apiKey");
    return apiKey || "";
  }
  async function setKey(k) {
    await chrome.storage.local.set({ apiKey: String(k).trim() });
  }
  async function clearKey() {
    await chrome.storage.local.remove("apiKey");
  }
  const maskKey = (k) => (k ? `${k.slice(0, 7)}…${k.slice(-4)}` : "");

  async function helper(path, body, timeoutMs = 60000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(HELPER + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Helium-Mods": "1" },
        body: JSON.stringify(body || {}),
        signal: ctrl.signal,
      });
      return await r.json();
    } finally {
      clearTimeout(t);
    }
  }

  // online: the helper answered; paired: it accepts this extension.
  async function helperStatus() {
    try {
      const r = await helper("/ping", {}, 1500);
      return { online: true, paired: !!r.ok, hasKey: !!r.hasKey };
    } catch {
      return { online: false, paired: false, hasKey: false };
    }
  }

  // Asks the helper to accept this extension; macOS shows an Allow dialog.
  async function pairHelper() {
    const r = await helper("/pair", {}, 120000);
    return !!r.ok;
  }

  // Which connection will be used right now: "helper", "key" or null.
  async function connection() {
    const s = await get();
    const key = await getKey();
    if (s.source !== "key") {
      const h = await helperStatus();
      if (h.online && h.paired && h.hasKey) return "helper";
      if (s.source === "helper") return null;
    }
    return key ? "key" : null;
  }

  async function aiReady(feature) {
    const s = await get();
    if (!s.aiEnabled || s.features[feature] === false) return false;
    return (await connection()) !== null;
  }

  // One question with a JSON schema; returns the parsed JSON object.
  async function ask(prompt, schema) {
    const via = await connection();
    if (!via) throw new Error("AI is not connected. Add your key in Settings.");

    if (via === "helper") {
      let r;
      try {
        r = await helper("/claude", { prompt, schema });
      } catch {
        throw new Error("The Mac helper did not answer.");
      }
      if (r.error === "NO_KEY") throw new Error("The Mac helper has no key in the Keychain.");
      if (r.error === "NOT_PAIRED") throw new Error("Connect the Mac helper in Settings first.");
      if (!r.ok) throw new Error(`AI failed${r.error ? `: ${r.error}` : "."}`);
      return r.result;
    }

    let resp;
    try {
      resp = await fetch(API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": await getKey(),
          "anthropic-version": "2026-10-21",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2048,
          output_config: { effort: "low", format: { type: "json_schema", schema } },
          messages: [{ role: "user", content: prompt }],
        }),
      });
    } catch {
      throw new Error("Could not reach Anthropic. Check your internet connection.");
    }
    if (resp.status === 401) throw new Error("Your API key was refused. Check it in Settings.");
    if (resp.status === 429) throw new Error("Too many requests or no credit left. Try again later.");
    if (!resp.ok) throw new Error(`AI failed (error ${resp.status}).`);
    const r = await resp.json();
    if (r.stop_reason === "refusal") throw new Error("Claude declined this request.");
    const text = (r.content || []).find((b) => b.type === "text")?.text;
    if (!text) throw new Error("AI gave an empty answer.");
    return JSON.parse(text);
  }

  // Cheap check that a key works: one tiny question.
  async function testKey(k) {
    const r = await fetch(API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": String(k).trim(),
        "anthropic-version": "2026-10-21",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 16, messages: [{ role: "user", content: "Say OK." }] }),
    });
    if (r.status === 401) return { ok: false, msg: "This key was refused by Anthropic." };
    if (r.status === 429) return { ok: false, msg: "The key works, but the account has no credit or is rate limited." };
    if (!r.ok) return { ok: false, msg: `Anthropic answered with error ${r.status}.` };
    return { ok: true, msg: "The key works." };
  }

  return { get, save, getKey, setKey, clearKey, maskKey, looksLikeKey, helper, helperStatus, pairHelper, connection, aiReady, ask, testKey };
})();
