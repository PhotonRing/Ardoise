// Filtre « Valeur d'une colonne » (spec filtres-logiques, ticket 03) : lignes de tableaux et fiches de faits ; colonnes et valeurs
// trouvées dans la portée, « (vide) » en tête, une valeur par pastille, « toutes » seulement avec des pastilles ; libellés ;
// vues Regroupée, Carte de chaleur et export Office sur le résultat filtré.
import { monter, test, egal, vrai } from './commun.mjs';

const P = (...t) => t.map((x) => `<span class="pill">${x}</span>`).join(' ');
const TAB = { id: 'tb', type: 'table', rows: [['Réf', 'Statut', 'Groupe'], ['1', 'Ouvert', P('APT28', 'APT29')], ['2', 'clos ', P('APT28')], ['3', '', 'aucun'], ['4', ' Clos', ''], ['5', 'En cours', '']] };
const FAITS = [
  { id: 'f1', type: 'facts', items: [{ k: 'Statut', v: 'Ouvert' }, { k: 'Responsable', v: 'Alice' }] },
  { id: 'f2', type: 'facts', items: [{ k: 'statut ', v: 'Clos' }] },
  { id: 'f3', type: 'facts', items: [{ k: 'Responsable', v: 'Bob' }] },
];
const doc = (q) => ({ title: 'Doc', pages: [{ id: 'p1', title: 'Accueil', blocks: [TAB, ...FAITS, { id: 'q', type: 'query', title: 'R', scope: 'doc', view: 'table', src: 'table', ...q }] }] });
const F = (id, vals, o = {}) => ({ id, prop: 'valeur', colonne: 'statut', vals, ...o });
const monte = (q) => { const { ctx, d } = monter(doc(q)); return { ctx, d, b: d.pages[0].blocks.find((x) => x.id === 'q') }; };
const refs = (q) => { const { ctx, d, b } = monte(q); return ctx.queryRecords(b, d, 0).map((r) => r.cells[0].v); };

test('« + Filtre » propose « Valeur d\'une colonne » pour les lignes de tableaux et les fiches de faits seulement', () => {
  const props = (src) => { const { ctx, b } = monte({ src }); return ctx.qFiltresProposes(b).map((f) => f.nom); };
  egal(props('table'), ['Pastilles', 'Valeur d’une colonne']);
  egal(props('facts'), ['Pastilles', 'Valeur d’une colonne']);
  for (const src of ['kanban', 'check', 'diamond']) vrai(!props(src).includes('Valeur d’une colonne'), src);
});

test('valeur d\'une colonne : lignes de tableaux filtrées sans casse ni espaces, (vide) pour une cellule vide', () => {
  egal(refs({ filtres: [F('a', ['ouvert', 'en cours'])] }), ['1', '5']);
  egal(refs({ filtres: [F('a', ['clos'], { mode: 'aucun' })] }), ['1', '3', '5']);
  egal(refs({ filtres: [F('a', [''])] }), ['3']);
  egal(refs({ filtres: [F('a', ['apt28', 'apt29'], { colonne: 'groupe', mode: 'tous' })] }), ['1']);
  egal(refs({ filtres: [F('a', ['apt28'], { colonne: 'groupe' })] }), ['1', '2']);
});

test('valeur d\'une colonne : fiches de faits (colonne = clé du fait), (vide) pour une fiche sans la clé, en « l\'une de » et « aucune de »', () => {
  const fiches = (filtres) => { const { ctx, d, b } = monte({ src: 'facts', filtres }); return ctx.queryRecords(b, d, 0).map((r) => r.x.blk.id); };
  egal(fiches([F('a', ['clos', 'ouvert'])]), ['f1', 'f2']);
  egal(fiches([F('a', [''])]), ['f3']);
  egal(fiches([F('a', [''], { mode: 'aucun' })]), ['f1', 'f2']);
  egal(fiches([F('a', ['alice'], { colonne: 'responsable', mode: 'aucun' })]), ['f2', 'f3']);
});

test('valeur d\'une colonne posée plusieurs fois, sur la même colonne ou d\'autres : filtres cumulés', () => {
  egal(refs({ filtres: [F('a', ['ouvert', 'clos', 'en cours']), F('b', ['clos'], { mode: 'aucun' })] }), ['1', '5']);
  egal(refs({ filtres: [F('a', ['ouvert', 'clos']), F('b', ['apt29'], { colonne: 'groupe', mode: 'aucun' })] }), ['2', '4']);
});

const fenetre = (q, cle) => { const { ctx, d, b } = monte(q); return ctx.qFenetre(b, d, 0, cle); };
const modes = (h) => [...h.matchAll(/data-qmode="(\w+)"[^>]*aria-pressed="(\w+)"[^>]*>([^<]+)/g)].map((m) => m[3] + (m[2] === 'true' ? '*' : ''));
const cases = (h) => [...h.matchAll(/<input type="checkbox" data-qval data-v="([^"]*)"( checked)?>(?:<span[^>]*>)*([^<]*)/g)].map((m) => m[3] + (m[2] ? '*' : ''));
const colonnes = (h) => [...h.matchAll(/<option value="([^"]*)"( selected)?>([^<]*)</g)].map((m) => m[3] + (m[2] ? '*' : ''));

test('fenêtre « Valeur d\'une colonne » : liste des colonnes en tête, puis mode, recherche et valeurs de la portée, « (vide) » en premier', () => {
  const h = fenetre({ filtres: [F('a', ['ouvert'])] }, 'f:a');
  vrai(h.includes('<h4>Valeur d’une colonne</h4>'), 'titre');
  vrai(/<select data-qcolonne/.test(h), 'liste des colonnes');
  egal(colonnes(h), ['Réf', 'Statut*', 'Groupe']);
  vrai(h.indexOf('data-qcolonne') < h.indexOf('data-qmode') && h.indexOf('data-qmode') < h.indexOf('data-qval'), 'colonne, puis mode, puis valeurs');
  egal(modes(h), ['l\'une de*', 'aucune de'], 'pas de « toutes » sans pastilles');
  vrai(h.includes('q-fen-q'), 'recherche');
  // valeurs de toute la portée (pas seulement des lignes retenues), casse et espaces fusionnés, dans l'ordre d'apparition
  egal(cases(h), ['(vide)', 'Ouvert*', 'clos', 'En cours']);
});

test('fenêtre : une cellule faite de pastilles donne une valeur par pastille, et « toutes » est proposé', () => {
  const h = fenetre({ filtres: [F('a', ['apt29'], { colonne: 'groupe', mode: 'tous' })] }, 'f:a');
  egal(modes(h), ['l\'une de', 'toutes*', 'aucune de']);
  egal(cases(h), ['(vide)', 'APT28', 'APT29*', 'aucun']);
});

test('fenêtre des fiches de faits : colonnes = clés des faits ; valeur cochée disparue gardée cochée et visible', () => {
  const h = fenetre({ src: 'facts', filtres: [F('a', ['archivé', ''])] }, 'f:a');
  egal(colonnes(h), ['Statut*', 'Responsable']);
  egal(cases(h), ['(vide)*', 'Ouvert', 'Clos', 'archivé*']);
  vrai(/q-case q-gone[^>]*title="Absente de la portée choisie"><input type="checkbox" data-qval data-v="archivé" checked/.test(h), 'archivé marquée absente');
});

test('fenêtre en attente (n:valeur:<mode>:<colonne>) : la colonne choisie, ou la première de la portée ; colonne disparue gardée', () => {
  let h = fenetre({}, 'n:valeur:aucun:groupe');
  egal(colonnes(h), ['Réf', 'Statut', 'Groupe*']);
  egal(modes(h), ['l\'une de', 'toutes', 'aucune de*']);
  egal(cases(h), ['(vide)', 'APT28', 'APT29', 'aucun']);
  egal(colonnes(fenetre({}, 'n:valeur:un')), ['Réf*', 'Statut', 'Groupe']);
  h = fenetre({ filtres: [F('a', ['x'], { colonne: 'priorité' })] }, 'f:a');
  egal(colonnes(h), ['Réf', 'Statut', 'Groupe', 'priorité*']);
  egal(cases(h), ['(vide)', 'x*']);
});

test('libellés des puces : « Statut : Ouvert ou En cours », « Statut : sauf Clos », « Statut : (vide) », noms de la portée', () => {
  const puces = (q) => { const { ctx, d, b } = monte(q); return ctx.qPuces(b, d, 0).filter((p) => p.quoi === 'filtre').map((p) => p.libelle); };
  egal(puces({ filtres: [F('a', ['ouvert', 'en cours']), F('b', ['']), F('c', ['apt28', 'apt29'], { colonne: 'groupe', mode: 'tous' })] }),
    ['Statut : Ouvert ou En cours', 'Statut : (vide)', 'Groupe : APT28 et APT29']);
  egal(puces({ src: 'facts', filtres: [F('a', ['clos'], { mode: 'aucun' }), F('b', ['ouvert'])] }), ['Statut : sauf Clos', 'Statut : Ouvert']);
  // colonne disparue : sa clé
  egal(puces({ filtres: [F('a', ['x'], { colonne: 'priorité' })] }), ['priorité : x']);
});

test('première case cochée d\'un filtre en attente : filtre posé en fin de liste, sur sa colonne et dans son mode', () => {
  const { ctx, b } = monte({ filtres: [F('a', ['ouvert'])] });
  const f = ctx.qBasculerValeur(b, b, 'filtres', { prop: 'valeur', mode: 'aucun', colonne: 'groupe' }, 'apt29');
  egal(b.filtres.map((x) => [x.prop, x.colonne, x.mode || 'un', x.vals]), [['valeur', 'statut', 'un', ['ouvert']], ['valeur', 'groupe', 'aucun', ['apt29']]]);
  vrai(f === b.filtres[1], 'rend le filtre posé');
});

test('changer de colonne : un filtre posé perd ses valeurs (retiré), la fenêtre passe en attente sur la nouvelle colonne, même mode', () => {
  const { ctx, d, b } = monte({ filtres: [F('a', ['ouvert'], { mode: 'aucun' }), F('b', ['apt28'], { colonne: 'groupe', mode: 'tous' })] });
  egal(ctx.qChangerColonne(b, d, 0, 'filtres', { id: 'a', prop: 'valeur', mode: 'aucun' }, 'groupe'), 'n:valeur:aucun:groupe');
  egal(b.filtres.map((x) => x.id), ['b']);
  egal(ctx.queryRecords(b, d, 0).map((r) => r.cells[0].v), ['1', '2'], 'résultat mis à jour aussitôt');
  // « toutes » sur une colonne sans pastilles : le mode revient à « l'une de »
  egal(ctx.qChangerColonne(b, d, 0, 'filtres', { id: 'b', prop: 'valeur', mode: 'tous' }, 'statut'), 'n:valeur:un:statut');
  vrai(!b.filtres, 'dernier filtre retiré : liste supprimée');
  // en attente : seule la clé change
  egal(ctx.qChangerColonne(b, d, 0, 'filtres', { prop: 'valeur', mode: 'tous' }, 'groupe'), 'n:valeur:tous:groupe');
});

test('normalisation : un filtre « Valeur d\'une colonne » sans colonne est écarté', () => {
  const { ctx, b } = monte({ filtres: [{ id: 'a', prop: 'valeur', vals: ['x'] }, F('b', ['ouvert'])] });
  ctx.qNormFiltres(b);
  egal(b.filtres.map((x) => x.id), ['b']);
});

// « Statut : sauf Clos » : les lignes 2 et 4 (« clos », « Clos ») sont écartées partout
const SAUF_CLOS = [F('a', ['clos'], { mode: 'aucun' })];
const office = (q) => { const { ctx, d, b } = monte({ filtres: SAUF_CLOS, ...q }); return ctx.officeTexte(ctx.officeBloc(b, d, { page: 0 })); };
const lu = (q) => { const { ctx, d } = monte({ filtres: SAUF_CLOS, ...q }); const h = ctx.renderPage(d, { page: 0, view: 'read' }); return h.slice(h.indexOf('class="q-res"') + 14).replace(/<[^>]+>/g, '|').replace(/\|[\s|]*/g, '|'); };

test('vues Regroupée et Carte de chaleur calculées sur le résultat filtré', () => {
  egal(lu({ view: 'regroupee', regX: 'statut' }), '|Ouvert|1|1 ligne|Accueil|(vide)|1|1 ligne|Accueil|En cours|1|1 ligne|Accueil|');
  const ch = lu({ view: 'chaleur', chX: 'statut', chY: 'groupe' });
  vrai(ch.startsWith('|Ouvert|1|APT28|APT29|1|') && ch.includes('|(vide)|1|aucun|1|') && ch.includes('|En cours|1|(vide)|1|') && !/clos/i.test(ch), ch);
});

test('« Copier pour Office » : mêmes lignes et mêmes comptes qu\'à l\'écran avec un filtre « Valeur d\'une colonne »', () => {
  egal(office({ view: 'table' }), 'R\nRéf\tStatut\tGroupe\tSource\n1\tOuvert\t#APT28 #APT29\tAccueil\n3\t\taucun\tAccueil\n5\tEn cours\t\tAccueil');
  egal(office({ view: 'count' }), 'R\nlignes de tableaux : 3');
  egal(office({ view: 'regroupee', regX: 'statut' }), 'R\nOuvert (1)\n(vide) (1)\nEn cours (1)');
});
