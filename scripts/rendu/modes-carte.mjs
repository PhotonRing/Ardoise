// Modes exclusifs de la carte : passage d'un mode à l'autre (mapModeNext), forme encore présente (mapShapeAlive),
// boutons enfoncés du rendu en édition. La synchronisation du moteur et du DOM (setMapMode) se vérifie à la main.
import { monter, test, egal } from './commun.mjs';

const carte = (id, extra) => ({ id, type: 'map', markers: [], zones: [], routes: [], ...extra });
const DOC = (blocks) => ({ title: 'Doc', pages: [{ id: 'p1', title: 'Carte', blocks }] });
const AUCUN = { draw: null, kind: null, editOf: null, edit: null, add: null };
const suivant = (ui, id, want) => { const { ctx } = monter(DOC([carte('c1')])); return JSON.parse(JSON.stringify(ctx.mapModeNext({ ...AUCUN, ...ui }, id, want))); };

test('modes de carte : l\'édition d\'une forme coupe l\'ajout de points et le dessin', () => {
  egal(suivant({ add: 'c1' }, 'c1', { edit: { kind: 'marker', i: 0 } }), { ...AUCUN, editOf: 'c1', edit: { kind: 'marker', i: 0 } });
  egal(suivant({ draw: 'c1', kind: 'poly' }, 'c1', { edit: { kind: 'zone', i: 1 } }), { ...AUCUN, editOf: 'c1', edit: { kind: 'zone', i: 1 } });
});

test('modes de carte : l\'ajout de points coupe l\'édition et le dessin', () => {
  egal(suivant({ editOf: 'c1', edit: { kind: 'marker', i: 0 } }, 'c1', { add: true }), { ...AUCUN, add: 'c1' });
  egal(suivant({ draw: 'c1', kind: 'route' }, 'c1', { add: true }), { ...AUCUN, add: 'c1' });
});

test('modes de carte : un outil de dessin coupe l\'ajout de points et l\'édition', () => {
  egal(suivant({ add: 'c1' }, 'c1', { draw: 'circle' }), { ...AUCUN, draw: 'c1', kind: 'circle' });
  egal(suivant({ editOf: 'c1', edit: { kind: 'route', i: 0 } }, 'c1', { draw: 'poly' }), { ...AUCUN, draw: 'c1', kind: 'poly' });
  egal(suivant({ draw: 'c1', kind: 'poly' }, 'c1', { draw: 'route' }), { ...AUCUN, draw: 'c1', kind: 'route' });
});

test('modes de carte : redemander le mode actif le coupe', () => {
  egal(suivant({ add: 'c1' }, 'c1', { add: true }), AUCUN);
  egal(suivant({ draw: 'c1', kind: 'poly' }, 'c1', { draw: 'poly' }), AUCUN);
  egal(suivant({ editOf: 'c1', edit: { kind: 'marker', i: 2 } }, 'c1', { edit: { kind: 'marker', i: 2 } }), AUCUN);
  egal(suivant({ editOf: 'c1', edit: { kind: 'marker', i: 2 } }, 'c1', { edit: { kind: 'route', i: 2 } }), { ...AUCUN, editOf: 'c1', edit: { kind: 'route', i: 2 } }, 'autre forme de même rang');
});

test('modes de carte : aucun mode demandé efface tout', () => {
  egal(suivant({ editOf: 'c1', edit: { kind: 'marker', i: 0 } }, null, null), AUCUN);
  egal(suivant({ add: 'c1' }, 'c1', null), AUCUN);
});

test('modes de carte : un seul mode actif sur la page, toutes cartes confondues', () => {
  egal(suivant({ add: 'c1' }, 'c2', { edit: { kind: 'marker', i: 0 } }), { ...AUCUN, editOf: 'c2', edit: { kind: 'marker', i: 0 } });
  egal(suivant({ editOf: 'c1', edit: { kind: 'marker', i: 0 } }, 'c2', { edit: { kind: 'marker', i: 0 } }), { ...AUCUN, editOf: 'c2', edit: { kind: 'marker', i: 0 } });
  egal(suivant({ draw: 'c1', kind: 'poly' }, 'c2', { draw: 'poly' }), { ...AUCUN, draw: 'c2', kind: 'poly' });
});

const vivante = (b, ed) => { const { ctx } = monter(DOC([b])); return ctx.mapShapeAlive(b, ed); };
const M0 = { lat: 48, lon: -4, label: 'Brest', color: 'accent' };
const Z0 = { label: 'Z', color: 'accent', shape: 'circle', c: [48, -4], r: 1000 };
const R0 = { label: 'R', color: 'accent', pts: [[48, -4], [47, -1]], names: ['', ''] };

test('remontage : un marqueur en édition se cherche parmi les marqueurs, pas parmi les itinéraires', () => {
  egal(vivante(carte('c1', { markers: [M0] }), { kind: 'marker', i: 0 }), true, 'marqueur sans itinéraire de même rang');
  egal(vivante(carte('c1', { routes: [R0] }), { kind: 'marker', i: 0 }), false, 'itinéraire de même rang, marqueur absent');
});

test('remontage : zones et itinéraires se cherchent dans leur liste ; forme absente écartée', () => {
  egal(vivante(carte('c1', { zones: [Z0] }), { kind: 'zone', i: 0 }), true);
  egal(vivante(carte('c1', { routes: [R0] }), { kind: 'route', i: 0 }), true);
  egal(vivante(carte('c1', { zones: [Z0], routes: [R0] }), { kind: 'zone', i: 1 }), false);
  egal(vivante(carte('c1', { markers: [M0] }), null), false);
});

const editer = (blocks, map) => {
  const { ctx, d } = monter(DOC(blocks));
  ctx.MapKit = { pathLen: () => 0, fmtDist: () => '0 km' };
  return ctx.renderPage(d, { page: 0, view: 'edit', editor: { bar: null, map: { ...AUCUN, ...map }, panelMin: false, paste: null, routePaste: null } });
};
const enfonces = (h) => [...h.matchAll(/data-act="(shape-edit|map-addmode|map-draw)"(?: data-kind="(\w+)")?(?: data-i="(\d+)")? aria-pressed="true"/g)].map((m) => [m[1], m[2] || '', m[3] || ''].join(':'));

test('rendu en édition de marqueur : seul son ✎ est enfoncé, « ＋ Point » et les outils relâchés', () => {
  const h = editer([carte('c1', { markers: [M0, { ...M0, label: 'B' }] })], { editOf: 'c1', edit: { kind: 'marker', i: 1 } });
  egal(enfonces(h), ['shape-edit:marker:1']);
  egal((h.match(/class="mk-item on"/g) || []).length, 1, 'une seule ligne en surbrillance');
});

test('rendu en édition d\'une forme absente : aucun ✎ enfoncé ni ligne en surbrillance', () => {
  const h = editer([carte('c1', { routes: [R0] })], { editOf: 'c1', edit: { kind: 'marker', i: 0 } });
  egal(enfonces(h), []);
  egal((h.match(/class="mk-item on"/g) || []).length, 0);
});

// Forme en édition suivie d'un rendu à l'autre (mapShapeFollow) : l'édition ne passe jamais en silence à la forme voisine.
const suivre = (b, ed) => { const { ctx } = monter(DOC([b])); const r = ctx.mapShapeFollow(b, ed); return r && r.i; };
const M1 = { ...M0, lat: 47, label: 'Nantes' }, M2 = { ...M0, lat: 45, label: 'Lyon' };

test('édition suivie : annuler l\'ajout d\'un marqueur placé avant garde l\'édition sur le même marqueur', () => {
  const { ctx } = monter(DOC([carte('c1')]));
  const avant = carte('c1', { markers: [M0, M1, M2] });
  const ed = ctx.mapShapeFollow(avant, { kind: 'marker', i: 2 });
  egal(ed.i, 2, 'entrée en édition');
  egal(ctx.mapShapeFollow(carte('c1', { markers: [M1, M2] }), ed).i, 1, 'M0 retiré : Lyon passe au rang 1');
});

test('édition suivie : la forme déplacée par l\'édition elle-même garde son rang', () => {
  const { ctx } = monter(DOC([carte('c1')]));
  const ed = ctx.mapShapeFollow(carte('c1', { markers: [M0, M1] }), { kind: 'marker', i: 1 });
  egal(ctx.mapShapeFollow(carte('c1', { markers: [M0, { ...M1, lat: 46.5 }] }), ed).i, 1);
});

test('édition suivie : forme disparue, ou liste raccourcie sans elle, quitte l\'édition', () => {
  const { ctx } = monter(DOC([carte('c1')]));
  const ed = ctx.mapShapeFollow(carte('c1', { markers: [M0, M1] }), { kind: 'marker', i: 0 });
  egal(ctx.mapShapeFollow(carte('c1', { markers: [M1] }), ed), null, 'le voisin ne la remplace pas');
  egal(ctx.mapShapeFollow(carte('c1', { markers: [] }), ed), null);
  egal(suivre(carte('c1', { routes: [R0] }), { kind: 'marker', i: 0 }), null, 'liste absente');
});

test('édition suivie : zones et itinéraires suivis par leur géométrie', () => {
  const { ctx } = monter(DOC([carte('c1')]));
  const Z1 = { ...Z0, r: 2000 };
  const ez = ctx.mapShapeFollow(carte('c1', { zones: [Z0, Z1] }), { kind: 'zone', i: 1 });
  egal(ctx.mapShapeFollow(carte('c1', { zones: [Z1] }), ez).i, 0);
  const R1 = { ...R0, pts: [[45, 5], [44, 6]] };
  const er = ctx.mapShapeFollow(carte('c1', { routes: [R0, R1] }), { kind: 'route', i: 0 });
  egal(ctx.mapShapeFollow(carte('c1', { routes: [R1, R0] }), er).i, 1, 'ordre changé');
});
