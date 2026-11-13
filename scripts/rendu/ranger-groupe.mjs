// Ranger les blocs d'un groupe repliable (05-document.js) : dépôt dans, hors et à l'intérieur d'un groupe (rangerBloc),
// sortie du groupe, « Mettre dans un groupe », « Dégrouper ».
import { monter, test, egal, vrai } from './commun.mjs';

// page : un paragraphe, un titre, un groupe de deux blocs, un groupe vide, un dernier paragraphe
const DOC = () => ({
  title: 'Doc',
  pages: [{ id: 'p1', title: 'Accueil', blocks: [
    { id: 'a', type: 'p', html: 'avant' },
    { id: 's', type: 'h2', html: 'Section' },
    { id: 'g', type: 'group', title: 'Détails', blocks: [{ id: 'c1', type: 'p', html: 'un' }, { id: 'c2', type: 'p', html: 'deux' }] },
    { id: 'v', type: 'group', title: 'Vide', blocks: [] },
    { id: 'z', type: 'p', html: 'après' },
  ] }],
});
// forme de la page : identifiants, un groupe écrit g[c1,c2]
const forme = (blocks) => blocks.map((b) => b.type === 'group' ? b.id + '[' + b.blocks.map((c) => c.id).join(',') + ']' : b.id).join(' ');
const essai = () => { const { ctx, d } = monter(DOC()); return { ctx, bl: d.pages[0].blocks }; };

test('rangerBloc : un bloc de la page déposé avant, entre ou après les blocs d\'un groupe y entre', () => {
  let { ctx, bl } = essai();
  vrai(ctx.rangerBloc(bl, 'a', { id: 'c1', before: true }));
  egal(forme(bl), 's g[a,c1,c2] v[] z', 'avant le premier');
  ({ ctx, bl } = essai());
  ctx.rangerBloc(bl, 'z', { id: 'c1', before: false });
  egal(forme(bl), 'a s g[c1,z,c2] v[]', 'entre');
  ({ ctx, bl } = essai());
  ctx.rangerBloc(bl, 'z', { id: 'c2', before: false });
  egal(forme(bl), 'a s g[c1,c2,z] v[]', 'après le dernier');
});

test('rangerBloc : un groupe vide reçoit le bloc déposé dans sa zone', () => {
  const { ctx, bl } = essai();
  vrai(ctx.rangerBloc(bl, 'a', { dans: 'v' }));
  egal(forme(bl), 's g[c1,c2] v[a] z');
});

test('rangerBloc : un bloc d\'un groupe sort dans la page, ou change de place dans son groupe ; le groupe vidé reste', () => {
  let { ctx, bl } = essai();
  ctx.rangerBloc(bl, 'c1', { id: 'a', before: true });
  egal(forme(bl), 'c1 a s g[c2] v[] z', 'hors du groupe');
  ctx.rangerBloc(bl, 'c2', { id: 'z', before: false });
  egal(forme(bl), 'c1 a s g[] v[] z c2', 'groupe vidé gardé');
  ({ ctx, bl } = essai());
  ctx.rangerBloc(bl, 'c1', { id: 'c2', before: false });
  egal(forme(bl), 'a s g[c2,c1] v[] z', 'réordonné');
  ({ ctx, bl } = essai());
  ctx.rangerBloc(bl, 'c1', { dans: 'v' });
  egal(forme(bl), 'a s g[c2] v[c1] z', 'd\'un groupe à l\'autre');
});

test('rangerBloc : titre, étape, en-tête, pied de page et groupe refusés dans un groupe, page inchangée ; autour du groupe, permis', () => {
  const { ctx, bl } = essai();
  const avant = forme(bl);
  egal(ctx.rangerBloc(bl, 's', { id: 'c1', before: true }), false, 'titre');
  egal(ctx.rangerBloc(bl, 'v', { id: 'c2', before: false }), false, 'groupe');
  egal(ctx.rangerBloc(bl, 'g', { dans: 'v' }), false, 'groupe dans un groupe vide');
  egal(ctx.rangerBloc(bl, 'g', { id: 'c1', before: false }), false, 'groupe dans lui-même');
  egal(ctx.rangerBloc(bl, 'a', { id: 'a', before: true }), false, 'sur lui-même');
  egal(ctx.rangerBloc(bl, 'zz', { id: 'a', before: true }), false, 'absent');
  egal(forme(bl), avant, 'page inchangée');
  for (const t of ['h3', 'step', 'header', 'footer']) {
    const { ctx: c2, d } = monter({ blocks: [{ id: 'x', type: t }, { id: 'g', type: 'group', blocks: [{ id: 'c', type: 'p' }] }] });
    egal(c2.rangerBloc(d.pages[0].blocks, 'x', { id: 'c', before: true }), false, t);
  }
  vrai(ctx.rangerBloc(bl, 's', { id: 'g', before: false }), 'titre après le groupe');
  egal(forme(bl), 'a g[c1,c2] s v[] z');
});

test('sortirDuGroupe : le bloc va juste après le groupe, ou juste avant ; refus pour un bloc de la page', () => {
  let { ctx, bl } = essai();
  vrai(ctx.sortirDuGroupe(bl, 'c2'));
  egal(forme(bl), 'a s g[c1] c2 v[] z', 'après');
  ({ ctx, bl } = essai());
  ctx.sortirDuGroupe(bl, 'c1', true);
  egal(forme(bl), 'a s c1 g[c2] v[] z', 'avant');
  egal(ctx.sortirDuGroupe(bl, 'a'), false, 'bloc de la page');
});

test('mettreDansGroupe : un groupe neuf, sans titre, à la place du bloc, qui le contient seul ; refus des blocs refusés et des enfants', () => {
  const { ctx, bl } = essai();
  const g = ctx.mettreDansGroupe(bl, 'z');
  egal([g.type, g.title, g.folded, g.blocks.map((b) => b.id)], ['group', '', false, ['z']]);
  egal(bl[bl.length - 1], g, 'à la place du bloc');
  vrai(g.id && g.id !== 'z', 'identifiant neuf');
  egal(ctx.mettreDansGroupe(bl, 's'), null, 'titre');
  egal(ctx.mettreDansGroupe(bl, 'v'), null, 'groupe');
  egal(ctx.mettreDansGroupe(bl, 'c1'), null, 'bloc déjà dans un groupe');
});

test('degrouper : les blocs reviennent à la place du groupe, dans l\'ordre, et le groupe disparaît', () => {
  const { ctx, bl } = essai();
  vrai(ctx.degrouper(bl, 'g'));
  egal(forme(bl), 'a s c1 c2 v[] z');
  vrai(ctx.degrouper(bl, 'v'), 'groupe vide');
  egal(forme(bl), 'a s c1 c2 z');
  egal(ctx.degrouper(bl, 'a'), false, 'pas un groupe');
});

test('deplacerVersPage : un bloc d\'un groupe part seul à la fin de la page cible, avant le pied ; le groupe reste ; le lien le suit', () => {
  const { ctx, d } = monter({ title: 'Doc', pages: [DOC().pages[0], { id: 'p2', title: 'Suite', blocks: [{ id: 'y', type: 'p' }, { id: 'f', type: 'footer' }] }] });
  egal(ctx.deplacerVersPage(d.pages, 0, 'c2', 1), 1);
  egal(forme(d.pages[0].blocks), 'a s g[c1] v[] z', 'source');
  egal(forme(d.pages[1].blocks), 'y c2 f', 'cible');
  egal(ctx.lireAdresse('#pg-p1/c2', d.pages).page, 1, 'le lien suit le bloc');
  ctx.deplacerVersPage(d.pages, 0, 'c1', 1);
  egal(forme(d.pages[0].blocks), 'a s g[] v[] z', 'groupe vidé gardé');
});

test('deplacerVersPage : un groupe part entier, avec ses blocs', () => {
  const { ctx, d } = monter({ title: 'Doc', pages: [DOC().pages[0], { id: 'p2', title: 'Suite', blocks: [] }] });
  egal(ctx.deplacerVersPage(d.pages, 0, 'g', 1), 1);
  egal(forme(d.pages[1].blocks), 'g[c1,c2]');
  egal(forme(d.pages[0].blocks), 'a s v[] z');
});
