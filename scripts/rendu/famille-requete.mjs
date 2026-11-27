// Famille requête et kanban (src/js/06-bloc-requete.js) : chaque type porte toutes ses facettes (plus aucun ancien aiguillage :
// completude.mjs). La sortie elle-même est prouvée par le relevé et par office-requetes.mjs,
// kanban.mjs, kanban-requete.mjs, cartes-nombre.mjs.
import { contexte, test, egal } from './commun.mjs';
import { manquesDe } from './completude.mjs';

const TYPES = ['query', 'kanban'];

test('famille requête : aucune facette ne manque à la requête ni au kanban', () => {
  const ctx = contexte();
  const r = TYPES.map((t) => { const m = manquesDe(t, ctx.T[t]); return [t, m.erreurs.concat(m.manques)]; });
  egal(r, TYPES.map((t) => [t, []]), 'manques par type');
});
