/* ---------- Opérations sur la grille d'un tableau (menu des cellules, +L −L +C −C, collage ; sans DOM) ---------- */
// opérations du menu, dans son ordre, avec leur libellé
var OPS_TABLEAU = [['ligne-avant', 'Insérer une ligne au-dessus'], ['ligne-apres', 'Insérer une ligne en dessous'],
  ['col-avant', 'Insérer une colonne à gauche'], ['col-apres', 'Insérer une colonne à droite'],
  ['ligne-suppr', 'Supprimer la ligne'], ['col-suppr', 'Supprimer la colonne']];
// → { rows : nouvelle grille, r, c : curseur, origine : indice d'avant de chaque ligne, -1 si ajoutée }, ou null si impossible (en-tête, dernière ligne ou colonne)
function opTableau(rows, op, r, c) {
  var g = rows.map(function (x) { return x.slice(); }), o = rows.map(function (x, i) { return i; }), nc = g[0].length;
  var vide = function () { return g[0].map(function () { return ''; }); };
  var ligne = function (at) { g.splice(at, 0, vide()); o.splice(at, 0, -1); };
  var col = function (at) { g.forEach(function (x, j) { x.splice(at, 0, j === 0 ? 'Colonne' : ''); }); };
  var fin = function (r2, c2) { return { rows: g, r: r2, c: c2, origine: o }; };
  switch (op) {
    case 'ligne-avant': if (r < 1) return null; ligne(r); return fin(r, c);
    case 'ligne-apres': ligne(r + 1); return fin(r + 1, c);
    case 'col-avant': col(c); return fin(r, c);
    case 'col-apres': col(c + 1); return fin(r, c + 1);
    case 'ligne-suppr': if (r < 1 || g.length < 3) return null; g.splice(r, 1); o.splice(r, 1); return fin(Math.min(r, g.length - 1), c);
    case 'col-suppr': if (nc < 2) return null; g.forEach(function (x) { x.splice(c, 1); }); return fin(r, Math.min(c, nc - 2));
  }
  return null;
}
// plage collée depuis (r, c) → nouvelle grille rectangulaire, agrandie comme par +L et +C ; les lignes de sauf (filtrées) sont sautées, comme à la copie
function collerGrille(rows, r, c, grille, sauf) {
  var cibles = [];
  for (var i = r; cibles.length < grille.length; i++) if (!sauf || sauf.indexOf(i) < 0) cibles.push(i);
  var nl = Math.max(rows.length, cibles[cibles.length - 1] + 1), nc = Math.max(rows[0].length, c + grille[0].length), g = [];
  for (i = 0; i < nl; i++) {
    g.push([]);
    for (var j = 0; j < nc; j++) g[i].push(rows[i] && j < rows[i].length ? rows[i][j] : i === 0 ? 'Colonne' : '');
  }
  grille.forEach(function (x, k) { x.forEach(function (v, j) { g[cibles[k]][c + j] = v; }); });
  return g;
}
// lignes de g venues de rows (origine, sinon même indice) remises dans leur tableau d'avant : le filtre (14-filtre-lignes.js) reconnaît une ligne à son tableau
function reprendreLignes(rows, g, origine) {
  return g.map(function (l, i) {
    var o = origine ? origine[i] : i < rows.length ? i : -1, x = o >= 0 && rows[o];
    if (!x) return l;
    x.length = 0; x.push.apply(x, l); return x;
  });
}
