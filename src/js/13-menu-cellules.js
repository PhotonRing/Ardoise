/* ---------- Menu contextuel des cellules d'un tableau ---------- */
// Clic droit, touche Menu, Maj+F10 ou appui long (contextmenu sous Android) en édition ; Ctrl+clic droit et la lecture gardent le menu natif.
function celluleDeTableau(t) { return mode === 'edit' && t && t.closest ? t.closest('.blk[data-type=table] [data-cell]') : null; }
function posCellule(el) { var m = el.dataset.k.split('.'); return { b: el.dataset.b, r: +m[1], c: +m[2] }; }
function ouvrirMenuCellules(cellule, point) {
  var x = posCellule(cellule), b = byId(x.b); if (!b) return;
  closePop();
  var p = document.createElement('div'); p.className = 'pop'; p.setAttribute('role', 'menu'); pop = p; p.cellule = cellule;
  p.innerHTML = OPS_TABLEAU.filter(function (o) { return opTableau(b.rows, o[0], x.r, x.c); }).map(function (o) {
    return '<button class="mi" type="button" role="menuitem" data-op="' + o[0] + '">' + o[1] + '</button>';
  }).join('');
  var boutons = $$('.mi', p);
  function aller(i) { boutons[(i + boutons.length) % boutons.length].focus({ preventScroll: true }); }
  p.addEventListener('keydown', function (e) {
    var i = boutons.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); aller(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); aller(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); aller(0); }
    else if (e.key === 'End') { e.preventDefault(); aller(-1); }
    else if (e.key === 'Escape' || e.key === 'Tab') {
      // le curseur revient dans la cellule (pas au clic extérieur, qui place le sien)
      e.preventDefault(); e.stopPropagation(); closePop(); if (document.contains(cellule)) cellule.focus({ preventScroll: true });
    }
  });
  p.addEventListener('click', function (e) {
    var o = e.target.closest('[data-op]'); if (!o) return;
    closePop(); var bb = byId(x.b); if (bb) tableOp(bb, o.dataset.op, x.r, x.c);   // tableOp : 13-actions-blocs.js
  });
  if (!point) { var cr = cellule.getBoundingClientRect(); point = { x: cr.left, y: cr.bottom }; }   // clavier : au bord de la cellule
  placePop(p, cellule, point); aller(0);
}
app.addEventListener('contextmenu', function (e) {
  var cellule = celluleDeTableau(e.target); if (!cellule || e.ctrlKey || e.metaKey) return;
  e.preventDefault();
  if (pop && pop.cellule === cellule) return;   // déjà ouvert par la touche Menu ou Maj+F10
  // clavier : coordonnées nulles, le menu s'ouvre au bord de la cellule
  ouvrirMenuCellules(cellule, e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : null);
});
app.addEventListener('keydown', function (e) {
  if (!(e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) return;
  var cellule = celluleDeTableau(e.target); if (!cellule) return;
  e.preventDefault(); ouvrirMenuCellules(cellule, null);
});
window.addEventListener('scroll', function () { if (pop && pop.cellule) closePop(); }, true);
