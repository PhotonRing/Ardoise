// Bloc texte : module pur des lignes (05-lignes.js), normalisation et rendu en lecture.
import { readFileSync } from 'node:fs';
import { contexte, monter, test, egal, vrai } from './commun.mjs';

const TAB = '<span class="tab">\t</span>';
const lignes = (html, indent) => JSON.parse(JSON.stringify(contexte().lignesDuParagraphe(html, indent)));

test('paragraphe → lignes : un <br> par ligne, taquets en tête comptés en niveau', () => {
  egal(lignes('un<br>' + TAB + 'deux<br>' + TAB + TAB + TAB + 'trois'), [{ html: 'un' }, { html: 'deux', lv: 1 }, { html: 'trois', lv: 3 }]);
  egal(lignes(TAB + '​' + TAB + 'x'), [{ html: 'x', lv: 2 }], 'espace sans chasse entre deux taquets');
});

test('paragraphe → lignes : retrait du paragraphe ajouté, plafonné à 6', () => {
  egal(lignes('a<br>' + TAB + 'b', 2), [{ html: 'a', lv: 2 }, { html: 'b', lv: 3 }]);
  egal(lignes(TAB + TAB + 'c', 5), [{ html: 'c', lv: 6 }]);
});

test('paragraphe → lignes : une mise en forme sur deux lignes est refermée puis rouverte', () => {
  egal(lignes('a <b>gras<br>suite</b> fin'), [{ html: 'a <b>gras</b>' }, { html: '<b>suite</b> fin' }]);
  egal(lignes('<a href="#x"><i>un<br>deux</i></a>'), [{ html: '<a href="#x"><i>un</i></a>' }, { html: '<a href="#x"><i>deux</i></a>' }]);
  egal(lignes('<span class="c-vert">v<br></span>w'), [{ html: '<span class="c-vert">v</span>' }, { html: 'w' }], 'forme vide retirée');
});

test('paragraphe → lignes : taquet au milieu → espace ; paragraphe vide → une ligne vide', () => {
  egal(lignes('a' + TAB + 'b'), [{ html: 'a b' }]);
  egal(lignes(''), [{ html: '' }]);
  egal(lignes(undefined, 3), [{ html: '', lv: 3 }]);
  egal(lignes('a<br><br>b'), [{ html: 'a' }, { html: '' }, { html: 'b' }], 'ligne vide au milieu');
});

test('ancien paragraphe → bloc texte : même identifiant, html et indent retirés, autres clés gardées, déterministe', () => {
  const ctx = contexte(), b = () => ({ id: 'x1', type: 'p', html: 'un<br>' + TAB + '<b>deux<br>trois</b>', indent: 1, folded: true });
  const a = b(); ctx.paragrapheEnTexte(a);
  egal(JSON.parse(JSON.stringify(a)), { id: 'x1', type: 'texte', folded: true, lignes: [{ html: 'un', lv: 1 }, { html: '<b>deux</b>', lv: 2 }, { html: '<b>trois</b>', lv: 1 }] });
  const c = b(); ctx.paragrapheEnTexte(c);
  egal(JSON.stringify(c), JSON.stringify(a), 'deux conversions du même JSON');
  const v = { id: 'v', type: 'p' }; ctx.paragrapheEnTexte(v);
  egal(JSON.parse(JSON.stringify(v)), { id: 'v', type: 'texte', lignes: [{ html: '' }] }, 'paragraphe sans html');
  egal(JSON.parse(JSON.stringify(ctx.texteDuHtml('a<br>b'))), { type: 'texte', lignes: [{ html: 'a' }, { html: 'b' }] });
});

test('JSON au format courant qui contient encore un paragraphe : lu comme un bloc texte, dans un groupe aussi', () => {
  const d = contexte().normalize({ v: 8, id: 'd', pages: [{ id: 'a', blocks: [{ id: 'x', type: 'p', html: 'a<br>b' }, { id: 'g', type: 'group', blocks: [{ id: 'y', type: 'p', html: 'c' }] }] }] });
  const [x, g] = d.pages[0].blocks;
  egal([x.id, x.type, JSON.parse(JSON.stringify(x.lignes)), 'html' in x], ['x', 'texte', [{ html: 'a' }, { html: 'b' }], false]);
  egal([g.blocks[0].id, g.blocks[0].type, g.blocks[0].lignes[0].html], ['y', 'texte', 'c']);
});

test('normLignes : au moins une ligne, niveau borné, valeurs par défaut omises', () => {
  const n = (x) => JSON.parse(JSON.stringify(contexte().normLignes(x)));
  egal(n([]), [{ html: '' }]);
  egal(n(undefined), [{ html: '' }]);
  egal(n([{ html: 'a', lv: 9 }, null, { html: 'b', lv: 0 }, 'c']), [{ html: 'a', lv: 6 }, { html: 'b' }, { html: 'c' }]);
});

test('bloc texte à l\'ouverture : jamais sans ligne', () => {
  const { d } = monter({ title: 'Doc', pages: [{ id: 'p1', blocks: [{ id: 't1', type: 'texte' }, { id: 't2', type: 'texte', lignes: [] }] }] });
  egal(d.pages[0].blocks.map((b) => b.lignes), [[{ html: '' }], [{ html: '' }]]);
});

test('bloc texte en lecture et à l\'export : une ligne par élément, retrait par niveau, aucune commande', () => {
  const { ctx, d } = monter({ title: 'Doc', pages: [{ id: 'p1', blocks: [{ id: 't1', type: 'texte', lignes: [{ html: 'un' }, { html: 'deux', lv: 2 }, { html: '' }] }] }] });
  for (const view of ['read', 'export']) {
    const h = ctx.renderPage(d, { page: 0, view });
    vrai(/<div [^>]*class="texte">/.test(h), view + ' : bloc texte absent');
    egal([...h.matchAll(/<div class="lg"( data-lv="\d")?>([\s\S]*?)<\/div>/g)].map((x) => [x[1] || '', x[2]]), [['', 'un'], [' data-lv="2"', 'deux'], ['', '<br>']], view);
    vrai(!/contenteditable|data-k="lignes"/.test(h), view + ' : commande d\'édition');
  }
});

test('bloc texte en édition : un seul champ, une ligne par élément', () => {
  const { ctx, d } = monter({ title: 'Doc', pages: [{ id: 'p1', blocks: [{ id: 't1', type: 'texte', lignes: [{ html: 'un' }, { html: 'deux', lv: 1 }] }] }] });
  const h = ctx.renderPage(d, { page: 0, view: 'edit' });
  egal((h.match(/data-k="lignes"/g) || []).length, 1, 'un champ');
  vrai(/<div class="lg">un<\/div><div class="lg" data-lv="1">deux<\/div>/.test(h), 'lignes du champ');
});

// Collage et copie (ticket 03) : HTML et texte brut → lignes de texte ; lignes → texte brut et HTML de copie
const brut = (fn, ...a) => JSON.parse(JSON.stringify(contexte()[fn](...a)));

test('collage HTML → lignes : <p>, <div> et <br> donnent des lignes de texte', () => {
  egal(brut('lignesDuCollage', '<p>un</p><p>deux</p>'), [{ html: 'un' }, { html: 'deux' }]);
  egal(brut('lignesDuCollage', '<div>un</div><div><div>deux</div></div>trois'), [{ html: 'un' }, { html: 'deux' }, { html: 'trois' }]);
  egal(brut('lignesDuCollage', 'un<br>deux<br><br>quatre'), [{ html: 'un' }, { html: 'deux' }, { html: '' }, { html: 'quatre' }]);
  egal(brut('lignesDuCollage', '<p>a<br>b</p><p>c</p>'), [{ html: 'a' }, { html: 'b' }, { html: 'c' }]);
  egal(brut('lignesDuCollage', 'seul <b>mot</b>'), [{ html: 'seul <b>mot</b>' }], 'une ligne');
});

test('collage HTML → lignes : paragraphe vide explicite gardé, blancs de mise en page ignorés', () => {
  egal(brut('lignesDuCollage', '<p>a</p>\n<p></p>\n<p>&nbsp;</p>\n<p>b</p>'), [{ html: 'a' }, { html: '' }, { html: '' }, { html: 'b' }]);
  egal(brut('lignesDuCollage', '<ul>\n  <li>\n    un\n    deux\n  </li>\n  <li>trois</li>\n</ul>'), [{ html: 'un deux', genre: 'puce' }, { html: 'trois', genre: 'puce' }]);
  egal(brut('lignesDuCollage', '<p>a<br></p><p>b</p>'), [{ html: 'a' }, { html: 'b' }], '<br> final d\'un paragraphe');
});

test('collage HTML → lignes : une forme sur deux paragraphes est refermée puis rouverte', () => {
  egal(brut('lignesDuCollage', '<b><p>un</p><p>deux</p></b>'), [{ html: '<b>un</b>' }, { html: '<b>deux</b>' }]);
  egal(brut('lignesDuCollage', '<p>a <i>b<br>c</i> d</p>'), [{ html: 'a <i>b</i>' }, { html: '<i>c</i> d' }]);
});

test('collage HTML → lignes : enveloppe du presse-papier, commentaires, styles et balises vides ignorés', () => {
  egal(brut('lignesDuCollage', '<html><head><style>p{color:red}</style><title>t</title></head><body><!--StartFragment--><p>a</p><img src="x.png"><p>b</p><!--EndFragment--></body></html>'),
    [{ html: 'a' }, { html: '<img src="x.png">' }, { html: 'b' }]);
  egal(brut('lignesDuCollage', '<meta charset="utf-8"><p>a<wbr>b</p>'), [{ html: 'a<wbr>b' }]);
});

test('collage HTML → lignes : le niveau d\'une ligne copiée d\'Ardoise (data-lv) est repris', () => {
  egal(brut('lignesDuCollage', '<p>a</p><p data-lv="2" style="margin-left:4em">b</p><div class="lg" data-lv="9">c</div>'), [{ html: 'a' }, { html: 'b', lv: 2 }, { html: 'c', lv: 6 }]);
});

test('collage de texte brut : une ligne de texte par saut de ligne, jamais de genre ni de niveau', () => {
  egal(brut('lignesDuTexteBrut', 'un\r\n- deux\n    trois <x> & co\n'), [{ html: 'un' }, { html: '- deux' }, { html: '    trois &lt;x&gt; &amp; co' }]);
  egal(brut('lignesDuTexteBrut', 'seul'), [{ html: 'seul' }]);
  egal(brut('lignesDuTexteBrut', 'a\r\rb'), [{ html: 'a' }, { html: '' }, { html: 'b' }]);
});

test('copie : texte brut à deux espaces par niveau, pastilles en #nom, ligne vide gardée', () => {
  egal(contexte().lignesEnTexte([{ html: 'a <b>gras</b>' }, { html: 'b <span class="pill">OK</span>', lv: 2 }, { html: '' }, { html: 'c &amp; d', lv: 1 }]), 'a gras\n    b #OK\n\n  c & d');
});

test('copie : HTML en un <p> par ligne, niveau en data-lv et en marge, pastilles marquées du document', () => {
  egal(contexte().lignesEnHtml([{ html: 'a' }, { html: '<span class="pill pa-2">OK</span>', lv: 2 }, { html: '' }], 'd1'),
    '<p>a</p><p data-lv="2" style="margin-left:4em"><span class="pill" data-ad="d1">OK</span></p><p><br></p>');
});

test('copie puis collage d\'Ardoise à Ardoise : mêmes lignes et mêmes niveaux', () => {
  const ls = [{ html: 'un <b>gras</b>' }, { html: 'deux', lv: 1 }, { html: '' }, { html: 'trois', lv: 3 }];
  egal(brut('lignesDuCollage', contexte().lignesEnHtml(ls, 'd1')), ls);
});

// Genres de ligne (ticket 05) : numérotation, raccourcis, normalisation
const N = (lv) => (lv ? { html: 'n', genre: 'numero', lv } : { html: 'n', genre: 'numero' });
const numeros = (ls) => brut('numerosDesLignes', ls);

test('numérotation : la suite continue malgré des lignes plus profondes intercalées', () => {
  egal(numeros([N(), { html: 'p', genre: 'puce', lv: 1 }, { html: 't', lv: 1 }, N(), N()]), [1, null, null, 2, 3]);
  egal(numeros([N(), N(1), N(1), N(), N(1)]), [1, 1, 2, 2, 1], 'chaque niveau a sa suite ; un numéro moins profond fait repartir la suite plus profonde');
});

test('numérotation : reprise à 1 après une ligne d\'un autre genre au même niveau, ou moins profonde', () => {
  egal(numeros([N(), N(), { html: 't' }, N()]), [1, 2, null, 1], 'ligne de texte');
  egal(numeros([N(), { html: 'p', genre: 'puce' }, N()]), [1, null, 1], 'puce');
  egal(numeros([N(1), N(1), { html: 't' }, N(1)]), [1, 2, null, 1], 'ligne moins profonde, quel que soit son genre');
  egal(numeros([N(1), N(1), { html: 's', genre: 'soustitre' }, N(1)]), [1, 2, null, 1]);
});

test('raccourcis : genre et texte restant', () => {
  const r = (h) => brut('raccourciDeLigne', h);
  egal(r('- '), { genre: 'puce', html: '' });
  egal(r('* suite'), { genre: 'puce', html: 'suite' });
  egal(r('1.&nbsp;un'), { genre: 'numero', html: 'un' });
  egal(r('42. <b>gras</b>'), { genre: 'numero', html: '<b>gras</b>' });
  egal(r('[] x'), { genre: 'case', html: 'x' });
  egal(r('[ ] x'), { genre: 'case', html: 'x' });
  egal(r('## Titre'), { genre: 'soustitre', html: 'Titre' });
  for (const h of ['-x', ' - x', '<b>- </b>', '3 x', '[x] x', '# x', '', '--']) egal(r(h), null, h);
});

test('lignes enregistrées : genre et coche gardés seulement s\'ils ont un sens', () => {
  const n = (a) => brut('normLignes', a);
  egal(n([{ html: 'a', genre: 'puce' }, { html: 'b', genre: 'case', done: true }, { html: 'c', genre: 'numero', lv: 2 }, { html: 'd', genre: 'soustitre' }]),
    [{ html: 'a', genre: 'puce' }, { html: 'b', genre: 'case', done: true }, { html: 'c', genre: 'numero', lv: 2 }, { html: 'd', genre: 'soustitre' }]);
  egal(n([{ html: 'a', genre: 'titre' }, { html: 'b', genre: 'puce', done: true }, { html: 'c', genre: 'case', done: false }, { html: 'd', genre: 'soustitre', taille: 'grand' }]),
    [{ html: 'a' }, { html: 'b', genre: 'puce' }, { html: 'c', genre: 'case' }, { html: 'd', genre: 'soustitre' }]);
});

test('bloc texte en lecture : genre, numéro calculé et coche sur chaque ligne', () => {
  const { ctx, d } = monter({ title: 'Doc', pages: [{ id: 'p1', blocks: [{ id: 't1', type: 'texte', lignes: [
    { html: 'a', genre: 'numero' }, { html: 'b', genre: 'puce', lv: 1 }, { html: 'c', genre: 'numero' }, { html: 'd', genre: 'case', done: true }, { html: 'e', genre: 'case' }, { html: 'f', genre: 'soustitre' }] }] }] });
  for (const view of ['read', 'export', 'edit']) {
    const h = ctx.renderPage(d, { page: 0, view });
    egal([...h.matchAll(/<div class="lg"([^>]*)>([^<]*)<\/div>/g)].map((x) => x[1].trim() + '|' + x[2]),
      ['data-g="numero" data-n="1"|a', 'data-lv="1" data-g="puce"|b', 'data-g="numero" data-n="2"|c', 'data-g="case" data-done|d', 'data-g="case"|e', 'data-g="soustitre"|f'], view);
  }
  vrai(/data-tx="t1"/.test(ctx.renderPage(d, { page: 0, view: 'export' })), 'repère des cases de l\'export statique');
});

test('lignes enregistrées : alignement et taille gardés seulement hors valeurs par défaut', () => {
  const n = (a) => brut('normLignes', a);
  egal(n([{ html: 'a', align: 'centre' }, { html: 'b', align: 'droite', taille: 'petit' }, { html: 'c', align: 'justifie', taille: 'grand', genre: 'puce' }]),
    [{ html: 'a', align: 'centre' }, { html: 'b', align: 'droite', taille: 'petit' }, { html: 'c', align: 'justifie', taille: 'grand', genre: 'puce' }]);
  egal(n([{ html: 'a', align: 'gauche', taille: 'normal' }, { html: 'b', align: 'center', taille: 3 }, { html: 'c', align: 'centre', taille: 'grand', genre: 'soustitre' }]),
    [{ html: 'a' }, { html: 'b' }, { html: 'c', align: 'centre', genre: 'soustitre' }]);
});

test('bloc texte en lecture : alignement et taille sur chaque ligne', () => {
  const { ctx, d } = monter({ title: 'Doc', pages: [{ id: 'p1', blocks: [{ id: 't1', type: 'texte', lignes: [
    { html: 'a', align: 'centre', taille: 'grand' }, { html: 'b', genre: 'puce', align: 'droite', taille: 'petit' }, { html: 'c', align: 'justifie' }, { html: 'd' }] }] }] });
  for (const view of ['read', 'export', 'edit']) {
    const h = ctx.renderPage(d, { page: 0, view });
    egal([...h.matchAll(/<div class="lg"([^>]*)>([^<]*)<\/div>/g)].map((x) => x[1].trim() + '|' + x[2]),
      ['data-align="centre" data-taille="grand"|a', 'data-g="puce" data-align="droite" data-taille="petit"|b', 'data-align="justifie"|c', '|d'], view);
  }
});

// ---------- Cochées à la fin (menu contextuel d'une case) ----------
const C = (html, done, lv) => { const o = { html, genre: 'case' }; if (done) o.done = true; if (lv) o.lv = lv; return o; };
const ranger = (ls, i) => JSON.parse(JSON.stringify(contexte().casesALaFin(ls, i))).map((l) => l.html);

test('cochées à la fin : cochées après les non cochées, ordre relatif gardé', () => {
  egal(ranger([C('a', true), C('b'), C('c', true), C('d')], 0), ['b', 'd', 'a', 'c']);
  egal(ranger([C('a', true), C('b'), C('c', true), C('d')], 3), ['b', 'd', 'a', 'c'], 'depuis n\'importe quelle case de la suite');
});

test('cochées à la fin : les lignes plus profondes suivent leur case et ne sont pas rangées', () => {
  const ls = [C('a', true), { html: 'a1', lv: 1 }, C('a2', false, 1), C('a3', true, 1), C('b'), { html: 'b1', genre: 'puce', lv: 2 }];
  egal(ranger(ls, 4), ['b', 'b1', 'a', 'a1', 'a2', 'a3']);
});

test('cochées à la fin : les lignes hors de la suite ne bougent pas', () => {
  const ls = [{ html: 't' }, { html: 't1', lv: 1 }, C('a', true), C('b'), { html: 'milieu' }, C('c', true), C('d'), C('x', true, 1), C('y', false, 1)];
  egal(ranger(ls, 3), ['t', 't1', 'b', 'a', 'milieu', 'c', 'd', 'x', 'y'], 'suite bornée par une ligne de texte du même niveau');
  egal(ranger(ls, 7), ['t', 't1', 'a', 'b', 'milieu', 'c', 'd', 'y', 'x'], 'suite plus profonde, bornée par sa case parente');
  egal(ranger([C('a', true), { html: 'p', genre: 'puce' }, C('b', true), C('c')], 2), ['a', 'p', 'c', 'b'], 'une puce du même niveau borne aussi');
});

test('cochées à la fin : suite déjà rangée ou ligne qui n\'est pas une case → même ordre, mêmes objets', () => {
  const ctx = contexte(), ls = [C('a'), C('b', true), { html: 't' }];
  const r = ctx.casesALaFin(ls, 0);
  vrai(r !== ls && r.every((l, k) => l === ls[k]), 'nouveau tableau des mêmes lignes');
  egal(ctx.casesALaFin(ls, 2).map((l) => l.html), ['a', 'b', 't']);
});

// ---------- Convertir en texte (menu ⋯ d'une Liste, d'une Liste à cocher ou d'un Sous-titre) ----------
const convertir = (b) => JSON.parse(JSON.stringify(contexte().blocEnTexte(b)));

test('convertir en texte : liste à puces → puces, liste numérotée → numéros, niveaux gardés', () => {
  egal(convertir({ id: 'l1', type: 'list', ordered: false, items: [{ html: 'a' }, { html: '<b>b</b>', lv: 1 }] }),
    { id: 'l1', type: 'texte', lignes: [{ html: 'a', genre: 'puce' }, { html: '<b>b</b>', lv: 1, genre: 'puce' }] });
  egal(convertir({ id: 'l2', type: 'list', ordered: true, items: [{ html: 'un' }, { html: 'deux', lv: 2 }] }).lignes,
    [{ html: 'un', genre: 'numero' }, { html: 'deux', lv: 2, genre: 'numero' }]);
});

test('convertir en texte : liste à cocher → cases avec coches, ordre saisi gardé même réglée « cochées à la fin »', () => {
  const b = { id: 'c1', type: 'check', order: 'doneLast', items: [{ html: 'fait', done: true }, { html: 'sous', done: false, lv: 1 }, { html: 'à faire', done: false }] };
  egal(convertir(b), { id: 'c1', type: 'texte', lignes: [{ html: 'fait', genre: 'case', done: true }, { html: 'sous', lv: 1, genre: 'case' }, { html: 'à faire', genre: 'case' }] });
  egal(convertir({ id: 'c2', type: 'check', items: [] }).lignes, [{ html: '' }], 'liste vide : une ligne vide');
});

test('convertir en texte : sous-titre → une ligne de sous-titre', () => {
  egal(convertir({ id: 's1', type: 'subtitle', html: 'Mon <i>titre</i>' }), { id: 's1', type: 'texte', lignes: [{ html: 'Mon <i>titre</i>', genre: 'soustitre' }] });
});

// Collage et copie des genres (ticket 07)
const P = (html, lv) => (lv ? { html, lv, genre: 'puce' } : { html, genre: 'puce' });
const NU = (html, lv) => (lv ? { html, lv, genre: 'numero' } : { html, genre: 'numero' });
const fixture = (f) => readFileSync(new URL('../fixtures/presse-papier/' + f, import.meta.url), 'utf8');

test('collage HTML → lignes : listes imbriquées en puces et numéros, un niveau par profondeur', () => {
  egal(brut('lignesDuCollage', '<ul><li>a<ul><li>b<ol><li>c</li><li>d</li></ol></li></ul></li><li>e</li></ul><p>f</p>'),
    [P('a'), P('b', 1), NU('c', 2), NU('d', 2), P('e'), { html: 'f' }]);
  egal(brut('lignesDuCollage', '<ol><li><p>un</p></li><li><p>deux</p></li></ol>'), [NU('un'), NU('deux')], '<p> dans un <li> : une seule ligne');
  egal(brut('lignesDuCollage', '<ul><li>a</li></ul><ul><li></li></ul>'), [P('a'), P('')], '<li> vide : une puce vide');
});

test('collage HTML → lignes : vraie copie de Writer (listes sans <li> parent, une liste par genre)', () => {
  egal(brut('lignesDuCollage', fixture('writer-liste/presse.html')),
    [P('Puce niv1'), NU('numéro niv2', 1), NU('numéro niv2', 1), P('puce niv1'), NU('numéro niv1'), P('puce niv2', 1), P('puce niv3', 2)]);
});

test('collage HTML → lignes : aria-level de Google Docs donne le niveau', () => {
  egal(brut('lignesDuCollage', '<ul><li aria-level="1"><p><span>a</span></p></li><li aria-level="3"><p><span>b</span></p></li></ul>'),
    [P('<span>a</span>'), P('<span>b</span>', 2)]);
});

const CA = (html, done, lv) => { const o = lv ? { html, lv, genre: 'case' } : { html, genre: 'case' }; if (done) o.done = true; return o; };
test('collage HTML → lignes : cases par case à cocher (liste de tâches GitHub) ou par ☐/☑ en tête', () => {
  egal(brut('lignesDuCollage', '<ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" class="task-list-item-checkbox" disabled> a</li><li><input type="checkbox" disabled checked=""> b<ul><li><input type="checkbox"> c</li></ul></li></ul>'),
    [CA('a'), CA('b', true), CA('c', false, 1)]);
  egal(brut('lignesDuCollage', '<p>☐ a</p><p><b>☑&nbsp;b</b></p><p style="margin-left:2em">☐</p><p>x ☐ y</p>'),
    [CA('a'), CA('<b>b</b>', true), CA(''), { html: 'x ☐ y' }], 'marque en tête seulement, retirée avec son espace');
});

// extrait RECONSTITUÉ d'après le HTML de Word documenté (pas d'Office chez le propriétaire : à vérifier au travail)
test('collage HTML → lignes : listes de Word (mso-list), symbole écarté, niveau par level', () => {
  const word = "<html xmlns:o='urn:schemas-microsoft-com:office:office'><body><!--StartFragment-->" +
    "<p class=MsoListParagraphCxSpFirst style='text-indent:-18.0pt;mso-list:l0 level1 lfo1'><![if !supportLists]><span style='font-family:Symbol'>·<span style='font:7.0pt \"Times New Roman\"'>&nbsp;&nbsp;&nbsp; </span></span><![endif]>un<o:p></o:p></p>" +
    "<p class=MsoListParagraphCxSpMiddle style='mso-list:l0 level2 lfo1'><![if !supportLists]><span style='font-family:\"Courier New\"'>o<span>&nbsp; </span></span><![endif]>deux<o:p></o:p></p>" +
    "<p class=MsoListParagraphCxSpLast style='mso-list:l1 level3 lfo2'><!--[if !supportLists]--><span>1.<span>&nbsp; </span></span><!--[endif]-->trois<o:p></o:p></p>" +
    "<p class=MsoNormal>quatre<o:p></o:p></p><!--EndFragment--></body></html>";
  egal(brut('lignesDuCollage', word), [P('un'), P('deux', 1), NU('trois', 2), { html: 'quatre' }]);
});

test('collage HTML → lignes : sous-titre et coche d\'une copie d\'Ardoise ; titre venu d\'ailleurs resté du texte', () => {
  egal(brut('lignesDuCollage', '<h3 data-g="soustitre">S</h3><h1>T</h1><h3>U</h3><div class="lg" data-g="case" data-done data-lv="1">c</div>'),
    [{ html: 'S', genre: 'soustitre' }, { html: 'T' }, { html: 'U' }, CA('c', true, 1)]);
});

test('collage de texte brut : « - a », « ☐ a », « 1. a » restent du texte', () => {
  egal(brut('lignesDuTexteBrut', '- a\n☐ b\n1. c'), [{ html: '- a' }, { html: '☐ b' }, { html: '1. c' }]);
});

const MELEES = [{ html: 'intro' }, P('p0'), P('p1', 1), NU('n1', 1), NU('n2', 1), CA('à faire'), CA('<b>fait</b>', true, 1), { html: 'Sous', genre: 'soustitre' }, { html: 'fin' }];
test('copie : texte brut avec « - », « N. » (numéros affichés), « ☐ » et « ☑ »', () => {
  egal(contexte().lignesEnTexte(MELEES), 'intro\n- p0\n  - p1\n  1. n1\n  2. n2\n☐ à faire\n  ☑ fait\nSous\nfin');
  egal(contexte().lignesEnTexte([NU('c'), NU('d')], [3, 4]), '3. c\n4. d', 'numéros affichés dans le bloc d\'origine');
});

test('copie : HTML en listes imbriquées, cases en <p>, sous-titre en <h3>', () => {
  egal(contexte().lignesEnHtml(MELEES, 'd1'),
    '<p>intro</p><ul><li>p0<ul><li>p1</li></ul><ol><li>n1</li><li>n2</li></ol></li></ul>' +
    '<p data-g="case">☐ à faire</p><p data-g="case" data-done data-lv="1" style="margin-left:2em">☑ <b>fait</b></p><h3 data-g="soustitre">Sous</h3><p>fin</p>');
  egal(contexte().lignesEnHtml([NU('c', 2), NU('d', 2), P('e')], 'd1', [3, 4, null]),
    '<ol data-lv="2" style="margin-left:4em" start="3"><li>c</li><li>d</li></ol><ul><li>e</li></ul>', 'liste commencée au niveau 2, numéros affichés');
  egal(contexte().lignesEnHtml([P('')], 'd1'), '<ul><li><br></li></ul>');
});

test('copie puis collage d\'Ardoise à Ardoise : genres, niveaux et coches gardés', () => {
  egal(brut('lignesDuCollage', contexte().lignesEnHtml(MELEES, 'd1')), MELEES);
  const ls = [NU('c', 2), P('x', 4), NU('d', 2), CA('', true), { html: '', genre: 'soustitre' }, P('')];
  egal(brut('lignesDuCollage', contexte().lignesEnHtml(ls, 'd1')), ls);
});

test('copie : une formule d\'une ligne part en MathML annoté (HTML) et en $source$ (texte brut)', () => {
  const ls = [{ html: 'Aire <span class="formule">\\pi r^2</span>' }];
  const h = contexte().lignesEnHtml(ls, 'd1');
  egal(/<math>[\s\S]*<annotation encoding="application\/x-tex">\\pi r\^2<\/annotation>/.test(h), true, h);
  egal(contexte().lignesEnTexte(ls), 'Aire $\\pi r^2$');
});
