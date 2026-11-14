// Filtres des requêtes (filtres-logiques, ticket 01) : fonction de filtrage unique qFiltrer, libellé qLibelleFiltre,
// migration des anciens champs (format 6) avec mêmes résultats et mêmes comptes, miroir des anciens champs à l'écriture.
import { monter, test, egal, vrai } from './commun.mjs';

// kanban : « Écrire » attend « Relire » (pas finie) → bloquée
const KB = { id: 'kb', type: 'kanban', cols: [
  { id: 'c1', title: 'À faire', cards: [
    { id: 'k1', title: 'Écrire', html: '<span class="pill">urgent</span>', due: '2020-01-01', who: 'Alice', prio: 'p1', dep: ['k2'] },
    { id: 'k2', title: 'Relire', html: '<span class="pill">urgent</span> <span class="pill">client</span>', due: '2099-01-01', who: '', prio: 'p2' },
  ] },
  { id: 'c2', title: 'En cours', cards: [{ id: 'k3', title: 'Tester', html: '<span class="pill">client</span>', due: '', who: 'Bob', prio: 'p3' }] },
  { id: 'c3', title: 'Fait', cards: [{ id: 'k4', title: 'Livrer', html: '', due: '2020-01-01', who: 'alice' }] },
] };
const CHK = { id: 'ch', type: 'check', items: [{ html: 'un <span class="pill">urgent</span>', done: true }, { html: 'deux', done: false }, { html: 'trois <span class="pill">urgent</span>', done: false }] };
const TAB = { id: 'tb', type: 'table', rows: [['Statut', 'Groupe'], ['Ouvert', '<span class="pill">APT28</span> <span class="pill">APT29</span>'], ['clos ', '<span class="pill">APT28</span>'], ['', 'aucun']] };
const doc = (q, v) => ({ ...(v ? { v } : {}), title: 'Doc', pages: [{ id: 'p1', title: 'Accueil', blocks: [KB, CHK, TAB, { id: 'q', type: 'query', scope: 'doc', view: 'table', ...q }] }] });
const requete = (q, v) => { const { ctx, d } = monter(doc(q, v)); return { ctx, d, b: d.pages[0].blocks[3] }; };
const titres = (q, v) => { const { ctx, d, b } = requete(q, v); return ctx.queryRecords(b, d, 0).map((r) => r.kb ? r.kb.title : r.html || r.cells[0].v); };
const comptes = (q) => { const { ctx, d, b } = requete({ view: 'count', ...q }); return ctx.qCompteurs(b, d, 0, ctx.queryRecords(b, d, 0)).map((c) => [c.num, c.tot, c.def]); };
const KBQ = { src: 'kanban' };

test('format 6 : filtres du bloc kanban, mêmes résultats après migration', () => {
  egal(titres({ ...KBQ }), ['Écrire', 'Relire', 'Tester', 'Livrer']);
  egal(titres({ ...KBQ, col: 'à faire' }), ['Écrire', 'Relire']);
  egal(titres({ ...KBQ, kbWho: 'alice' }), ['Écrire', 'Livrer']);
  egal(titres({ ...KBQ, kbWho: '-' }), ['Relire']);
  egal(titres({ ...KBQ, kbPrio: 'p12' }), ['Écrire', 'Relire']);
  egal(titres({ ...KBQ, kbPrio: '-' }), ['Livrer']);
  egal(titres({ ...KBQ, kbPrio: 'p3' }), ['Tester']);
  egal(titres({ ...KBQ, kbDue: 'late' }), ['Écrire']);
  egal(titres({ ...KBQ, kbDue: 'none' }), ['Tester']);
  egal(titres({ ...KBQ, kbDue: 'after', kbDueN: 2, kbDueU: 'm' }), ['Relire']);
  egal(titres({ ...KBQ, bloquees: true }), ['Écrire']);
  egal(titres({ ...KBQ, tags: ['urgent', 'client'] }), ['Écrire', 'Relire', 'Tester']);
  egal(titres({ ...KBQ, tags: ['urgent', 'client'], match: 'all' }), ['Relire']);
  egal(titres({ ...KBQ, col: 'à faire', kbWho: 'alice', tags: ['urgent'] }), ['Écrire']);
  // champ d'une autre source : ignoré, comme avant
  egal(titres({ ...KBQ, state: 'done' }), ['Écrire', 'Relire', 'Tester', 'Livrer']);
  egal(titres({ src: 'check', col: 'fait', kbPrio: 'p1' }).length, 3);
  egal(titres({ src: 'check', state: 'todo' }), ['deux', 'trois <span class="pill">urgent</span>']);
});

test('format 6 : comptes et totaux des cartes de nombre, mêmes après migration (texte par défaut : source puis libellés des filtres, ticket 04)', () => {
  egal(comptes({ ...KBQ, cards: [{ label: '', tags: [], match: 'any', state: 'all', col: 'fait', total: 'all' }] }), [[1, 4, 'cartes · Colonne : Fait']]);
  egal(comptes({ ...KBQ, cards: [{ label: 'x', tags: ['urgent', 'client'], match: 'all', state: 'all', total: 'filter', ttags: ['client'], tmatch: 'any', tcol: 'à faire' }] }), [[1, 1, 'cartes · urgent et client']]);
  egal(comptes({ src: 'check', cards: [{ label: '', tags: ['urgent'], match: 'any', state: 'done', total: 'filter', ttags: ['urgent'], tstate: 'all' }] }), [[1, 2, 'cases à cocher · urgent · Cochées']]);
  egal(comptes({ src: 'check' }), [[1, 3, 'cases à cocher · Cochées']]);
  // carte d'une autre source avec un état : rien ne passe, comme avant
  egal(comptes({ src: 'table', cards: [{ label: '', tags: [], match: 'any', state: 'done', total: 'all' }] }), [[0, 3, 'lignes de tableaux · Cochées']]);
});

test('format 6 : vue « En colonnes » ne garde que la colonne filtrée', () => {
  const { ctx, d } = monter(doc({ ...KBQ, view: 'kanban', col: 'en cours' }));
  egal(ctx.qRegroupements(d.pages[0].blocks[3], d, 0, ctx.queryRecords(d.pages[0].blocks[3], d, 0)).groups.map((g) => g.name), ['En cours']);
});

// --- format 7 : la fonction de filtrage unique ---
const recs = (q) => { const { ctx, d, b } = requete(q, 7); return { ctx, liste: ctx.queryRecords(b, d, 0), d, b }; };
const F = (prop, vals, plus) => ({ id: prop + vals.join(), prop, vals, ...plus });
const filtre = (src, filtres, ctxf) => { const { ctx, liste } = recs({ src }); return ctx.qFiltrer(liste, filtres, ctxf).map((r) => r.kb ? r.kb.title : r.html || r.cells[0].v); };

test('qFiltrer : « l\'une de », « aucune de », « toutes » sur colonne, responsable, priorité, pastilles', () => {
  egal(filtre('kanban', [F('col', ['à faire', 'fait'])]), ['Écrire', 'Relire', 'Livrer']);
  egal(filtre('kanban', [F('col', ['à faire', 'fait'], { mode: 'aucun' })]), ['Tester']);
  egal(filtre('kanban', [F('kbWho', ['alice', '-'])]), ['Écrire', 'Relire', 'Livrer']);
  egal(filtre('kanban', [F('kbWho', ['-'], { mode: 'aucun' })]), ['Écrire', 'Tester', 'Livrer']);
  egal(filtre('kanban', [F('kbPrio', ['p3', '-'])]), ['Tester', 'Livrer']);
  egal(filtre('kanban', [F('kbPrio', ['p3'], { mode: 'aucun' })]), ['Écrire', 'Relire', 'Livrer']);
  egal(filtre('kanban', [F('tags', ['urgent', 'client'], { mode: 'tous' })]), ['Relire']);
  egal(filtre('kanban', [F('tags', ['urgent'], { mode: 'aucun' })]), ['Tester', 'Livrer']);
  // même filtre posé deux fois : ET
  egal(filtre('kanban', [F('tags', ['urgent', 'client']), F('tags', ['client'], { mode: 'aucun' })]), ['Écrire']);
});

test('qFiltrer : état des cases, « Bloquées » / « Non bloquées », échéance à date fixée par le contexte', () => {
  egal(filtre('check', [F('state', ['done'])]), ['un <span class="pill">urgent</span>']);
  egal(filtre('kanban', [F('bloquees', ['oui'])]), ['Écrire']);
  egal(filtre('kanban', [F('bloquees', ['non'])]), ['Relire', 'Tester', 'Livrer']);
  const jour = (n, u) => (n ? (u === 'm' ? '2099-03-01' : '2099-01-05') : '2098-12-31');
  egal(filtre('kanban', [F('kbDue', ['next'], { n: 5, u: 'j' })], { jour }), ['Relire']);
  egal(filtre('kanban', [F('kbDue', ['today'])], { jour: () => '2099-01-01' }), ['Relire']);
});

test('qFiltrer : valeur d\'une colonne (casse et espaces, une valeur par pastille, (vide) pour cellule vide ou clé absente)', () => {
  egal(filtre('table', [F('valeur', ['ouvert', 'clos'], { colonne: 'statut' })]), ['Ouvert', 'clos ']);
  egal(filtre('table', [F('valeur', [''], { colonne: 'statut' })]), ['']);
  egal(filtre('table', [F('valeur', [''], { colonne: 'statut', mode: 'aucun' })]), ['Ouvert', 'clos ']);
  egal(filtre('table', [F('valeur', ['apt28', 'apt29'], { colonne: 'groupe', mode: 'tous' })]), ['Ouvert']);
  egal(filtre('table', [F('valeur', ['apt28'], { colonne: 'groupe' })]), ['Ouvert', 'clos ']);
  egal(filtre('table', [F('valeur', [''], { colonne: 'absente' })]).length, 3);
});

test('qLibelleFiltre : libellés actuels pour une valeur, puis plusieurs valeurs et « sauf »', () => {
  const { ctx, d, b } = recs({ src: 'kanban' }), noms = ctx.qNomsFiltres(b, d, 0), L = (f) => ctx.qLibelleFiltre(f, noms);
  egal(L(F('col', ['fait'])), 'Colonne : Fait');
  egal(L(F('kbWho', ['alice'])), 'Responsable : Alice');
  egal(L(F('kbWho', ['-'])), 'Sans responsable');
  egal(L(F('kbPrio', ['p1'])), 'P1');
  egal(L(F('kbPrio', ['p1', 'p2'])), 'P1 ou P2');
  egal(L(F('kbPrio', ['-'])), 'Sans priorité');
  egal(L(F('kbPrio', ['p3'], { mode: 'aucun' })), 'Priorité : sauf P3');
  egal(L(F('kbDue', ['next'], { n: 2, u: 's' })), 'Échéance dans les 2 semaines');
  egal(L(F('state', ['todo'])), 'Non cochées');
  egal(L(F('bloquees', ['oui'])), 'Bloquées');
  egal(L(F('bloquees', ['non'])), 'Non bloquées');
  egal(L(F('tags', ['urgent', 'client'])), 'urgent ou client');
  egal(L(F('tags', ['urgent', 'client'], { mode: 'tous' })), 'urgent et client');
  egal(L(F('tags', ['urgent'], { mode: 'aucun' })), 'sauf urgent');
  egal(L(F('col', ['à faire', 'en cours'])), 'Colonne : À faire ou En cours');
  egal(L(F('col', ['fait', 'à faire'], { mode: 'aucun' })), 'Colonne : sauf Fait, À faire');
  egal(L(F('kbWho', ['alice'], { mode: 'aucun' })), 'Responsable : sauf Alice');
  egal(ctx.qLibelleFiltre(F('valeur', ['ouvert'], { colonne: 'statut' }), { colonnes: { statut: 'Statut' }, valeur: { ouvert: 'Ouvert' } }), 'Statut : Ouvert');
  egal(ctx.qLibelleFiltre(F('valeur', [''], { colonne: 'statut' }), { colonnes: { statut: 'Statut' } }), 'Statut : (vide)');
});

test('vue « En colonnes » : colonnes retenues par « aucune de » et par deux filtres de colonne', () => {
  const groupes = (filtres) => { const { ctx, d, b } = requete({ src: 'kanban', view: 'kanban', filtres }, 7); return ctx.qRegroupements(b, d, 0, ctx.queryRecords(b, d, 0)).groups.map((g) => g.name); };
  egal(groupes([F('col', ['fait'], { mode: 'aucun' })]), ['À faire', 'En cours']);
  egal(groupes([F('col', ['fait'], { mode: 'aucun' }), F('col', ['en cours', 'fait'])]), ['En cours']);
  egal(groupes([F('col', ['fait', 'à faire'])]), ['À faire', 'Fait'], '« l\'une de » : ces colonnes, dans l\'ordre du kanban, vide comprise');
});

// ticket 02 : réglage d'un filtre de la ligne de puces par son identifiant (deux filtres de même propriété)
test('réglage par identifiant : cocher, changer de mode, décocher la dernière valeur ne touche que ce filtre', () => {
  const { ctx, d, b } = requete({ src: 'kanban', filtres: [{ id: 'a', prop: 'tags', vals: ['urgent'] }, { id: 'b', prop: 'tags', vals: ['client'], mode: 'aucun' }] }, 7);
  const vue = () => JSON.parse(JSON.stringify(b.filtres || []));
  ctx.qBasculerValeur(b, b, 'filtres', { id: 'b', prop: 'tags' }, 'urgent');
  egal(vue()[1], { id: 'b', prop: 'tags', vals: ['client', 'urgent'], mode: 'aucun' }, 'coché sur b, mode gardé');
  egal(titres({ src: 'kanban', filtres: vue() }, 7), [], 'urgent ET sauf client, urgent');
  ctx.qModeFiltre(b, 'filtres', { id: 'b' }, 'un');
  egal(vue()[1].mode, undefined, '« l\'une de » : mode absent');
  egal(ctx.qBasculerValeur(b, b, 'filtres', { id: 'b', prop: 'tags' }, 'client') !== null, true);
  egal(ctx.qBasculerValeur(b, b, 'filtres', { id: 'b', prop: 'tags' }, 'urgent'), null, 'dernière valeur : filtre retiré');
  egal(vue(), [{ id: 'a', prop: 'tags', vals: ['urgent'] }], 'l\'autre filtre de pastilles reste');
  const n = ctx.qBasculerValeur(b, b, 'filtres', { prop: 'kbWho', mode: 'aucun' }, '-');
  egal(vue()[1], { id: n.id, prop: 'kbWho', vals: ['-'], mode: 'aucun' }, 'nouveau filtre créé à la première valeur, avec le mode de la fenêtre');
  egal(titres({ src: 'kanban', filtres: vue() }, 7), ['Écrire'], 'urgent, sauf Sans responsable');
  ctx.qReglerFiltre(b, b, 'filtres', { id: n.id, prop: 'kbWho' }, '');
  egal(vue().length, 1, 'valeur vide : filtre retiré');
  const bq = ctx.qReglerFiltre(b, b, 'filtres', { prop: 'bloquees' }, 'oui');
  ctx.qReglerFiltre(b, b, 'filtres', { id: bq.id, prop: 'bloquees' }, 'non');
  egal(titres({ src: 'kanban', filtres: vue() }, 7), ['Relire'], 'urgent et non bloquées');
});

test('format 7 : les anciens champs ne sont jamais lus ni gardés en mémoire ; identifiants uniques dans le bloc', () => {
  const { ctx, d, b } = requete({ src: 'kanban', col: 'fait', kbPrio: 'p1', tags: ['urgent'], match: 'all', bloquees: true, cards: [{ label: '', col: 'fait', total: 'filter', ttags: ['x'] }] }, 7);
  egal(ctx.queryRecords(b, d, 0).length, 4);
  egal(['col', 'kbPrio', 'tags', 'match', 'bloquees'].filter((k) => k in b), []);
  egal(Object.keys(b.cards[0]).sort(), ['id', 'label', 'total']);
  const { b: b2 } = requete({ src: 'kanban', filtres: [F('col', ['fait'], { id: 'x' }), { id: 'x', prop: 'kbWho', vals: ['-'] }, { prop: 'tags', vals: [] }, { prop: 'inconnu', vals: ['a'] }], cards: [{ filtres: [{ id: 'x', prop: 'tags', vals: ['a'] }] }] }, 7);
  const ids = [...b2.filtres, ...b2.cards[0].filtres].map((f) => f.id);
  egal(b2.filtres.map((f) => f.prop), ['col', 'kbWho']);
  egal(new Set(ids).size, 3, 'identifiants uniques');
  const { ctx: c3, b: b3 } = requete({ src: 'kanban', filtres: [F('col', ['fait'])] }, 7);
  const vus = new Set(b3.filtres.map((f) => f.id));
  for (let i = 0; i < 50; i++) { const id = c3.qIdFiltre(b3); vrai(!vus.has(id), 'id neuf'); }
});

test('miroir des anciens champs à l\'écriture : premier filtre « l\'une de » à une valeur, P1 et P2 en « p12 », pastilles avec match', () => {
  const { ctx, d } = requete({ src: 'kanban', filtres: [
    F('col', ['fait', 'à faire']), F('col', ['en cours']), F('kbWho', ['alice'], { mode: 'aucun' }), F('kbPrio', ['p1', 'p2']),
    F('kbDue', ['next'], { n: 3, u: 'm' }), F('bloquees', ['non']), F('tags', ['urgent'], { mode: 'aucun' }), F('tags', ['a', 'b'], { mode: 'tous' }), F('tags', ['c']),
  ], cards: [{ label: '', filtres: [F('state', ['done']), F('col', ['fait'])], total: 'filter', tfiltres: [F('tags', ['x'])] }] }, 7);
  const avant = JSON.stringify(d), m = ctx.miroirFiltres(d), q = m.pages[0].blocks[3];
  egal(JSON.stringify(d), avant, 'original intact');
  egal({ col: q.col, kbWho: q.kbWho, kbPrio: q.kbPrio, kbDue: q.kbDue, kbDueN: q.kbDueN, kbDueU: q.kbDueU, bloquees: q.bloquees, tags: q.tags, match: q.match },
    { col: 'en cours', kbPrio: 'p12', kbDue: 'next', kbDueN: 3, kbDueU: 'm', tags: ['a', 'b'], match: 'all' });
  egal(q.filtres.length, 9, 'filtres gardés');
  const c = q.cards[0];
  egal([c.state, c.col, c.ttags, c.tmatch, c.tags], ['done', 'fait', ['x'], 'any', undefined]);
  // p12 seulement pour exactement P1 et P2
  const { ctx: c2, d: d2 } = requete({ src: 'kanban', filtres: [F('kbPrio', ['p1', 'p2', 'p3'])] }, 7);
  egal('kbPrio' in c2.miroirFiltres(d2).pages[0].blocks[3], false);
  // relu par cet éditeur : le miroir n'est pas repris, mêmes résultats
  const relu = ctx.normalize(JSON.parse(JSON.stringify(m))).pages[0].blocks[3];
  egal(['col', 'kbPrio', 'tags', 'match'].filter((k) => k in relu), []);
  egal(relu.filtres, q.filtres);
});

// vérification c22 du lot 7 : sans aucune carte, les colonnes retenues restent affichées, vides (écran et Office)
test('vue « En colonnes » : aucune carte retenue, la colonne retenue s\'affiche vide au lieu de « Aucun résultat »', () => {
  const q = { src: 'kanban', view: 'kanban', filtres: [F('col', ['fait']), F('tags', ['urgent'])] };
  const { ctx, d } = monter(doc(q, 7));
  const h = ctx.renderPage(d, { page: 0, view: 'read' });
  const res = h.slice(h.indexOf('class="q-res"'));
  egal([...res.matchAll(/<span class="kb-title">([\s\S]*?)<\/span>/g)].map((m) => m[1]), ['Fait'], 'écran : colonne Fait');
  vrai(!res.includes('Aucun résultat'), 'écran : pas de « Aucun résultat »');
  const t = ctx.officeTexte(ctx.officeBloc(d.pages[0].blocks[3], d, { page: 0 }));
  vrai(t.includes('Fait') && !t.includes('Aucun résultat'), 'Office : colonne Fait, pas de « Aucun résultat » : ' + t);
  egal(titres({ src: 'kanban', view: 'kanban', filtres: [F('col', ['fait'], { mode: 'aucun' }), F('col', ['fait'])] }, 7), [], 'sans colonne retenue : rien');
});
