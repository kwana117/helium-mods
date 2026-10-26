// Editor de skins para o Helium.
// As skins vivem no storage da extensão. "Aplicar" escreve o tema
// (imagens + manifest) na pasta do tema instalado e volta a ligá-lo.

const $ = (id) => document.getElementById(id);

// ─── Guardar dados (storage da extensão, ou localStorage fora dela) ─────────
const temChrome = typeof chrome !== "undefined" && chrome.storage?.local;
const store = {
  async get(k) {
    if (temChrome) return (await chrome.storage.local.get(k))[k];
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : undefined;
  },
  async set(k, v) {
    if (temChrome) return chrome.storage.local.set({ [k]: v });
    localStorage.setItem(k, JSON.stringify(v));
  },
};

const PREDEFINIDAS = [
  { id: "arc-suave", nome: "Arc Soft", cores: ["#706a94", "#656e90", "#5a728a"], angulo: 160, grao: 5 },
  { id: "areia", nome: "Sand", cores: ["#b49a83", "#a08c80", "#8a7f7c"], angulo: 150, grao: 6 },
  { id: "floresta", nome: "Forest", cores: ["#4f6b5c", "#486257", "#3c5550"], angulo: 170, grao: 5 },
  { id: "noite", nome: "Night", cores: ["#2e2f45", "#2a2c3e", "#232534"], angulo: 165, grao: 4 },
];

let skins = [];
let atual = null;
let aplicadaId = null;

// ─── Cor ────────────────────────────────────────────────────────────────────
const hexParaRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const misturar = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const luminancia = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const ajustar = (c, d) => c.map((v) => Math.max(0, Math.min(255, Math.round(v + d))));

// ─── Desenhar o gradiente com grão ──────────────────────────────────────────
function desenhar(skin, w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  // Ângulo como no CSS: 0 = para cima, 90 = para a direita.
  const rad = (skin.angulo * Math.PI) / 180;
  const dx = Math.sin(rad), dy = -Math.cos(rad);
  const meio = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const g = ctx.createLinearGradient(w / 2 - dx * meio, h / 2 - dy * meio, w / 2 + dx * meio, h / 2 + dy * meio);
  g.addColorStop(0, skin.cores[0]);
  g.addColorStop(0.5, skin.cores[1]);
  g.addColorStop(1, skin.cores[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  if (skin.grao > 0) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() * 2 - 1) * skin.grao;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }
  return canvas;
}

// Cores lisas que o Helium usa onde não mostra a imagem.
// No Helium a barra de cima inteira e o separador activo pintam-se com a cor da
// barra de endereço (omnibox_background). Essa cor é a da skin um pouco mais
// clara (ou escura, em skins claras): a barra de cima fica da mesma família e o
// separador activo destaca-se, porque os inactivos ficam sem fundo.
function coresDoTema(skin) {
  const [a, b, c] = skin.cores.map(hexParaRgb);
  const medio = misturar(misturar(a, b, 0.5), c, 0.33);
  const topo = misturar(a, b, 0.25);
  const fundoClaro = luminancia(medio) > 0.6;
  // Experiência (26-10-2026): barra de cima igual ao fundo; o separador activo
  // distingue-se só pelo texto. Para voltar a dar-lhe fundo, pôr 0.07.
  const DESTAQUE = 0;
  const ativo = fundoClaro ? misturar(topo, [20, 20, 28], DESTAQUE) : misturar(topo, [255, 255, 255], DESTAQUE);
  const textoAtivo = luminancia(ativo) > 0.6 ? [24, 24, 32] : [255, 255, 255];
  // Texto dos separadores inactivos mais apagado: o activo destaca-se também pelo texto.
  const textoFundo = fundoClaro ? misturar([40, 40, 50], medio, 0.5) : misturar([236, 236, 246], medio, 0.5);
  return {
    frame: medio,
    frame_inactive: ajustar(medio, -8),
    background_tab: medio,
    background_tab_inactive: ajustar(medio, -8),
    toolbar: topo,
    tab_text: textoAtivo,
    tab_background_text: textoFundo,
    tab_background_text_inactive: textoFundo,
    bookmark_text: textoAtivo,
    toolbar_button_icon: textoAtivo,
    omnibox_background: ativo,
    omnibox_text: textoAtivo,
    ntp_background: medio,
    ntp_text: fundoClaro ? [30, 30, 36] : [255, 255, 255],
  };
}

// ─── Interface ──────────────────────────────────────────────────────────────
function lerControlos() {
  atual.nome = $("nome").value.trim();
  atual.angulo = +$("angulo").value;
  atual.grao = +$("grao").value;
}

function escreverControlos() {
  $("nome").value = atual.nome;
  $("angulo").value = atual.angulo;
  $("grao").value = atual.grao;
}

const SUGESTOES = [
  ["#706a94", "#656e90", "#5a728a"],
  ["#8e6f9c", "#a07a8e", "#b38a7f"],
  ["#5d7d8f", "#5f8a86", "#6a9478"],
  ["#b49a83", "#a08c80", "#8a7f7c"],
  ["#3d4a6b", "#4a5a7e", "#5d6f92"],
  ["#2e2f45", "#2a2c3e", "#232534"],
];

const nivelGrao = (g) => (g === 0 ? "none" : g <= 5 ? `${g} · subtle` : g <= 11 ? `${g} · medium` : `${g} · strong`);
const pintarRange = (el) => el.style.setProperty("--p", `${((el.value - el.min) / (el.max - el.min)) * 100}%`);

let pendente = 0;
function preVisualizar() {
  cancelAnimationFrame(pendente);
  pendente = requestAnimationFrame(() => {
    $("angulo-v").textContent = `${atual.angulo}°`;
    $("grao-v").textContent = nivelGrao(atual.grao);
    pintarRange($("angulo"));
    pintarRange($("grao"));
    $("mostrador").querySelector("i").style.transform = `rotate(${atual.angulo}deg)`;
    $("faixa").style.background = `linear-gradient(90deg, ${atual.cores.join(", ")})`;
    document.querySelectorAll(".ponto span").forEach((el, i) => (el.style.background = atual.cores[i]));

    const imagem = desenhar(atual, 800, 500).toDataURL();
    const janela = $("janela");
    janela.style.backgroundImage = `url(${imagem})`;
    $("aplicar").style.backgroundImage = `url(${imagem})`;
    const t = coresDoTema(atual).tab_background_text;
    const tema = coresDoTema(atual);
    janela.style.setProperty("--texto-skin", `rgb(${t.join(",")})`);
    janela.style.setProperty("--ativo-skin", `rgb(${tema.omnibox_background.join(",")})`);
    janela.style.setProperty("--ativo-texto", `rgb(${tema.tab_text.join(",")})`);
    $("aplicar").style.color = `rgb(${t.join(",")})`;
  });
}

function desenharSugestoes() {
  const caixa = $("sugestoes");
  for (const cores of SUGESTOES) {
    const b = document.createElement("button");
    b.title = "Use these colours";
    b.style.background = `linear-gradient(135deg, ${cores.join(", ")})`;
    b.onclick = () => {
      atual.cores = [...cores];
      escreverControlos();
      preVisualizar();
    };
    caixa.append(b);
  }
}

function desenharLista() {
  const ul = $("lista");
  ul.replaceChildren();
  for (const s of skins) {
    const li = document.createElement("li");
    li.className = s.id === atual?.id ? "ativa" : "";
    const amostra = document.createElement("span");
    amostra.className = "amostra";
    amostra.style.background = `linear-gradient(${s.angulo}deg, ${s.cores.join(", ")})`;
    const texto = document.createElement("div");
    const nome = document.createElement("div");
    nome.className = "nome";
    nome.textContent = s.nome || "Untitled";
    texto.append(nome);
    if (s.id === aplicadaId) {
      const tag = document.createElement("div");
      tag.className = "aplicada";
      tag.textContent = "Applied";
      texto.append(tag);
    }
    li.append(amostra, texto);
    li.onclick = () => escolher(s.id);
    ul.append(li);
  }
}

function escolher(id) {
  atual = structuredClone(skins.find((s) => s.id === id));
  escreverControlos();
  desenharLista();
  preVisualizar();
  estado("");
}

function estado(msg, erro = false) {
  $("estado").textContent = msg;
  $("estado").classList.toggle("erro", erro);
}

async function guardarTudo() {
  await store.set("skins", skins);
}

async function guardar() {
  lerControlos();
  if (!atual.nome) atual.nome = "Untitled";
  $("nome").value = atual.nome;
  const i = skins.findIndex((s) => s.id === atual.id);
  if (i >= 0) skins[i] = structuredClone(atual);
  else skins.push(structuredClone(atual));
  await guardarTudo();
  desenharLista();
  estado("Saved.");
}

async function nova(base) {
  lerControlos();
  const origem = base ?? { cores: ["#706a94", "#656e90", "#5a728a"], angulo: 160, grao: 5, nome: "" };
  atual = { ...structuredClone(origem), id: crypto.randomUUID(), nome: base ? `${base.nome} 2`.slice(0, 18) : "" };
  skins.push(structuredClone(atual));
  await guardarTudo();
  escreverControlos();
  desenharLista();
  preVisualizar();
  $("nome").focus();
  $("nome").select();
  estado(base ? "" : "Name it, or press the star for a suggestion.");
}

async function apagar() {
  if (skins.length <= 1) return estado("Keep at least one skin.", true);
  if (!confirm(`Delete the skin "${atual.nome}"?`)) return;
  skins = skins.filter((s) => s.id !== atual.id);
  await guardarTudo();
  escolher(skins[0].id);
  estado("Deleted.");
}

// ─── Aplicar ────────────────────────────────────────────────────────────────
// A extensão não escreve no disco: manda a skin ao Hammerspoon (skins.lua),
// que grava ~/Code/helium-tema. Sem escolher pastas.
// ─── Aplicar ────────────────────────────────────────────────────────────────
// Com o ajudante do Mac (Hammerspoon), grava o tema e recarrega-o sozinho.
// Sem ele, descarrega o tema num zip para instalar à mão.

const paraBase64 = (canvas) => canvas.toDataURL("image/png").split(",")[1];
const paraBytes = (canvas) => new Promise((ok) => canvas.toBlob(async (b) => ok(new Uint8Array(await b.arrayBuffer())), "image/png"));

function montarTema() {
  const frame = desenhar(atual, 2000, 1300);
  const toolbar = document.createElement("canvas");
  toolbar.width = 2000;
  toolbar.height = 340;
  toolbar.getContext("2d").drawImage(frame, 0, 0);
  const manifesto = {
    manifest_version: 3,
    name: "Helium Skin",
    version: "1.0.0",
    description: `Skin "${atual.nome}", made with the Skins editor.`,
    theme: {
      images: {
        theme_frame: "images/frame.png",
        theme_frame_inactive: "images/frame.png",
        theme_toolbar: "images/toolbar.png",
        theme_ntp_background: "images/frame.png",
      },
      colors: coresDoTema(atual),
      properties: { ntp_background_alignment: "center", ntp_background_repeat: "no-repeat" },
    },
  };
  return { frame, toolbar, manifesto };
}

async function descarregarTema({ frame, toolbar, manifesto }) {
  const zip = Zip.criar([
    { name: "helium-skin/manifest.json", data: new TextEncoder().encode(JSON.stringify(manifesto, null, 2)) },
    { name: "helium-skin/images/frame.png", data: await paraBytes(frame) },
    { name: "helium-skin/images/toolbar.png", data: await paraBytes(toolbar) },
  ]);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(zip);
  a.download = `helium-skin-${(atual.nome || "skin").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function aplicar() {
  lerControlos();
  await guardar();
  const botao = $("aplicar");
  botao.disabled = true;
  try {
    estado("Building the theme…");
    const tema = montarTema();
    const ajudante = await HM.helperStatus();

    if (!ajudante.online || !ajudante.paired) {
      await descarregarTema(tema);
      estado(ajudante.online
        ? "Theme downloaded. To apply in one click, press Connect in Settings to link the Mac helper."
        : "Theme downloaded. Unzip it, open helium://extensions and choose Load unpacked with the helium-skin folder (or replace the old folder and press reload).");
      $("extensoes").hidden = false;
      return;
    }

    const r = await HM.helper("/apply", {
      name: atual.nome,
      colors: tema.manifesto.theme.colors,
      frame: paraBase64(tema.frame),
      toolbar: paraBase64(tema.toolbar),
    });
    if (!r.ok) throw new Error(`Could not save the theme${r.error ? `: ${r.error}` : "."}`);

    aplicadaId = atual.id;
    await store.set("aplicada", aplicadaId);
    desenharLista();

    const religado = await religarTema();
    estado(religado
      ? `"${atual.nome}" applied. If the window did not change, reload the theme on the extensions page.`
      : `Theme saved. Reload it on the extensions page.`);
    $("extensoes").hidden = false;
  } catch (e) {
    estado(e.message || String(e), true);
  } finally {
    botao.disabled = false;
  }
}

// Desliga e volta a ligar o tema instalado, para o Helium o reler do disco.
let temaId = null;
async function religarTema() {
  if (typeof chrome === "undefined" || !chrome.management) return false;
  const todas = await chrome.management.getAll();
  const tema = todas.find((x) => x.type === "theme" && x.installType === "development");
  if (!tema) return false;
  temaId = tema.id;
  await chrome.management.setEnabled(tema.id, false);
  await new Promise((r) => setTimeout(r, 300));
  await chrome.management.setEnabled(tema.id, true);
  return true;
}

// ─── IA (opcional; ver ai.js) ───────────────────────────────────────────────
const corValida = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);

const REGRAS_NOME = "Name in English, 1 or 2 words, at most 14 characters, evocative and concrete " +
  "(a place, a time of day, a material), no quotes or emojis. Examples of the tone: " +
  "Slate Dusk, Late Lavender, Wet Stone, Tagus Glow.";

const ESQUEMA_NOME = { type: "object", additionalProperties: false, required: ["nome"], properties: { nome: { type: "string" } } };
const ESQUEMA_SKIN = {
  type: "object",
  additionalProperties: false,
  required: ["nome", "cores", "angulo", "grao"],
  properties: {
    nome: { type: "string" },
    cores: { type: "array", items: { type: "string" } },
    angulo: { type: "integer" },
    grao: { type: "integer" },
  },
};

const pedirNome = (s) => HM.ask(
  `Name a browser skin: gradient with the colours ${s.cores.join(", ")}, direction ${s.angulo} degrees, grain ${s.grao} out of 20. ${REGRAS_NOME}`,
  ESQUEMA_NOME,
);

async function sugerirNome() {
  lerControlos();
  const botao = $("sugerir-nome");
  botao.classList.add("a-pensar");
  estado("Thinking of a name…");
  try {
    const { nome } = await pedirNome(atual);
    atual.nome = String(nome).slice(0, 18);
    $("nome").value = atual.nome;
    estado("Name suggested. Press Save if you like it.");
  } catch (e) {
    estado(e.message, true);
  } finally {
    botao.classList.remove("a-pensar");
  }
}

async function criarComIA() {
  const descricao = $("descricao").value.trim().slice(0, 300);
  if (!descricao) return $("descricao").focus();
  const form = $("criar-ia");
  form.classList.add("a-pensar");
  try {
    const r = await HM.ask(
      `Create a browser skin from this description (it may be in any language): «${descricao}».\n` +
        "Return exactly 3 hex colours (#rrggbb) for a soft gradient, close and low-saturation tones " +
        "that read well with white text on top (unless the description asks for a light skin). " +
        "angulo from 0 to 360 (160 is a soft downward diagonal), grao from 0 to 20 (5 is subtle). " + REGRAS_NOME,
      ESQUEMA_SKIN,
    );
    const cores = (r.cores || []).filter(corValida).slice(0, 3);
    if (cores.length !== 3) throw new Error("The AI returned invalid colours. Try another description.");
    lerControlos();
    atual = {
      id: crypto.randomUUID(),
      nome: String(r.nome || descricao).slice(0, 18),
      cores: cores.map((c) => c.toLowerCase()),
      angulo: Math.max(0, Math.min(360, Math.round(r.angulo / 5) * 5 || 160)),
      grao: Math.max(0, Math.min(20, Math.round(r.grao) || 5)),
    };
    skins.push(structuredClone(atual));
    await guardarTudo();
    escreverControlos();
    desenharLista();
    preVisualizar();
    $("descricao").value = "";
    estado(`Created "${atual.nome}". Tweak it and apply.`);
  } catch (e) {
    estado(e.message, true);
  } finally {
    form.classList.remove("a-pensar");
  }
}

// Mostra só os botões de IA ligados nas definições e com ligação feita.
async function mostrarIA() {
  $("sugerir-nome").hidden = !(await HM.aiReady("nameSuggest"));
  $("criar-ia").hidden = !(await HM.aiReady("createFromText"));
}

// Os nomes passaram a inglês e curtos (25-10-2026): renomeia uma vez as skins
// guardadas. As predefinidas por tradução fixa, as outras pela IA, se houver.
async function nomesEmIngles() {
  if (await store.get("nomesIngles")) return;
  const fixos = Object.fromEntries(PREDEFINIDAS.map((p) => [p.id, p.nome]));
  const comIA = await HM.aiReady("nameSuggest");
  for (const s of skins) {
    if (fixos[s.id]) { s.nome = fixos[s.id]; continue; }
    try {
      if (!comIA) throw new Error();
      const { nome } = await pedirNome(s);
      s.nome = String(nome).slice(0, 18);
    } catch {
      s.nome = s.nome.slice(0, 18);
    }
  }
  await guardarTudo();
  await store.set("nomesIngles", true);
}

// ─── Arranque ───────────────────────────────────────────────────────────────
async function iniciar() {
  desenharSugestoes();
  skins = (await store.get("skins")) ?? structuredClone(PREDEFINIDAS);
  if (!skins.length) skins = structuredClone(PREDEFINIDAS);
  aplicadaId = (await store.get("aplicada")) ?? null;
  await nomesEmIngles();
  await guardarTudo();
  escolher((skins.find((s) => s.id === aplicadaId) ?? skins[0]).id);

  document.querySelectorAll(".ponto").forEach((botao) => {
    botao.onclick = () => {
      const i = +botao.dataset.i;
      Seletor.abrir(botao, atual.cores[i], (cor) => {
        atual.cores[i] = cor;
        preVisualizar();
      });
    };
  });
  await mostrarIA();
  if (temChrome) chrome.storage.onChanged.addListener((mudou) => { if (mudou.settings || mudou.apiKey) mostrarIA(); });
  $("definicoes").onclick = () => chrome.runtime.openOptionsPage();
  $("sugerir-nome").onclick = sugerirNome;
  $("criar-ia").onsubmit = (e) => { e.preventDefault(); criarComIA(); };

  for (const id of ["angulo", "grao", "nome"]) {
    $(id).addEventListener("input", () => { lerControlos(); preVisualizar(); });
  }
  $("guardar").onclick = guardar;
  $("duplicar").onclick = () => nova(atual);
  $("nova").onclick = () => nova();
  $("apagar").onclick = apagar;
  $("aplicar").onclick = aplicar;
  $("extensoes").onclick = () => {
    const url = "chrome://extensions/" + (temaId ? `?id=${temaId}` : "");
    typeof chrome !== "undefined" && chrome.tabs ? chrome.tabs.create({ url }) : window.open(url);
  };
}

iniciar();
