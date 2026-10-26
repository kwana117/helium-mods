// Skins: how this extension describes itself to Settings and the welcome guide.
const EXT = {
  name: "Skins",
  features: [
    { id: "nameSuggest", label: "Suggest names", desc: "The star next to the name proposes a short name for the skin." },
    { id: "createFromText", label: "Create skins from a description", desc: "Type something like \"sunset over the river\" and get a skin." },
  ],
  privacy: "When AI is on, only the skin's colours or the description you type are sent to Claude. Nothing about your tabs or browsing.",
  guide: [
    { icon: "ola", title: "Welcome to Skins", html: "<p>Skins gives Helium a soft gradient look, like Arc. Make your own, save as many as you like and switch in one click.</p>" },
    { icon: "pino", title: "Pin it to the toolbar", html: "<p>Click the puzzle icon at the top right of Helium, then the pin next to <b>Skins</b>. Clicking the icon opens the editor.</p>" },
    { icon: "usar", title: "Make a skin", html: "<ul><li>Pick a skin on the left, or press <b>+</b> for a new one.</li><li>Click the three circles to choose the colours.</li><li>Set the direction and the grain.</li><li>Press <b>Save</b>, then <b>Apply to Helium</b>.</li></ul>" },
    { icon: "teclado", title: "Applying the skin", html: "<p>With the optional Mac helper, <b>Apply</b> changes the window straight away.</p><p>Without it, <b>Apply</b> downloads the theme. Unzip it, open <kbd>helium://extensions</kbd>, turn on <b>Developer mode</b> and choose <b>Load unpacked</b> with that folder.</p>" },
    { icon: "ia", title: "AI is optional", html: "<p>Everything works without AI. If you want name suggestions and skins made from a description, add your own Anthropic key in Settings.</p>", action: "settings" },
    { icon: "pronto", title: "You're set", html: "<p>Open this guide again any time from Settings → Help.</p>" },
  ],
};
