// Folders: o painel lateral. Desenha a pasta "Folders" dos favoritos como uma
// árvore ao estilo do Arc; clicar numa pasta abre/fecha e escolhe-a como destino,
// clicar numa página vai para o separador se já estiver aberto, senão abre um novo.

const lista = document.getElementById("lista");
const estado = document.getElementById("estado");
const tPasta = document.getElementById("t-pasta");
const tLink = document.getElementById("t-link");

let raizId = null;
let destinoId = null;
let abertas = new Set();
let urlAtual = "";

const favicon = (url) => {
  const u = new URL(chrome.runtime.getURL("/_favicon/"));
  u.searchParams.set("pageUrl", url);
  u.searchParams.set("size", "32");
  return u.toString();
};

function avisar(html, ms = 4000) {
  estado.innerHTML = html;
  clearTimeout(avisar.t);
  if (ms) avisar.t = setTimeout(() => (estado.innerHTML = ""), ms);
}

async function guardarAbertas() {
  await chrome.storage.local.set({ abertas: [...abertas] });
}

// ---------- desenhar ----------

function desenharLink(n) {
  const el = tLink.content.firstElementChild.cloneNode(true);
  el.dataset.id = n.id;
  el.dataset.parent = n.parentId;
  el.dataset.index = n.index;
  el.dataset.url = n.url;
  el.title = n.url;
  el.querySelector("img").src = favicon(n.url);
  el.querySelector(".nome").textContent = n.title || n.url;
  if (n.url === urlAtual) el.classList.add("aberto-agora");
  return el;
}

function desenharPasta(n) {
  const el = tPasta.content.firstElementChild.cloneNode(true);
  const item = el.querySelector(".item");
  item.dataset.id = n.id;
  item.dataset.parent = n.parentId;
  item.dataset.index = n.index;
  item.dataset.pasta = "1";
  item.querySelector(".nome").textContent = n.title || "Untitled";
  if (n.id === destinoId) item.classList.add("destino");
  if (abertas.has(n.id)) el.classList.add("aberta");
  el.setAttribute("aria-expanded", abertas.has(n.id));
  const filhos = el.querySelector(".filhos");
  for (const f of n.children || []) filhos.append(f.url ? desenharLink(f) : desenharPasta(f));
  return el;
}

async function desenhar() {
  const [raiz] = await chrome.bookmarks.getSubTree(raizId);
  const frag = document.createDocumentFragment();
  for (const n of raiz.children || []) frag.append(n.url ? desenharLink(n) : desenharPasta(n));
  lista.replaceChildren(frag);
  if (!raiz.children?.length) {
    lista.innerHTML = `<p class="vazio">No folders yet. Press <b>New folder</b>, then <b>Save</b> to put the page you're on inside it.<br><br>
      To save the page you're on: press <kbd>⌥ ⇧ S</kbd>, or right-click the page and choose <b>Save to Folders</b>.</p>`;
  }
  const [d] = await chrome.bookmarks.get(destinoId);
  document.getElementById("destino-nome").textContent = d.id === raizId ? "Folders" : d.title;
}

let pendente;
function redesenhar() {
  clearTimeout(pendente);
  pendente = setTimeout(desenhar, 60);
}

// ---------- ações ----------

async function abrir(url, novo) {
  if (!novo) {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const t = tabs.find((t) => t.url === url);
    if (t) return chrome.tabs.update(t.id, { active: true });
  }
  chrome.tabs.create({ url, active: !novo });
}

async function escolher(id) {
  destinoId = id;
  await FS.escolherDestino(id);
}

async function guardarAqui(parentId, tab) {
  if (!tab) [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const { novo } = await FS.guardarTab(tab, parentId);
    if (parentId !== raizId) abertas.add(parentId);
    await guardarAbertas();
    redesenhar();
    perguntarFechar(tab.id, parentId, novo);
  } catch (e) {
    avisar(e.message || String(e));
  }
}

// Depois de guardar, pergunta se o separador sai (fecha) ou fica aberto.
const pergunta = document.getElementById("pergunta");
let perguntaTab = null;

async function perguntarFechar(tabId, parentId, novo) {
  const [p] = await chrome.bookmarks.get(parentId);
  const nome = p.id === raizId ? "Folders" : p.title;
  perguntaTab = tabId;
  document.getElementById("pergunta-txt").textContent = `${novo ? "Saved to" : "Already in"} “${nome}”. Close the tab?`;
  pergunta.hidden = false;
  document.getElementById("fechar-tab").focus();
}

function esconderPergunta() {
  pergunta.hidden = true;
  perguntaTab = null;
}

document.getElementById("fechar-tab").onclick = async () => {
  if (perguntaTab) await chrome.tabs.remove(perguntaTab).catch(() => {});
  esconderPergunta();
};
document.getElementById("manter-tab").onclick = esconderPergunta;
chrome.tabs.onRemoved.addListener((id) => { if (id === perguntaTab) esconderPergunta(); });

// O atalho ⌥⇧S guarda no fundo e deixa aqui o pedido para perguntar.
async function verPedido() {
  const { pedido } = await chrome.storage.session.get("pedido");
  if (!pedido || Date.now() - pedido.quando > 20000) return;
  await chrome.storage.session.remove("pedido");
  if (pedido.tipo === "escolher") return escolherPasta(pedido.tabId);
  perguntarFechar(pedido.tabId, pedido.parentId, pedido.novo);
}

// ---------- escolha rápida da pasta (⌥⇧S) ----------
// Escreve para filtrar, setas para mudar, Enter guarda, Esc cancela.
// Se o que escreveste não existe, a última linha cria essa pasta.

const caixaEscolha = document.getElementById("escolha");
const campoEscolha = document.getElementById("escolha-campo");
const listaEscolha = document.getElementById("escolha-lista");
let escolha = null;

const semAcentos = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function escolherPasta(tabId) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) return;
  escolha = { tab, pastas: await FS.pastas(), marcada: 0 };
  document.getElementById("escolha-pagina").textContent = tab.title || tab.url;
  campoEscolha.value = "";
  caixaEscolha.hidden = false;
  desenharEscolha();
  campoEscolha.focus();
}

function opcoesEscolha() {
  const q = semAcentos(campoEscolha.value.trim());
  const ops = escolha.pastas
    .filter((p) => !q || semAcentos(p.caminho).includes(q))
    .map((p) => ({ ...p, rotulo: p.nivel === 0 ? "Folders (top level)" : p.caminho }));
  const nome = campoEscolha.value.trim();
  if (nome && !escolha.pastas.some((p) => semAcentos(p.nome || "") === q)) ops.push({ nova: nome, rotulo: `New folder “${nome}”` });
  return ops;
}

function desenharEscolha() {
  const ops = opcoesEscolha();
  if (!campoEscolha.value.trim()) escolha.marcada = Math.max(0, ops.findIndex((o) => o.id === destinoId));
  escolha.marcada = Math.min(escolha.marcada, ops.length - 1);
  listaEscolha.replaceChildren(...ops.map((o, i) => {
    const b = document.createElement("button");
    b.className = "opcao" + (i === escolha.marcada ? " marcada" : "");
    b.innerHTML = `<svg viewBox="0 0 24 24">${o.nova ? ICONES.pasta : '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'}</svg>`;
    b.append(o.rotulo);
    b.onclick = () => confirmarEscolha(o);
    return b;
  }));
  listaEscolha.querySelector(".marcada")?.scrollIntoView({ block: "nearest" });
}

async function confirmarEscolha(o) {
  if (!escolha || !o) return;
  const { tab } = escolha;
  fecharEscolha();
  let parentId = o.id;
  if (o.nova) parentId = (await chrome.bookmarks.create({ parentId: raizId, title: o.nova })).id;
  await escolher(parentId);
  await guardarAqui(parentId, tab);
}

function fecharEscolha() {
  caixaEscolha.hidden = true;
  escolha = null;
}

campoEscolha.addEventListener("input", () => { escolha.marcada = 0; desenharEscolha(); });
campoEscolha.addEventListener("keydown", (e) => {
  const ops = opcoesEscolha();
  if (e.key === "ArrowDown") { e.preventDefault(); escolha.marcada = (escolha.marcada + 1) % ops.length; desenharEscolha(); }
  if (e.key === "ArrowUp") { e.preventDefault(); escolha.marcada = (escolha.marcada - 1 + ops.length) % ops.length; desenharEscolha(); }
  if (e.key === "Enter") { e.preventDefault(); confirmarEscolha(ops[escolha.marcada]); }
  if (e.key === "Escape") { e.preventDefault(); fecharEscolha(); }
});
document.getElementById("escolha-cancelar").onclick = fecharEscolha;

async function novaPasta(parentId) {
  const n = await chrome.bookmarks.create({ parentId, title: "New folder" });
  if (parentId !== raizId) abertas.add(parentId);
  abertas.add(n.id);
  await guardarAbertas();
  await escolher(n.id);
  await desenhar();
  renomear(lista.querySelector(`.item[data-id="${n.id}"]`));
}

function renomear(item) {
  const nome = item.querySelector(".nome");
  const antes = nome.textContent;
  const input = document.createElement("input");
  input.value = antes;
  nome.replaceWith(input);
  item.draggable = false;
  input.focus();
  input.select();
  let feito = false;
  const fim = async (gravar) => {
    if (feito) return;
    feito = true;
    const titulo = input.value.trim();
    if (gravar && titulo && titulo !== antes) await chrome.bookmarks.update(item.dataset.id, { title: titulo });
    redesenhar();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") fim(true);
    if (e.key === "Escape") fim(false);
  });
  input.addEventListener("blur", () => fim(true));
  input.addEventListener("click", (e) => e.stopPropagation());
}

async function apagar(item) {
  const id = item.dataset.id;
  const [n] = await chrome.bookmarks.getSubTree(id);
  if (n.url) {
    await chrome.bookmarks.remove(id);
    avisar(`Removed “${esc(n.title)}”. <a href="#" id="desfazer">Undo</a>`, 8000);
    document.getElementById("desfazer").onclick = async (e) => {
      e.preventDefault();
      await chrome.bookmarks.create({ parentId: n.parentId, index: n.index, title: n.title, url: n.url });
      avisar("Restored.");
    };
    return;
  }
  const total = contar(n);
  if (total && !confirm(`Delete “${n.title}” and the ${total} page${total === 1 ? "" : "s"} inside it?`)) return;
  await chrome.bookmarks.removeTree(id);
  if (id === destinoId) await escolher(raizId);
}

const contar = (n) => (n.children || []).reduce((s, f) => s + (f.url ? 1 : contar(f)), 0);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---------- cliques ----------

lista.addEventListener("click", async (e) => {
  const item = e.target.closest(".item");
  if (!item || item.querySelector("input")) return;
  const botao = e.target.closest(".acoes button");
  if (botao) {
    e.stopPropagation();
    if (botao.classList.contains("aqui")) return guardarAqui(item.dataset.id);
    if (botao.classList.contains("sub")) return novaPasta(item.dataset.id);
    if (botao.classList.contains("renomear")) return renomear(item);
    if (botao.classList.contains("apagar")) return apagar(item);
  }
  if (item.dataset.pasta) {
    const id = item.dataset.id;
    const pasta = item.parentElement;
    pasta.classList.toggle("aberta");
    pasta.classList.contains("aberta") ? abertas.add(id) : abertas.delete(id);
    pasta.setAttribute("aria-expanded", pasta.classList.contains("aberta"));
    await guardarAbertas();
    await escolher(id);
    lista.querySelectorAll(".item.destino").forEach((i) => i.classList.remove("destino"));
    item.classList.add("destino");
    document.getElementById("destino-nome").textContent = item.querySelector(".nome").textContent;
  } else {
    abrir(item.dataset.url, e.metaKey || e.ctrlKey || e.button === 1);
  }
});

lista.addEventListener("auxclick", (e) => {
  const item = e.target.closest(".item.link");
  if (item && e.button === 1) abrir(item.dataset.url, true);
});

lista.addEventListener("dblclick", (e) => {
  const item = e.target.closest(".item");
  if (item && !e.target.closest(".acoes")) renomear(item);
});

// Clicar no vazio volta a pôr a raiz como destino.
lista.addEventListener("click", async (e) => {
  if (e.target !== lista) return;
  await escolher(raizId);
  redesenhar();
});

document.getElementById("guardar").onclick = () => guardarAqui(destinoId);

// ---------- organizar com IA ----------

const botaoOrganizar = document.getElementById("organizar");
const caixaPlano = document.getElementById("plano");
let planoAtual = null;

botaoOrganizar.onclick = async () => {
  if (botaoOrganizar.classList.contains("a-pensar")) return;
  if (!(await HM.aiReady("organize"))) {
    avisar('AI is off. <a href="#" id="abrir-definicoes">Turn it on in Settings</a>.', 10000);
    document.getElementById("abrir-definicoes").onclick = (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); };
    return;
  }
  botaoOrganizar.classList.add("a-pensar");
  avisar("Claude is reading your folders…", 0);
  try {
    planoAtual = await pedirPlano(raizId);
    estado.innerHTML = "";
    if (!planoAtual.moves.length) return avisar("Everything is already in the right place.");
    mostrarPlano(planoAtual);
  } catch (e) {
    avisar(esc(e.message || String(e)), 8000);
  } finally {
    botaoOrganizar.classList.remove("a-pensar");
  }
};

function mostrarPlano(plano) {
  const extra = [
    `${plano.moves.length} page${plano.moves.length === 1 ? "" : "s"} to move.`,
    plano.comContexto ? "Used your notes." : "",
    plano.cortadas ? `${plano.cortadas} more left for next time.` : "",
  ].filter(Boolean).join(" ");
  document.getElementById("plano-resumo").textContent = `${plano.summary} ${extra}`.trim();
  const grupos = new Map();
  for (const m of plano.moves) {
    if (!grupos.has(m.to)) grupos.set(m.to, []);
    grupos.get(m.to).push(m);
  }
  const lista = document.getElementById("plano-lista");
  lista.replaceChildren(...[...grupos].sort(([a], [b]) => a.localeCompare(b)).map(([pasta, ms]) => {
    const g = document.createElement("div");
    g.className = "grupo";
    const h = document.createElement("h3");
    h.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
    h.append(pasta || "Folders (top level)");
    if (ms[0].nova) h.insertAdjacentHTML("beforeend", '<span class="nova">NEW</span>');
    g.append(h);
    for (const m of ms) {
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = '<img alt=""><span class="nome"></span><span class="de"></span>';
      el.querySelector("img").src = favicon(m.url);
      el.querySelector(".nome").textContent = m.title || m.url;
      el.querySelector(".de").textContent = m.folder ? `from ${m.folder}` : "";
      g.append(el);
    }
    return g;
  }));
  caixaPlano.hidden = false;
  document.getElementById("plano-aplicar").focus();
}

document.getElementById("plano-cancelar").onclick = () => { caixaPlano.hidden = true; planoAtual = null; };

document.getElementById("plano-aplicar").onclick = async () => {
  if (!planoAtual) return;
  const plano = planoAtual;
  planoAtual = null;
  caixaPlano.hidden = true;
  const desfazer = await aplicarPlano(raizId, plano);
  for (const m of plano.moves) {
    const partes = m.to.split("/");
    for (let i = 1; i <= partes.length; i++) {
      const id = plano.pastas.get(partes.slice(0, i).join("/"));
      if (id) abertas.add(id);
    }
  }
  await guardarAbertas();
  await desenhar();
  // As pastas novas só têm id depois de criadas: abre-as também.
  lista.querySelectorAll(".pasta").forEach((p) => {
    const id = p.querySelector(".item").dataset.id;
    if (desfazer.criadas.includes(id)) { abertas.add(id); p.classList.add("aberta"); }
  });
  await guardarAbertas();
  avisar(`Moved ${desfazer.antes.length} page${desfazer.antes.length === 1 ? "" : "s"}. <a href="#" id="desfazer-plano">Undo</a>`, 60000);
  document.getElementById("desfazer-plano").onclick = async (e) => {
    e.preventDefault();
    await desfazerPlano(desfazer);
    avisar("Put everything back.");
  };
};
document.getElementById("nova-pasta").onclick = () => novaPasta(destinoId);

// ---------- arrastar ----------

const TIPO = "application/x-folders-id";
let aArrastar = null;

lista.addEventListener("dragstart", (e) => {
  const item = e.target.closest(".item");
  if (!item) return;
  aArrastar = item;
  item.classList.add("a-arrastar");
  e.dataTransfer.setData(TIPO, item.dataset.id);
  if (item.dataset.url) e.dataTransfer.setData("text/uri-list", item.dataset.url);
  e.dataTransfer.effectAllowed = "copyMove";
});

lista.addEventListener("dragend", () => {
  aArrastar?.classList.remove("a-arrastar");
  aArrastar = null;
  limparAlvos();
});

function limparAlvos() {
  lista.classList.remove("alvo-raiz");
  lista.querySelectorAll(".alvo-dentro, .alvo-antes").forEach((i) => i.classList.remove("alvo-dentro", "alvo-antes"));
}

// Onde cai: dentro de uma pasta (meio da linha), antes de um item (metade de
// cima), depois de uma página (metade de baixo), ou no fim da raiz (vazio).
function alvo(e) {
  const item = e.target.closest(".item");
  if (!item) return { parentId: raizId, el: null, modo: "raiz" };
  const r = item.getBoundingClientRect();
  const y = (e.clientY - r.top) / r.height;
  const index = Number(item.dataset.index);
  if (item.dataset.pasta && y > 0.25) return { parentId: item.dataset.id, el: item, modo: "dentro" };
  if (!item.dataset.pasta && y > 0.5) {
    const seguinte = item.nextElementSibling;
    const el = seguinte?.matches(".item") ? seguinte : seguinte?.querySelector(":scope > .item");
    if (el) return { parentId: item.dataset.parent, index: index + 1, el, modo: "antes" };
    return { parentId: item.dataset.parent, index: index + 1, el: item, modo: "nenhum" };
  }
  return { parentId: item.dataset.parent, index, el: item, modo: "antes" };
}

lista.addEventListener("dragover", (e) => {
  const tipos = e.dataTransfer.types;
  if (![TIPO, "text/uri-list", "text/plain"].some((t) => tipos.includes(t))) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = tipos.includes(TIPO) ? "move" : "copy";
  limparAlvos();
  const a = alvo(e);
  if (a.modo === "raiz") lista.classList.add("alvo-raiz");
  else if (a.modo === "dentro") a.el.classList.add("alvo-dentro");
  else if (a.modo === "antes") a.el.classList.add("alvo-antes");
});

lista.addEventListener("dragleave", (e) => {
  if (!lista.contains(e.relatedTarget)) limparAlvos();
});

lista.addEventListener("drop", async (e) => {
  e.preventDefault();
  limparAlvos();
  const a = alvo(e);
  const destino = a.index === undefined ? { parentId: a.parentId } : { parentId: a.parentId, index: a.index };
  const id = e.dataTransfer.getData(TIPO);

  if (id) {
    // Uma pasta não pode ir para dentro de si própria.
    const origem = lista.querySelector(`.item[data-id="${id}"]`);
    const caixa = origem?.dataset.pasta ? origem.parentElement : null;
    if (id === a.parentId || caixa?.contains(lista.querySelector(`.item[data-id="${a.parentId}"]`))) return;
    await chrome.bookmarks.move(id, destino);
  } else {
    const url = (e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain") || "").split("\n").find((l) => /^https?:/.test(l.trim()))?.trim();
    if (!url) return avisar("Only web pages can be dropped here.");
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((t) => t.url === url);
    let titulo = tab?.title;
    if (!titulo) try { titulo = new URL(url).hostname.replace(/^www\./, ""); } catch { titulo = url; }
    await chrome.bookmarks.create({ ...destino, title: titulo, url });
    avisar("Saved.");
  }
  if (a.modo === "dentro") { abertas.add(a.parentId); await guardarAbertas(); }
});

// ---------- página atual ----------

async function marcarAtual() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  urlAtual = tab?.url || "";
  lista.querySelectorAll(".item.link").forEach((i) => i.classList.toggle("aberto-agora", i.dataset.url === urlAtual));
}

chrome.tabs.onActivated.addListener(marcarAtual);
chrome.tabs.onUpdated.addListener((_, info) => { if (info.url) marcarAtual(); });

// ---------- clique direito ----------

const menu = document.getElementById("menu");
const ICONES = {
  mais: '<path d="M12 5v14M5 12h14"/>',
  pasta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v5M9.5 13.5h5"/>',
  lapis: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  lixo: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
  abrir: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
};

function abrirMenu(e, opcoes) {
  menu.replaceChildren(...opcoes.map((o) => {
    if (o === "-") return document.createElement("hr");
    const b = document.createElement("button");
    b.setAttribute("role", "menuitem");
    if (o.perigo) b.className = "perigo";
    b.innerHTML = `<svg viewBox="0 0 24 24">${ICONES[o.icone]}</svg>`;
    b.append(o.rotulo);
    b.onclick = () => { fecharMenu(); o.fazer(); };
    return b;
  }));
  menu.hidden = false;
  const { innerWidth: w, innerHeight: h } = window;
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(e.clientX, w - r.width - 6)}px`;
  menu.style.top = `${Math.min(e.clientY, h - r.height - 6)}px`;
  menu.querySelector("button")?.focus();
}

function fecharMenu() { menu.hidden = true; }

document.addEventListener("contextmenu", async (e) => {
  if (!e.target.closest("#rolo")) return;
  e.preventDefault();
  const item = e.target.closest(".item");
  if (!item) {
    return abrirMenu(e, [
      { icone: "pasta", rotulo: "New folder", fazer: () => novaPasta(raizId) },
      { icone: "mais", rotulo: "Save this page here", fazer: () => guardarAqui(raizId) },
    ]);
  }
  if (item.dataset.pasta) {
    return abrirMenu(e, [
      { icone: "mais", rotulo: "Save this page here", fazer: () => guardarAqui(item.dataset.id) },
      { icone: "pasta", rotulo: "New folder inside", fazer: () => novaPasta(item.dataset.id) },
      "-",
      { icone: "lapis", rotulo: "Rename", fazer: () => renomear(item) },
      { icone: "lixo", rotulo: "Delete folder", perigo: true, fazer: () => apagar(item) },
    ]);
  }
  abrirMenu(e, [
    { icone: "abrir", rotulo: "Open", fazer: () => abrir(item.dataset.url) },
    { icone: "mais", rotulo: "Open in new tab", fazer: () => abrir(item.dataset.url, true) },
    { icone: "link", rotulo: "Copy link", fazer: async () => { await navigator.clipboard.writeText(item.dataset.url); avisar("Link copied."); } },
    "-",
    { icone: "lapis", rotulo: "Rename", fazer: () => renomear(item) },
    { icone: "lixo", rotulo: "Remove", perigo: true, fazer: () => apagar(item) },
  ]);
});

document.addEventListener("mousedown", (e) => { if (!menu.hidden && !menu.contains(e.target)) fecharMenu(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    fecharMenu();
    if (!pergunta.hidden) esconderPergunta();
    if (!caixaPlano.hidden) { caixaPlano.hidden = true; planoAtual = null; }
  }
});
window.addEventListener("blur", fecharMenu);
document.getElementById("rolo").addEventListener("scroll", fecharMenu);

// ---------- arranque ----------

for (const ev of ["onCreated", "onRemoved", "onChanged", "onMoved", "onChildrenReordered", "onImportEnded"]) {
  chrome.bookmarks[ev].addListener(redesenhar);
}
chrome.storage.onChanged.addListener((m, area) => {
  if (area === "session" && m.pedido?.newValue) return verPedido();
  if (m.destinoId) { destinoId = m.destinoId.newValue || raizId; redesenhar(); }
});

// ---------- ligação ao fundo (para o ⌥⇧F saber fechar) ----------

let janelaId = null;
let porta = null;
function ligar() {
  porta = chrome.runtime.connect({ name: "painel" });
  if (janelaId) porta.postMessage({ windowId: janelaId });
  porta.onDisconnect.addListener(() => setTimeout(ligar, 200));
}
chrome.windows.getCurrent().then((w) => { janelaId = w.id; ligar(); });
// Um sinal de vida a cada 20 s mantém o fundo acordado enquanto o painel está aberto.
setInterval(() => { try { porta?.postMessage({ windowId: janelaId }); } catch {} }, 20000);
chrome.runtime.onMessage.addListener((m) => {
  if (m.tipo === "fechar" && m.windowId === janelaId) window.close();
});

// ---------- atalhos (para não te esqueceres) ----------
// Mostra os atalhos tal como estão agora no Helium, mesmo que os tenhas mudado.

const caixaAtalhos = document.getElementById("atalhos");
const botaoAtalhos = document.getElementById("ver-atalhos");
const NOMES = { alternar: "Open or close this panel", guardar: "Save this page to a folder" };
const bonito = (k) => k.replace(/⌥|Alt/g, "⌥").replace(/⇧|Shift/g, "⇧").replace(/⌘|Command/g, "⌘").replace(/MacCtrl|Ctrl|⌃/g, "⌃").replace(/\+/g, " ");

async function mostrarAtalhos(mostrar = caixaAtalhos.hidden) {
  caixaAtalhos.hidden = !mostrar;
  botaoAtalhos.classList.toggle("ligado", mostrar);
  if (!mostrar) return;
  const comandos = await chrome.commands.getAll();
  document.getElementById("atalhos-lista").replaceChildren(...comandos.filter((c) => NOMES[c.name]).map((c) => {
    const li = document.createElement("li");
    const t = document.createElement("span");
    t.textContent = NOMES[c.name];
    const k = document.createElement("kbd");
    k.textContent = c.shortcut ? bonito(c.shortcut) : "Not set";
    if (!c.shortcut) k.className = "falta";
    li.append(t, k);
    return li;
  }));
}

botaoAtalhos.onclick = () => mostrarAtalhos();
document.getElementById("fechar-atalhos").onclick = () => mostrarAtalhos(false);
document.getElementById("mudar-atalhos").onclick = () => chrome.tabs.create({ url: "chrome://extensions/shortcuts" });

(async () => {
  // Se algum atalho ficou sem tecla (o Helium já a usava), o cartão abre sozinho a avisar.
  if ((await chrome.commands.getAll()).some((c) => NOMES[c.name] && !c.shortcut)) mostrarAtalhos(true);
})();

(async () => {
  raizId = await FS.root();
  destinoId = await FS.destino();
  abertas = new Set((await chrome.storage.local.get("abertas")).abertas || []);
  await marcarAtual();
  await desenhar();
  await verPedido();
})();
