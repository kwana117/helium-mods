// Folders: "Organize" com IA. O Claude lê os títulos, sites e pastas das páginas
// guardadas (e o teu contexto pessoal, se o ajudante do Mac tiver um) e propõe
// a pasta de cada página. Nada se move antes de carregares em Apply; Undo repõe.

const MAX_PAGINAS = 150;

const ESQUEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    moves: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, folder: { type: "string" } },
        required: ["id", "folder"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "moves"],
  additionalProperties: false,
};

// Caminho "Compras/Casa" de cada pasta e lista plana das páginas, a partir da raiz.
function inventario(raiz) {
  const pastas = new Map([["", raiz.id]]);
  const paginas = [];
  const andar = (n, caminho) => {
    for (const f of n.children || []) {
      if (f.url) paginas.push({ id: f.id, title: f.title, url: f.url, folder: caminho, parentId: f.parentId, index: f.index });
      else {
        const c = caminho ? `${caminho}/${f.title}` : f.title;
        pastas.set(c, f.id);
        andar(f, c);
      }
    }
  };
  andar(raiz, "");
  return { pastas, paginas };
}

const site = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };

const normalizar = (c) => String(c || "").split("/").map((p) => p.trim()).filter(Boolean)
  .filter((p, i) => !(i === 0 && p.toLowerCase() === ROOT_TITLE.toLowerCase())).slice(0, 3).join("/");

async function pedirPlano(raizId) {
  const [raiz] = await chrome.bookmarks.getSubTree(raizId);
  const { pastas, paginas } = inventario(raiz);
  if (!paginas.length) throw new Error("There are no saved pages to organize yet.");
  const lote = paginas.slice(0, MAX_PAGINAS);
  const contexto = await HM.context();

  const prompt = [
    "You organize a person's saved web pages (bookmarks) into folders, like Arc's sidebar.",
    contexto ? `About this person (use it to name folders after their real projects, clients and areas):\n<context>\n${contexto}\n</context>` : "",
    `Existing folders (paths, "/" separates levels):\n${[...pastas.keys()].filter(Boolean).map((p) => `- ${p}`).join("\n") || "(none)"}`,
    `Pages (id | title | site | current folder, empty = top level):\n${lote.map((p) => `${p.id} | ${p.title.slice(0, 90)} | ${site(p.url)} | ${p.folder}`).join("\n")}`,
    [
      "Return one move per page: its id and the folder path it belongs in.",
      "- Reuse existing folders when they fit; keep a page where it is if its folder already fits.",
      "- Create new folders only when several pages share a theme; at most 2 levels deep; short names in the language of the existing folders, Portuguese if there are none.",
      "- Group by the project, client or area the page is for, not by website type.",
      "- Never invent pages. summary: one short sentence in Portuguese describing the plan.",
    ].join("\n"),
  ].filter(Boolean).join("\n\n");

  const r = await HM.ask(prompt, ESQUEMA, { maxTokens: 8000 });
  const porId = new Map(lote.map((p) => [p.id, p]));
  const existentes = new Map([...pastas.keys()].map((k) => [k.toLowerCase(), k]));
  const moves = [];
  for (const m of r.moves || []) {
    const p = porId.get(String(m.id));
    if (!p) continue;
    let destino = normalizar(m.folder);
    destino = existentes.get(destino.toLowerCase()) ?? destino;
    if (destino !== p.folder) moves.push({ ...p, to: destino, nova: !pastas.has(destino) });
    porId.delete(p.id);
  }
  return { summary: r.summary || "", moves, pastas, cortadas: paginas.length - lote.length, comContexto: !!contexto };
}

// Cria as pastas que faltam e move as páginas. Devolve como desfazer.
async function aplicarPlano(raizId, plano) {
  const pastas = new Map(plano.pastas);
  const criadas = [];
  const garantir = async (caminho) => {
    if (!caminho) return raizId;
    if (pastas.has(caminho)) return pastas.get(caminho);
    const partes = caminho.split("/");
    const pai = await garantir(partes.slice(0, -1).join("/"));
    const n = await chrome.bookmarks.create({ parentId: pai, title: partes.at(-1) });
    pastas.set(caminho, n.id);
    criadas.push(n.id);
    return n.id;
  };
  // As posições guardam-se todas antes de mexer: cada move muda os índices dos outros.
  const antes = [];
  for (const m of plano.moves) {
    const [atual] = await chrome.bookmarks.get(m.id).catch(() => []);
    if (atual) antes.push({ id: m.id, parentId: atual.parentId, index: atual.index, to: m.to });
  }
  for (const a of antes) await chrome.bookmarks.move(a.id, { parentId: await garantir(a.to) });
  return { antes, criadas };
}

async function desfazerPlano({ antes, criadas }) {
  for (const a of [...antes].sort((x, y) => x.index - y.index)) {
    await chrome.bookmarks.move(a.id, { parentId: a.parentId, index: a.index }).catch(() => {});
  }
  for (const id of criadas.reverse()) {
    const filhos = await chrome.bookmarks.getChildren(id).catch(() => null);
    if (filhos && !filhos.length) await chrome.bookmarks.remove(id).catch(() => {});
  }
}
