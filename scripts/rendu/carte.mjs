// Import d'un itinéraire collé : lecture des lignes (routeImport) et panneau « Éléments de la carte » en édition.
import { monter, test, egal, vrai } from './commun.mjs';

const carte = (id, extra) => ({ id, type: 'map', markers: [], zones: [], routes: [], ...extra });
const DOC = (blocks) => ({ title: 'Doc', pages: [{ id: 'p1', title: 'Carte', blocks }] });
const lire = (texte, blocks, except) => { const { ctx, d } = monter(DOC(blocks || [carte('c1')])); return JSON.parse(JSON.stringify(ctx.routeImport(texte, d, except || null))); };

test('import d\'itinéraire : formats de coordonnées acceptés, lignes vides ignorées', () => {
  const r = lire('48.38, -4.47\n\n48.38; -4.47\n48,38 ; -4,47\n48,38, -4,47\n48.38N 4.47O\n48.38\t-4.47\n');
  egal(r.pts, [[48.38, -4.47], [48.38, -4.47], [48.38, -4.47], [48.38, -4.47], [48.38, -4.47], [48.38, -4.47]]);
  egal(r.bad, []);
});

test('import d\'itinéraire : libellé après une tabulation ou un point-virgule', () => {
  const r = lire('48.38, -4.47\tBrest\n47.21; -1.55; Nantes \n44.84\t-0.58\tBordeaux\n43.3, 5.37');
  egal(r.names, ['Brest', 'Nantes', 'Bordeaux', '']);
});

test('import d\'itinéraire : numéros des lignes ignorées (illisibles ou hors bornes)', () => {
  const r = lire('lat\tlon\n48.38, -4.47\n\n95, 3\nParis\n47.21, -1.55');
  egal(r.pts.length, 2);
  egal(r.bad, [1, 4, 5]);
});

// à 48.4° de latitude, 0,0001° de latitude ≈ 11 m ; 0,0005° ≈ 56 m
test('import d\'itinéraire : un point sans libellé prend le nom du lieu le plus proche à moins de 50 m', () => {
  const blocks = [
    carte('c1', { routes: [{ label: 'Autre', color: 'accent', pts: [[48.4003, -4.5], [47, -1]], names: ['Port', ''] }] }),
    carte('c2', { markers: [{ lat: 48.4001, lon: -4.5, label: 'Brest' }, { lat: 48.0, lon: -4.0, label: '' }, { lat: 47.0005, lon: -1.0, label: 'Loin' }] }),
  ];
  const r = lire('48.4, -4.5\n47, -1\n48, -4\n48.4003, -4.5\tGardé', blocks);
  egal(r.names, ['Brest', '', '', 'Gardé']);
});

test('import d\'itinéraire : les étapes de l\'itinéraire remplacé ne nomment pas les points', () => {
  const blocks = [carte('c1', { routes: [{ label: 'R', color: 'accent', pts: [[48.4, -4.5], [47, -1]], names: ['Ancien', ''] }] })];
  egal(lire('48.4, -4.5\n47, -1', blocks).names, ['Ancien', '']);
  egal(lire('48.4, -4.5\n47, -1', blocks, { b: 'c1', i: 0 }).names, ['', '']);
});

const panneau = (blocks, routePaste) => {
  const { ctx, d } = monter(DOC(blocks));
  ctx.MapKit = { pathLen: () => 0, fmtDist: () => '0 km' };   // le moteur de carte exige window : la distance n'est pas l'objet de l'essai
  return ctx.renderPage(d, { page: 0, view: 'edit', editor: { bar: null, map: {}, panelMin: false, paste: null, routePaste } });
};

test('panneau de la carte : « Coller un itinéraire… » même sans itinéraire, « Remplacer les points… » par itinéraire', () => {
  const vide = panneau([carte('c1')], null);
  vrai(vide.includes('Itinéraires') && vide.includes('data-act="rt-paste" data-i="-1"'), 'section Itinéraires et bouton attendus :\n' + vide);
  vrai(!vide.includes('rt-ta'), 'zone de collage fermée');
  const deux = panneau([carte('c1', { routes: [{ label: 'R', color: 'accent', pts: [[48, -4], [47, -1]], names: ['', ''] }] })], null);
  vrai(deux.includes('data-act="rt-paste" data-i="0"') && deux.includes('Remplacer les points…'), 'bouton de remplacement attendu');
});

test('panneau de la carte : la zone de collage s\'ouvre selon le contexte d\'édition', () => {
  const blocks = [carte('c1', { routes: [{ label: 'R', color: 'accent', pts: [[48, -4], [47, -1]], names: ['', ''] }] }), carte('c2')];
  const nb = (h) => (h.match(/ rt-ta"/g) || []).length;
  egal(nb(panneau(blocks, { b: 'c1', i: -1 })), 1, 'nouvel itinéraire');
  egal(nb(panneau(blocks, { b: 'c1', i: 0 })), 1, 'remplacement');
  egal(nb(panneau(blocks, { b: 'c2', i: 0 })), 0, 'autre carte, itinéraire absent');
});
