// helium-mods: welcome guide. Steps come from EXT.guide in ext.js.
// A step's text may hold simple markup (<kbd>, <b>, <ul>) written by us in
// ext.js; it never contains anything typed by the user or read from a page.

const $ = (id) => document.getElementById(id);
const ICONES = {
  ola: '<path d="M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z"/>',
  usar: '<path d="M5 3l14 9-14 9z"/>',
  teclado: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  ia: '<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>',
  pronto: '<path d="M20 6L9 17l-5-5"/>',
  pino: '<path d="M12 17v5M9 3h6l-1 6 3 3H7l3-3z"/>',
};

let i = 0;

function desenhar() {
  const passos = EXT.guide;
  const p = passos[i];
  $("topo").replaceChildren(...passos.map((_, n) => {
    const t = document.createElement("i");
    if (n <= i) t.className = "feito";
    return t;
  }));
  const sec = $("passo");
  sec.innerHTML = `<div class="icone-grande"><svg class="i" viewBox="0 0 24 24">${ICONES[p.icon] || ICONES.ola}</svg></div><h1></h1><div class="corpo"></div>`;
  sec.querySelector("h1").textContent = p.title;
  sec.querySelector(".corpo").innerHTML = p.html;
  if (p.action === "settings") {
    const b = document.createElement("button");
    b.className = "b";
    b.type = "button";
    b.textContent = "Open settings";
    b.onclick = () => chrome.runtime.openOptionsPage();
    sec.append(b);
  }
  $("voltar").style.visibility = i === 0 ? "hidden" : "visible";
  const ultimo = i === passos.length - 1;
  $("seguinte").firstChild.textContent = ultimo ? "Done " : "Next ";
}

$("voltar").onclick = () => { if (i > 0) { i--; desenhar(); } };
$("seguinte").onclick = async () => {
  if (i < EXT.guide.length - 1) { i++; desenhar(); return; }
  await HM.save({ welcomed: true });
  window.close();
};
addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") $("seguinte").click();
  if (e.key === "ArrowLeft") $("voltar").click();
});
desenhar();
