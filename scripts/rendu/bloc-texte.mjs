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
