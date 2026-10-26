// Tidy: how this extension describes itself to Settings and the welcome guide.
const EXT = {
  name: "Tidy",
  features: [
    { id: "groupByTopic", label: "Group tabs by topic", desc: "Claude reads your loose tabs' titles and sorts them into named groups. Without it, Tidy groups by site." },
  ],
  privacy: "When AI is on and you group by topic, the titles and addresses of the loose tabs in that window are sent to Claude. Grouping by site never sends anything.",
  guide: [
    { icon: "ola", title: "Welcome to Tidy", html: "<p>Tidy sorts the loose tabs in a window into groups, so you can find things again. Pinned tabs and groups you already have are never touched.</p>" },
    { icon: "pino", title: "Pin it to the toolbar", html: "<p>Click the puzzle icon at the top right of Helium, then the pin next to <b>Tidy</b>.</p>" },
    { icon: "teclado", title: "One shortcut", html: "<p>Press <kbd>⌥ Option</kbd> + <kbd>⇧ Shift</kbd> + <kbd>G</kbd> in any window. The Tidy icon shows the number of groups it made.</p><p>Change it at <kbd>helium://extensions/shortcuts</kbd>.</p>" },
    { icon: "usar", title: "Changed your mind?", html: "<p>Open Tidy and press <b>Undo</b>. It works for 30 minutes after each tidy-up.</p>" },
    { icon: "ia", title: "AI is optional", html: "<p>Without AI, Tidy groups by site: Gmail with Gmail, GitHub with GitHub. With your own Anthropic key, it can group by topic instead, like <b>Shopping</b> or <b>Project X</b>.</p>", action: "settings" },
    { icon: "pronto", title: "You're set", html: "<p>Open this guide again any time from Settings → Help.</p>" },
  ],
};
