// Folders: how this extension describes itself to Settings and the welcome guide.
const EXT = {
  name: "Folders",
  features: [
    { id: "organize", label: "Organize with AI", desc: "Claude reads the titles and sites of your saved pages and suggests which folder each one belongs in. You see the plan before anything moves." },
  ],
  privacy: "When you press Organize, the titles, sites and folder names of your saved pages are sent to Claude. If your Mac helper has a personal context set up, that goes too. Nothing is sent otherwise.",
  guide: [
    { icon: "ola", title: "Welcome to Folders", html: "<p>Folders keeps pages in folders on the side, like Arc, so you don't have to pin them. Everything is stored in Helium's own bookmarks.</p>" },
    { icon: "pino", title: "Open the panel", html: "<p>Click the Folders icon, or press <kbd>⌥ Option</kbd> + <kbd>⇧ Shift</kbd> + <kbd>F</kbd>.</p>" },
    { icon: "teclado", title: "Save a page", html: "<p>Press <kbd>⌥ Option</kbd> + <kbd>⇧ Shift</kbd> + <kbd>S</kbd>. Type a few letters of the folder and press Enter; Folders then asks if you want to close the tab. You can also right-click a page → <b>Save to Folders</b>.</p><p>Change the shortcuts at <kbd>helium://extensions/shortcuts</kbd>.</p>" },
    { icon: "usar", title: "Drag and right-click", html: "<p>Drag pages and folders to move them. Right-click anything in the panel for New folder, Rename and Delete.</p>" },
    { icon: "ia", title: "AI is optional", html: "<p>With your own Anthropic key, <b>Organize</b> suggests a folder for each saved page. You see the plan first, and you can undo it.</p>", action: "settings" },
    { icon: "pronto", title: "You're set", html: "<p>Open this guide again any time from Settings → Help.</p>" },
  ],
};
