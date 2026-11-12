// Opérations sur la grille d'un tableau (src/js/05-tableau.js) : opTableau sert le menu contextuel des cellules et les
// boutons +L, −L, +C, −C ; elle rend une nouvelle grille et la nouvelle place du curseur, ou null si l'opération est impossible.
import { contexte, egal, test } from './commun.mjs';

const ctx = contexte();
const GRILLE = () => [['A', 'B'], ['a1', 'b1'], ['a2', 'b2']];
const op = (rows, o, r, c) => JSON.parse(JSON.stringify(ctx.opTableau(rows, o, r, c)));

test('opTableau : insérer une ligne au-dessus ou en dessous, curseur dans la nouvelle ligne', () => {
  egal(op(GRILLE(), 'ligne-avant', 1, 1), { rows: [['A', 'B'], ['', ''], ['a1', 'b1'], ['a2', 'b2']], r: 1, c: 1 });
  egal(op(GRILLE(), 'ligne-apres', 1, 0), { rows: [['A', 'B'], ['a1', 'b1'], ['', ''], ['a2', 'b2']], r: 2, c: 0 });
  egal(op(GRILLE(), 'ligne-apres', 0, 1), { rows: [['A', 'B'], ['', ''], ['a1', 'b1'], ['a2', 'b2']], r: 1, c: 1 }, 'sous l\'en-tête');
});

test('opTableau : insérer une colonne à gauche ou à droite, « Colonne » en en-tête, curseur dans la nouvelle colonne', () => {
  egal(op(GRILLE(), 'col-avant', 2, 0), { rows: [['Colonne', 'A', 'B'], ['', 'a1', 'b1'], ['', 'a2', 'b2']], r: 2, c: 0 });
  egal(op(GRILLE(), 'col-apres', 1, 0), { rows: [['A', 'Colonne', 'B'], ['a1', '', 'b1'], ['a2', '', 'b2']], r: 1, c: 1 });
});

test('opTableau : supprimer la ligne ou la colonne, curseur ramené dans la grille', () => {
  egal(op(GRILLE(), 'ligne-suppr', 1, 1), { rows: [['A', 'B'], ['a2', 'b2']], r: 1, c: 1 });
  egal(op(GRILLE(), 'ligne-suppr', 2, 0), { rows: [['A', 'B'], ['a1', 'b1']], r: 1, c: 0 }, 'dernière ligne');
  egal(op(GRILLE(), 'col-suppr', 1, 1), { rows: [['A'], ['a1'], ['a2']], r: 1, c: 0 }, 'dernière colonne');
  egal(op(GRILLE(), 'col-suppr', 0, 0), { rows: [['B'], ['b1'], ['b2']], r: 0, c: 0 }, 'depuis l\'en-tête');
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
