// Opérations sur la grille d'un tableau (src/js/05-tableau.js) : opTableau sert le menu contextuel des cellules et les
// boutons +L, −L, +C, −C ; elle rend une nouvelle grille et la nouvelle place du curseur, ou null si l'opération est impossible.
import { contexte, egal, test } from './commun.mjs';

const ctx = contexte();
const GRILLE = () => [['A', 'B'], ['a1', 'b1'], ['a2', 'b2']];
// origine : pour chaque ligne rendue, l'indice de la ligne d'où elle vient, -1 pour une ligne ajoutée
const op = (rows, o, r, c) => JSON.parse(JSON.stringify(ctx.opTableau(rows, o, r, c)));

test('opTableau : insérer une ligne au-dessus ou en dessous, curseur dans la nouvelle ligne', () => {
  egal(op(GRILLE(), 'ligne-avant', 1, 1), { rows: [['A', 'B'], ['', ''], ['a1', 'b1'], ['a2', 'b2']], r: 1, c: 1, origine: [0, -1, 1, 2] });
  egal(op(GRILLE(), 'ligne-apres', 1, 0), { rows: [['A', 'B'], ['a1', 'b1'], ['', ''], ['a2', 'b2']], r: 2, c: 0, origine: [0, 1, -1, 2] });
  egal(op(GRILLE(), 'ligne-apres', 0, 1), { rows: [['A', 'B'], ['', ''], ['a1', 'b1'], ['a2', 'b2']], r: 1, c: 1, origine: [0, -1, 1, 2] }, 'sous l\'en-tête');
});

test('opTableau : insérer une colonne à gauche ou à droite, « Colonne » en en-tête, curseur dans la nouvelle colonne', () => {
  egal(op(GRILLE(), 'col-avant', 2, 0), { rows: [['Colonne', 'A', 'B'], ['', 'a1', 'b1'], ['', 'a2', 'b2']], r: 2, c: 0, origine: [0, 1, 2] });
  egal(op(GRILLE(), 'col-apres', 1, 0), { rows: [['A', 'Colonne', 'B'], ['a1', '', 'b1'], ['a2', '', 'b2']], r: 1, c: 1, origine: [0, 1, 2] });
});

test('opTableau : supprimer la ligne ou la colonne, curseur ramené dans la grille', () => {
  egal(op(GRILLE(), 'ligne-suppr', 1, 1), { rows: [['A', 'B'], ['a2', 'b2']], r: 1, c: 1, origine: [0, 2] });
  egal(op(GRILLE(), 'ligne-suppr', 2, 0), { rows: [['A', 'B'], ['a1', 'b1']], r: 1, c: 0, origine: [0, 1] }, 'dernière ligne');
  egal(op(GRILLE(), 'col-suppr', 1, 1), { rows: [['A'], ['a1'], ['a2']], r: 1, c: 0, origine: [0, 1, 2] }, 'dernière colonne');
  egal(op(GRILLE(), 'col-suppr', 0, 0), { rows: [['B'], ['b1'], ['b2']], r: 0, c: 0, origine: [0, 1, 2] }, 'depuis l\'en-tête');
});

test('opTableau : limites, en-tête jamais supprimé ni précédé, une ligne sous l\'en-tête, une colonne', () => {
  egal(ctx.opTableau(GRILLE(), 'ligne-avant', 0, 0), null, 'au-dessus de l\'en-tête');
  egal(ctx.opTableau(GRILLE(), 'ligne-suppr', 0, 0), null, 'en-tête');
  egal(ctx.opTableau([['A', 'B'], ['a1', 'b1']], 'ligne-suppr', 1, 0), null, 'seule ligne sous l\'en-tête');
  egal(ctx.opTableau([['A'], ['a1'], ['a2']], 'col-suppr', 1, 0), null, 'seule colonne');
  egal(ctx.opTableau(GRILLE(), 'inconnue', 1, 0), null, 'opération inconnue');
});

test('opTableau : la grille reçue n\'est pas modifiée', () => {
  const g = GRILLE();
  for (const o of ['ligne-avant', 'ligne-apres', 'col-avant', 'col-apres', 'ligne-suppr', 'col-suppr']) ctx.opTableau(g, o, 1, 1);
  egal(g, GRILLE());
});

// collerGrille : une plage collée remplit le tableau à partir d'une cellule, vers la droite et le bas, et l'agrandit au besoin
const coller = (rows, r, c, g, sauf) => JSON.parse(JSON.stringify(ctx.collerGrille(rows, r, c, g, sauf)));

test('collerGrille : une plage qui tient dans le tableau remplace les cellules sous elle', () => {
  egal(coller(GRILLE(), 1, 0, [['x', 'y'], ['z', 't']]), [['A', 'B'], ['x', 'y'], ['z', 't']]);
  egal(coller(GRILLE(), 2, 1, [['x']]), [['A', 'B'], ['a1', 'b1'], ['a2', 'x']]);
});

test('collerGrille : une plage qui déborde ajoute lignes et colonnes, « Colonne » en en-tête, tableau rectangulaire', () => {
  egal(coller(GRILLE(), 2, 1, [['x', 'y', 'z'], ['u', 'v', 'w']]),
    [['A', 'B', 'Colonne', 'Colonne'], ['a1', 'b1', '', ''], ['a2', 'x', 'y', 'z'], ['', 'u', 'v', 'w']]);
});

test('collerGrille : depuis l\'en-tête, la première ligne de la plage remplace les en-têtes', () => {
  egal(coller(GRILLE(), 0, 0, [['Nom', 'Âge'], ['Alice', '31']]), [['Nom', 'Âge'], ['Alice', '31'], ['a2', 'b2']]);
});

test('collerGrille : ni la grille ni la plage reçues ne sont modifiées', () => {
  const g = GRILLE(), p = [['x', 'y', 'z']];
  ctx.collerGrille(g, 2, 1, p);
  egal(g, GRILLE()); egal(p, [['x', 'y', 'z']]);
});

test('collerGrille : sous un filtre, la plage remplit les lignes visibles et saute les masquées (sauf)', () => {
  const g = [['A', 'B'], ['a1', 'b1'], ['a2', 'b2'], ['a3', 'b3'], ['a4', 'b4']];
  egal(coller(g, 1, 1, [['x'], ['y'], ['z']], [2, 3]), [['A', 'B'], ['a1', 'x'], ['a2', 'b2'], ['a3', 'b3'], ['a4', 'y'], ['', 'z']], 'ligne ajoutée en bout');
  egal(coller(g, 1, 0, [['x', 'y']], [2]), [['A', 'B'], ['x', 'y'], ['a2', 'b2'], ['a3', 'b3'], ['a4', 'b4']], 'plage d\'une ligne');
});

// reprendreLignes : chaque ligne venue de l'ancienne grille reprend son tableau d'origine (le filtre reconnaît les lignes ainsi)
test('reprendreLignes : les lignes gardées restent les mêmes tableaux, avec leur nouveau contenu ; les ajoutées sont neuves', () => {
  const avant = GRILLE(), lignes = avant.slice();
  const x = ctx.opTableau(avant, 'col-apres', 1, 0), g = ctx.reprendreLignes(avant, x.rows, x.origine);
  egal(g.map((l) => lignes.indexOf(l)), [0, 1, 2]);
  egal(JSON.parse(JSON.stringify(g)), [['A', 'Colonne', 'B'], ['a1', '', 'b1'], ['a2', '', 'b2']]);
  const y = ctx.opTableau(g, 'ligne-avant', 2, 0), h = ctx.reprendreLignes(g, y.rows, y.origine);
  egal(h.map((l) => lignes.indexOf(l)), [0, 1, -1, 2]);
  const p = ctx.reprendreLignes(h, ctx.collerGrille(h, 3, 0, [['u'], ['v']]));
  egal(p.map((l) => lignes.indexOf(l)), [0, 1, -1, 2, -1], 'collage : par indice, ligne ajoutée neuve');
  egal(JSON.parse(JSON.stringify(p[3])), ['u', '', 'b2']);
});
