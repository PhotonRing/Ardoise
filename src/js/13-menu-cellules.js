/* ---------- Menus contextuels : cellules d'un tableau, cases d'un bloc texte ---------- */
// Clic droit, touche Menu, Maj+F10 ou appui long (contextmenu sous Android) en édition ; Ctrl+clic droit, la lecture et le
// reste du document gardent le menu natif.
// Menu d'Ardoise : entrées { label, fn, op facultatif (data-op, repère des bancs) }, flèches, Début et Fin ; Échap ou Tab rendent le curseur à sa place dans le champ
// (pas au clic extérieur, qui place le sien). cible : élément visé (garde contre le contextmenu qui suit la touche Menu,
// fermeture au défilement) ; champ : élément qui reprend le focus ; point absent (clavier) : au bord de la cible.
function ouvrirMenuContextuel(cible, champ, point, entrees) {
  var s = getSelection(), plage = s.rangeCount && champ.contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : null;
  closePop();
  var p = document.createElement('div'); p.className = 'pop'; p.setAttribute('role', 'menu'); pop = p; p.cible = cible;
  p.innerHTML = entrees.map(function (o, i) { return '<button class="mi" type="button" role="menuitem" data-mc="' + i + '"' + (o.op ? ' data-op="' + o.op + '"' : '') + '>' + esc(o.label) + '</button>'; }).join('');
  var boutons = $$('.mi', p);
  function aller(i) { boutons[(i + boutons.length) % boutons.length].focus({ preventScroll: true }); }
  p.addEventListener('keydown', function (e) {
    var i = boutons.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); aller(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); aller(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); aller(0); }
    else if (e.key === 'End') { e.preventDefault(); aller(-1); }
    else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault(); e.stopPropagation(); closePop();
      if (!document.contains(champ)) return;
      champ.focus({ preventScroll: true });
      if (plage) { var sl = getSelection(); sl.removeAllRanges(); sl.addRange(plage); }
    }
  });
  p.addEventListener('click', function (e) {
    var o = e.target.closest('[data-mc]'); if (!o) return;
    closePop(); entrees[+o.dataset.mc].fn();
  });
  if (!point) { var cr = cible.getBoundingClientRect(); point = { x: cr.left, y: cr.bottom }; }
  placePop(p, cible, point); aller(0);
}
// clic droit : au pointeur ; clavier (coordonnées nulles) : au bord de la cible
function pointDuMenu(e) { return e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : null; }

// cellules d'un tableau : opérations de lignes et de colonnes possibles à cet endroit
function celluleDeTableau(t) { return mode === 'edit' && t && t.closest ? t.closest('.blk[data-type=table] [data-cell]') : null; }
function posCellule(el) { var m = el.dataset.k.split('.'); return { b: el.dataset.b, r: +m[1], c: +m[2] }; }
function ouvrirMenuCellules(cellule, point) {
  var x = posCellule(cellule), b = byId(x.b); if (!b) return;
  ouvrirMenuContextuel(cellule, cellule, point, OPS_TABLEAU.filter(function (o) { return opTableau(b.rows, o[0], x.r, x.c); }).map(function (o) {
    return { label: o[1], op: o[0], fn: function () { var bb = byId(x.b); if (bb) tableOp(bb, o[0], x.r, x.c); } };   // tableOp : 13-actions-blocs.js
  }));
}

// cases d'un bloc texte : « Cochées à la fin de la liste ». La ligne visée est celle du pointeur, ou celle du curseur quand
// l'événement vise le champ entier (touche Menu, Maj+F10)
function caseDeBlocTexte(t) {
  if (mode !== 'edit' || !t || !t.closest) return null;
  var el = t.closest('.texte[data-texte]'); if (!el) return null;
  var lg = ligneDuNoeud(el, t), s = getSelection();   // 12-bloc-texte.js
  if (!lg && s.rangeCount && el.contains(s.anchorNode)) lg = ligneDuNoeud(el, s.anchorNode);
  return lg && lg.dataset.g === 'case' ? lg : null;
}
function ouvrirMenuCase(lg, point) {
  ouvrirMenuContextuel(lg, lg.parentNode, point, [{ label: 'Cochées à la fin de la liste', fn: function () { rangerCases(lg); } }]);
}
// suite de cases autour de la ligne rangée par le module pur (casesALaFin : 05-lignes.js) ; déjà rangée : rien, aucune étape
function rangerCases(lg) {
  var el = lg.parentNode, bid = el && el.dataset.b, b = byId(bid), i = lignesDe(el).indexOf(lg);
  if (!b || !b.lignes || !b.lignes[i]) return;
  session.valider();
  var l = b.lignes[i], range = casesALaFin(b.lignes, i);
  if (range.every(function (x, k) { return x === b.lignes[k]; })) { caretLigne(bid, i, 0); return; }
  session.modifier(function () { b.lignes = range; });
  caretLigne(bid, range.indexOf(l), 0);
  if (tousBlocs(doc.blocks).some(function (x) { return x.type === 'query'; })) refreshDerivedSoon();   // requêtes sur les cases à cocher
}

app.addEventListener('contextmenu', function (e) {
  if (e.ctrlKey || e.metaKey) return;
  var cellule = celluleDeTableau(e.target), lg = cellule ? null : caseDeBlocTexte(e.target), cible = cellule || lg;
  if (!cible) return;
  e.preventDefault();
  if (pop && pop.cible === cible) return;   // déjà ouvert par la touche Menu ou Maj+F10
  if (cellule) ouvrirMenuCellules(cellule, pointDuMenu(e)); else ouvrirMenuCase(lg, pointDuMenu(e));
});
app.addEventListener('keydown', function (e) {
  if (!(e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) return;
  var cellule = celluleDeTableau(e.target), lg = cellule ? null : caseDeBlocTexte(e.target);
  if (cellule) { e.preventDefault(); ouvrirMenuCellules(cellule, null); }
  else if (lg) { e.preventDefault(); ouvrirMenuCase(lg, null); }
});
window.addEventListener('scroll', function () { if (pop && pop.cible) closePop(); }, true);
