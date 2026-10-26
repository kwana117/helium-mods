// Janelinha da Tidy. A lógica de arrumar vive em tidy.js; a IA em ai.js.

const $ = (id) => document.getElementById(id);
const CORES = { grey: "#9aa0a6", blue: "#8ab4f8", red: "#f28b82", yellow: "#fdd663", green: "#81c995", pink: "#ff8bcb", purple: "#c58af9", cyan: "#78d9ec", orange: "#fcad70" };

let comIA = false;
const ICONE_IA = "M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z";
const ICONE_SITE = "M3 12h18M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18";

function estado(msg, erro = false) {
  $("estado").textContent = msg;
  $("estado").classList.toggle("erro", erro);
}

function mostrarResultado(grupos) {
  const ul = $("resultado");
  ul.replaceChildren();
  for (const g of grupos) {
    const li = document.createElement("li");
    const cor = document.createElement("span");
    cor.className = "cor";
    cor.style.background = CORES[g.cor] || CORES.grey;
    const nome = document.createElement("span");
    nome.textContent = g.nome;
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = g.ids.length;
    li.append(cor, nome, n);
    ul.append(li);
  }
}

async function agrupar(modo, botao) {
  const botoes = [$("agrupar"), $("por-site")];
  botoes.forEach((b) => (b.disabled = true));
  botao.classList.add("a-pensar");
  estado(modo === "topic" ? "Reading your tabs…" : "Sorting by site…");
  try {
    const { grupos, total } = await arrumar(undefined, modo);
    mostrarResultado(grupos);
    estado(`${total} tabs in ${grupos.length} groups.`);
    $("desfazer").hidden = false;
    botoes.forEach((b) => (b.hidden = true));
    $("dica-ia").hidden = true;
  } catch (e) {
    estado(e.message || String(e), true);
    botoes.forEach((b) => (b.disabled = false));
  } finally {
    botao.classList.remove("a-pensar");
  }
}

async function desfazer() {
  await desfazerUltimo();
  $("desfazer").hidden = true;
  $("resultado").replaceChildren();
  estado("Undone. The tabs are loose again.");
  await iniciar();
}

async function iniciar() {
  comIA = await HM.aiReady("groupByTopic");
  const soltos = await lerSoltos();
  const principal = $("agrupar");
  const porSite = $("por-site");
  principal.hidden = false;
  $("rotulo-principal").textContent = comIA ? "Group by topic" : "Group by site";
  $("icone-principal").querySelector("path").setAttribute("d", comIA ? ICONE_IA : ICONE_SITE);
  porSite.hidden = !comIA;
  $("dica-ia").hidden = comIA;

  const poucos = soltos.length < 2;
  $("resumo").textContent = poucos
    ? "No loose tabs to sort in this window."
    : `${soltos.length} loose tabs in this window. Pinned tabs and existing groups stay as they are.`;
  principal.disabled = poucos;
  porSite.disabled = poucos;

  const atalho = (await chrome.commands.getAll()).find((c) => c.name === "agrupar")?.shortcut;
  $("atalho").textContent = atalho ? `Shortcut: ${atalho}` : "No shortcut set";
  const { ultimo } = await chrome.storage.local.get("ultimo");
  $("desfazer").hidden = !(ultimo && Date.now() - ultimo.quando < 30 * 60 * 1000);
}

$("agrupar").onclick = () => agrupar(comIA ? "topic" : "site", $("agrupar"));
$("por-site").onclick = () => agrupar("site", $("por-site"));
$("desfazer").onclick = desfazer;
$("definicoes").onclick = () => chrome.runtime.openOptionsPage();
$("ligar-ia").onclick = (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); };
iniciar();
