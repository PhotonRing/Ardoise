// Filtre des lignes : correspondance d'une ligne (sans casse ni accents, pastilles comprises) et lignes affichées
// (une ligne ajoutée ou gardée pendant un filtre reste visible). Le filtre n'entre jamais dans le rendu en chaîne.
import { contexte, monter, test, egal, vrai } from './commun.mjs';

const ctx = contexte();

test('ligneCorrespond : sans casse ni accents', () => {
  vrai(ctx.ligneCorrespond(['Priorité', 'x'], 'PRIO'), 'PRIO doit trouver Priorité');
  vrai(ctx.ligneCorrespond(['Été'], 'ete'), 'ete doit trouver Été');
  vrai(ctx.ligneCorrespond(['ete'], 'Été'), 'Été doit trouver ete');
  vrai(!ctx.ligneCorrespond(['Hiver', 'Automne'], 'ete'), 'ete ne doit pas trouver Hiver ni Automne');
});

test('ligneCorrespond : le texte des pastilles compte', () => {
  vrai(ctx.ligneCorrespond(['Tâche <span class="pill">Urgent</span>'], 'urg'), 'urg doit trouver la pastille Urgent');
  vrai(!ctx.ligneCorrespond(['<span class="pill">Urgent</span>'], 'pill'), 'le nom de classe ne compte pas');
});

test('ligneCorrespond : terme vide, ligne vide, entités', () => {
  vrai(ctx.ligneCorrespond([], ''), 'terme vide : tout correspond');
  vrai(ctx.ligneCorrespond(['a'], '   '), 'terme blanc : tout correspond');
  vrai(!ctx.ligneCorrespond([], 'a'), 'aucune cellule : rien ne correspond');
  vrai(!ctx.ligneCorrespond(['', ''], 'a'), 'cellules vides : rien ne correspond');
  vrai(ctx.ligneCorrespond(['Pierre &amp; Paul'], '& p'), 'entité décodée');
  vrai(ctx.ligneCorrespond(['un  deux'], 'un deux'), 'espaces réduits');
});

test('lignesAffichees : correspondance, ligne ajoutée depuis le terme, ligne gardée', () => {
  const a = ['Alpha'], b = ['Bravo'], c = ['Charlie'], neuve = ['', ''];
  egal(ctx.lignesAffichees([a, b, c], 'al', [a, b, c], []), [true, false, false], 'filtre simple');
  egal(ctx.lignesAffichees([a, neuve, b], 'al', [a, b], []), [true, true, false], 'ligne ajoutée après le terme : affichée');
  egal(ctx.lignesAffichees([a, b, c], 'al', [a, b, c], [c]), [true, false, true], 'ligne gardée : affichée');
  egal(ctx.lignesAffichees([a, b], '', [a], []), [true, true], 'terme vide : tout');
});

test('le filtre de session n\'entre pas dans le rendu en chaîne (lecture, édition, export)', () => {
  const D = { title: 'Doc', pages: [{ id: 'p1', blocks: [
    { id: 't1', type: 'table', rows: [['A'], ['Alpha'], ['Bravo']] },
    { id: 'f1', type: 'facts', items: [{ k: 'Nom', v: 'Alpha' }] },
    { id: 'q1', type: 'query', src: 'facts', scope: 'doc', view: 'table' }] }] };
  const sans = monter(D), avec = monter(D);
  avec.ctx.viewFiltre.t1 = 'zzz'; avec.ctx.viewFiltre.q1 = 'zzz';
  for (const view of ['read', 'edit', 'export']) egal(avec.ctx.renderPage(avec.d, { page: 0, view }), sans.ctx.renderPage(sans.d, { page: 0, view }), view);
});
