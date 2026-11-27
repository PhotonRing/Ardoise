// Famille requête et kanban (src/js/06-bloc-requete.js) : chaque type porte toutes ses facettes, sans repli sur un ancien case
// ni sur OFFICE_RENDUS (ancien 09-office-requetes.js). La sortie elle-même est prouvée par le relevé et par office-requetes.mjs,
// kanban.mjs, kanban-requete.mjs, cartes-nombre.mjs.
import { contexte, test, egal } from './commun.mjs';
import { manquesDe } from './completude.mjs';

const TYPES = ['query', 'kanban'];

test('famille requête : aucune facette ne manque à la requête ni au kanban', () => {
  const ctx = contexte();
  const r = TYPES.map((t) => { const m = manquesDe(t, ctx.T[t]); return [t, m.erreurs.concat(m.manques)]; });
  egal(r, TYPES.map((t) => [t, []]), 'manques par type');
});

test('famille requête : plus aucun ancien rendu Office dans OFFICE_RENDUS', () => {
  const ctx = contexte();
  egal(TYPES.filter((t) => ctx.OFFICE_RENDUS[t]), [], 'types encore dans OFFICE_RENDUS');
});
