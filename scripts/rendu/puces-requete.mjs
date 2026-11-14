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
  egal(puces({ view: 'regroupee', regX: 'incident', sortBy: 'c:incident' })[4], 'Tri : Incident ↑', 'tri sur X');
  egal(puces({ view: 'regroupee', regX: 'incident', sortBy: 'c:échéance', sortDir: 'desc' })[4], 'Sans tri', 'un tri resté de la vue tableau, sans effet sur les groupes');
  const { ctx, d } = monter(doc({ view: 'regroupee', regX: 'incident', sortBy: 'c:échéance', sortDir: 'desc' }));
  const fen = ctx.qFenetre(d.pages[0].blocks[3], d, 0, 'sort');
  vrai(/<option value="" selected>/.test(fen) && !fen.includes('data-qset="sortDir"'), 'fenêtre du tri : « Sans tri » choisi, sans sens');
});

test('puces : tri sur une colonne, croissant ou décroissant', () => {
  egal(puces({ sortBy: 'c:échéance', sortDir: 'asc' })[5], 'Tri : Échéance ↑');
  egal(puces({ sortBy: 'c:échéance', sortDir: 'desc' })[5], 'Tri : Échéance ↓');
  egal(puces({ sortBy: 'src' })[5], 'Tri : Source ↑');
});

test('« + Filtre » propose toujours tous les filtres de la source, même ceux déjà posés', () => {
  const { ctx } = monter(doc({}));
  const f = (b) => ctx.qFiltresProposes(b).map((x) => x.prop);
  egal(f({ src: 'table' }), ['tags', 'valeur']);
  egal(f({ src: 'check', filtres: [{ id: 'f1', prop: 'state', vals: ['done'] }] }), ['tags', 'state']);
  egal(f({ src: 'kanban', filtres: [{ id: 'f1', prop: 'kbPrio', vals: ['p1'] }] }), ['tags', 'col', 'kbWho', 'kbPrio', 'kbDue', 'bloquees']);
  const { ctx: c2, d } = monter(doc({ src: 'kanban', filtres: [{ id: 'f1', prop: 'kbPrio', vals: ['p1'] }] }));
  vrai(!c2.qFenetre(d.pages[0].blocks[3], d, 0, 'plus').includes('déjà là'), 'plus de « déjà là »');
});

const F = (id, prop, vals, plus) => ({ id, prop, vals, ...plus });
test('puces : un même filtre posé deux fois donne deux puces f:<id>, dans l\'ordre des filtres', () => {
  const q = { src: 'kanban', filtres: [F('a', 'tags', ['urgent', 'client']), F('b', 'col', ['en cours']), F('c', 'tags', ['client'], { mode: 'aucun' })] };
  egal(cles(q).slice(2, 6), ['f:a', 'f:b', 'f:c', 'plus']);
  egal(puces(q).slice(2, 5), ['urgent ou client', 'Colonne : En cours', 'sauf client']);
  const { ctx, d } = monter(doc(q));
  const ed = ctx.renderPage(d, { page: 0, view: 'edit' });
  vrai(ed.includes('data-qretirer="a"') && ed.includes('data-qretirer="c"') && !ed.includes('data-qretirer="tags"'), '× par identifiant');
});

test('puces : libellés de Q7 (plusieurs valeurs, « sauf », Sans responsable, Non bloquées)', () => {
  const p = (filtres) => puces({ src: 'kanban', filtres }).slice(2, 2 + filtres.length);
  egal(p([F('a', 'col', ['en cours', 'fait'])]), ['Colonne : En cours ou Fait']);
  egal(p([F('a', 'col', ['fait'], { mode: 'aucun' })]), ['Colonne : sauf Fait']);
  egal(p([F('a', 'kbPrio', ['p1', 'p2']), F('b', 'kbPrio', ['p3'], { mode: 'aucun' })]), ['P1 ou P2', 'Priorité : sauf P3']);
  egal(p([F('a', 'kbWho', ['alice', 'bob']), F('b', 'kbWho', ['alice'], { mode: 'aucun' }), F('c', 'kbWho', ['-'])]), ['Responsable : Alice ou Bob', 'Responsable : sauf Alice', 'Sans responsable']);
  egal(p([F('a', 'bloquees', ['oui']), F('b', 'bloquees', ['non'])]), ['Bloquées', 'Non bloquées']);
  egal(p([F('a', 'tags', ['urgent', 'client'], { mode: 'tous' })]), ['urgent et client']);
});

test('puces : pastilles en couleur jointes par « ou », « et », ou précédées de « sauf »', () => {
  const ligne = (filtres) => { const { ctx, d } = monter(doc({ filtres })); return ctx.qLignePuces(d.pages[0].blocks[3], d, 0); };
  vrai(/urgent<\/span> <small>ou<\/small> <span class="pill[^"]*">client/.test(ligne([F('a', 'tags', ['urgent', 'client'])])), 'ou');
  vrai(/urgent<\/span> <small>et<\/small> <span/.test(ligne([F('a', 'tags', ['urgent', 'client'], { mode: 'tous' })])), 'et');
  vrai(/<small>sauf<\/small> <span class="pill[^"]*">urgent<\/span>, <span class="pill[^"]*">client/.test(ligne([F('a', 'tags', ['urgent', 'client'], { mode: 'aucun' })])), 'sauf');
});

const fenetre = (q, cle) => { const { ctx, d } = monter(doc(q)); return ctx.qFenetre(d.pages[0].blocks[3], d, 0, cle); };
const modes = (h) => [...h.matchAll(/data-qmode="(\w+)"[^>]*aria-pressed="(\w+)"[^>]*>([^<]+)/g)].map((m) => m[3] + (m[2] === 'true' ? '*' : ''));
const cochees = (h) => [...h.matchAll(/<input type="checkbox" data-qval data-v="([^"]*)"( checked)?/g)].map((m) => m[1] + (m[2] ? '*' : ''));
test('fenêtre d\'un filtre à plusieurs valeurs : segments selon la propriété, puis une case par valeur', () => {
  const kb = (filtres) => ({ src: 'kanban', filtres });
  let h = fenetre(kb([F('a', 'col', ['fait'], { mode: 'aucun' })]), 'f:a');
  egal(modes(h), ['l\'une de', 'aucune de*']);
  egal(cochees(h), ['en cours', 'fait*']);
  vrai(h.indexOf('data-qmode') < h.indexOf('data-qval'), 'segments au-dessus des cases');
  h = fenetre(kb([F('a', 'kbWho', ['-', 'alice'])]), 'f:a');
  egal(modes(h), ['l\'une de*', 'aucune de']);
  egal(cochees(h), ['alice*', 'bob', '-*']);
  vrai(h.includes('Sans responsable'), 'Sans responsable');
  egal(cochees(fenetre(kb([F('a', 'kbPrio', ['p1', 'p2'])]), 'f:a')), ['p1*', 'p2*', 'p3', '-']);
  h = fenetre({ filtres: [F('a', 'tags', ['urgent'], { mode: 'tous' })] }, 'f:a');
  egal(modes(h), ['l\'une de', 'toutes*', 'aucune de']);
  egal(cochees(h), ['urgent*', 'client']);
  vrai(h.includes('q-fen-q'), 'recherche des pastilles');
  vrai(!fenetre(kb([F('a', 'col', ['fait'])]), 'f:a').includes('q-fen-q'), 'liste courte : pas de recherche');
});

test('fenêtre en attente (n:<prop>:<mode>) : rien de coché, le mode choisi ; valeur cochée disparue gardée', () => {
  const h = fenetre({ src: 'kanban' }, 'n:col:aucun');
  egal(modes(h), ['l\'une de', 'aucune de*']);
  egal(cochees(h), ['en cours', 'fait']);
  egal(cochees(fenetre({ src: 'kanban', filtres: [F('a', 'col', ['archives'])] }, 'f:a')), ['en cours', 'fait', 'archives*']);
  egal(fenetre({ src: 'kanban' }, 'f:inconnu'), '', 'filtre disparu : rien');
});

test('fenêtre à valeur unique : Bloquées / Non bloquées, échéance, état des cases, visant le filtre par son id', () => {
  let h = fenetre({ src: 'kanban', filtres: [F('a', 'bloquees', ['non'])] }, 'f:a');
  vrai(/data-qset="bloquees" data-fid="a" data-v="non" aria-pressed="true"/.test(h) && h.includes('>Bloquées<'), 'Non bloquées choisi');
  h = fenetre({ src: 'kanban', filtres: [F('a', 'kbDue', ['late']), F('b', 'kbDue', ['next'], { n: 3, u: 's' })] }, 'f:b');
  vrai(/data-qset="kbDue" data-fid="b" data-v="next" aria-pressed="true"/.test(h) && /data-prop="kbDueN" data-fid="b"[^>]*value="3"/.test(h) && /data-qset="kbDueU" data-fid="b" data-v="s" aria-pressed="true"/.test(h), 'second filtre d\'échéance');
  vrai(/data-qset="state" data-fid="" data-v="todo"/.test(fenetre({ src: 'check' }, 'n:state:un')), 'état des cases en attente');
});

test('ligne de puces rendue en édition seulement : ni en lecture ni à l\'export ; plus d\'ancien formulaire', () => {
  const { ctx, d } = monter(doc({ tags: ['urgent'] }));
  const ed = ctx.renderPage(d, { page: 0, view: 'edit' });
  vrai(ed.includes('class="q-puces"') && /data-qpuce="f:[^"]+"/.test(ed) && /data-qretirer="[^"]+"/.test(ed), 'édition : puces et × du filtre');
  vrai(!ed.includes('class="q-form"'), 'l\'ancien formulaire a disparu');
  for (const vue of ['read', 'export']) vrai(!ctx.renderPage(d, { page: 0, view: vue }).includes('q-puce'), vue + ' : aucune puce');
});

test('vue nombre : les cartes de nombre gardent leur formulaire sous la ligne de puces', () => {
  const { ctx, d } = monter(doc({ view: 'count' }));
  const ed = ctx.renderPage(d, { page: 0, view: 'edit' });
  vrai(ed.indexOf('class="q-puces"') < ed.indexOf('class="q-cform"'), 'formulaire des cartes après la ligne');
});
