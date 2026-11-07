// Cellule vide : la règle de page.css (.tablewrap td:empty::after) lui donne la hauteur d'une ligne ; le banc n'a pas de
// mise en page, il vérifie donc que la règle existe et que le rendu produit bien des cellules vides (sans espace) sous .tablewrap.
import { readFileSync } from 'node:fs';
import { monter, test, vrai } from './commun.mjs';

const css = readFileSync(new URL('../../src/css/page.css', import.meta.url), 'utf8');
const TABLEAU = { title: 'Doc', pages: [{ id: 'p1', blocks: [{ id: 't1', type: 'table', rows: [['A', 'B'], ['x', ''], ['', '']] }] }] };
// deux fiches de faits, la seconde sans la colonne « Âge » : sa cellule de résultat est vide
const REQUETE = { title: 'Doc', pages: [{ id: 'p1', blocks: [
  { id: 'f1', type: 'facts', items: [{ k: 'Nom', v: 'Alpha' }, { k: 'Âge', v: '3' }] },
  { id: 'f2', type: 'facts', items: [{ k: 'Nom', v: 'Bravo' }] },
  { id: 'q1', type: 'query', src: 'facts', scope: 'doc', view: 'table' }] }] };
const tableau = (h) => (h.match(/<div[^>]* class="tablewrap">[\s\S]*?<\/table>/) || [''])[0];

test('page.css donne à une cellule vide de tableau la hauteur d\'une ligne', () => {
  vrai(/\.tablewrap td:empty::after,\s*\.tablewrap th:empty::after\{content:"\\200b"\}/.test(css), 'règle .tablewrap td:empty::after absente de page.css');
});

test('bloc tableau : une cellule vide sort sans contenu sous .tablewrap, en lecture, export et édition', () => {
  const { ctx, d } = monter(TABLEAU);
  for (const view of ['read', 'export']) vrai(/<td><\/td>/.test(tableau(ctx.renderPage(d, { page: 0, view }))), view + ' : <td></td> attendu');
  vrai(/<td class="fld"[^>]*><\/td>/.test(tableau(ctx.renderPage(d, { page: 0, view: 'edit' }))), 'édition : cellule éditable vide attendue');
});

test('requête en vue tableau : la colonne absente d\'un enregistrement donne une cellule vide sous .tablewrap', () => {
  const { ctx, d } = monter(REQUETE);
  for (const view of ['read', 'export', 'edit']) vrai(/<td><\/td>/.test(tableau(ctx.renderPage(d, { page: 0, view }))), view + ' : <td></td> attendu');
});
