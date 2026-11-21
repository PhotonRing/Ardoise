// Sujet : formules dans les titres. Une formule d'un titre de section, de sous-section ou d'étape est rendue en MathML
// dans le sommaire latéral et dans le bloc sommaire, en édition, en lecture et dans la page exportée ; le sommaire garde
// le HTML assaini du titre sans lien imbriqué ; ailleurs (onglets, titre de la fenêtre, nom du fichier) une formule se
// lit $source$, et le titre reste du texte échappé. Origine : spec formules, ticket 06.

const F = (s) => '<span class="formule">' + s + '</span>';
const DOC = { title: 'Titres', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 'hd', type: 'header', title: 'Aire ' + F('\\pi r^2'), lede: '' },
  { id: 'sm', type: 'summary' },
  { id: 's1', type: 'h2', html: 'Énergie ' + F('E=mc^2') },
  { id: 's2', type: 'h3', html: '<b>Gras</b> ' + F('x_1') },
  { id: 'e1', type: 'step', title: 'Étape ' + F('\\alpha') },
  { id: 's3', type: 'h2', html: 'Voir <a href="https://exemple.org">le site</a>' },
  { id: 's4', type: 'h2', html: '&lt;img src=x onerror=alert(1)&gt; texte' },
] }, { id: 'p2', title: 'Deux', blocks: [{ id: 'h2', type: 'header', title: 'Page ' + F('y') }] }] };
const BASCULER = `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }))`;
// formules visibles d'un conteneur : présence du MathML annoté et source
const SOURCES = (sel) => `[...document.querySelectorAll(${JSON.stringify(sel)})].map((a) => [...a.querySelectorAll('.formule')].filter((x) => x.getClientRects().length)
  .map((x) => !!x.querySelector('math semantics annotation') && x.querySelector('math').getBoundingClientRect().width > 0 ? x.querySelector('annotation').textContent : '!'))`;
const GUET = `(() => { window.__export = null; window.__nom = null; const o = URL.createObjectURL, c = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (b) => { window.__blob = b; return o.call(URL, b); };
  HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__nom = this.download; window.__blob.text().then((t) => { window.__export = t; }); return; } return c.call(this); }; return true; })()`;

export const nom = 'formules dans les titres';
export default async function ({ ecran, charger, evalue, attendre, mesure, echec }) {
  const attendu = (cas, ok, vu) => { mesure(); if (!ok) echec(cas + ' : ' + JSON.stringify(vu)); };
  await ecran(1400, false);
  await charger();
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(150);

  // sommaire latéral en édition : formules des titres rendues, entrées dans l'ordre de la page
  const ed = await evalue(SOURCES('.pnav-side a[data-sec]'));
  attendu('édition : formules du sommaire latéral', JSON.stringify(ed) === JSON.stringify([['E=mc^2'], ['x_1'], ['\\alpha'], [], []]), ed);
  const blk = await evalue(SOURCES('.blk[data-id="sm"] .toc-blk-l a'));
  attendu('édition : formules du bloc sommaire', JSON.stringify(blk) === JSON.stringify([['E=mc^2'], ['x_1'], ['\\alpha'], [], []]), blk);

  // HTML assaini : mise en forme gardée, lien défait, texte d'un titre échappé
  const sur = await evalue(`(() => { const a = [...document.querySelectorAll('.pnav-side a[data-sec]')]; return { gras: !!a[1].querySelector('b'), lien: a[3].querySelectorAll('a').length,
    lienTexte: a[3].textContent.trim(), img: document.querySelectorAll('.pnav-side img, .pnav-tabs img, .toc-blk img').length, texte: a[4].textContent.trim() }; })()`);
  attendu('sommaire : HTML assaini, sans lien imbriqué ni injection', sur.gras && sur.lien === 0 && sur.lienTexte === 'Voir le site' && sur.img === 0 && sur.texte === '<img src=x onerror=alert(1)> texte', sur);

  // ailleurs, le titre se lit en texte : formule $source$
  const txt = await evalue(`({ titre: document.title, nom: document.querySelector('.tb .doc-name').textContent, onglets: [...document.querySelectorAll('.pnav-tabs [data-pg]')].map((b) => b.textContent),
    pages: [...document.querySelectorAll('.pnav-side [data-pg]')].map((b) => b.innerHTML) })`);
  attendu('titre de la fenêtre, onglets et pages du sommaire en $source$', txt.titre === 'Aire $\\pi r^2$' && txt.nom === txt.titre &&
    JSON.stringify(txt.onglets) === JSON.stringify(['Aire $\\pi r^2$', 'Page $y$']) && JSON.stringify(txt.pages) === JSON.stringify(['Aire $\\pi r^2$', 'Page $y$']), txt);

  // frappe dans un titre : le sommaire suit (mise à jour en place)
  await evalue(`(() => { const f = document.querySelector('.blk[data-id="s1"] h2[contenteditable="true"]'); f.focus(); const r = document.createRange(); r.setStart(f.firstChild, 0); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`);
  await evalue(`document.execCommand('insertText', false, 'Z ')`); await attendre(500);
  const suit = await evalue(`(() => { const a = document.querySelector('.pnav-side a[data-sec="s1"]'); return [a.textContent.slice(0, 2), !!a.querySelector('.formule math annotation')]; })()`);
  attendu('frappe dans un titre : le sommaire suit, formule gardée', suit[0] === 'Z ' && suit[1], suit);

  // lecture : mêmes formules dans le sommaire latéral et le bloc sommaire
  await evalue(BASCULER); await attendre(250);
  const lec = await evalue(SOURCES('.pnav-side a[data-sec]'));
  const lecb = await evalue(SOURCES('.toc-blk-l a'));
  attendu('lecture : formules du sommaire', JSON.stringify(lec) === JSON.stringify([['E=mc^2'], ['x_1'], ['\\alpha'], [], []]) && JSON.stringify(lecb) === JSON.stringify(lec), [lec, lecb]);
  await evalue(BASCULER); await attendre(250);

  // page exportée : MathML dans le sommaire, titre et nom du fichier tirés du titre en $source$
  await evalue(GUET);
  await evalue(`document.querySelector('[data-ui="file"]').click(), document.querySelector('[data-f="export"]').click(), true`);
  for (let i = 0; i < 50 && !(await evalue('!!window.__export')); i++) await attendre(100);
  const ex = await evalue(`(() => { const d = new DOMParser().parseFromString(window.__export || '', 'text/html');
    return { titre: d.title, nom: window.__nom, toc: [...d.querySelectorAll('.pnav-side a[data-sec]')].map((a) => [...a.querySelectorAll('.formule math annotation')].map((x) => x.textContent)),
      img: d.querySelectorAll('.pnav-side img').length }; })()`);
  attendu('page exportée : formules dans le sommaire, titre en $source$', ex.titre === 'Aire $\\pi r^2$' && ex.nom === 'Aire-pi-r-2-lecture.html' && ex.img === 0 &&
    JSON.stringify(ex.toc.slice(0, 5)) === JSON.stringify([['E=mc^2'], ['x_1'], ['\\alpha'], [], []]), ex);
  await evalue(`window.__nom = null, document.querySelector('.blk[data-id="s1"] [data-act="menu-bloc"]').click(),
    [...document.querySelectorAll('.menu-bloc .mi')].find((m) => m.textContent.includes('Exporter en Word (.docx)')).click(), true`);
  for (let i = 0; i < 50 && !(await evalue('!!window.__nom')); i++) await attendre(100);
  const word = await evalue('window.__nom');
  attendu('nom proposé du .docx d\'un titre à formule', word === 'Z-Energie-E-mc-2.docx', word);
}
