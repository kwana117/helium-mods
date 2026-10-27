-- ─── helium-mods helper (optional) ──────────────────────────────────────────
-- Optional Hammerspoon helper for the helium-mods extensions. It does two
-- things the browser cannot do on its own:
--   1. Writes the theme files when you press "Apply to Helium" in Skins, so
--      the window changes colour with one click.
--   2. Talks to Claude with the API key kept in the macOS Keychain, so the
--      key never lives inside the browser.
--   3. Optionally hands extensions a short personal context (your projects,
--      clients, topics) so AI features can sort things the way you think.
--      It comes from ~/.config/helium-mods/context (a program you write,
--      whose output is used) or ~/.config/helium-mods/context.md. Nothing
--      in this repository reads your notes; with neither file, it's empty.
-- Without this helper everything still works: Skins offers "Download theme"
-- and the AI features use a key pasted in each extension's Settings.
--
-- Listens only on 127.0.0.1. Every request needs the X-Helium-Mods header,
-- which forces the browser to ask permission first (a preflight this server
-- never answers), so ordinary web pages cannot use it. On top of that, only
-- extensions you approved can use it: the first time an extension presses
-- "Connect" in its Settings, macOS asks you to allow it, and its address is
-- remembered. Anything else (other extensions, other programs) is refused.
--
-- Setup: see README.md, section "Optional: the Hammerspoon helper".

local M = {}

-- Where the theme extension lives. Change this if you cloned elsewhere.
local THEME_DIR = os.getenv("HOME") .. "/Code/helium-mods/theme"
local PORT = 4872
-- Keychain item that holds the Anthropic API key (service name).
local KEYCHAIN_SERVICE = "anthropic-api-key"
local MODEL = "claude-haiku-5-5"
local CONTEXT_DIR = os.getenv("HOME") .. "/.config/helium-mods"

-- Load these up front: loading an extension for the first time inside the
-- server callback overflows the stack.
local http = require("hs.http")
local base64 = require("hs.base64")
local dialog = require("hs.dialog")
local settings = require("hs.settings")
local fs = require("hs.fs")

local function writeFile(path, data)
  local f = assert(io.open(path, "wb"))
  f:write(data)
  f:close()
end

local function nextVersion()
  local f = io.open(THEME_DIR .. "/manifest.json", "r")
  if not f then return "1.0.1" end
  local ok, m = pcall(hs.json.decode, f:read("*a"))
  f:close()
  local a, b, c = tostring(ok and m and m.version or "1.0.0"):match("(%d+)%.(%d+)%.(%d+)")
  return string.format("%d.%d.%d", tonumber(a) or 1, tonumber(b) or 0, (tonumber(c) or 0) + 1)
end

local function hasHeader(headers, name)
  for k in pairs(headers or {}) do
    if k:lower() == name then return true end
  end
  return false
end

local function reply(code, body)
  return hs.json.encode(body), code, { ["Content-Type"] = "application/json" }
end

-- Extensions you approved, by origin (chrome-extension://<id>).
local function allowed()
  return settings.get("helium-mods.allowed") or {}
end

local function originOf(headers)
  for k, v in pairs(headers or {}) do
    if k:lower() == "origin" then return v end
  end
  return nil
end

local function isApproved(origin)
  if not origin then return false end
  for _, o in ipairs(allowed()) do
    if o == origin then return true end
  end
  return false
end

local function pair(origin)
  if not origin or not origin:match("^chrome%-extension://[a-p]+$") then error("not an extension") end
  if isApproved(origin) then return {} end
  local id = origin:gsub("^chrome%-extension://", "")
  hs.focus()
  local choice = dialog.blockAlert("Allow this Helium extension to use helium-mods?",
    "Extension id: " .. id .. "\n\nAllow only if you just pressed Connect in an extension's Settings. "
    .. "It will be able to apply themes and use your Anthropic key from the Keychain.",
    "Allow", "Don't allow", "informational")
  if choice ~= "Allow" then error("NOT_ALLOWED") end
  local list = allowed()
  list[#list + 1] = origin
  settings.set("helium-mods.allowed", list)
  return {}
end

local function apiKey()
  local out, ok = hs.execute("/usr/bin/security find-generic-password -s " .. KEYCHAIN_SERVICE .. " -w 2>/dev/null")
  if not ok or not out or #out < 10 then return nil end
  return (out:gsub("%s+$", ""))
end

-- One question to Claude with a JSON schema; returns the parsed JSON.
-- The prompt is written by the extension; model and limits are fixed here.
local function askClaude(p)
  local key = apiKey()
  if not key then error("NO_KEY") end
  local prompt = tostring(p.prompt or ""):sub(1, 40000)
  local maxTokens = math.max(256, math.min(tonumber(p.max_tokens) or 2048, 8000))
  if prompt == "" or type(p.schema) ~= "table" then error("bad request") end
  local body = hs.json.encode({
    model = MODEL,
    max_tokens = maxTokens,
    output_config = { effort = "low", format = { type = "json_schema", schema = p.schema } },
    messages = { { role = "user", content = prompt } },
  })
  local code, resp = http.post("https://api.anthropic.com/v1/messages", body, {
    ["Content-Type"] = "application/json",
    ["x-api-key"] = key,
    ["anthropic-version"] = "2026-10-21",
  })
  if code ~= 200 then error("Claude answered " .. tostring(code)) end
  local r = hs.json.decode(resp)
  if r.stop_reason == "refusal" then error("Claude declined the request") end
  for _, block in ipairs(r.content or {}) do
    if block.type == "text" then return { result = hs.json.decode(block.text) } end
  end
  error("empty answer")
end

-- Your personal context, if you set one up (see the top of this file).
local function context()
  local prog = CONTEXT_DIR .. "/context"
  local text = ""
  if fs.attributes(prog, "mode") == "file" and hs.execute("test -x '" .. prog .. "' && echo y"):find("y") then
    text = hs.execute("'" .. prog .. "' 2>/dev/null") or ""
  else
    local f = io.open(CONTEXT_DIR .. "/context.md", "r")
    if f then text = f:read("*a") or ""; f:close() end
  end
  return { context = text:sub(1, 12000) }
end

-- The theme manifest is built here, never taken from the request: only
-- colour values and two PNG images are accepted.
local COLOR_KEYS = {
  "frame", "frame_inactive", "background_tab", "background_tab_inactive", "toolbar",
  "tab_text", "tab_background_text", "tab_background_text_inactive", "bookmark_text",
  "toolbar_button_icon", "omnibox_background", "omnibox_text", "ntp_background", "ntp_text",
}

local function validColor(c)
  if type(c) ~= "table" or #c ~= 3 then return false end
  for _, v in ipairs(c) do
    if type(v) ~= "number" or v < 0 or v > 255 or v % 1 ~= 0 then return false end
  end
  return true
end

local function validPng(data)
  return type(data) == "string" and #data > 8 and #data < 30 * 1024 * 1024
    and data:sub(1, 8) == "\137PNG\r\n\26\n"
end

local function applyTheme(p)
  local colors = {}
  for _, k in ipairs(COLOR_KEYS) do
    local c = (p.colors or {})[k]
    if c ~= nil then
      if not validColor(c) then error("invalid colour " .. k) end
      colors[k] = c
    end
  end
  local frame = base64.decode(tostring(p.frame or ""))
  local toolbar = base64.decode(tostring(p.toolbar or ""))
  if not validPng(frame) or not validPng(toolbar) then error("images must be PNG") end
  local name = tostring(p.name or "Skin"):gsub("[^%w%s%-]", ""):sub(1, 30)

  local manifest = {
    manifest_version = 3,
    name = "Helium Skin",
    version = nextVersion(),
    description = "Skin \"" .. name .. "\", made with the Skins editor.",
    theme = {
      images = {
        theme_frame = "images/frame.png",
        theme_frame_inactive = "images/frame.png",
        theme_toolbar = "images/toolbar.png",
        theme_ntp_background = "images/frame.png",
      },
      colors = colors,
      properties = { ntp_background_alignment = "center", ntp_background_repeat = "no-repeat" },
    },
  }
  fs.mkdir(THEME_DIR)
  fs.mkdir(THEME_DIR .. "/images")
  writeFile(THEME_DIR .. "/images/frame.png", frame)
  writeFile(THEME_DIR .. "/images/toolbar.png", toolbar)
  writeFile(THEME_DIR .. "/manifest.json", hs.json.encode(manifest, true))
  return {}
end

local ROUTES = {
  ["/ping"] = function() return { hasKey = apiKey() ~= nil } end,
  ["/pair"] = true, -- handled below, needs the origin
  ["/claude"] = askClaude,
  ["/context"] = context,
  ["/apply"] = applyTheme,
}

M.server = hs.httpserver.new(false, false)
M.server:setInterface("localhost")
M.server:setPort(PORT)
M.server:maxBodySize(40 * 1024 * 1024)
M.server:setCallback(function(method, path, headers, body)
  local route = ROUTES[path]
  if method ~= "POST" or not route or not hasHeader(headers, "x-helium-mods") then
    return reply(404, { ok = false })
  end
  local origin = originOf(headers)
  if path == "/pair" then
    local ok, err = pcall(pair, origin)
    if ok then return reply(200, { ok = true }) end
    return reply(200, { ok = false, error = tostring(err):find("NOT_ALLOWED") and "NOT_ALLOWED" or "bad request" })
  end
  if not isApproved(origin) then
    return reply(200, { ok = false, error = "NOT_PAIRED" })
  end
  local ok, res = pcall(route, hs.json.decode(body ~= "" and body or "{}") or {})
  if ok then
    res.ok = true
    return reply(200, res)
  end
  local err = tostring(res):gsub("^.-:%d+: ", "")
  if err:find("NO_KEY") then return reply(200, { ok = false, error = "NO_KEY" }) end
  return reply(500, { ok = false, error = err })
end)
M.server:start()

return M
