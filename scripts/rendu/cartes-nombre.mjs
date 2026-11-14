// Cartes de nombre à filtres (spec filtres-logiques, ticket 04) : « Compter » et le total « un autre filtre… » reçoivent tous les
// filtres de la source, en plus de ceux de la requête ; texte par défaut = source puis libellés des puces « Compter » ; petite ligne
// de puces par carte (× et « + Filtre ») qui ouvre la même fenêtre ; réinitialisation au changement de source ; export Office.
import { monter, test, egal, vrai } from './commun.mjs';

// kanban : « Écrire » attend « Relire » (pas finie) → bloquée
const KB = { id: 'kb', type: 'kanban', cols: [
  { id: 'c1', title: 'À faire', cards: [
    { id: 'k1', title: 'Écrire', html: '<span class="pill">urgent</span>', who: 'Alice', prio: 'p1', dep: ['k2'] },
    { id: 'k2', title: 'Relire', html: '<span class="pill">urgent</span>', who: 'Alice', prio: 'p2' },
    { id: 'k3', title: 'Coder', html: '', who: 'alice', prio: 'p2' },
  ] },
  { id: 'c2', title: 'Fait', cards: [{ id: 'k4', title: 'Tester', html: '<span class="pill">client</span>', who: 'Bob', prio: 'p1' }, { id: 'k5', title: 'Livrer', html: '', who: 'Alice', prio: 'p3' }] },
] };
const CHK = { id: 'ch', type: 'check', items: [{ html: 'un', done: true }, { html: 'deux', done: false }] };
const TAB = { id: 'tb', type: 'table', rows: [['Réf', 'Statut'], ['1', 'Ouvert'], ['2', 'Clos'], ['3', 'Ouvert']] };
const doc = (q) => ({ title: 'Doc', pages: [{ id: 'p1', title: 'Accueil', blocks: [KB, CHK, TAB, { id: 'q', type: 'query', title: 'R', scope: 'doc', view: 'count', src: 'kanban', ...q }] }] });
const monte = (q) => { const { ctx, d } = monter(doc(q)); return { ctx, d, b: d.pages[0].blocks.find((x) => x.id === 'q') }; };
const comptes = (q) => { const { ctx, d, b } = monte(q); return ctx.qCompteurs(b, d, 0, ctx.queryRecords(b, d, 0)).map((c) => [c.num, c.tot, c.label]); };
const F = (id, prop, vals, o = {}) => ({ id, prop, vals, ...o });
const QUI = F('a', 'kbWho', ['alice']), PRIO = F('b', 'kbPrio', ['p1', 'p2']), NB = F('c', 'bloquees', ['non']);

test('cartes de nombre : compte avec tous les filtres de la source, en plus de ceux de la requête ; texte par défaut', () => {
  egal(comptes({ cards: [{ id: 'n1', label: '', filtres: [QUI, PRIO, NB], total: 'none' }] }), [[2, null, 'cartes · Responsable : Alice · P1 ou P2 · Non bloquées']]);
  // filtres de la requête d'abord : la carte compte dans le résultat
  egal(comptes({ filtres: [F('r', 'col', ['fait'])], cards: [{ id: 'n1', label: '', filtres: [QUI], total: 'all' }] }), [[1, 2, 'cartes · Responsable : Alice']]);
  // « aucune de » sur les pastilles, et un texte saisi l'emporte
  egal(comptes({ cards: [{ id: 'n1', label: 'Calmes', filtres: [F('t', 'tags', ['urgent'], { mode: 'aucun' })], total: 'none' }] }), [[3, null, 'Calmes']]);
});

test('cartes de nombre : total « un autre filtre… » avec tous les filtres, absent du texte par défaut', () => {
  egal(comptes({ cards: [{ id: 'n1', label: '', filtres: [F('x', 'kbPrio', ['p1'])], total: 'filter', tfiltres: [QUI] }] }), [[2, 4, 'cartes · P1']]);
  egal(comptes({ cards: [{ id: 'n1', label: '', total: 'filter', tfiltres: [F('y', 'col', ['à faire'], { mode: 'aucun' })] }] }), [[5, 2, 'cartes']]);
});

test('cartes de nombre : texte par défaut des autres sources, à la lettre de la spec', () => {
  egal(comptes({ src: 'check', cards: [{ id: 'n1', label: '', filtres: [F('s', 'state', ['done'])], total: 'all' }] }), [[1, 2, 'cases à cocher · Cochées']]);
  egal(comptes({ src: 'table', cards: [{ id: 'n1', label: '', filtres: [F('v', 'valeur', ['ouvert'], { colonne: 'statut' })], total: 'all' }] }), [[2, 3, 'lignes de tableaux · Statut : Ouvert']]);
  egal(comptes({ src: 'facts', cards: [{ id: 'n1', label: '', total: 'none' }] }), [[0, null, 'fiches de faits']]);
});

test('cartes de nombre : une ligne de puces par carte (× et « + Filtre »), celle du total seulement avec « un autre filtre… »', () => {
  const { ctx, d } = monte({ cards: [{ id: 'n1', label: '', filtres: [QUI], total: 'none' }, { id: 'n2', label: '', total: 'filter', tfiltres: [PRIO] }] });
  const ed = ctx.renderPage(d, { page: 0, view: 'edit' });
  vrai(/data-qpuce="f:a"[^>]*>[^<]*Responsable : Alice/.test(ed), 'puce du filtre « Compter »');
  vrai(ed.includes('data-qretirer="a"') && ed.includes('data-qretirer="b"'), '× sur les puces des cartes');
  for (const k of ['plus:n1:filtres', 'plus:n2:filtres', 'plus:n2:tfiltres']) vrai(ed.includes('data-qpuce="' + k + '"'), k);
  vrai(!ed.includes('data-qpuce="plus:n1:tfiltres"'), 'pas de ligne du total sans « un autre filtre… »');
  vrai(!ed.includes('q-chip') && !/data-prop="cards\.\d+\.(t?)(state|col|match)"/.test(ed), 'anciennes listes retirées');
  vrai(ed.includes('data-prop="cards.0.total"'), 'le choix « sur » reste');
  vrai(!ctx.renderPage(d, { page: 0, view: 'read' }).includes('q-puce'), 'lecture : aucune puce');
});

test('cartes de nombre : la fenêtre d\'une puce de carte est celle de la requête (modes, valeurs, « Valeur d\'une colonne »)', () => {
  const { ctx, d, b } = monte({ cards: [{ id: 'n1', label: '', filtres: [QUI], total: 'filter', tfiltres: [F('t', 'tags', ['urgent'], { mode: 'tous' })] }] });
  const f = ctx.qFenetre(b, d, 0, 'f:a');
  vrai(f.includes('<h4>Responsable</h4>') && /data-v="alice" checked/.test(f) && f.includes('data-qmode="aucun"'), f);
  vrai(/data-qmode="tous" aria-pressed="true"/.test(ctx.qFenetre(b, d, 0, 'f:t')), 'mode du total');
  egal([...ctx.qFenetre(b, d, 0, 'plus:n1:filtres').matchAll(/data-qfiltre="(\w+)"/g)].map((m) => m[1]), ['tags', 'col', 'kbWho', 'kbPrio', 'kbDue', 'bloquees']);
  const t = monte({ src: 'table', cards: [{ id: 'n1', label: '', total: 'none' }] });
  vrai(t.ctx.qFenetre(t.b, t.d, 0, 'plus:n1:filtres').includes('data-qfiltre="valeur"'), '« Valeur d\'une colonne » proposée sur une carte');
  vrai(t.ctx.qFenetre(t.b, t.d, 0, 'n:valeur:un:statut').includes('data-v="ouvert"'), 'fenêtre en attente');
});

test('cartes de nombre : identifiant de carte donné par qDefCard et la normalisation, unique dans le bloc', () => {
  const { ctx, b } = monte({ cards: [{ label: '', total: 'none' }, { id: 'z', label: '', total: 'none' }, { id: 'z', label: '', total: 'none' }] });
  const ids = b.cards.map((c) => c.id);
  vrai(ids.every((x) => typeof x === 'string' && x) && new Set(ids).size === 3 && ids[1] === 'z', JSON.stringify(ids));
  vrai(typeof ctx.qDefCard(b).id === 'string', 'qDefCard');
});

test('cartes de nombre : au changement de source, une carte sans texte dont les filtres sont vides ou ceux du défaut reprend le défaut', () => {
  const { ctx, b } = monte({ src: 'check', cards: [
    { id: 'd', label: '', filtres: [F('s', 'state', ['done'])], total: 'all' },   // défaut des cases
    { id: 'v', label: '', total: 'none' },                                         // vide
    { id: 't', label: 'Mes cases', total: 'none' },                                // texte saisi
    { id: 'f', label: '', filtres: [F('u', 'state', ['todo'])], total: 'all' },   // filtre réglé
  ] });
  ctx.qCartesNouvelleSource(b, 'check', 'kanban');
  egal(b.cards.map((c) => [c.label, c.total, (c.filtres || []).length]), [['', 'none', 0], ['', 'none', 0], ['Mes cases', 'none', 0], ['', 'all', 1]]);
  const k = monte({ src: 'kanban', cards: [{ id: 'v', label: '', total: 'none' }] });
  k.ctx.qCartesNouvelleSource(k.b, 'kanban', 'check');
  egal(k.b.cards.map((c) => [c.total, c.filtres.map((f) => f.vals[0])]), [['all', ['done']]]);
});
