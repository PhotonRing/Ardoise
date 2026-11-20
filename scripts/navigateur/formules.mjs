// Sujet : formules en ligne. Une formule stockée (span.formule) s'affiche en MathML, non éditable en édition, en lecture et
// dans une requête ; une frappe juste avant ou juste après la garde dans le document ; le collage relit l'élément rendu
// d'Ardoise et un <math> annoté application/x-tex en formule, jette un <math> sans annotation ; la page statique exportée
// contient le MathML sans le moteur ; une commande inconnue est en rouge. Origine : spec formules, ticket 01.

const F = (s) => '<span class="formule">' + s + '</span>';
const DOC = { title: 'Formules', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 't', type: 'texte', lignes: [{ html: 'Aire ' + F('\\pi r^2') + ' fin' }, { html: 'Erreur ' + F('\\cancel{x}') }] },
  { id: 'c', type: 'texte', lignes: [{ html: '' }] },
  { id: 'tb', type: 'table', rows: [['Nom', 'Valeur'], ['a', '']] },
  { id: 'f', type: 'facts', items: [{ k: 'Énergie', v: F('E=mc^2') }] },
  { id: 'q', type: 'query', src: 'facts', scope: 'doc' },
] }] };
const ANN = (s) => '<annotation encoding="application/x-tex">' + s + '</annotation>';
// élément rendu tel qu'Ardoise le copie, MathML d'une autre application annoté, MathML sans annotation
const RENDU = '<span class="formule" contenteditable="false"><math><semantics><mrow><mi>𝑥</mi></mrow>' + ANN('x') + '</semantics></math></span>';
const ANNOTE = '<math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mi>y</mi>' + ANN('y^2') + '</semantics></math>';
const NU = '<math><mi>z</mi></math>';
const BLOC = (id) => `window.ardoise.doc.pages[0].blocks.find((b) => b.id === ${JSON.stringify(id)})`;
// curseur dans le nœud de texte voisin de la première formule du bloc : avant (fin du texte précédent) ou après
const CURSEUR = (cote) => `(() => { const f = document.querySelector('.blk[data-id="t"] .formule'); const n = ${cote === 'avant' ? 'f.previousSibling' : 'f.nextSibling'};
  n.parentElement.closest('[contenteditable="true"]').focus(); const r = document.createRange(); r.setStart(n, ${cote === 'avant' ? 'n.length' : '0'}); r.collapse(true);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`;
const COLLER = (sel, html) => `(() => { const f = document.querySelector(${JSON.stringify(sel)}); f.focus(); const r = document.createRange(); r.setStart(f, 0); r.collapse(true);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r); const dt = new DataTransfer(); dt.setData('text/html', ${JSON.stringify(html)}); dt.setData('text/plain', 'x');
  f.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); return true; })()`;
const RENDUES = (sel) => `[...document.querySelectorAll(${JSON.stringify(sel + ' .formule')})].filter((x) => x.getClientRects().length).map((x) => ({
  math: !!x.querySelector('math semantics annotation') && x.querySelector('math').getBoundingClientRect().width > 0, ce: x.getAttribute('contenteditable'),
  src: (x.querySelector('annotation') || {}).textContent }))`;
const BASCULER = `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }))`;
const GUET = `(() => { window.__export = null; const o = URL.createObjectURL, c = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (b) => { window.__blob = b; return o.call(URL, b); };
  HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__blob.text().then((t) => { window.__export = t; }); return; } return c.call(this); }; return true; })()`;

export const nom = 'formules en ligne';
export default async function ({ ecran, charger, evalue, cdp, attendre, mesure, echec }) {
  const attendu = (cas, ok, vu) => { mesure(); if (!ok) echec(cas + ' : ' + JSON.stringify(vu)); };
  await ecran(1000, false);
  await charger();
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await attendre(150);

  // édition : rendue, non éditable ; la commande inconnue en rouge (--bad du thème clair)
  const ed = await evalue(RENDUES('.blk[data-id="t"]'));
  attendu('édition : formules rendues et non éditables', ed.length === 2 && ed.every((x) => x.math && x.ce === 'false') && ed[0].src === '\\pi r^2', ed);
  const rouge = await evalue(`(() => { const e = document.querySelector('.blk[data-id="t"] .f-err'); return e && [e.textContent, getComputedStyle(e).color, getComputedStyle(document.documentElement).getPropertyValue('--bad').trim()]; })()`);
  attendu('commande inconnue en rouge', rouge && rouge[0] === '\\cancel' && rouge[1] === 'rgb(180, 35, 24)', rouge);
  const req = await evalue(RENDUES('.blk[data-id="q"] .q-res'));
  attendu('requête : la formule de la fiche est rendue', req.length === 1 && req[0].math && req[0].src === 'E=mc^2', req);

  // frappe juste avant et juste après : la formule reste dans le document
  await evalue(CURSEUR('apres')); await cdp('Input.insertText', { text: 'X' }); await attendre(80);
  await evalue(CURSEUR('avant')); await cdp('Input.insertText', { text: 'Y' }); await attendre(80);
  const l0 = await evalue(BLOC('t') + '.lignes[0].html');
  attendu('frappe à côté : span.formule gardé', l0 === 'Aire Y' + F('\\pi r^2') + 'X fin', l0);

  // collage dans un bloc texte et dans une cellule : rendu d'Ardoise et MathML annoté relus, MathML nu jeté
  await evalue(COLLER('.blk[data-id="c"] .lg', 'a ' + RENDU + ' b ' + ANNOTE + ' c ' + NU + ' d')); await attendre(120);
  const lc = await evalue(BLOC('c') + '.lignes[0].html');
  attendu('collage dans un bloc texte', lc === 'a ' + F('x') + ' b ' + F('y^2') + ' c  d', lc);
  const cc = await evalue(RENDUES('.blk[data-id="c"]'));
  attendu('collage dans un bloc texte : formules rendues aussitôt', cc.length === 2 && cc.every((x) => x.math && x.ce === 'false'), cc);
  const cellule = '.blk[data-id="tb"] tbody tr:last-child td:last-child [contenteditable="true"], .blk[data-id="tb"] tr:last-child td:last-child[contenteditable="true"]';
  await evalue(COLLER(cellule, RENDU + ' et ' + ANNOTE)); await attendre(120);
  const tc = await evalue(BLOC('tb') + '.rows[1][1]');
  attendu('collage dans une cellule', tc === F('x') + ' et ' + F('y^2'), tc);
  const ct = await evalue(RENDUES('.blk[data-id="tb"] tr:last-child'));
  attendu('collage dans une cellule : formules rendues aussitôt', ct.length === 2 && ct.every((x) => x.math), ct);

  // lecture : rendue, sans contenteditable
  await evalue(BASCULER); await attendre(200);
  const lec = await evalue(RENDUES('#b-t'));
  attendu('lecture : formules rendues', lec.length === 2 && lec.every((x) => x.math && x.ce === null), lec);
  await evalue(BASCULER); await attendre(200);

  // page statique : MathML présent, aucun moteur dans le script
  await evalue(GUET);
  await evalue(`document.querySelector('[data-ui="file"]').click(), document.querySelector('[data-f="export"]').click(), true`);
  for (let i = 0; i < 50 && !(await evalue('!!window.__export')); i++) await attendre(100);
  const ex = await evalue(`(() => { const t = window.__export || ''; return { math: (t.match(/<span class="formule"><math>/g) || []).length, ann: t.includes('${'<annotation encoding="application/x-tex">\\\\pi r^2</annotation>'}'),
    moteur: /texEnMathML|COMMANDES_TEX|analyseurTex/.test(t), ce: t.includes('contenteditable') }; })()`);
  attendu('page statique : MathML présent sans le moteur', ex.math >= 6 && ex.ann && !ex.moteur && !ex.ce, ex);
}
