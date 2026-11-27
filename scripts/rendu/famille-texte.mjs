// Famille texte et titres (src/js/06-bloc-texte.js) : chaque type porte toutes ses facettes (plus aucun ancien aiguillage :
// completude.mjs). La sortie elle-même est prouvée par le relevé et par office-texte.mjs, bloc-texte.mjs.
import { contexte, test, egal } from './commun.mjs';
import { manquesDe } from './completude.mjs';

const TYPES = ['header', 'h2', 'h3', 'subtitle', 'step', 'texte', 'footer'];

test('famille texte : aucune facette ne manque à ses sept types', () => {
  const ctx = contexte();
  const r = TYPES.map((t) => { const m = manquesDe(t, ctx.T[t]); return [t, m.erreurs.concat(m.manques)]; });
  egal(r, TYPES.map((t) => [t, []]), 'manques par type');
});
