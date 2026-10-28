// Folders: o ícone abre o painel lateral. ⌥⇧S abre o painel com a escolha rápida
// da pasta; o clique direito na página tem "Save to Folders" com as pastas.
// Depois de guardar, o painel pergunta se o separador fecha.

importScripts("store.js");

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

async function marcar(texto, cor, titulo) {
  await chrome.action.setBadgeBackgroundColor({ color: cor });
  await chrome.action.setBadgeText({ text: texto });
  if (titulo) await chrome.action.setTitle({ title: titulo });
  setTimeout(async () => {
    await chrome.action.setBadgeText({ text: "" });
    await chrome.action.setTitle({ title: "Folders" });
  }, 3000);
}

// O painel lê o pedido quando abre (ou logo, se já estiver aberto).
const pedir = (pedido) => chrome.storage.session.set({ pedido: { ...pedido, quando: Date.now() } });

// ---------- abrir e fechar o painel (⌥⇧F) ----------
// Cada painel aberto liga-se aqui e diz de que janela é; assim o atalho sabe
// se tem de abrir ou fechar. Fechar = pedir ao painel dessa janela que se feche.

const paineis = new Set();
chrome.runtime.onConnect.addListener((porta) => {
  if (porta.name !== "painel") return;
  let janela = null;
  porta.onMessage.addListener((m) => { if (m.windowId) { janela = m.windowId; paineis.add(janela); } });
  porta.onDisconnect.addListener(() => { if (janela) paineis.delete(janela); });
});

chrome.commands.onCommand.addListener(async (comando, tab) => {
  if (comando === "alternar") {
    const janela = tab?.windowId ?? (await chrome.windows.getLastFocused()).id;
    if (paineis.has(janela)) return chrome.runtime.sendMessage({ tipo: "fechar", windowId: janela }).catch(() => {});
    return chrome.sidePanel.open({ windowId: janela }).catch(() => {});
  }
  if (comando !== "guardar") return;
  // Abrir o painel tem de ser já, antes de qualquer espera, senão o Helium recusa.
  if (tab) chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  if (!tab) [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || !/^https?:|^file:/.test(tab.url || "")) return marcar("!", "#e0707a", "Folders: this page can't be saved");
  await pedir({ tipo: "escolher", tabId: tab.id });
});

// ---------- clique direito ----------

const MAX_MENU = 40;
let aConstruir = Promise.resolve();

function construirMenu() {
  aConstruir = aConstruir.then(async () => {
    await chrome.contextMenus.removeAll();
    // Em qualquer sítio da página: texto, imagem, vídeo, link. Num link guarda o link.
    const ctx = ["page", "frame", "selection", "link", "editable", "image", "video", "audio"];
    chrome.contextMenus.create({ id: "raiz", title: "Save to Folders", contexts: ctx });
    const pastas = (await FS.pastas()).slice(0, MAX_MENU);
    for (const p of pastas) {
      const nome = p.nivel === 0 ? "Folders (top level)" : `${"   ".repeat(p.nivel - 1)}${p.nome}`;
      chrome.contextMenus.create({ id: `p:${p.id}`, parentId: "raiz", title: nome, contexts: ctx });
    }
    chrome.contextMenus.create({ id: "sep", parentId: "raiz", type: "separator", contexts: ctx });
    chrome.contextMenus.create({ id: "escolher", parentId: "raiz", title: "Choose folder…  ⌥⇧S", contexts: ctx });
  }).catch(() => {});
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (tab) chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  if (info.menuItemId === "escolher") return pedir({ tipo: "escolher", tabId: tab.id });
  const parentId = String(info.menuItemId).replace(/^p:/, "");
  try {
    if (info.linkUrl) {
      // Clique direito num link: guarda o link, o separador fica como está.
      let titulo = info.selectionText;
      if (!titulo) try { titulo = new URL(info.linkUrl).hostname.replace(/^www\./, ""); } catch { titulo = info.linkUrl; }
      const { novo } = await FS.guardarTab({ url: info.linkUrl, title: titulo }, parentId);
      return marcar(novo ? "✓" : "=", novo ? "#5a9e6f" : "#8f88c9");
    }
    const { novo } = await FS.guardarTab(tab, parentId);
    await pedir({ tipo: "fechar", tabId: tab.id, parentId, novo });
  } catch (e) {
    await marcar("!", "#e0707a", `Folders: ${e.message || e}`);
  }
});

for (const ev of ["onCreated", "onRemoved", "onChanged", "onMoved", "onChildrenReordered"]) {
  chrome.bookmarks[ev].addListener((id, info) => {
    if (ev === "onCreated" && info?.url) return;
    if (ev === "onChanged" && info?.url) return;
    construirMenu();
  });
}

// Reconstruído sempre que o fundo arranca, para o menu nunca faltar.
construirMenu();
chrome.runtime.onInstalled.addListener(({ reason }) => {
  construirMenu();
  if (reason === "install") chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
});
