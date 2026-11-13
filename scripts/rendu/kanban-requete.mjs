// Requête sur les cartes de kanban : champs des cartes (champs : masques, ordre), « Attend », filtre « Bloquées »,
// colonne « Attend » en vue tableau ; première couverture de la vue kanban d'une requête.
import { monter, test, egal, vrai, textes } from './commun.mjs';

// kanban : « Écrire » attend « Relire » (encore à faire) et « Valider » (fini) → bloquée ; « Publier » attend « Valider » seulement
const KB = { id: 'kb', type: 'kanban', cols: [
  { id: 'c1', title: 'À faire', cards: [
    { id: 'k1', title: 'Écrire', html: 'le plan', due: '2026-03-12', who: 'Alice', prio: 'p1', dep: ['k2', 'k3'] },
    { id: 'k2', title: 'Relire', html: '', due: '', who: '' },
    { id: 'k4', title: 'Publier', html: '', due: '', who: 'Bob', dep: ['k3'] },
  ] },
  { id: 'c2', title: 'Fait', cards: [{ id: 'k3', title: 'Valider', html: '', due: '', who: '' }] },
] };
const doc = (q) => ({ title: 'Doc', pages: [{ id: 'p1', title: 'Accueil', blocks: [KB, { id: 'q', type: 'query', src: 'kanban', scope: 'doc', view: 'kanban', ...q }] }] });
const rendu = (q, vue) => { const { ctx, d } = monter(doc(q)); return ctx.renderPage(d, { page: 0, view: vue || 'read' }); };
const resultat = (h) => h.slice(h.indexOf('class="q-res"'));
const cartes = (h) => [...resultat(h).matchAll(/<article class="([^"]*)">([\s\S]*?)<\/article>/g)].map((m) => ({ cls: m[1], html: m[2] }));
const titres = (h) => cartes(h).map((c) => c.html.match(/<div class="kb-ct">([\s\S]*?)<\/div>/)[1]);

test('requête kanban : filtre « Bloquées » (une carte attendue hors de la dernière colonne) ; la carte bloquée garde ses pointillés', () => {
  egal(titres(rendu({})), ['Écrire', 'Relire', 'Publier', 'Valider']);
  egal(titres(rendu({ bloquees: true })), ['Écrire']);
  vrai(cartes(rendu({}))[0].cls.split(' ').includes('kb-blocked'), 'Écrire en pointillés');
  vrai(!cartes(rendu({}))[2].cls.includes('kb-blocked'), 'Publier n\'attend qu\'une carte finie');
});

// ordre des champs d'une carte : priorité, échéance, responsable (dans .kb-meta), texte, Attend, Source
const champs = (carte) => [...carte.matchAll(/class="kb-(prio|due|who|tx|wait)\b|class="q-src"/g)].map((m) => m[1] || 'src');

test('requête kanban : sans réglage, les champs d\'avant (texte, priorité, échéance, responsable, source), sans « Attend »', () => {
  const c = cartes(rendu({}))[0].html;
  egal(champs(c), ['tx', 'prio', 'due', 'who', 'src']);
  vrai(/^<div class="kb-ct">Écrire<\/div><div class="kb-tx">le plan<\/div><div class="kb-meta">/.test(c), c);
});

test('requête kanban : champs masqués et ordonnés, « Attend » liste les cartes attendues (en rouge si bloquée), titre toujours là', () => {
  const c = cartes(rendu({ champs: { masques: ['texte', 'priorite'], ordre: ['attend', 'responsable', 'source', 'echeance'] } }))[0].html;
  egal(champs(c), ['wait', 'who', 'src', 'due']);
  vrai(c.startsWith('<div class="kb-ct">Écrire</div>'), 'titre en tête');
  vrai(c.includes('<div class="kb-wait blocked">Attend : <span class="kb-dref">Relire</span>, <span class="kb-dref">Valider</span></div>'), c);
  vrai(!c.includes('data-kbgo'), 'pas de lien de défilement depuis une requête');
  egal(champs(cartes(rendu({ champs: { masques: [], ordre: [] } }))[0].html), ['tx', 'prio', 'due', 'who', 'src', 'wait'], 'tous : Attend en dernier');
  egal(champs(cartes(rendu({ champs: { masques: ['responsable'], ordre: [] } }))[1].html), ['src'], 'Relire n\'attend rien : pas de ligne Attend');
});

test('requête kanban : colonne « Attend » proposée en tableau, masquée par défaut, affichée en la cochant ; liste et tri', () => {
  const entetes = (h) => textes(resultat(h), /<th>([\s\S]*?)<\/th>/g).map((t) => t.replace(/ [↑↓]$/, ''));
  egal(entetes(rendu({ view: 'table' })), ['Titre', 'Colonne', 'Priorité', 'Échéance', 'Responsable', 'Source']);
  const h = rendu({ view: 'table', colonnes: { mode: 'sauf', noms: [], ordre: [] } });
  egal(entetes(h), ['Titre', 'Colonne', 'Priorité', 'Échéance', 'Responsable', 'Attend', 'Source']);
  egal(textes(resultat(h), /<tr><td>[^<]*<\/td>(?:<td>[^<]*<\/td>){4}<td>([^<]*)<\/td>/g), ['Relire, Valider', '', 'Valider', '']);
  egal(entetes(rendu({ view: 'table', colonnes: { mode: 'seulement', noms: ['titre', '#attend'], ordre: ['#attend'] } })), ['Attend', 'Titre']);
  const li = resultat(rendu({ view: 'list', colonnes: { mode: 'seulement', noms: ['titre', '#attend'], ordre: [] } }));
  vrai(li.includes('<span class="q-k">Attend</span> Relire, Valider'), li);
  const tri = rendu({ view: 'table', sortBy: 'att', sortDir: 'asc', colonnes: { mode: 'seulement', noms: ['titre'], ordre: [] } });
  egal(textes(resultat(tri), /<tr><td>([^<]*)<\/td>/g), ['Écrire', 'Publier', 'Relire', 'Valider'], 'tri sur Attend masquée, vides à la fin');
  vrai(!resultat(rendu({ view: 'table' }, 'edit')).includes('data-qcol="#attend" checked'), 'case Attend décochée par défaut');
});

test('requête kanban : réglages en édition seulement (case « bloquées seulement », champs des cartes en vue kanban)', () => {
  const ed = rendu({ champs: { masques: ['texte'], ordre: ['source'] } }, 'edit');
  vrai(ed.includes('data-qbloquees') && !ed.includes('data-qbloquees checked'), 'case bloquées');
  vrai(rendu({ bloquees: true }, 'edit').includes('data-qbloquees checked'), 'case cochée');
  egal([...ed.matchAll(/data-qchamp="([^"]*)"( checked)?/g)].map((m) => m[1] + (m[2] ? '+' : '-')), ['source+', 'texte-', 'priorite+', 'echeance+', 'responsable+', 'attend+']);
  vrai(!ed.includes('data-qcolmode'), 'pas de choix des colonnes en vue kanban');
  vrai(rendu({ view: 'table' }, 'edit').includes('data-qbloquees') && !rendu({ view: 'table' }, 'edit').includes('data-qchamp'), 'tableau : filtre, pas de champs');
  for (const v of ['read', 'export']) vrai(!rendu({}, v).includes('data-qchamp') && !rendu({}, v).includes('data-qbloquees'), v);
});

const pur = (x) => JSON.parse(JSON.stringify(x));
test('requête kanban, gestes : masquer ou afficher un champ, le déplacer (premier geste : Attend reste masqué)', () => {
  const { ctx, d } = monter(doc({})), b = d.pages[0].blocks[1];
  egal(pur(ctx.qChampBasculer(b, 'texte')), { masques: ['attend', 'texte'], ordre: [] });
  egal(pur(ctx.qChampBasculer(b, 'attend')), { masques: [], ordre: [] });
  egal(pur(ctx.qChampDeplacer(b, 'source', 0)), { masques: ['attend'], ordre: ['source', 'texte', 'priorite', 'echeance', 'responsable', 'attend'] });
  b.champs = { masques: ['texte', 'inconnu'], ordre: [] };
  egal(pur(ctx.qChampBasculer(b, 'texte')), { masques: [], ordre: [] }, 'clé inconnue purgée');
});

const office = (q) => { const { ctx, d } = monter(doc(q)); const e = ctx.officeBloc(d.pages[0].blocks[1], d, { page: 0 }); return { texte: ctx.officeTexte(e), html: ctx.officeHtml(e, d) }; };
test('office : requête kanban, cartes aux champs choisis avec « Attend », colonne « Attend » en tableau', () => {
  egal(office({}).texte.split('\n')[0], 'À faire (3)\tFait (1)', 'en-têtes des colonnes');
  const t = office({ champs: { masques: ['source', 'echeance'], ordre: ['attend'] } }).texte;
  vrai(t.includes('Écrire Attend : Relire, Valider le plan Priorité P1 (haute) · Responsable : Alice'), t);
  vrai(!t.includes('Accueil'), 'source masquée');
  const sans = office({}).texte;
  vrai(sans.includes('Écrire le plan Priorité P1 (haute) · Échéance : 12 mars 2026 · Responsable : Alice Accueil') && !sans.includes('Attend'), sans);
  const h = office({ champs: { masques: [], ordre: ['attend'] } }).html;
  vrai(/color:#b42318[^>]*>Attend : Relire, Valider/.test(h), 'Attend en rouge si bloquée');
  egal(office({ view: 'table', colonnes: { mode: 'seulement', noms: ['titre', '#attend'], ordre: [] } }).texte, 'Titre\tAttend\nÉcrire\tRelire, Valider\nRelire\t\nPublier\tValider\nValider\t');
  egal(office({ view: 'list', colonnes: { mode: 'seulement', noms: ['titre', '#attend'], ordre: [] } }).texte.split('\n')[0], '- Titre Écrire · Attend Relire, Valider', 'liste');
});

test('requête kanban : colonne « Attend » avec la règle de Source en tête de la vue liste (ticket 01) ; déplacer Attend laisse Source hors de l\'ordre', () => {
  const li = resultat(rendu({ view: 'list', colonnes: { mode: 'sauf', noms: [], ordre: [] } })).match(/<li>([\s\S]*?)<\/li>/)[1];
  egal([...li.matchAll(/class="q-src"|<span class="q-k">([^<]*)/g)].map((m) => m[1] || 'Source'), ['Source', 'Titre', 'Colonne', 'Priorité', 'Échéance', 'Responsable', 'Attend']);
  const { ctx, d } = monter(doc({ view: 'list' })), b = d.pages[0].blocks[1];
  const dp = ctx.qColonnesDispo(b, ctx.queryRecords(b, d, 0), true).dispo;
  egal(pur(ctx.qColBasculer(b, dp, '#attend')), { mode: 'sauf', noms: [], ordre: [] }, 'cocher Attend');
  egal(pur(ctx.qColDeplacer(b, dp, '#attend', 1)), { mode: 'sauf', noms: ['#attend'], ordre: ['#attend', 'titre', 'colonne', 'priorité', 'échéance', 'responsable'] });
});
