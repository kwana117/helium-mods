// Atalho de teclado da Tidy: arruma a janela da frente sem abrir a janelinha.
// O ícone mostra "…" enquanto trabalha e depois o número de grupos (ou "!").

importScripts("ext.js", "ai.js", "tidy.js");

async function marcar(texto, cor) {
  await chrome.action.setBadgeBackgroundColor({ color: cor });
  await chrome.action.setBadgeText({ text: texto });
}

chrome.commands.onCommand.addListener(async (comando) => {
  if (comando !== "agrupar") return;
  const janela = await chrome.windows.getLastFocused();
  await marcar("…", "#8f88c9");
  try {
    const modo = (await HM.aiReady("groupByTopic")) ? "topic" : "site";
    const { grupos } = await arrumar(janela.id, modo);
    await marcar(String(grupos.length), "#5a9e6f");
  } catch (e) {
    await marcar("!", "#e0707a");
    await chrome.action.setTitle({ title: `Tidy: ${e.message || e}` });
  }
  setTimeout(async () => {
    await chrome.action.setBadgeText({ text: "" });
    await chrome.action.setTitle({ title: "Tidy" });
  }, 6000);
});

// Primeira instalação: abre o guia de boas-vindas.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
});
