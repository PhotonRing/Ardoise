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
