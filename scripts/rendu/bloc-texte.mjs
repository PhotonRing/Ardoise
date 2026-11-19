// Bloc texte : module pur des lignes (05-lignes.js), normalisation et rendu en lecture.
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
  egal(brut('lignesDuCollage', '<ul>\n  <li>\n    un\n    deux\n  </li>\n  <li>trois</li>\n</ul>'), [{ html: 'un deux' }, { html: 'trois' }]);
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
