// Folders: tudo vive nos favoritos do Helium, dentro da pasta "Folders" em
// Other bookmarks. Se a extensão falhar ou for removida, os favoritos ficam.

const ROOT_TITLE = "Folders";

const FS = {
  // Pasta raiz: a que guardámos, ou a que já existe com o nome certo, ou uma nova.
  async root() {
    const { rootId } = await chrome.storage.local.get("rootId");
    if (rootId) {
      try { const [n] = await chrome.bookmarks.get(rootId); if (n && !n.url) return n.id; } catch {}
    }
    const [arvore] = await chrome.bookmarks.getTree();
    const outros = arvore.children.find((n) => n.folderType === "other") || arvore.children[1] || arvore.children[0];
    let raiz = (outros.children || []).find((n) => !n.url && n.title === ROOT_TITLE);
    if (!raiz) raiz = await chrome.bookmarks.create({ parentId: outros.id, title: ROOT_TITLE });
    await chrome.storage.local.set({ rootId: raiz.id });
    return raiz.id;
  },

  // Pasta onde o atalho e o botão "Save" guardam. Volta à raiz se foi apagada.
  async destino() {
    const { destinoId } = await chrome.storage.local.get("destinoId");
    if (destinoId) {
      try { const [n] = await chrome.bookmarks.get(destinoId); if (n && !n.url) return n.id; } catch {}
    }
    return FS.root();
  },

  async escolherDestino(id) {
    await chrome.storage.local.set({ destinoId: id });
  },

  // Todas as pastas, com o caminho ("comprar / casa"), pela ordem da árvore.
  async pastas() {
    const raizId = await FS.root();
    const [raiz] = await chrome.bookmarks.getSubTree(raizId);
    const lista = [{ id: raiz.id, caminho: ROOT_TITLE, nivel: 0 }];
    const andar = (n, caminho, nivel) => {
      for (const f of n.children || []) {
        if (f.url) continue;
        const c = caminho ? `${caminho} / ${f.title}` : f.title;
        lista.push({ id: f.id, caminho: c, nome: f.title, nivel });
        andar(f, c, nivel + 1);
      }
    };
    andar(raiz, "", 1);
    return lista;
  },

  // Guarda a página do separador. Se já estiver nessa pasta, não duplica.
  async guardarTab(tab, parentId) {
    if (!tab || !/^https?:|^file:/.test(tab.url || "")) throw new Error("This page can't be saved");
    parentId = parentId || (await FS.destino());
    const filhos = await chrome.bookmarks.getChildren(parentId);
    const igual = filhos.find((n) => n.url === tab.url);
    if (igual) return { node: igual, novo: false };
    const node = await chrome.bookmarks.create({ parentId, title: tab.title || tab.url, url: tab.url });
    return { node, novo: true };
  },
};
