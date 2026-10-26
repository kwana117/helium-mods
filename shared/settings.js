// helium-mods: Settings page. The extension describes itself in ext.js (EXT).

const $ = (id) => document.getElementById(id);

function mensagem(texto, tipo = "") {
  $("msg-chave").textContent = texto;
  $("msg-chave").className = `msg ${tipo}`;
}

async function desenharFuncoes() {
  const s = await HM.get();
  const caixa = $("funcoes");
  caixa.replaceChildren();
  for (const f of EXT.features) {
    const linha = document.createElement("div");
    linha.className = "linha" + (s.aiEnabled ? "" : " desligada");
    linha.innerHTML = `<div class="txt"><b></b><span></span></div><label class="interruptor"><input type="checkbox"><span></span></label>`;
    linha.querySelector("b").textContent = f.label;
    linha.querySelector(".txt span").textContent = f.desc;
    const input = linha.querySelector("input");
    input.setAttribute("aria-label", f.label);
    input.checked = s.features[f.id] !== false;
    input.disabled = !s.aiEnabled;
    input.onchange = () => HM.save({ features: { [f.id]: input.checked } });
    caixa.append(linha);
  }
  $("ai-ligada").checked = s.aiEnabled;
  $("cartao-ligacao").style.opacity = s.aiEnabled ? "1" : ".55";
}

async function desenharLigacao() {
  const s = await HM.get();
  const chave = await HM.getKey();
  const h = await HM.helperStatus();
  const via = await HM.connection();

  const pil = $("estado-ligacao");
  if (via === "helper") { pil.textContent = "Connected through the Mac helper (Keychain)"; pil.className = "pilula ok"; }
  else if (via === "key") { pil.textContent = "Connected with your key"; pil.className = "pilula ok"; }
  else if (s.source === "helper") {
    pil.textContent = !h.online ? "Mac helper not running" : !h.paired ? "Mac helper not connected yet" : "Mac helper has no key in the Keychain";
    pil.className = "pilula erro";
  }
  else { pil.textContent = "Not connected: add your key below"; pil.className = "pilula"; }

  const campo = $("chave");
  campo.value = "";
  campo.placeholder = chave ? `Saved: ${HM.maskKey(chave)}` : "sk-ant-…";
  $("guardar-chave").textContent = chave ? "Replace" : "Save";
  $("testar").hidden = !chave;
  $("apagar-chave").hidden = !chave;

  document.querySelectorAll('input[name="fonte"]').forEach((r) => { r.checked = r.value === s.source; });
  const pa = $("estado-ajudante");
  if (!h.online) { pa.textContent = "Not installed or not running"; pa.className = "pilula"; }
  else if (!h.paired) { pa.textContent = "Found on this Mac, not connected yet"; pa.className = "pilula erro"; }
  else { pa.textContent = h.hasKey ? "Connected, with a key in the Keychain" : "Connected, no key in the Keychain"; pa.className = "pilula ok"; }
  $("bloco-ligar").hidden = !(h.online && !h.paired);
}

async function ligarAjudante() {
  const b = $("ligar-ajudante");
  b.disabled = true;
  $("txt-ajudante").textContent = "Look for the dialog on your Mac and press Allow.";
  $("txt-ajudante").className = "msg";
  try {
    const ok = await HM.pairHelper();
    $("txt-ajudante").textContent = ok ? "Connected." : "Not allowed. Press Connect to try again.";
    $("txt-ajudante").className = ok ? "msg ok" : "msg erro";
  } catch {
    $("txt-ajudante").textContent = "The Mac helper did not answer.";
  } finally {
    b.disabled = false;
    await desenharLigacao();
  }
}

async function guardarChave() {
  const k = $("chave").value.trim();
  if (!HM.looksLikeKey(k)) return mensagem("That does not look like an Anthropic key. It should start with sk-ant-.", "erro");
  $("guardar-chave").disabled = true;
  mensagem("Checking the key…");
  try {
    const r = await HM.testKey(k);
    if (!r.ok && !r.msg.includes("no credit")) return mensagem(r.msg, "erro");
    await HM.setKey(k);
    const s = await HM.get();
    if (!s.aiEnabled) await HM.save({ aiEnabled: true });
    mensagem(r.ok ? "Saved. AI is on." : `Saved. ${r.msg}`, r.ok ? "ok" : "erro");
  } catch {
    mensagem("Could not reach Anthropic. Check your internet connection.", "erro");
  } finally {
    $("guardar-chave").disabled = false;
    await desenharFuncoes();
    await desenharLigacao();
  }
}

async function testar() {
  mensagem("Testing…");
  try {
    const r = await HM.testKey(await HM.getKey());
    mensagem(r.msg, r.ok ? "ok" : "erro");
  } catch {
    mensagem("Could not reach Anthropic. Check your internet connection.", "erro");
  }
}

async function apagarChave() {
  if (!confirm("Remove the saved key from this extension?")) return;
  await HM.clearKey();
  mensagem("Key removed.");
  await desenharLigacao();
}

async function iniciar() {
  document.title = `${EXT.name} settings`;
  $("nome-ext").textContent = EXT.name;
  $("o-que-sai").textContent = EXT.privacy;
  await desenharFuncoes();
  await desenharLigacao();

  $("ai-ligada").onchange = async (e) => {
    await HM.save({ aiEnabled: e.target.checked });
    await desenharFuncoes();
    await desenharLigacao();
  };
  $("guardar-chave").onclick = guardarChave;
  $("chave").addEventListener("keydown", (e) => { if (e.key === "Enter") guardarChave(); });
  $("testar").onclick = testar;
  $("ligar-ajudante").onclick = ligarAjudante;
  $("apagar-chave").onclick = apagarChave;
  $("ver").onclick = () => { const c = $("chave"); c.type = c.type === "password" ? "text" : "password"; };
  document.querySelectorAll('input[name="fonte"]').forEach((r) => {
    r.onchange = async () => { await HM.save({ source: r.value }); await desenharLigacao(); };
  });
  $("abrir-guia").onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
}

iniciar();
