// Rendu avec un contexte explicite : page, requêtes, pliage en lecture, sommaires, fichier enregistré, carte.
import { monter, test, egal, vrai, textes, SECTIONS, DEUX_PAGES } from './commun.mjs';


test('rend une page autre que la page courante, sans changer la page courante', () => {
  const { ctx, d } = monter(DEUX_PAGES);
  const h = ctx.renderPage(d, { page: 1, view: 'read' });
  vrai(h.includes('Deuxième page') && h.includes('texte de la suite'), 'contenu de la page 2 attendu :\n' + h);
  vrai(!h.includes('Première page'), 'la page 1 ne doit pas apparaître');
  egal(d.cur, 0, 'page courante inchangée');
});

// requête sur des fiches de faits, rangées par nom croissant dans le document ; ordre lu dans la première colonne
const FICHE = (id, nom) => ({ id, type: 'facts', items: [{ k: 'Nom', v: nom }] });
const REQUETE = {
  title: 'Doc',
  pages: [{ id: 'p1', title: 'Accueil', blocks: [FICHE('f1', 'Alpha'), FICHE('f2', 'Bravo'), FICHE('f3', 'Charlie'),
    { id: 'q1', type: 'query', src: 'facts', scope: 'doc', view: 'table', sortBy: 'c:nom', sortDir: 'asc' }] }],
};
const TRI_DESC = { q1: { by: 'c:nom', dir: 'desc' } };
const ordre = (h) => textes(h, /<tr><td>([\s\S]*?)<\/td>/g);

test('le tri de lecture d\'une requête s\'applique en vue read', () => {
  const { ctx, d } = monter(REQUETE);
  egal(ordre(ctx.renderPage(d, { page: 0, view: 'read' })), ['Alpha', 'Bravo', 'Charlie'], 'sans tri de session : tri enregistré');
  egal(ordre(ctx.renderPage(d, { page: 0, view: 'read', sort: TRI_DESC })), ['Charlie', 'Bravo', 'Alpha'], 'tri de session');
});

test('le tri de session est ignoré en vue export et en édition ; l\'export n\'a pas d\'en-tête cliquable', () => {
  const { ctx, d } = monter(REQUETE);
  const ex = ctx.renderPage(d, { page: 0, view: 'export', sort: TRI_DESC });
  egal(ordre(ex), ['Alpha', 'Bravo', 'Charlie'], 'export');
  vrai(!ex.includes('data-qsort'), 'export : pas de bouton de tri');
  vrai(ctx.renderPage(d, { page: 0, view: 'read' }).includes('data-qsort'), 'lecture : en-têtes cliquables');
  const ed = ctx.renderPage(d, { page: 0, view: 'edit', sort: TRI_DESC });
  egal(ordre(ed), ['Alpha', 'Bravo', 'Charlie'], 'édition');
});

test('kanban : cartes déplaçables en lecture, sans commande de déplacement en vue export', () => {
  const { ctx, d } = monter({ title: 'Doc', pages: [{ id: 'p1', blocks: [{ id: 'k1', type: 'kanban', cols: [{ id: 'c1', title: 'À faire', cards: [{ id: 'x', title: 'Tâche' }] }] }] }] });
  const lu = ctx.renderPage(d, { page: 0, view: 'read' }), ex = ctx.renderPage(d, { page: 0, view: 'export' });
  vrai(lu.includes('data-kbmove') && lu.includes('draggable="true"'), 'lecture : carte déplaçable');
  vrai(ex.includes('Tâche') && !ex.includes('data-kbmove') && !ex.includes('draggable'), 'export : carte figée');
});

// attributs de pliage posés sur la balise de chaque bloc rendu en lecture
const plis = (h) => Object.fromEntries([...h.matchAll(/<\w+[^>]*>(?:<button[^>]*data-vfold[^>]*><\/button>)?([^<]+)</g)]
  .map((m) => [m[1], /data-folded/.test(m[0]) ? 'plié' : /data-fh/.test(m[0]) ? 'masqué' : '']));

test('pliage en lecture : plis de session en vue read, état enregistré sinon', () => {
  const { ctx, d } = monter(SECTIONS);
  egal(plis(ctx.renderPage(d, { page: 0, view: 'read' })),
    { 'Section un': '', 'dans un': '', 'Sous-section': '', 'dans la sous-section': '', 'Section deux': 'plié', 'dans deux': 'masqué' }, 'état enregistré');
  egal(plis(ctx.renderPage(d, { page: 0, view: 'read', folds: { s1: true, s3: false } })),
    { 'Section un': 'plié', 'dans un': 'masqué', 'Sous-section': 'masqué', 'dans la sous-section': 'masqué', 'Section deux': '', 'dans deux': '' }, 'plis de session');
  egal(plis(ctx.renderPage(d, { page: 0, view: 'export', folds: { s1: true, s3: false } }))['Section deux'], 'plié', 'export : plis de session ignorés');
});

test('pliage en édition : les blocs d\'une section pliée ne sont pas rendus', () => {
  const { ctx, d } = monter(SECTIONS);
  const h = ctx.renderPage(d, { page: 0, view: 'edit', folds: { s3: false } });
  vrai(h.includes('Section deux') && !h.includes('dans deux'), 'section pliée du document masquée en édition');
  vrai(h.includes('1 bloc masqué'), 'nombre de blocs masqués affiché');
});

test('barre d\'outils maintenue : seulement en édition, sur le bloc du contexte', () => {
  const { ctx, d } = monter(SECTIONS);
  const h = ctx.renderPage(d, { page: 0, view: 'edit', editor: { bar: 'x1' } });
  egal([...h.matchAll(/class="blk bar-on[^"]*" data-id="(\w+)"/g)].map((m) => m[1]), ['x1']);
  vrai(!ctx.renderPage(d, { page: 0, view: 'edit' }).includes('bar-on'), 'sans contexte d\'édition : aucune barre maintenue');
});

// trois pages : Accueil, et sa sous-page Détail (avec deux sections et un bloc sommaire), puis Annexe
const ARBRE = {
  title: 'Doc',
  pages: [
    { id: 'p1', title: 'Accueil', blocks: [{ id: 'a1', type: 'h2', html: 'Intro' }] },
    { id: 'p2', title: 'Détail', lv: 1, blocks: [{ id: 'm1', type: 'summary' }, { id: 'd1', type: 'h2', html: 'Méthode' }, { id: 'd2', type: 'h3', html: 'Mesures' }] },
    { id: 'p3', title: 'Annexe', blocks: [{ id: 'z1', type: 'h2', html: 'Sources' }] },
  ],
};
const liens = (h) => textes(h, /<a href="[^"]*"[^>]*>([\s\S]*?)<\/a>/g);

test('bloc sommaire d\'une page autre que la page courante : ses propres sections', () => {
  const { ctx, d } = monter(ARBRE);
  egal(liens(ctx.renderPage(d, { page: 1, view: 'read' })), ['Méthode', 'Mesures']);
  egal(ctx.summaryList(d.pages[1].blocks[0], d, 1).includes('#pg-p2/d1'), true, 'lien vers la section de la page 2');
});

test('sommaire latéral : page du contexte, ses sections, plis du sommaire', () => {
  const { ctx, d } = monter(ARBRE);
  const h = ctx.navHTML(d, { page: 1, view: 'read' });
  egal([...h.matchAll(/<li class="toc-p on[^"]*" data-pgi="(\d)"/g)].map((m) => m[1]), ['1'], 'page 2 en cours');
  egal(textes(h, /<a href="#b-[^"]*" data-sec="[^"]*">([\s\S]*?)<\/a>/g), ['Méthode', 'Mesures'], 'sections de la page en cours seulement');
  vrai(/data-pgi="0"[^>]*>/.test(h) && /class="toc-p has-kids open" data-pgi="0"/.test(h), 'parent de la page en cours déplié');
  vrai(/class="toc-p has-kids" data-pgi="0"/.test(ctx.navHTML(d, { page: 1, view: 'read', navFolds: { p1: false } })), 'replié à la main');
  const ex = ctx.navHTML(d, { page: 0, view: 'export' });
  egal(textes(ex, /<a href="#b-[^"]*" data-sec="[^"]*">([\s\S]*?)<\/a>/g), ['Intro', 'Méthode', 'Mesures', 'Sources'], 'export : sections de toutes les pages');
  vrai(!ex.includes('data-pgm') && h.indexOf('data-pgm') < 0 && ctx.navHTML(d, { page: 1, view: 'edit' }).includes('data-pgm'), 'menus de page en édition seulement');
});

test('fichier enregistré : le même en lecture et en édition, avec des tris et des plis de session', () => {
  const brut = { title: 'Doc', pages: [REQUETE.pages[0], SECTIONS.pages[0]].map((pg, i) => ({ ...pg, id: 'p' + i })) };
  const neutre = monter(brut), session = monter(brut, { sort: TRI_DESC, folds: { s1: true, s3: false }, navFolds: { p0: false } });
  const ref = neutre.ctx.fileAppHTML(neutre.d, 0);
  egal(ordre(ref), ['Alpha', 'Bravo', 'Charlie'], 'tri enregistré');
  for (const m of ['view', 'edit']) {
    session.ctx.mode = m; session.ctx.barHold = 'q1';
    egal(session.ctx.fileAppHTML(session.d, 0), ref, 'mode ' + m);
  }
  session.d.cur = 1; neutre.d.cur = 1;
  egal(plis(session.ctx.fileAppHTML(session.d, 1))['Section deux'], 'plié', 'plis enregistrés, pas ceux de la session');
  egal(session.ctx.fileAppHTML(session.d, 1), neutre.ctx.fileAppHTML(neutre.d, 1), 'page 2');
});

// carte : la clé CARTO du document rendu passe à la page de lecture ; en édition, l'état de dessin vient du contexte
const CARTE = { title: 'Doc', mapKey: 'CLE-DOC', pages: [{ id: 'p1', title: 'Carte', blocks: [{ id: 'c1', type: 'map', markers: [{ lat: 48.4, lon: -4.5, label: 'Brest' }], list: true }] }] };

test('carte : la clé du document rendu en lecture et en export, l\'outil de dessin du contexte en édition', () => {
  const { ctx, d } = monter(CARTE);
  for (const view of ['read', 'export']) vrai(ctx.renderPage(d, { page: 0, view }).includes('&quot;key&quot;:&quot;CLE-DOC&quot;'), view + ' : clé du document attendue');
  const ed = ctx.renderPage(d, { page: 0, view: 'edit', editor: { map: { draw: 'c1', kind: 'route' } } });
  vrai(/data-kind="route" aria-pressed="true"/.test(ed) && /data-kind="poly" aria-pressed="false"/.test(ed), 'édition : itinéraire en cours de dessin');
});

test('indice de page hors du document : la dernière page, comme le sommaire latéral', () => {
  const { ctx, d } = monter(DEUX_PAGES);
  vrai(ctx.renderPage(d, { page: 7, view: 'read' }).includes('Deuxième page'), 'renderPage');
  vrai(ctx.renderPage(d, { page: -1, view: 'read' }).includes('Première page'), 'renderPage, indice négatif');
  egal(ctx.anchorBlock(d, { page: 7, view: 'read' }, 'b2'), 'b2', 'anchorBlock');
  vrai(/<li class="toc-p on[^"]*" data-pgi="1"/.test(ctx.navHTML(d, { page: 7, view: 'read' })), 'navHTML');
});
