// Déplacer un bloc vers une autre page (deplacerVersPage, pageDuBloc) : unité emportée, place d'arrivée, refus ;
// bouton de la barre du bloc ; sommaire et requêtes qui suivent le bloc à sa nouvelle page.
import { monter, test, egal, vrai } from './commun.mjs';

// page source : en-tête, section h2 (avec sous-section h3 et paragraphes), section suivante, pied de page ;
// page cible : en-tête, paragraphe, pied de page ; troisième page sans pied
const DOC = () => ({
  title: 'Doc',
  pages: [
    { id: 'p1', title: 'Accueil', blocks: [
      { id: 'hd1', type: 'header', title: 'Accueil' },
      { id: 's1', type: 'h2', html: 'Courses' }, { id: 'x1', type: 'p', html: 'du pain' },
      { id: 's2', type: 'h3', html: 'Marché' }, { id: 'x2', type: 'p', html: 'des pommes #fruit' },
      { id: 's3', type: 'h2', html: 'Voyage' }, { id: 'x3', type: 'p', html: 'le train' },
      { id: 'f1', type: 'footer', html: 'Sources' },
    ] },
    { id: 'p2', title: 'Suite', blocks: [
      { id: 'hd2', type: 'header', title: 'Suite' }, { id: 'y1', type: 'p', html: 'déjà là' }, { id: 'f2', type: 'footer', html: 'Pied' },
    ] },
    { id: 'p3', title: 'Fin', blocks: [{ id: 'z1', type: 'h2', html: 'Annexe', folded: true }, { id: 'z2', type: 'p', html: 'caché' }] },
  ],
});
const ids = (pg) => pg.blocks.map((b) => b.id);
const deplacer = (doc, de, bid, vers) => { const { ctx, d } = monter(doc); const r = ctx.deplacerVersPage(d.pages, de, bid, vers); return { r, d, ctx }; };

test('deplacerVersPage : une section part avec sa sous-section et leurs blocs, avant le pied de page de la cible', () => {
  const { r, d } = deplacer(DOC(), 0, 's1', 1);
  egal(r, 4, 'nombre de blocs déplacés');
  egal(ids(d.pages[0]), ['hd1', 's3', 'x3', 'f1'], 'page source');
  egal(ids(d.pages[1]), ['hd2', 'y1', 's1', 'x1', 's2', 'x2', 'f2'], 'page cible');
});

test('deplacerVersPage : une section pliée part aussi avec son contenu, et garde son pli', () => {
  const doc = DOC(); doc.pages[0].blocks[1].folded = true;
  const { d } = deplacer(doc, 0, 's1', 1);
  egal(ids(d.pages[1]), ['hd2', 'y1', 's1', 'x1', 's2', 'x2', 'f2']);
  egal(d.pages[1].blocks[2].folded, true, 'réglage gardé');
});

test('deplacerVersPage : une sous-section s\'arrête au titre de même niveau ; un paragraphe part seul', () => {
  egal(ids(deplacer(DOC(), 0, 's2', 1).d.pages[1]), ['hd2', 'y1', 's2', 'x2', 'f2'], 'h3');
  egal(ids(deplacer(DOC(), 0, 'x1', 1).d.pages[0]), ['hd1', 's1', 's2', 'x2', 's3', 'x3', 'f1'], 'paragraphe');
  egal(ids(deplacer(DOC(), 0, 's3', 1).d.pages[0]), ['hd1', 's1', 'x1', 's2', 'x2', 'f1'], 'dernière section : arrêt au pied');
});

test('deplacerVersPage : le bloc garde son identifiant, son contenu et ses réglages', () => {
  const { ctx, d } = monter(DOC()), avant = JSON.stringify(d.pages[0].blocks[4]);
  ctx.deplacerVersPage(d.pages, 0, 'x2', 1);
  egal(JSON.stringify(d.pages[1].blocks.filter((b) => b.id === 'x2')[0]), avant);
});

test('deplacerVersPage : sans pied de page, le bloc arrive en fin de page ; la section pliée qui le recevrait est dépliée', () => {
  const { d } = deplacer(DOC(), 1, 'y1', 2);
  egal(ids(d.pages[2]), ['z1', 'z2', 'y1']);
  egal(d.pages[2].blocks[0].folded, undefined, 'section d\'arrivée dépliée');
});

test('deplacerVersPage : en-tête, même page, bloc ou page absents refusés, document inchangé', () => {
  for (const [de, bid, vers, cas] of [[0, 'hd1', 1, 'en-tête'], [0, 's1', 0, 'même page'], [0, 'nul', 1, 'bloc absent'], [0, 's1', 9, 'page absente']]) {
    const { r, d } = deplacer(DOC(), de, bid, vers);
    egal(r, false, cas);
    egal(JSON.parse(JSON.stringify(d.pages.map(ids))), DOC().pages.map(ids), cas + ' : inchangé');
  }
});

test('pageDuBloc : indice de la page qui contient le bloc, -1 sinon', () => {
  const { ctx, d } = monter(DOC());
  egal(ctx.pageDuBloc(d.pages, 'x3'), 0);
  egal(ctx.pageDuBloc(d.pages, 'z2'), 2);
  egal(ctx.pageDuBloc(d.pages, 'nul'), -1);
});

test('barre du bloc : « Déplacer vers la page… » sauf sur l\'en-tête, absente avec une seule page', () => {
  const { ctx, d } = monter(DOC());
  const h = ctx.renderPage(d, { page: 0, view: 'edit' });
  const avec = [...h.matchAll(/<div class="blk[^"]*" data-id="([^"]+)"[\s\S]*?(?=<div class="blk[ "]|$)/g)].filter((m) => m[0].includes('data-act="move-page"')).map((m) => m[1]);
  egal(avec, ['s1', 'x1', 's2', 'x2', 's3', 'x3', 'f1']);
  const seule = DOC(); seule.pages = [seule.pages[0]];
  const u = monter(seule);
  vrai(!u.ctx.renderPage(u.d, { page: 0, view: 'edit' }).includes('move-page'), 'une seule page : absente');
});

test('après le déplacement, sommaire et résultat de requête lient la section à sa nouvelle page', () => {
  const doc = DOC();
  doc.pages[0].blocks[2] = { id: 'x1', type: 'facts', items: [{ k: 'nom', v: 'pain', alert: false }] };
  doc.pages[2].blocks.push({ id: 'q1', type: 'query', src: 'facts', scope: 'doc', view: 'table' });
  const { d, ctx } = deplacer(doc, 0, 's1', 1);
  const nav = ctx.navHTML(d, { page: 0, view: 'export' });
  const sec = nav.indexOf('data-sec="s1"');
  vrai(sec > nav.indexOf('data-pgi="1"') && sec < nav.indexOf('data-pgi="2"'), 'section dans le sommaire de la page cible');
  vrai(ctx.renderPage(d, { page: 2, view: 'read' }).includes('href="#pg-p2/s1"'), 'résultat de requête vers la page cible');
});
