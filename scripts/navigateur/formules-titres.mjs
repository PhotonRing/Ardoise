// Sujet : formules dans les titres. Une formule d'un titre de section, de sous-section ou d'étape est rendue en MathML
// dans le sommaire latéral et dans le bloc sommaire, en édition, en lecture et dans la page exportée ; le sommaire garde
// le HTML assaini du titre sans lien imbriqué ; le nom d'une page y est rendu aussi, comme sur les onglets de pages. Le titre
// de la fenêtre (et le <title> de la page exportée) retire les formules, sauf un titre fait d'une formule seule, lu sans ses
// dollars ; le nom à côté du logo et le nom du fichier lisent la formule $source$. Origine : spec formules, tickets 06 et 11
// (décision d9).

const F = (s) => '<span class="formule">' + s + '</span>';
const DOC = { title: 'Titres', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 'hd', type: 'header', title: 'Aire ' + F('\\pi r^2'), lede: '' },
  { id: 'sm', type: 'summary' },
  { id: 's1', type: 'h2', html: 'Énergie ' + F('E=mc^2') },
  { id: 's2', type: 'h3', html: '<b>Gras</b> ' + F('x_1') },
  { id: 'e1', type: 'step', title: 'Étape ' + F('\\alpha') },
  { id: 's3', type: 'h2', html: 'Voir <a href="https://exemple.org">le site</a>' },
  { id: 's4', type: 'h2', html: '&lt;img src=x onerror=alert(1)&gt; texte' },
] }, { id: 'p2', title: 'Deux', blocks: [{ id: 'h2', type: 'header', title: 'Page ' + F('y') }] },
  { id: 'p3', title: 'Trois', blocks: [{ id: 'h3', type: 'header', title: ' ' + F('\\pi r^2') + ' ' }] }] };
const SOUS_PAGES = { title: 'Sous-pages', pages: [{ id: 'q1', blocks: [{ id: 'hq', type: 'header', title: 'Parent' }, { id: 'sp', type: 'summary', src: 'pages' }] },
  { id: 'q2', lv: 1, blocks: [{ id: 'hq2', type: 'header', title: 'Aire ' + F('x^2') }] }, { id: 'q3', lv: 1, title: 'Trois', blocks: [{ id: 'hq3', type: 'header', title: 'Sous ' + F('\\beta') }] }] };
import { jusqua } from './outils/attente.mjs';

const BASCULER = `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }))`;
// formules visibles d'un conteneur : présence du MathML annoté et source
const SOURCES = (sel) => `[...document.querySelectorAll(${JSON.stringify(sel)})].map((a) => [...a.querySelectorAll('.formule')].filter((x) => x.getClientRects().length)
  .map((x) => !!x.querySelector('math semantics annotation') && x.querySelector('math').getBoundingClientRect().width > 0 ? x.querySelector('annotation').textContent : '!'))`;
const GUET = `(() => { window.__export = null; window.__nom = null; const o = URL.createObjectURL, c = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (b) => { window.__blob = b; return o.call(URL, b); };
  HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__nom = this.download; window.__blob.text().then((t) => { window.__export = t; }); return; } return c.call(this); }; return true; })()`;

export const nom = 'formules dans les titres';
export default async function ({ ecran, charger, evalue, cdp, mesure, echec }) {
  const attendu = (cas, ok, vu) => { mesure(); if (!ok) echec(cas + ' : ' + JSON.stringify(vu)); };
  // attend que l'expression vaille `val` (comparée en JSON), au plus 5 s
  const egal = (expr, val) => jusqua(evalue, `JSON.stringify(${expr}) === ${JSON.stringify(JSON.stringify(val))}`);
  const ENTREES = [['E=mc^2'], ['x_1'], ['\\alpha'], [], []];
  await ecran(1400, false);
  await charger();
  // bloc sommaire en sous-pages : le nom de chaque sous-page y est rendu avec ses formules, comme dans le sommaire de gauche
  await evalue(`window.ardoise.load(${JSON.stringify(SOUS_PAGES)})`); await egal(SOURCES('.blk[data-id="sp"] .toc-blk-l a'), [['x^2'], ['\\beta']]);
  const sp = await evalue(SOURCES('.blk[data-id="sp"] .toc-blk-l a'));
  const spt = await evalue(`[...document.querySelectorAll('.blk[data-id="sp"] .toc-blk-l a')].map((a) => a.textContent.slice(0, 4))`);
  attendu('bloc sommaire en sous-pages : noms des pages rendus', JSON.stringify(sp) === JSON.stringify([['x^2'], ['\\beta']]) && spt[0] === 'Aire' && spt[1] === 'Sous', [sp, spt]);
  await evalue(`window.ardoise.load(${JSON.stringify(DOC)})`); await egal(SOURCES('.pnav-side a[data-sec]'), ENTREES);

  // sommaire latéral en édition : formules des titres rendues, entrées dans l'ordre de la page
  const ed = await evalue(SOURCES('.pnav-side a[data-sec]'));
  attendu('édition : formules du sommaire latéral', JSON.stringify(ed) === JSON.stringify(ENTREES), ed);
  const blk = await evalue(SOURCES('.blk[data-id="sm"] .toc-blk-l a'));
  attendu('édition : formules du bloc sommaire', JSON.stringify(blk) === JSON.stringify([['E=mc^2'], ['x_1'], ['\\alpha'], [], []]), blk);

  // HTML assaini : mise en forme gardée, lien défait, texte d'un titre échappé
  const sur = await evalue(`(() => { const a = [...document.querySelectorAll('.pnav-side a[data-sec]')]; return { gras: !!a[1].querySelector('b'), lien: a[3].querySelectorAll('a').length,
    lienTexte: a[3].textContent.trim(), img: document.querySelectorAll('.pnav-side img, .pnav-tabs img, .toc-blk img').length, texte: a[4].textContent.trim() }; })()`);
  attendu('sommaire : HTML assaini, sans lien imbriqué ni injection', sur.gras && sur.lien === 0 && sur.lienTexte === 'Voir le site' && sur.img === 0 && sur.texte === '<img src=x onerror=alert(1)> texte', sur);

  // nom des pages rendu dans les onglets (masqués à cette largeur : formules présentes) et le sommaire ; titre de la fenêtre sans formule ; nom à côté du logo en $source$
  const PAGES = [['\\pi r^2'], ['y'], ['\\pi r^2']];
  const ong = await evalue(`[...document.querySelectorAll('.pnav-tabs [data-pg]')].map((b) => [...b.querySelectorAll('.formule math annotation')].map((x) => x.textContent))`), som = await evalue(SOURCES('.pnav-side [data-pg]'));
  const txt = await evalue(`({ titre: document.title, nom: document.querySelector('.tb .doc-name').textContent, debut: [...document.querySelectorAll('.pnav-tabs [data-pg], .pnav-side [data-pg]')].map((b) => b.textContent.slice(0, 4)) })`);
  attendu('onglets de pages et pages du sommaire : formules rendues', JSON.stringify(ong) === JSON.stringify(PAGES) && JSON.stringify(som) === JSON.stringify(PAGES) &&
    txt.debut[0] === 'Aire' && txt.debut[1] === 'Page' && txt.debut[3] === 'Aire', [ong, som, txt.debut]);
  attendu('titre de la fenêtre sans la formule, nom à côté du logo en $source$', txt.titre === 'Aire' && txt.nom === 'Aire $\\pi r^2$', txt);
  const onglet = async (i, titre) => { await evalue(`document.querySelector('[data-pg="${i}"]').click(), true`); await egal('document.title', titre); return evalue('document.title'); };
  const fen = [await onglet(1, 'Page'), await onglet(2, '\\pi r^2'), await onglet(0, 'Aire')];
  attendu('titre de la fenêtre par page : formule retirée, ou sa source sans dollars si le titre n\'est qu\'une formule', JSON.stringify(fen) === JSON.stringify(['Page', '\\pi r^2', 'Aire']), fen);

  // frappe dans un titre : le sommaire suit (mise à jour en place)
  await evalue(`(() => { const f = document.querySelector('.blk[data-id="s1"] h2[contenteditable="true"]'); f.focus(); const r = document.createRange(); r.setStart(f.firstChild, 0); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()`);
  await evalue(`document.execCommand('insertText', false, 'Z ')`); await jusqua(evalue, `document.querySelector('.pnav-side a[data-sec="s1"]').textContent.slice(0, 2) === 'Z '`);
  const suit = await evalue(`(() => { const a = document.querySelector('.pnav-side a[data-sec="s1"]'); return [a.textContent.slice(0, 2), !!a.querySelector('.formule math annotation')]; })()`);
  attendu('frappe dans un titre : le sommaire suit, formule gardée', suit[0] === 'Z ' && suit[1], suit);

  // lecture : mêmes formules dans le sommaire latéral et le bloc sommaire
  await evalue(BASCULER); await jusqua(evalue, `!document.documentElement.classList.contains('is-edit')`); await egal(SOURCES('.toc-blk-l a'), ENTREES);
  const lec = await evalue(SOURCES('.pnav-side a[data-sec]'));
  const lecb = await evalue(SOURCES('.toc-blk-l a'));
  attendu('lecture : formules du sommaire', JSON.stringify(lec) === JSON.stringify([['E=mc^2'], ['x_1'], ['\\alpha'], [], []]) && JSON.stringify(lecb) === JSON.stringify(lec), [lec, lecb]);
  await evalue(BASCULER); await jusqua(evalue, `document.documentElement.classList.contains('is-edit')`);

  // page exportée : MathML dans le sommaire, titre et nom du fichier tirés du titre en $source$
  await evalue(GUET);
  await evalue(`document.querySelector('[data-ui="file"]').click(), document.querySelector('[data-f="export"]').click(), true`);
  await jusqua(evalue, '!!window.__export');
  const ex = await evalue(`(() => { const d = new DOMParser().parseFromString(window.__export || '', 'text/html');
    return { titre: d.title, nom: window.__nom, toc: [...d.querySelectorAll('.pnav-side a[data-sec]')].map((a) => [...a.querySelectorAll('.formule math annotation')].map((x) => x.textContent)),
      img: d.querySelectorAll('.pnav-side img').length }; })()`);
  attendu('page exportée : formules dans le sommaire, titre sans la formule, nom du fichier inchangé', ex.titre === 'Aire' && ex.nom === 'Aire-pi-r-2-lecture.html' && ex.img === 0 &&
    JSON.stringify(ex.toc.slice(0, 5)) === JSON.stringify([['E=mc^2'], ['x_1'], ['\\alpha'], [], []]), ex);
  const exporte = await evalue('window.__export');
  await evalue(`window.__nom = null, document.querySelector('.blk[data-id="s1"] [data-act="menu-bloc"]').click(),
    [...document.querySelectorAll('.menu-bloc .mi')].find((m) => m.textContent.includes('Exporter en Word (.docx)')).click(), true`);
  await jusqua(evalue, '!!window.__nom');
  const word = await evalue('window.__nom');
  attendu('nom proposé du .docx d\'un titre à formule', word === 'Z-Energie-E-mc-2.docx', word);

  // page exportée ouverte : nom des pages rendu, titre de la fenêtre sans formule à chaque page
  await cdp('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(exporte).toString('base64') }); await egal(SOURCES('.pnav-side [data-pg]'), PAGES);
  const exo = await evalue(SOURCES('.pnav-side [data-pg]'));
  const exf = [await evalue('document.title'), await onglet(1, 'Page'), await onglet(2, '\\pi r^2')];
  attendu('page exportée ouverte : pages du sommaire rendues, titre de la fenêtre par page', JSON.stringify(exo) === JSON.stringify(PAGES) &&
    JSON.stringify(exf) === JSON.stringify(['Aire', 'Page', '\\pi r^2']), [exo, exf]);
}
