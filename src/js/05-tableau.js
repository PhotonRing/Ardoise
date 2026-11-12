/* ---------- Opérations sur la grille d'un tableau ----------
   Fonction pure, partagée par le menu contextuel des cellules et les boutons +L, −L, +C, −C de la barre du bloc.
   Au chargement, ce fichier ne touche ni au DOM ni au stockage. */
// opérations du menu, dans son ordre, avec leur libellé
var OPS_TABLEAU = [['ligne-avant', 'Insérer une ligne au-dessus'], ['ligne-apres', 'Insérer une ligne en dessous'],
  ['col-avant', 'Insérer une colonne à gauche'], ['col-apres', 'Insérer une colonne à droite'],
  ['ligne-suppr', 'Supprimer la ligne'], ['col-suppr', 'Supprimer la colonne']];
// grille rows (ligne 0 : en-tête) et cellule (r, c) → { rows : nouvelle grille, r, c : place du curseur }, ou null si
// l'opération est impossible : l'en-tête n'est jamais supprimé ni précédé, il reste une ligne sous l'en-tête et une colonne
function opTableau(rows, op, r, c) {
  var g = rows.map(function (x) { return x.slice(); }), nc = g[0].length;
  var vide = function () { return g[0].map(function () { return ''; }); };
  var col = function (at) { g.forEach(function (x, j) { x.splice(at, 0, j === 0 ? 'Colonne' : ''); }); };
  switch (op) {
    case 'ligne-avant': if (r < 1) return null; g.splice(r, 0, vide()); return { rows: g, r: r, c: c };
    case 'ligne-apres': g.splice(r + 1, 0, vide()); return { rows: g, r: r + 1, c: c };
    case 'col-avant': col(c); return { rows: g, r: r, c: c };
    case 'col-apres': col(c + 1); return { rows: g, r: r, c: c + 1 };
    case 'ligne-suppr': if (r < 1 || g.length < 3) return null; g.splice(r, 1); return { rows: g, r: Math.min(r, g.length - 1), c: c };
    case 'col-suppr': if (nc < 2) return null; g.forEach(function (x) { x.splice(c, 1); }); return { rows: g, r: r, c: Math.min(c, nc - 2) };
  }
  return null;
}
// plage collée (grille de cellules) à partir de la cellule (r, c), vers la droite et le bas → nouvelle grille, agrandie
// au besoin (nouvel en-tête « Colonne », nouvelles cellules vides, comme +C et +L), toujours rectangulaire
function collerGrille(rows, r, c, grille) {
  var nl = Math.max(rows.length, r + grille.length), nc = Math.max(rows[0].length, c + grille[0].length), g = [];
  for (var i = 0; i < nl; i++) {
    g.push([]);
    for (var j = 0; j < nc; j++) g[i].push(rows[i] && j < rows[i].length ? rows[i][j] : i === 0 ? 'Colonne' : '');
  }
  grille.forEach(function (x, i) { x.forEach(function (v, j) { g[r + i][c + j] = v; }); });
  return g;
}
