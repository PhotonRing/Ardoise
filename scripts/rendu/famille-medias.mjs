// Famille médias (src/js/06-bloc-medias.js) : image, bloc de code, formule et séparateur portent toutes leurs facettes,
// et leur ancien rendu Office (09-office-texte.js et 09-office-tableaux.js, supprimés) est fondu dans la famille.
// La sortie elle-même est prouvée par le relevé et par office-texte.mjs, office-tableaux.mjs, bloc-formule.mjs.
import { existsSync } from 'node:fs';
import { contexte, test, egal } from './commun.mjs';
import { manquesDe } from './completude.mjs';

const TYPES = ['image', 'code', 'formule', 'divider'];

test('famille médias : aucune facette ne manque à ses quatre types', () => {
  const ctx = contexte();
  const r = TYPES.map((t) => { const m = manquesDe(t, ctx.T[t]); return [t, m.erreurs.concat(m.manques)]; });
  egal(r, TYPES.map((t) => [t, []]), 'manques par type');
});

test('famille médias : 09-office-texte.js et 09-office-tableaux.js supprimés', () => {
  for (const f of ['09-office-texte.js', '09-office-tableaux.js'])
    egal(existsSync(new URL('../../src/js/' + f, import.meta.url)), false, f + ' existe encore');
});
