// Choix des colonnes d'une requête (champ colonnes : mode, noms, ordre) : vues tableau, liste et en colonnes, cases, diamants.
import { monter, test, egal, vrai, textes } from './commun.mjs';

// deux tableaux aux colonnes de même nom (casse différente) ; le second ajoute « Note »
const TAB = (id, rows) => ({ id, type: 'table', rows });
const doc = (q, extra) => ({ title: 'Doc', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  TAB('t1', [['Hôte', 'État', 'Risque'], ['srv1', 'ok', 'bas'], ['srv2', 'ko', 'haut']]),
  ...(extra || []),
  { id: 'q', type: 'query', src: 'table', scope: 'doc', view: 'table', ...q },
] }] });
const rendu = (q, extra, vue) => { const { ctx, d } = monter(doc(q, extra)); return ctx.renderPage(d, { page: 0, view: vue || 'read' }); };
const resultat = (h) => h.slice(h.indexOf('class="q-res"'));
const entetes = (h) => textes(resultat(h), /<th>([\s\S]*?)<\/th>/g).map((t) => t.replace(/ [↑↓]$/, ''));
const premiereLigne = (h) => textes(resultat(h).slice(resultat(h).indexOf('<tbody>')), /<td>([\s\S]*?)<\/td>/g).slice(0, entetes(h).length);

test('colonnes : absent = toutes les colonnes, puis Source', () => {
  egal(entetes(rendu({})), ['Hôte', 'État', 'Risque', 'Source']);
});

test('colonnes : « Toutes sauf… » masque, « Seulement… » garde ; une colonne ajoutée plus tard suit le mode', () => {
  egal(entetes(rendu({ colonnes: { mode: 'sauf', noms: ['état'], ordre: [] } })), ['Hôte', 'Risque', 'Source']);
  egal(entetes(rendu({ colonnes: { mode: 'seulement', noms: ['risque', 'hôte'], ordre: [] } })), ['Hôte', 'Risque'], 'ordre d\'apparition, Source cachée');
  const plus = [TAB('t2', [['hôte', 'Note'], ['srv3', 'neuve']])];
  egal(entetes(rendu({ colonnes: { mode: 'sauf', noms: ['état'], ordre: [] } }, plus)), ['Hôte', 'Risque', 'Note', 'Source'], 'sauf : nouvelle colonne visible, Hôte fusionnée sans casse');
  egal(entetes(rendu({ colonnes: { mode: 'seulement', noms: ['hôte'], ordre: [] } }, plus)), ['Hôte'], 'seulement : nouvelle colonne cachée');
  egal(entetes(rendu({ colonnes: { mode: 'toutes', noms: ['état'], ordre: [] } })), ['Hôte', 'État', 'Risque', 'Source'], 'toutes : noms ignorés');
});

test('colonnes : ordre choisi, Source déplacée ou masquée ; les colonnes absentes de l\'ordre suivent', () => {
  const h = rendu({ colonnes: { mode: 'toutes', noms: [], ordre: ['#source', 'risque'] } });
  egal(entetes(h), ['Source', 'Risque', 'Hôte', 'État']);
  egal(premiereLigne(h), ['Accueil', 'bas', 'srv1', 'ok'], 'cellules dans l\'ordre des en-têtes');
  egal(entetes(rendu({ colonnes: { mode: 'sauf', noms: ['#source'], ordre: [] } })), ['Hôte', 'État', 'Risque']);
});

test('colonnes : clé disparue ou renommée oubliée sans erreur', () => {
  egal(entetes(rendu({ colonnes: { mode: 'sauf', noms: ['ancienne'], ordre: ['ancienne', 'risque'] } })), ['Risque', 'Hôte', 'État', 'Source']);
  egal(entetes(rendu({ colonnes: { mode: 'seulement', noms: ['ancienne'], ordre: [] } })), [], 'rien de gardé : aucune colonne');
});

test('colonnes : tri et regroupement sur une colonne masquée', () => {
  const h = rendu({ sortBy: 'c:risque', sortDir: 'desc', colonnes: { mode: 'sauf', noms: ['risque'], ordre: [] } });
  egal(entetes(h), ['Hôte', 'État', 'Source']);
  egal(premiereLigne(h)[0], 'srv2', 'trié par Risque décroissant');
  const k = rendu({ view: 'kanban', groupBy: 'c:état', colonnes: { mode: 'sauf', noms: ['état', 'hôte'], ordre: [] } });
  egal(textes(k, /<span class="kb-title">([\s\S]*?)<\/span>/g), ['ok', 'ko'], 'regroupées par État masqué');
  egal(textes(k, /<span class="q-k">([\s\S]*?)<\/span>/g), ['Risque', 'Risque'], 'Hôte masqué sur les cartes');
});

test('colonnes : vue liste et vue en colonnes suivent le choix ; Source en tête de la liste tant qu\'elle n\'est pas déplacée', () => {
  const liste = (c) => resultat(rendu({ view: 'list', colonnes: c })).match(/<li>([\s\S]*?)<\/li>/)[1];
  const ordre = (li) => [...li.matchAll(/class="q-src"|<span class="q-k">([^<]*)/g)].map((m) => m[1] || 'Source');
  egal(ordre(liste(undefined)), ['Source', 'Hôte', 'État', 'Risque']);
  egal(ordre(liste({ mode: 'sauf', noms: ['état'], ordre: ['risque'] })), ['Source', 'Risque', 'Hôte']);
  egal(ordre(liste({ mode: 'toutes', noms: [], ordre: ['hôte', '#source'] })), ['Hôte', 'Source', 'État', 'Risque'], 'Source déplacée');
  egal(ordre(liste({ mode: 'sauf', noms: ['#source'], ordre: [] })), ['Hôte', 'État', 'Risque'], 'Source masquée');
  const carte = (c) => resultat(rendu({ view: 'kanban', groupBy: 'c:hôte', colonnes: c })).match(/<article class="kb-card">([\s\S]*?)<\/article>/)[1];
  egal(ordre(carte({ mode: 'toutes', noms: [], ordre: ['#source', 'risque'] })), ['Source', 'Risque', 'État']);
  egal(ordre(carte({ mode: 'sauf', noms: ['#source'], ordre: [] })), ['État', 'Risque']);
});

test('colonnes : cases à cocher (✓, Élément, Source) et modèles diamant', () => {
  const cases = { id: 'c1', type: 'check', items: [{ html: 'fait', done: true }] };
  const h = (c, v) => rendu({ src: 'check', view: v || 'table', colonnes: c }, [cases]);
  egal(entetes(h()), ['✓', 'Élément', 'Source']);
  egal(entetes(h({ mode: 'sauf', noms: ['✓'], ordre: ['#source'] })), ['Source', 'Élément']);
  vrai(!resultat(h({ mode: 'sauf', noms: ['✓'], ordre: [] })).includes('q-box'), 'case masquée');
  vrai(!resultat(h({ mode: 'seulement', noms: ['élément'], ordre: [] }, 'list')).includes('q-src'), 'liste : Source masquée');
  const dia = { id: 'd1', type: 'diamond', title: 'Campagne', adversaire: 'A', capacite: 'C', infrastructure: 'I', victime: 'V' };
  egal(entetes(rendu({ src: 'diamond', colonnes: { mode: 'seulement', noms: ['adversaire', 'titre'], ordre: ['adversaire'] } }, [dia])), ['Adversaire', 'Titre']);
});

test('colonnes : réglage dans le formulaire en édition seulement', () => {
  const ed = rendu({ colonnes: { mode: 'sauf', noms: ['état'], ordre: ['risque'] } }, null, 'edit');
  vrai(ed.includes('data-qcolmode'), 'mode des colonnes');
  egal([...ed.matchAll(/data-qcol="([^"]*)"( checked)?/g)].map((m) => m[1] + (m[2] ? '+' : '-')), ['risque+', 'hôte+', 'état-', '#source+'], 'cases dans l\'ordre choisi');
  vrai(!rendu({}).includes('data-qcol') && !rendu({}, null, 'export').includes('data-qcol'), 'lecture et export : aucun réglage');
});

// gestes du formulaire : fonctions pures qui rendent le nouveau champ colonnes à partir des colonnes disponibles
const dispo = (q) => { const { ctx, d } = monter(doc(q)); const b = d.pages[0].blocks.find((x) => x.id === 'q'); return { ctx, b, dispo: ctx.qColonnesDispo(b, ctx.queryRecords(b, d, 0), (b.view || 'table') === 'list').dispo }; };
const pur = (x) => JSON.parse(JSON.stringify(x));

test('colonnes, gestes : décocher part de « Toutes sauf… », recocher, mode « Seulement… » repris des colonnes visibles', () => {
  let { ctx, b, dispo: dp } = dispo({});
  egal(pur(ctx.qColBasculer(b, dp, 'état')), { mode: 'sauf', noms: ['état'], ordre: [] }, 'premier choix');
  b.colonnes = { mode: 'sauf', noms: ['état', 'ancienne'], ordre: ['ancienne'] };
  egal(pur(ctx.qColBasculer(b, dp, 'état')), { mode: 'sauf', noms: [], ordre: [] }, 'recochée ; clé disparue purgée');
  egal(pur(ctx.qColMode(b, dp, 'seulement')), { mode: 'seulement', noms: ['hôte', 'risque', '#source'], ordre: [] }, 'seulement : les visibles');
  b.colonnes = { mode: 'seulement', noms: ['hôte'], ordre: [] };
  egal(pur(ctx.qColMode(b, dp, 'sauf')), { mode: 'sauf', noms: ['état', 'risque', '#source'], ordre: [] }, 'sauf : les cachées');
  egal(pur(ctx.qColBasculer(b, dp, 'risque')), { mode: 'seulement', noms: ['hôte', 'risque'], ordre: [] }, 'seulement : cocher ajoute');
  egal(pur(ctx.qColMode(b, dp, 'toutes')), { mode: 'toutes', noms: [], ordre: [] });
});

test('colonnes, gestes : déplacer une colonne range les clés ; Source n\'y entre que déplacée elle-même', () => {
  const { ctx, b, dispo: dp } = dispo({ colonnes: { mode: 'sauf', noms: ['état'], ordre: [] } });
  egal(pur(ctx.qColDeplacer(b, dp, '#source', 0)), { mode: 'sauf', noms: ['état'], ordre: ['#source', 'hôte', 'état', 'risque'] });
  egal(pur(ctx.qColDeplacer(b, dp, 'hôte', 2)), { mode: 'sauf', noms: ['état'], ordre: ['état', 'risque', 'hôte'] }, 'vers le bas, Source hors de l\'ordre');
  const sans = dispo({});
  egal(pur(sans.ctx.qColDeplacer(sans.b, sans.dispo, 'risque', 0)), { mode: 'toutes', noms: [], ordre: ['risque', 'hôte', 'état'] }, 'sans choix : toutes');
  const bougee = dispo({ colonnes: { mode: 'toutes', noms: [], ordre: ['hôte', '#source'] } });
  egal(pur(bougee.ctx.qColDeplacer(bougee.b, bougee.dispo, 'risque', 0)), { mode: 'toutes', noms: [], ordre: ['risque', 'hôte', '#source', 'état'] }, 'Source déjà déplacée : gardée à sa place');
});

test('colonnes, vue liste : Source reste en tête après le déplacement d\'une autre colonne, réglage dans l\'ordre affiché', () => {
  const l = dispo({ view: 'list' });
  egal(l.dispo.map((c) => c.cle), ['#source', 'hôte', 'état', 'risque'], 'liste : Source en tête des colonnes disponibles');
  const ch = pur(l.ctx.qColDeplacer(l.b, l.dispo, 'risque', 1));
  egal(ch, { mode: 'toutes', noms: [], ordre: ['risque', 'hôte', 'état'] }, 'Risque juste après Source');
  const liste = resultat(rendu({ view: 'list', colonnes: ch })).match(/<li>([\s\S]*?)<\/li>/)[1];
  egal([...liste.matchAll(/class="q-src"|<span class="q-k">([^<]*)/g)].map((m) => m[1] || 'Source'), ['Source', 'Risque', 'Hôte', 'État']);
  const ed = rendu({ view: 'list', colonnes: ch }, null, 'edit');
  egal([...ed.matchAll(/data-qcol="([^"]*)"/g)].map((m) => m[1]), ['#source', 'risque', 'hôte', 'état'], 'réglage dans l\'ordre de la liste');
  egal(entetes(rendu({ colonnes: ch })), ['Risque', 'Hôte', 'État', 'Source'], 'vue tableau : Source en fin');
});

test('colonnes : vue en colonnes des cases à cocher, case et élément ensemble, Source à sa place', () => {
  const cases = { id: 'c1', type: 'check', items: [{ html: 'fait', done: true }] };
  const carte = (c) => resultat(rendu({ src: 'check', view: 'kanban', colonnes: c }, [cases])).match(/<article class="kb-card done">([\s\S]*?)<\/article>/)[1];
  vrai(/^<div class="q-it"><span class="q-box"[^>]*>☑<\/span> fait<\/div><a class="q-src"/.test(carte(undefined).replace(/<button[^>]*>/, '<span class="q-box">').replace('</button>', '</span>')), carte(undefined));
  vrai(/^<a class="q-src"[^>]*>Accueil<\/a><div class="q-it">fait<\/div>$/.test(carte({ mode: 'sauf', noms: ['✓'], ordre: ['#source'] })), carte({ mode: 'sauf', noms: ['✓'], ordre: ['#source'] }));
});
