// Groupe repliable : forme du document (normBlocks, blocs refusés remis dans la page, identifiants neufs), recherche
// d'un bloc d'un groupe (ouEst, page du bloc, lien), requêtes qui voient les blocs d'un groupe, pliage d'édition et de lecture.
import { monter, test, egal, vrai } from './commun.mjs';

// page : section « Détails » qui contient un groupe de deux blocs (paragraphe et fiche de faits), puis une seconde section
const DOC = () => ({
  title: 'Doc',
  pages: [
    { id: 'p1', title: 'Accueil', blocks: [
      { id: 's1', type: 'h2', html: 'Détails' },
      { id: 'g1', type: 'group', title: 'Pour aller plus loin', blocks: [
        { id: 'c1', type: 'p', html: 'premier enfant' },
        { id: 'c2', type: 'facts', items: [{ k: 'Port', v: '<span class="pill">rouge</span>' }] },
      ] },
      { id: 's2', type: 'h2', html: 'Ailleurs' }, { id: 'x2', type: 'p', html: 'hors du groupe' },
    ] },
    { id: 'p2', title: 'Suite', blocks: [{ id: 'y1', type: 'p', html: 'autre page' }] },
  ],
});
const ids = (l) => l.map((b) => b.id);

test('groupe : normBlocks garde le groupe et ses blocs, complétés depuis leur type ; folded par défaut faux', () => {
  const { d } = monter(DOC());
  const g = d.pages[0].blocks[1];
  egal(g.type, 'group'); egal(g.title, 'Pour aller plus loin'); egal(g.folded, false, 'pli par défaut');
  egal(ids(g.blocks), ['c1', 'c2']);
  egal(g.blocks[1].items[0].alert, undefined, 'fiche gardée telle quelle');
  egal(g.blocks[0].type, 'p');
});

test('groupe : un bloc refusé dans un groupe (titre, étape, en-tête, pied, groupe) est remis dans la page juste après le groupe', () => {
  const doc = DOC();
  doc.pages[0].blocks[1].blocks.push(
    { id: 'r1', type: 'h3', html: 'Sous-section' }, { id: 'c3', type: 'p', html: 'reste' },
    { id: 'r2', type: 'group', title: 'imbriqué', blocks: [{ id: 'r3', type: 'p', html: 'petit-enfant' }] },
    { id: 'r4', type: 'step', title: 'Étape' }, { id: 'r5', type: 'header', title: 'H' }, { id: 'r6', type: 'footer', html: 'F' }, { id: 'r7', type: 'h2', html: 'S' });
  const { d } = monter(doc);
  egal(ids(d.pages[0].blocks), ['s1', 'g1', 'r1', 'r2', 'r4', 'r5', 'r6', 'r7', 's2', 'x2'], 'page');
  egal(ids(d.pages[0].blocks[1].blocks), ['c1', 'c2', 'c3'], 'groupe');
  egal(ids(d.pages[0].blocks[3].blocks), ['r3'], 'groupe sorti, gardé avec son contenu');
});

test('groupe : un groupe sans liste de blocs en reçoit une vide ; un type inconnu dans un groupe est écarté', () => {
  const { d } = monter({ blocks: [{ id: 'g', type: 'group', title: 't' }, { id: 'g2', type: 'group', blocks: [{ id: 'z', type: 'inconnu' }, { id: 'k', type: 'p' }] }] });
  egal(d.pages[0].blocks[0].blocks, []);
  egal(ids(d.pages[0].blocks[1].blocks), ['k']);
});

test('groupe : le parcours des blocs d\'une page voit les enfants juste après leur groupe, avec leur parent', () => {
  const { ctx, d } = monter(DOC());
  const vus = []; ctx.blocsDe(d.pages[0].blocks, (b, liste, i, parent) => vus.push([b.id, i, parent ? parent.id : null, liste[i] === b]));
  egal(vus, [['s1', 0, null, true], ['g1', 1, null, true], ['c1', 0, 'g1', true], ['c2', 1, 'g1', true], ['s2', 2, null, true], ['x2', 3, null, true]]);
});

test('groupe : ouEst trouve un bloc d\'un groupe (liste, position, parent) ; pageDuBloc et le lien le suivent', () => {
  const { ctx, d } = monter(DOC());
  const o = ctx.ouEst(d.pages[0].blocks, 'c2');
  egal([o.b.id, o.i, o.parent.id, o.liste === d.pages[0].blocks[1].blocks], ['c2', 1, 'g1', true]);
  egal(ctx.ouEst(d.pages[0].blocks, 'x2').parent, null, 'premier niveau');
  egal(ctx.ouEst(d.pages[0].blocks, 'zz'), null, 'absent');
  egal(ctx.pageDuBloc(d.pages, 'c1'), 0); egal(ctx.pageDuBloc(d.pages, 'y1'), 1);
  egal(ctx.lireAdresse('#pg-p2/c1', d.pages).page, 0, 'adresse d\'un bloc d\'un groupe : sa page réelle');
});

test('groupe : copieBloc donne un identifiant neuf au groupe et à chacun de ses blocs, sans toucher l\'original', () => {
  const { ctx, d } = monter(DOC());
  const g = d.pages[0].blocks[1], c = ctx.copieBloc(g);
  vrai(c.id !== 'g1' && c.blocks.every((x, i) => x.id !== g.blocks[i].id), 'identifiants neufs');
  egal(c.blocks.map((x) => x.type), ['p', 'facts']); egal(c.blocks[0].html, 'premier enfant');
  egal(g.blocks.map((x) => x.id), ['c1', 'c2'], 'original intact');
});

test('groupe : une requête trouve une fiche de faits d\'un groupe, rattachée à la section du groupe, portée de section comprise', () => {
  const doc = DOC();
  doc.pages[1].blocks.push({ id: 'q', type: 'query', src: 'facts', scope: 'doc', tags: ['rouge'] });
  const { ctx, d } = monter(doc);
  const q = d.pages[1].blocks[1];
  const r = ctx.queryRecords(q, d, 1);
  egal(r.map((x) => [x.x.blk.id, x.x.sec && x.x.sec.id]), [['c2', 's1']], 'portée document');
  q.scope = 'sec:p1/s1'; egal(ctx.queryRecords(q, d, 1).map((x) => x.x.blk.id), ['c2'], 'section du groupe');
  q.scope = 'sec:p1/s2'; egal(ctx.queryRecords(q, d, 1).length, 0, 'autre section');
  q.scope = 'pg:p1'; egal(ctx.queryRecords(q, d, 1).length, 1, 'page du groupe');
});

test('groupe : une case à cocher et une carte de kanban d\'un groupe sont trouvées ; une requête dans un groupe s\'exclut', () => {
  const doc = DOC();
  const g = doc.pages[0].blocks[1];
  g.blocks.push({ id: 'k1', type: 'check', items: [{ html: 'faire', done: true }] }, { id: 'q', type: 'query', src: 'check', scope: 'here', tags: [] });
  const { ctx, d } = monter(doc);
  const q = d.pages[0].blocks[1].blocks[3];
  egal(ctx.queryRecords(q, d, 0).map((x) => x.x.blk.id), ['k1']);
  egal(ctx.queryBlocks(q, d, 0).some((x) => x.blk === q), false, 'la requête ne se voit pas');
});

// rendu d'une page dont le groupe est plié ou non (dans le document), dans une vue donnée
const rendu = (vue, plie, ctxVue) => {
  const doc = DOC(); doc.pages[0].blocks[1].folded = !!plie;
  const { ctx, d } = monter(doc);
  return ctx.renderPage(d, Object.assign({ page: 0, view: vue }, ctxVue || {}));
};

test('groupe (édition) : ouvert, ses blocs sont rendus dans le groupe, chacun avec sa barre ; titre éditable', () => {
  const h = rendu('edit', false);
  const g = h.slice(h.indexOf('data-id="g1"'), h.indexOf('data-id="s2"'));
  vrai(g.includes('data-id="c1"') && g.includes('data-id="c2"'), 'enfants dans le groupe');
  vrai(/data-b="g1" data-k="title"/.test(g), 'titre éditable');
  vrai(/data-act="fold"[^>]*aria-expanded="true"/.test(g), 'chevron ouvert');
  vrai(g.includes('data-act="grp-add"'), 'ajout dans le groupe');
  vrai(!g.slice(g.indexOf('data-id="c1"'), g.indexOf('data-id="c2"')).includes('deplacer-page'), 'pas de « Déplacer vers la page » sur un bloc du groupe');
  vrai(h.slice(h.indexOf('data-id="g1"'), h.indexOf('data-id="c1"')).includes('deplacer-page'), 'le groupe, lui, se déplace');
});

test('groupe (édition) : plié, ses blocs ne sont pas rendus et un compteur dit combien il en cache', () => {
  const h = rendu('edit', true);
  vrai(!h.includes('data-id="c1"') && !h.includes('data-id="c2"'), 'enfants non rendus');
  vrai(h.includes('2 blocs'), 'compteur');
  vrai(/data-act="fold"[^>]*aria-expanded="false"/.test(h), 'chevron plié');
});

test('groupe (édition) : vide, il reste affiché avec son invite', () => {
  const { ctx, d } = monter({ blocks: [{ id: 'g', type: 'group', title: 'Vide', blocks: [] }] });
  vrai(ctx.renderPage(d, { page: 0, view: 'edit' }).includes('Glissez des blocs ici ou ajoutez-en un'));
});

test('groupe (lecture) : <details> ouvert au départ si le groupe n\'est pas plié ; le pli de lecture de la session l\'emporte', () => {
  vrai(/<details[^>]*class="grp"[^>]* open/.test(rendu('read', false)), 'ouvert');
  vrai(!/<details[^>]*class="grp"[^>]* open/.test(rendu('read', true)), 'plié');
  vrai(/<details[^>]*class="grp"[^>]* open/.test(rendu('read', true, { folds: { g1: false } })), 'déplié pour soi');
  const h = rendu('read', false);
  vrai(/<summary[^>]*>Pour aller plus loin<\/summary>/.test(h), 'titre');
  vrai(h.includes('data-bid="c1"'), 'ancrage des blocs du groupe');
  vrai(!rendu('export', false).includes('data-bid'), 'export : pas d\'ancrage');
});

test('groupe : il suit sa section, masqué avec elle en lecture et non rendu en édition', () => {
  const doc = DOC(); doc.pages[0].blocks[0].folded = true;
  const { ctx, d } = monter(doc);
  vrai(/<details[^>]*data-fh[^>]*class="grp"/.test(ctx.renderPage(d, { page: 0, view: 'read' })), 'lecture : masqué');
  const e = ctx.renderPage(d, { page: 0, view: 'edit' });
  vrai(!e.includes('data-id="g1"') && !e.includes('data-id="c1"'), 'édition : non rendu');
  egal(ctx.foldInfo(d.pages[0].blocks).count.s1, 1, 'la section compte le groupe pour un bloc');
});

test('groupe : revealBlock déplie le groupe d\'un bloc et la section qui le masque', () => {
  const doc = DOC(); doc.pages[0].blocks[0].folded = true; doc.pages[0].blocks[1].folded = true;
  const { ctx, d } = monter(doc);
  ctx.revealBlock('c2', d.pages[0].blocks);
  egal([d.pages[0].blocks[0].folded, d.pages[0].blocks[1].folded], [undefined, false]);
  vrai(ctx.cacheEnEdition(d.pages[0].blocks, 'c2') === false, 'plus caché');
  d.pages[0].blocks[1].folded = true;
  vrai(ctx.cacheEnEdition(d.pages[0].blocks, 'c2'), 'groupe plié : caché');
});

test('groupe : sommaire, numéros d\'étape et sections ignorent le groupe', () => {
  const { ctx, d } = monter(DOC());
  egal(ctx.sectionsOf(d.pages[0]).map((x) => x.id), ['s1', 's2']);
});

test('groupe : à la bascule, un bloc d\'un groupe ouvert s\'ancre sur lui-même, d\'un groupe plié sur le groupe', () => {
  const doc = DOC(); doc.pages[0].blocks[1].folded = true;
  const { ctx, d } = monter(doc);
  egal(ctx.anchorBlock(d, { page: 0, view: 'edit' }, 'c1'), 'g1', 'édition : groupe plié');
  egal(ctx.anchorBlock(d, { page: 0, view: 'read', folds: { g1: false } }, 'c1'), 'c1', 'lecture : déplié pour soi');
  d.pages[0].blocks[0].folded = true;
  egal(ctx.anchorBlock(d, { page: 0, view: 'read', folds: { g1: false } }, 'c1'), 's1', 'section pliée : son titre');
});

test('groupe : export et import JSON gardent le groupe et son contenu', () => {
  const { ctx, d } = monter(DOC());
  const { d: d2 } = monter(JSON.parse(JSON.stringify({ title: d.title, pages: d.pages })));
  egal(d2.pages[0].blocks[1], d.pages[0].blocks[1]);
});

test('groupe et modèle diamant : un diamant reste dans un groupe et la source « Modèles diamant » le trouve, avec la section du groupe', () => {
  const doc = DOC();
  doc.pages[0].blocks[1].blocks.push({ id: 'dm', type: 'diamond', title: 'Campagne', adversaire: 'Groupe <span class="pill">apt</span>' });
  doc.pages[1].blocks.push({ id: 'q', type: 'query', src: 'diamond', scope: 'sec:p1/s1', tags: ['apt'] });
  const { ctx, d } = monter(doc);
  egal(ids(d.pages[0].blocks[1].blocks), ['c1', 'c2', 'dm'], 'diamant gardé dans le groupe');
  egal(ctx.queryRecords(d.pages[1].blocks[1], d, 1).map((r) => r.x.blk.id), ['dm']);
  vrai(/id="b-dm"/.test(ctx.renderPage(d, { page: 0, view: 'export' })), 'cible du lien de la requête, dans le groupe, export compris');
});
