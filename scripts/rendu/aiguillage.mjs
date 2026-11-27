// Aiguillage des points d'entrée communs par l'inscription des types (T, src/js/03-types-de-blocs.js) : une facette inscrite
// l'emporte sur l'ancien case (renderBlock, settings, officeBloc, officeHtmlContenu, normBlocks, libelleNature) et reçoit
// son contexte x. Les facettes d'essai sont posées dans un contexte neuf, jamais dans le vrai fichier.
import vm from 'node:vm';
import { monter, js, test, egal, vrai } from './commun.mjs';

const DOC = { title: 'Doc', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 's1', type: 'step', title: 'Étape' }, { id: 'h1', type: 'h2', html: 'Titre <b>gras</b>' }, { id: 'm1', type: 'map', markers: [{ label: 'Port', lat: 1, lon: 2 }] },
] }] };
const bloc = (d, id) => d.pages[0].blocks.find((b) => b.id === id);

test('aiguillage : renderBlock prend la facette rendu et lui passe le contexte x du rendu', () => {
  const { ctx, d } = monter(DOC), vus = [];
  ctx.T.h2.rendu = (b, x) => { vus.push(x); return '<h2>' + x.f('span', 'k', 'html', b.html) + '</h2>'; };
  const lecture = ctx.renderBlock(bloc(d, 'h1'), d, ctx.renderCtx(d, { page: 0, view: 'read' }), 7);
  egal(lecture, '<h2><span class="k">Titre <b>gras</b></span></h2>', 'rendu de la facette en lecture');
  const edition = ctx.renderBlock(bloc(d, 'h1'), d, ctx.renderCtx(d, { page: 0, view: 'edit', editor: { bar: 'h1' } }), null);
  vrai(/contenteditable="true"[^>]*data-b="h1" data-k="html"/.test(edition), 'aide f liée au bloc en édition : ' + edition);
  const [xl, xe] = vus;
  egal(Object.keys(xl).sort(), ['checks', 'ctx', 'd', 'edit', 'editor', 'f', 'num', 'ta'], 'clés du contexte x');
  egal([xl.edit, xl.num, xl.d === d, xl.ctx.page, xl.ctx.view], [false, 7, true, 0, 'read'], 'contexte x en lecture');
  egal([xe.edit, xe.num, xe.editor.bar], [true, null, 'h1'], 'contexte x en édition');
  egal(xl.checks('items', []), '', 'aide checks : liste vide en lecture');
  vrai(/<textarea class="code-ta /.test(xe.ta()), 'aide ta : zone de code');
  vrai(ctx.renderPage(d, { page: 0, view: 'read' }).includes('<span class="k">Titre <b>gras</b></span>'), 'renderPage passe par la facette');
});

test('aiguillage : settings prend la facette reglages ; sans elle, le repli reste', () => {
  const { ctx, d } = monter(DOC);
  const avant = ctx.settings(bloc(d, 'm1'));
  vrai(/data-prop="height"/.test(avant), 'réglages de la carte : ' + avant);
  ctx.T.h2.reglages = (b) => '<button>' + b.id + '</button>';
  egal(ctx.settings(bloc(d, 'h1')), '<button>h1</button>', 'réglages de la facette');
  egal(ctx.settings(bloc(d, 'm1')), avant, 'autre type inchangé');
});

test('aiguillage : officeBloc prend la facette elements avec le contexte x des éléments neutres', () => {
  const { ctx, d } = monter(DOC);
  let vu = null;
  ctx.T.h2.elements = (b, x) => { vu = x; return [x.para(x.gras(x.S(b.html)))]; };
  const img = { src: 'data:image/png;base64,AA', l: 1, h: 1 }, opts = { page: 0, images: { h1: img } };
  const e = ctx.officeBloc(bloc(d, 'h1'), d, opts);
  egal(e, [{ t: 'para', segs: [{ texte: 'Titre ', gras: true }, { texte: 'gras', gras: true }] }], 'éléments de la facette');
  egal(Object.keys(vu).sort(), ['S', 'cases', 'd', 'gras', 'image', 'images', 'opts', 'para', 'pi', 'txt'], 'clés du contexte x');
  egal([vu.d === d, vu.opts === opts, vu.pi, vu.images.h1 === img], [true, true, 0, true], 'contexte x');
  egal(ctx.officeTexte(ctx.officeBlocs(d.pages[0].blocks, d, opts)).split('\n')[1], 'Titre gras', 'officeBlocs passe par la facette');
});

test('aiguillage : officeHtmlContenu prend la facette office, sinon OFFICE_RENDUS, sinon les éléments neutres', () => {
  const { ctx, d } = monter(DOC);
  const carte = ctx.officeHtmlContenu(bloc(d, 'm1'), d, { page: 0 });
  egal(carte, ctx.officeHtmlElements(ctx.officeBloc(bloc(d, 'm1'), d, { page: 0 }), d), 'carte sans facette office : éléments neutres');
  let vu = null;
  ctx.T.h2.office = (b, x) => { vu = x; return '<p>' + x.segs(x.S(b.html)) + '</p>'; };
  egal(ctx.officeHtmlContenu(bloc(d, 'h1'), d, { page: 0 }), '<p>Titre <b>gras</b></p>', 'HTML de la facette, avant OFFICE_RENDUS.h2');
  egal(Object.keys(vu).sort(), ['C', 'S', 'acc', 'accSoft', 'd', 'images', 'opts', 'pi', 'segs'], 'clés du contexte x');
  ctx.T.map.office = () => '<p>carte</p>';
  egal(ctx.officeHtmlContenu(bloc(d, 'm1'), d, { page: 0 }), '<p>carte</p>', 'facette office d\'un type sans ancien rendu');
});

test('aiguillage : normBlocks passe la facette normaliser après la copie sur make, avec newer', () => {
  const { ctx } = monter(DOC), vus = [];
  ctx.T.h2.normaliser = (nb, b, newer) => { vus.push([nb.html, b.html, nb.id, newer]); nb.html = String(nb.html).toUpperCase(); };
  const d = ctx.normalize({ title: 'Doc', pages: [{ id: 'p', title: '', blocks: [{ id: 'a', type: 'h2', html: 'abc' }] }] });
  egal(d.pages[0].blocks[0], { html: 'ABC', id: 'a', type: 'h2' }, 'bloc normalisé par la facette');
  egal(vus, [['abc', 'abc', 'a', false]], 'arguments : bloc copié (avant l\'identifiant final), bloc lu, newer');
});

test('aiguillage : libelleNature prend la facette libelle ; null donne le libellé générique', () => {
  const { ctx } = monter(DOC);
  vm.runInContext(js('05-synchro-moteur.js') + '\n' + js('05-libelle-etape.js'), ctx);
  const a = { id: 'a', type: 'h2', html: 'un' }, b = { id: 'a', type: 'h2', html: 'deux' };
  egal(ctx.libelleNature(a, b), 'texte modifié', 'libellé générique sans facette');
  ctx.T.h2.libelle = (ba, bb) => (bb.html === 'deux' ? 'titre réécrit' : null);
  egal(ctx.libelleNature(a, b), 'titre réécrit', 'libellé de la facette');
  egal(ctx.libelleNature(a, { id: 'a', type: 'h2', html: 'trois' }), 'texte modifié', 'facette qui rend null : libellé générique');
  egal(ctx.libelleNature({ id: 'a', type: 'list', items: [] }, { id: 'a', type: 'texte', lignes: [] }), 'converti en texte', 'changement de type : avant toute facette');
});
