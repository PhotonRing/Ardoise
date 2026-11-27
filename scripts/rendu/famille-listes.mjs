// Famille listes et tableaux (src/js/06-bloc-listes.js) : l'ordre d'affichage d'une liste à cocher, le même à l'écran, dans les
// éléments neutres et dans Office (ordreCases). La sortie elle-même est prouvée par le relevé et par office-listes.mjs.
import { monter, test, egal } from './commun.mjs';

// cases imbriquées et mêlées : à chaque niveau, cochées avant ou après les autres, les sous-cases suivent leur parent
const CASES = [['a', 0, 0], ['a1', 1, 1], ['a2', 1, 0], ['b', 0, 1], ['c', 0, 0], ['c1', 1, 1]].map(([html, lv, done]) => ({ html, lv, done: !!done }));
const ORDRES = { manual: 'a a1 a2 b c c1', doneFirst: 'b a a1 a2 c c1', doneLast: 'a a2 a1 c c1 b' };
test('famille listes : ordre d\'affichage des cases inchangé à l\'écran, dans les éléments neutres et dans Office', () => {
  for (const order of Object.keys(ORDRES)) {
    const { ctx, d } = monter({ title: 'D', pages: [{ id: 'p', title: '', blocks: [{ id: 'c', type: 'check', order, items: CASES }] }] });
    const b = d.pages[0].blocks[0], attendu = ORDRES[order];
    for (const view of ['read', 'edit']) {
      const h = ctx.renderBlock(b, d, ctx.renderCtx(d, { page: 0, view }), null);
      egal([...h.matchAll(/data-k="items\.(\d)\.done"/g)].map((m) => CASES[m[1]].html).join(' '), attendu, order + ' à l\'écran (' + view + ')');
    }
    egal(ctx.officeBloc(b, d, { page: 0 })[0].items.map((it) => it.segs[0].texte).join(' '), attendu, order + ' en éléments neutres');
    egal([...ctx.officeHtmlBloc(b, d, { page: 0 }).matchAll(/<p [^>]*>.*?(?:☑|☐)<\/span> (?:<span[^>]*>)?(\w+)/g)].map((m) => m[1]).join(' '), attendu, order + ' dans Office');
  }
});
