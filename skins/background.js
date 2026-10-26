// Clicar no ícone abre o editor num separador (ou foca o que já está aberto).
chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("editor.html");
  const [aberto] = await chrome.tabs.query({ url });
  if (aberto) {
    await chrome.tabs.update(aberto.id, { active: true });
    await chrome.windows.update(aberto.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
});

// Primeira instalação: abre o guia de boas-vindas.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
});
