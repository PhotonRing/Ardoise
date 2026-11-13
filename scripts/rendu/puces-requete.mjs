// Ligne de puces du bloc requête (spec requetes-avancees, ticket 03) : libellés des puces (fonction pure qPuces),
// filtres proposés par « + Filtre » selon la source, ligne rendue en édition seulement (ni en lecture ni à l'export).
import { monter, test, egal, vrai } from './commun.mjs';

const TABLEAU = { id: 't1', type: 'table', rows: [['Réf', 'Incident', 'Échéance'], ['1', 'Panne <span class="pill">urgent</span>', '12/03/2026'], ['2', '<span class="pill">client</span>', '']] };
const KB = { id: 'kb', type: 'kanban', cols: [
  { id: 'c1', title: 'En cours', cards: [{ id: 'k1', title: 'Écrire', who: 'Alice', prio: 'p1', dep: ['k2'] }, { id: 'k2', title: 'Relire', who: 'Bob' }] },
  { id: 'c2', title: 'Fait', cards: [] },
] };
const CASES = { id: 'c', type: 'check', items: [{ html: 'a', done: true }] };
const doc = (q) => ({ title: 'Doc', pages: [
  { id: 'p1', title: 'Accueil', blocks: [TABLEAU, KB, CASES, { id: 'q', type: 'query', title: 'Incidents', scope: 'doc', view: 'table', src: 'table', ...q }] },
  { id: 'p2', title: 'Projet Atlas', blocks: [{ id: 'h', type: 'h2', html: 'Méthode' }] },
] });
const puces = (q) => { const { ctx, d } = monter(doc(q)); return ctx.qPuces(d.pages[0].blocks[3], d, 0).map((p) => p.libelle); };
const cles = (q) => { const { ctx, d } = monter(doc(q)); return ctx.qPuces(d.pages[0].blocks[3], d, 0).map((p) => p.cle); };

test('puces : source, portée, « + Filtre », vue, colonnes et tri d\'une requête sans filtre', () => {
  egal(puces({}), ['Lignes de tableaux', 'Tout le document', '+ Filtre', 'Tableau', 'Toutes les colonnes', 'Sans tri']);
  egal(cles({}), ['src', 'scope', 'plus', 'view', 'cols', 'sort']);
});

test('puces : portée (cette page, page nommée, sous-pages, section)', () => {
  egal(puces({ scope: 'here' })[1], 'Cette page');
  egal(puces({ scope: 'pg:p2' })[1], 'Page Projet Atlas');
  egal(puces({ scope: 'pg:p2', sub: true })[1], 'Page Projet Atlas et ses sous-pages');
  egal(puces({ scope: 'sec:p2/h' })[1], 'Section Méthode');
});

test('puces : un filtre de pastilles posé, « au moins une » ou « toutes » ; ne pas poser = pas de puce', () => {
  egal(puces({ tags: ['urgent'] }).slice(2, 4), ['urgent', '+ Filtre']);
  egal(puces({ tags: ['urgent', 'client'] })[2], 'urgent ou client');
  egal(puces({ tags: ['urgent', 'client'], match: 'all' })[2], 'urgent et client');
  egal(puces({ tags: [] })[2], '+ Filtre');
});

test('puces : filtres des cartes de kanban (colonne, responsable, priorité, échéance, bloquées)', () => {
  const q = { src: 'kanban', col: 'en cours', kbWho: 'alice', kbPrio: 'p12', kbDue: 'next', kbDueN: 2, kbDueU: 's', bloquees: true };
  egal(puces(q).slice(2, 8), ['Colonne : En cours', 'Responsable : Alice', 'P1 ou P2', 'Échéance dans les 2 semaines', 'Bloquées', '+ Filtre']);
  egal(puces({ src: 'kanban', kbWho: '-', kbPrio: '-', kbDue: 'none' }).slice(2, 5), ['Sans responsable', 'Sans priorité', 'Sans échéance']);
  egal(puces({ src: 'kanban', kbDue: 'late' })[2], 'Échéance dépassée');
});

test('puces : un filtre d\'une autre source n\'a pas de puce (état des cases sur des lignes de tableaux)', () => {
  egal(puces({ state: 'done', col: 'fait' })[2], '+ Filtre');
  egal(puces({ src: 'check', state: 'done' })[2], 'Cochées');
  egal(puces({ src: 'check', state: 'todo' })[2], 'Non cochées');
  egal(puces({ src: 'check', state: 'all' })[2], '+ Filtre');
});

test('puces : vue et colonnes choisies', () => {
  egal(puces({ view: 'list' })[3], 'Liste');
  egal(puces({ view: 'kanban' })[3], 'En colonnes');
  egal(puces({ colonnes: { mode: 'sauf', noms: ['réf'], ordre: [] } })[4], '3 colonnes sur 4');
  egal(puces({ colonnes: { mode: 'seulement', noms: ['réf'], ordre: [] } })[4], '1 colonne sur 4');
  egal(puces({ src: 'check' })[4], 'Toutes les colonnes');
});

test('puces : vue kanban sur les cartes, « Cartes : N champs » ; vue nombre, ni colonnes ni tri', () => {
  egal(puces({ src: 'kanban', view: 'kanban' }).slice(3), ['En colonnes', 'Cartes : 5 champs', 'Sans tri']);
  egal(puces({ src: 'kanban', view: 'kanban', champs: { masques: ['texte', 'source', 'priorite', 'echeance', 'responsable', 'attend'], ordre: [] } })[4], 'Cartes : titre seul');
  egal(puces({ src: 'kanban', view: 'kanban', champs: { masques: ['texte', 'source', 'priorite', 'echeance', 'attend'], ordre: [] } })[4], 'Cartes : 1 champ');
  egal(puces({ view: 'count' }).slice(3), ['Nombre']);
});

test('puces : vue regroupée (lignes de tableaux seulement), sans puce de colonnes ; tri des groupes', () => {
  egal(puces({ view: 'regroupee' }).slice(3), ['Regroupée', 'Sans tri']);
  egal(puces({ view: 'regroupee', sortBy: '#n', sortDir: 'desc' })[4], 'Tri : Nombre de lignes ↓');
  egal(puces({ view: 'regroupee', src: 'facts' })[3], 'Tableau', 'une autre source retombe sur le tableau');
});

test('puces : tri sur une colonne, croissant ou décroissant', () => {
  egal(puces({ sortBy: 'c:échéance', sortDir: 'asc' })[5], 'Tri : Échéance ↑');
  egal(puces({ sortBy: 'c:échéance', sortDir: 'desc' })[5], 'Tri : Échéance ↓');
  egal(puces({ sortBy: 'src' })[5], 'Tri : Source ↑');
});

test('« + Filtre » propose seulement les filtres de la source, et marque ceux déjà posés', () => {
  const { ctx } = monter(doc({}));
  const f = (b) => ctx.qFiltresProposes(b).map((x) => x.prop + (x.pose ? '*' : ''));
  egal(f({ src: 'table' }), ['tags']);
  egal(f({ src: 'facts', tags: ['urgent'] }), ['tags*']);
  egal(f({ src: 'check', state: 'done' }), ['tags', 'state*']);
  egal(f({ src: 'kanban', kbPrio: 'p1' }), ['tags', 'col', 'kbWho', 'kbPrio*', 'kbDue', 'bloquees']);
});

test('ligne de puces rendue en édition seulement : ni en lecture ni à l\'export ; plus d\'ancien formulaire', () => {
  const { ctx, d } = monter(doc({ tags: ['urgent'] }));
  const ed = ctx.renderPage(d, { page: 0, view: 'edit' });
  vrai(ed.includes('class="q-puces"') && ed.includes('data-qpuce="f:tags"') && ed.includes('data-qretirer="tags"'), 'édition : puces et × du filtre');
  vrai(!ed.includes('class="q-form"'), 'l\'ancien formulaire a disparu');
  for (const vue of ['read', 'export']) vrai(!ctx.renderPage(d, { page: 0, view: vue }).includes('q-puce'), vue + ' : aucune puce');
});

test('vue nombre : les cartes de nombre gardent leur formulaire sous la ligne de puces', () => {
  const { ctx, d } = monter(doc({ view: 'count' }));
  const ed = ctx.renderPage(d, { page: 0, view: 'edit' });
  vrai(ed.indexOf('class="q-puces"') < ed.indexOf('class="q-cform"'), 'formulaire des cartes après la ligne');
});
