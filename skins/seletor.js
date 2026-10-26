// Seletor de cor próprio: quadrado de saturação/brilho, barra de matiz,
// código hex e cores recentes. Abre junto ao botão que o chamou.

const Seletor = (() => {
  const el = (id) => document.getElementById(id);
  const caixa = el("seletor"), sv = el("sv"), cursor = el("sv-cursor");
  const matiz = el("matiz"), hex = el("hex"), amostra = el("seletor-amostra"), recentes = el("recentes");

  let h = 0, s = 0, v = 0, aoMudar = null, ancoraAtual = null;

  const hsvParaHex = (h, s, v) => {
    const f = (n) => {
      const k = (n + h / 60) % 6;
      return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))));
    };
    return "#" + [f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, "0")).join("");
  };

  const hexParaHsv = (cor) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
    let hh = 0;
    if (d) hh = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(hh * 60 + 360) % 360, max ? d / max : 0, max];
  };

  const lerRecentes = () => {
    try { return JSON.parse(localStorage.getItem("skins-recentes")) || []; } catch { return []; }
  };
  const guardarRecente = (cor) => {
    const lista = [cor, ...lerRecentes().filter((c) => c !== cor)].slice(0, 10);
    try { localStorage.setItem("skins-recentes", JSON.stringify(lista)); } catch {}
  };

  function pintar(emitir = true) {
    const cor = hsvParaHex(h, s, v);
    sv.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h} 100% 50%))`;
    cursor.style.left = `${s * 100}%`;
    cursor.style.top = `${(1 - v) * 100}%`;
    cursor.style.background = cor;
    matiz.value = h;
    amostra.style.background = cor;
    if (document.activeElement !== hex) hex.value = cor;
    if (emitir && aoMudar) aoMudar(cor);
  }

  function desenharRecentes() {
    recentes.replaceChildren();
    for (const cor of lerRecentes()) {
      const b = document.createElement("button");
      b.type = "button";
      b.title = cor;
      b.style.background = cor;
      b.onclick = () => { [h, s, v] = hexParaHsv(cor); pintar(); };
      recentes.append(b);
    }
  }

  function arrastarSV(e) {
    const r = sv.getBoundingClientRect();
    const mover = (ev) => {
      s = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      v = Math.min(1, Math.max(0, 1 - (ev.clientY - r.top) / r.height));
      pintar();
    };
    mover(e);
    const largar = () => { removeEventListener("pointermove", mover); removeEventListener("pointerup", largar); };
    addEventListener("pointermove", mover);
    addEventListener("pointerup", largar);
  }

  function fechar() {
    if (caixa.hidden) return;
    caixa.hidden = true;
    guardarRecente(hsvParaHex(h, s, v));
    ancoraAtual?.classList.remove("aberto");
    ancoraAtual = null;
    aoMudar = null;
  }

  function abrir(ancora, cor, callback) {
    if (ancoraAtual === ancora) return fechar();
    fechar();
    [h, s, v] = hexParaHsv(cor);
    aoMudar = callback;
    ancoraAtual = ancora;
    ancora.classList.add("aberto");
    desenharRecentes();
    caixa.hidden = false;
    const r = ancora.getBoundingClientRect();
    const largura = caixa.offsetWidth;
    caixa.style.left = `${Math.min(innerWidth - largura - 16, Math.max(16, r.left + r.width / 2 - largura / 2)) + scrollX}px`;
    caixa.style.top = `${r.bottom + 12 + scrollY}px`;
    pintar(false);
  }

  sv.addEventListener("pointerdown", arrastarSV);
  matiz.addEventListener("input", () => { h = +matiz.value; pintar(); });
  hex.addEventListener("input", () => {
    const c = hex.value.trim().replace(/^#?/, "#");
    if (/^#[0-9a-f]{6}$/i.test(c)) { [h, s, v] = hexParaHsv(c.toLowerCase()); pintar(); }
  });
  addEventListener("pointerdown", (e) => {
    if (!caixa.hidden && !caixa.contains(e.target) && !ancoraAtual?.contains(e.target)) fechar();
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });

  return { abrir, fechar };
})();
