// Ancrage à la bascule lecture / édition (anchorBlock, data-bid).
import { monter, test, egal } from './commun.mjs';

// Ancrage à la bascule lecture / édition : bloc qui garde sa hauteur à l'écran dans la vue cible
const ANCRES = {
  title: 'Doc',
  pages: [{ id: 'p1', title: 'Page', blocks: [
    { id: 't1', type: 'h2', html: 'Section pliée', folded: true },
    { id: 'x1', type: 'p', html: 'dans la section pliée' },
    { id: 't2', type: 'h3', html: 'Sous-section pliée', folded: true },
    { id: 'x2', type: 'p', html: 'dans la sous-section' },
    { id: 't3', type: 'h2', html: 'Section ouverte' },
    { id: 'x3', type: 'p', html: 'visible partout' },
  ] }],
};

test('ancrage en édition : un bloc de section pliée s\'ancre sur son titre, le plus externe s\'il y en a plusieurs', () => {
  const { ctx, d } = monter(ANCRES);
  const edit = { page: 0, view: 'edit' };
  egal(ctx.anchorBlock(d, edit, 'x1'), 't1', 'bloc de la section pliée');
  egal(ctx.anchorBlock(d, edit, 'x2'), 't1', 'bloc d\'une sous-section pliée dans une section pliée');
  egal(ctx.anchorBlock(d, edit, 'x3'), 'x3', 'bloc visible');
  egal(ctx.anchorBlock(d, edit, 't1'), 't1', 'titre plié');
});

test('ancrage en lecture : les plis de la session décident, pas l\'état enregistré', () => {
  const { ctx, d } = monter(ANCRES);
  const lecture = { page: 0, view: 'read', folds: { t1: false, t3: true } };
  egal(ctx.anchorBlock(d, lecture, 'x1'), 'x1', 'section dépliée pendant la session');
  egal(ctx.anchorBlock(d, lecture, 'x2'), 't2', 'sous-section restée pliée');
  egal(ctx.anchorBlock(d, lecture, 'x3'), 't3', 'section pliée pendant la session');
});

test('ancrage en lecture : un bloc qui n\'affiche rien s\'ancre sur le bloc visible le plus proche, le précédent d\'abord', () => {
  // un sommaire sans titre à lister n'affiche rien en lecture
  const { ctx, d } = monter({ title: 'Doc', pages: [{ id: 'p1', title: 'Page', blocks: [
    { id: 's1', type: 'summary' }, { id: 'y1', type: 'p', html: 'un' }, { id: 's2', type: 'summary' }, { id: 'y2', type: 'p', html: 'deux' },
  ] }] });
  const lecture = { page: 0, view: 'read' };
  egal(ctx.anchorBlock(d, lecture, 's2'), 'y1', 'le précédent');
  egal(ctx.anchorBlock(d, lecture, 's1'), 'y1', 'le suivant quand rien ne précède');
  egal(ctx.anchorBlock(d, { page: 0, view: 'edit' }, 's2'), 's2', 'en édition le sommaire vide s\'affiche');
});

test('lecture : chaque bloc affiché porte son id (data-bid) pour l\'ancrage ; l\'export n\'en porte aucun', () => {
  const { ctx, d } = monter(ANCRES);
  const ids = (h) => [...h.matchAll(/data-bid="([^"]*)"/g)].map((m) => m[1]);
  egal(ids(ctx.renderPage(d, { page: 0, view: 'read' })), ['t1', 'x1', 't2', 'x2', 't3', 'x3']);
  egal(ids(ctx.renderPage(d, { page: 0, view: 'export' })), []);
});
