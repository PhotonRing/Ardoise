// Copier pour Office, famille Listes (src/js/09-office-listes.js) : listes à puces et numérotées, listes à cocher, sommaire.
import { monter, test, egal, vrai } from './commun.mjs';
import { monterOffice, verifierSocle } from './office-socle.mjs';

const P = (t, cls) => '<span class="pill' + (cls ? ' ' + cls : '') + '">' + t + '</span>';
const NIVEAUX = [{ html: 'un' }, { html: 'deux', lv: 1 }, { html: 'trois', lv: 2 }, { html: 'quatre', lv: 3 }, { html: 'cinq' }];
// document en thème sombre à la palette indigo : le collage reste clair, à l'accent clair de la palette (#4848c0 / #ececfb)
const DOC = { v: 6, title: 'Doc', theme: 'dark', palette: 'indigo', tags: { ok: { c: 0 } }, pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 'ul', type: 'list', ordered: false, items: NIVEAUX },
  { id: 'ol', type: 'list', ordered: true, items: NIVEAUX },
  { id: 'c', type: 'check', items: [{ html: 'fait ' + P('OK'), done: true }, { html: 'à faire' }, { html: 'dessous', lv: 1 }, { html: 'plus bas', lv: 2, done: true }] },
  { id: 'co', type: 'check', order: 'doneFirst', items: [{ html: 'a' }, { html: 'b', done: true }] },
  { id: 'cv', type: 'check', items: [] },
  { id: 'sm', type: 'summary', title: 'Sommaire', src: 'sec', sort: 'doc' },
  { id: 'smt', type: 'summary', title: '', src: 'sec', sort: 'doc' },
  { id: 'smp', type: 'summary', title: 'Pages', src: 'pages', sort: 'doc' },
  { id: 'e1', type: 'step', num: '', title: 'Isoler' }, { id: 'h3', type: 'h3', html: 'Détail' }, { id: 'h2', type: 'h2', html: 'Bilan' },
  { id: 'saut', type: 'list', ordered: false, items: [{ html: 'haut' }, { html: 'trop bas', lv: 3 }] },
] }, { id: 'p2', title: 'Annexe', lv: 1, blocks: [] }, { id: 'p3', title: 'Vide', blocks: [{ id: 'smv', type: 'summary', title: 'Sommaire', src: 'sec', sort: 'doc' }] }] };
const office = (id, doc = DOC, opts) => { const r = monterOffice(doc, id, opts); verifierSocle(r.html, id); return r; };
// balises de liste ouvrantes, dans l'ordre : [balise, attribut type, list-style-type]
const listes = (html) => [...html.matchAll(/<(ul|ol)( type="([^"]*)")? style="([^"]*)"/g)].map((m) => [m[1], m[3], (m[4].match(/list-style-type:([\w-]+)/) || [])[1]]);

test('office (listes) : liste à puces, puce de chaque niveau comme dans Ardoise (disque, cercle, carré)', () => {
  const { html, texte } = office('ul');
  egal(listes(html), [['ul', 'disc', 'disc'], ['ul', 'circle', 'circle'], ['ul', 'square', 'square'], ['ul', 'square', 'square']], html);
  vrai(/<li[^>]*>un<ul[^>]*><li[^>]*>deux<ul[^>]*><li[^>]*>trois<ul[^>]*><li[^>]*>quatre<\/li><\/ul><\/li><\/ul><\/li><\/ul><\/li><li[^>]*>cinq<\/li><\/ul>/.test(html), 'imbrication : ' + html);
  egal(texte, '- un\n  - deux\n    - trois\n      - quatre\n- cinq', 'texte brut inchangé');
});

test('office (listes) : liste numérotée, 1 puis a puis i puis 1 comme dans Ardoise', () => {
  const { html, texte } = office('ol');
  egal(listes(html), [['ol', '1', 'decimal'], ['ol', 'a', 'lower-alpha'], ['ol', 'i', 'lower-roman'], ['ol', '1', 'decimal']], html);
  egal(texte, '1. un\n  1. deux\n    1. trois\n      1. quatre\n2. cinq', 'texte brut inchangé');
});

test('office (listes) : un niveau sauté descend d\'un cran seulement, comme à l\'écran', () => {
  const { html } = office('saut');
  egal(listes(html).length, 2, html);
  vrai(/<li[^>]*>haut<ul[^>]*><li[^>]*>trop bas<\/li><\/ul><\/li><\/ul>/.test(html), html);
});

test('office (listes) : liste à cocher en paragraphes (☑ accent, ☐ gris), cochées en gris, niveaux en retrait', () => {
  const { html, texte } = office('c');
  vrai(!/<[ou]l|<li/.test(html), 'aucune liste, aucun <li> à case : ' + html);
  const ps = [...html.matchAll(/<p style="([^"]*)">(.*?)<\/p>/g)];
  egal(ps.length, 4, html);
  egal(ps.map((m) => (m[1].match(/margin-left:([\d.]+pt)/) || [])[1] || '0'), ['0', '0', '19.5pt', '39pt'], 'retrait de 26 px par niveau (ul.check li.lv-N)');
  vrai(/^<span style="color:#4848c0">☑<\/span> <span style="color:#566573">fait <span style="background:#e3f3ea;color:#1f7a4d;[^"]*">OK<\/span><\/span>$/.test(ps[0][2]), 'cochée : case accent, libellé gris, pastille dans sa couleur : ' + ps[0][2]);
  egal(ps[1][2], '<span style="color:#566573">☐</span> à faire', 'non cochée : case grise, libellé normal');
  vrai(ps[3][2].startsWith('<span style="color:#4848c0">☑</span> <span style="color:#566573">plus bas'), ps[3][2]);
  egal(texte, '☑ fait #OK\n☐ à faire\n  ☐ dessous\n    ☑ plus bas', 'texte brut inchangé');
});

test('office (listes) : liste à cocher dans l\'ordre de l\'écran (cochées d\'abord), vide sans rien', () => {
  const { html, texte } = office('co');
  vrai(/☑<\/span> <span[^>]*>b<\/span><\/p><p[^>]*><span[^>]*>☐<\/span> a<\/p>/.test(html), html);
  egal(texte, '☑ b\n☐ a');
  vrai(/^<div[^>]*><\/div>$/.test(office('cv').html), office('cv').html);
});

test('office (listes) : sommaire dans un cadre bordé à trait d\'accent, titre en étiquette, numéros accent', () => {
  const { html, texte } = office('sm');
  vrai(/^<div[^>]*><table width="100%" style="[^"]*"><tr><td width="100%" style="[^"]*background:#ffffff;[^"]*border:1px solid #d9e0e5;[^"]*border-left:3px solid #4848c0[^"]*">/.test(html), 'cadre : ' + html);
  vrai(/<p style="[^"]*font-family:Consolas,monospace;[^"]*font-size:8\.25pt;[^"]*color:#566573;[^"]*">SOMMAIRE<\/p>/.test(html), 'titre en étiquette : ' + html);
  const ps = [...html.matchAll(/<p style="([^"]*)">(?!SOMMAIRE)(.*?)<\/p>/g)];
  egal(ps.length, 3, html);
  vrai(/^<span style="font-family:Consolas,monospace;font-size:9pt;font-weight:600;color:#4848c0">1<\/span>&nbsp;&nbsp;Isoler$/.test(ps[0][2]), 'numéro accent : ' + ps[0][2]);
  vrai(/margin-left:16\.5pt/.test(ps[1][1]) && /font-size:10\.5pt/.test(ps[1][1]) && ps[1][2] === 'Détail', 'sous-entrée en retrait, plus petite : ' + ps[1][0]);
  vrai(!/margin-left/.test(ps[2][1]) && ps[2][2] === 'Bilan', ps[2][0]);
  vrai(!/<[ou]l|<li|<u>|<a /.test(html), 'entrées en paragraphes, sans soulignement ni lien : ' + html);
  egal(texte, 'Sommaire\n- 1 Isoler\n  - Détail\n- Bilan', 'texte brut inchangé');
});

test('office (listes) : sommaire sans titre, de sous-pages, ou vide (phrase grise de l\'écran d\'édition)', () => {
  vrai(!/SOMMAIRE|Consolas,monospace;font-size:8\.25pt/.test(office('smt').html), office('smt').html);
  vrai(/>Annexe<\/p>/.test(office('smp').html) && !/Consolas,monospace;font-size:9pt/.test(office('smp').html), 'sous-pages sans numéro : ' + office('smp').html);
  const { ctx, d } = monter(DOC), vide = { html: ctx.officeHtmlBloc(d.pages[2].blocks[0], d, { page: 2 }) };
  verifierSocle(vide.html, 'smv');
  vrai(/<p style="[^"]*color:#566573[^"]*">Aucune section dans cette page : ajoutez des titres de section, des étapes ou des sous-sections\.<\/p>/.test(vide.html), vide.html);
});
