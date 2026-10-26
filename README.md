# helium-mods

Small upgrades for the [Helium](https://helium.computer/) browser on Mac.
Bring back the things you miss from Arc, and make Helium look like yours.

| | What it does |
|---|---|
| **Skins** | Soft gradient looks for Helium, like Arc. Make your own, save them, switch in one click. |
| **Tidy** | Sorts the loose tabs in a window into groups. One shortcut: <kbd>⌥ Option</kbd> <kbd>⇧ Shift</kbd> <kbd>G</kbd>. |

**Everything works without AI.** AI is an optional extra you turn on in Settings, with your own Anthropic key.

---

## Install (5 minutes)

You need Helium and this folder on your Mac.

1. **Get the files.** Click the green **Code** button on this page → **Download ZIP**, then unzip it.
   (Or, if you use git: `git clone` this repository.)
2. **Open Helium's extensions page.** Type `helium://extensions` in the address bar and press Enter.
3. **Turn on Developer mode.** It's the switch at the top right of that page.
4. **Add each extension.** Click **Load unpacked** and pick a folder. Do it once for each:
   - `skins` → the Skins editor
   - `tidy` → Tidy
   - `theme` → the theme Skins writes to (only if you will use the Mac helper, see below)
5. **Pin them.** Click the puzzle icon at the top right of Helium and press the pin next to **Skins** and **Tidy**.

Each extension opens a short welcome guide the first time. You can open it again from its Settings → Help.

---

## Using it

### Skins
1. Click the **Skins** icon. The editor opens in a tab.
2. Pick a skin on the left, or press **+** for a new one.
3. Click the three circles to choose the colours, then set the direction and the grain.
4. Press **Save**, then **Apply to Helium**.

**Applying:** with the Mac helper (below), the window changes straight away.
Without it, **Apply** downloads a `helium-skin-….zip`. Unzip it, then in `helium://extensions` click **Load unpacked** and pick the `helium-skin` folder. Next time, replace that folder and press the reload icon on its card.

### Tidy
- Press <kbd>⌥ Option</kbd> <kbd>⇧ Shift</kbd> <kbd>G</kbd> in any window, or click the Tidy icon and press the button.
- **Without AI** it groups by site: Gmail with Gmail, GitHub with GitHub. Nothing leaves your browser.
- **With AI** it groups by topic, like *Shopping* or *Project X*.
- Pinned tabs and groups you already have are never touched.
- Changed your mind? Open Tidy and press **Undo** (works for 30 minutes).
- Change the shortcut at `helium://extensions/shortcuts`.

---

## AI (optional)

AI adds: name suggestions and "describe a skin" in **Skins**, and grouping by topic in **Tidy**.
It uses Claude by Anthropic. Each use costs a fraction of a cent, on your own account.

**Turn it on**
1. Create a key at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) → **Create Key**. It starts with `sk-ant-`.
2. Open the extension's **Settings** (gear icon, or right-click the icon → **Options**).
3. Paste the key and press **Save**. It is checked straight away.
4. Use the switches to turn each AI feature on or off. The **Use AI** switch turns them all off at once.

Each extension has its own Settings, so paste the key in Skins and in Tidy.

**Is my key safe?**
- It is stored only inside that extension, on your Mac. It is never synced.
- It is only ever sent to `api.anthropic.com`.
- Websites and other extensions cannot read it.
- For the most privacy, use the Mac helper instead: the key then lives in the macOS Keychain and never inside the browser.

**What is sent to Claude**
- Skins: only the colours of the skin, or the description you type.
- Tidy (by topic): the titles and addresses of the loose tabs in that window. Grouping by site sends nothing.

---

## Optional: the Mac helper

A small [Hammerspoon](https://www.hammerspoon.org/) script that makes two things nicer:
- **Apply to Helium** changes the window in one click, no zip.
- **AI** can use a key kept in the macOS Keychain, instead of inside the browser.

**Set it up**
1. Install Hammerspoon and open it once (give it the Accessibility permission it asks for).
2. Copy `hammerspoon/helium-mods.lua` into `~/.hammerspoon/`.
3. Open `~/.hammerspoon/init.lua` and add this line at the end:
   ```lua
   require("helium-mods")
   ```
4. If you did not put this folder at `~/Code/helium-mods`, open `helium-mods.lua` and change `THEME_DIR` at the top to where your `theme` folder is.
5. In the Hammerspoon menu, choose **Reload Config**.
6. *(For AI through the helper)* save your key in the Keychain. In Terminal, run this and paste the key when asked (it stays hidden):
   ```bash
   security add-generic-password -s anthropic-api-key -a helium-mods -w
   ```
7. In each extension's Settings, press **Connect** next to "Mac helper found", then press **Allow** in the dialog that macOS shows.
8. Under **Where the key comes from**, leave **Automatic** or pick **Only the Mac helper**.

The helper only listens on your own Mac (`127.0.0.1`). It only answers extensions you allowed in step 7: websites, other extensions and other programs are refused. It builds the theme itself and only accepts colours and real PNG images.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| The skin did not change after Apply | Open `helium://extensions` and press the reload icon on **Helium Skin**. Old windows can keep old colours: open a new window with <kbd>⌘ N</kbd>. |
| "Hammerspoon did not answer" | Open Hammerspoon and choose **Reload Config** in its menu. |
| Apply downloads a zip even with the helper | Open the extension's Settings and press **Connect**, then **Allow**. |
| "Your API key was refused" | Create a new key in the Anthropic console and paste it in Settings. |
| "No credit left" | Add credit in the Anthropic console, under **Billing**. |
| The Tidy shortcut does nothing | Another app may use it. Set a new one at `helium://extensions/shortcuts`. |

---

## For developers

```
skins/         Skins extension (editor, colour picker, theme builder)
tidy/          Tidy extension (popup, shortcut, grouping)
theme/         The theme extension that Skins writes to
shared/        Settings page, welcome guide and AI connection, shared by all
hammerspoon/   The optional Mac helper
sync-shared.sh Copies shared/ into each extension
```

Edit the shared files in `shared/`, then run `./sync-shared.sh`. Never edit the copies inside `skins/` or `tidy/`.
No build step and no dependencies: plain HTML, CSS and JavaScript (Manifest V3).
