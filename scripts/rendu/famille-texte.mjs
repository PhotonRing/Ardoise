// Famille texte et titres (src/js/06-bloc-texte.js) : chaque type porte toutes ses facettes, sans repli sur un ancien case
// ni sur OFFICE_RENDUS (09-office-texte.js). La sortie elle-même est prouvée par le relevé et par office-texte.mjs, bloc-texte.mjs.
import { contexte, test, egal } from './commun.mjs';
import { manquesDe } from './completude.mjs';

const TYPES = ['header', 'h2', 'h3', 'subtitle', 'step', 'texte', 'footer'];

test('famille texte : aucune facette ne manque à ses sept types', () => {
  const ctx = contexte();
  const r = TYPES.map((t) => { const m = manquesDe(t, ctx.T[t]); return [t, m.erreurs.concat(m.manques)]; });
  egal(r, TYPES.map((t) => [t, []]), 'manques par type');
});

test('famille texte : plus aucun ancien rendu Office dans OFFICE_RENDUS', () => {
  const ctx = contexte();
  egal(TYPES.filter((t) => ctx.OFFICE_RENDUS[t]), [], 'types encore dans OFFICE_RENDUS');
});
