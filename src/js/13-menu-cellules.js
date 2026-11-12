/* ---------- Menu contextuel des cellules d'un tableau ----------
   En édition : clic droit, touche Menu, Maj+F10 ou appui long (Android l'envoie comme contextmenu) dans une cellule.
   Ctrl ou Cmd + clic droit et la lecture gardent le menu natif. Les actions passent par tableOp (13-actions-blocs.js). */
function tableCell(t) { return mode === 'edit' && t && t.closest ? t.closest('.blk[data-type=table] [data-cell]') : null; }
function openCellMenu(cell, point) {
  var bid = cell.dataset.b, m = cell.dataset.k.split('.'), r = +m[1], c = +m[2], b = byId(bid); if (!b) return;
  closePop();
  var p = document.createElement('div'); p.className = 'pop'; p.setAttribute('role', 'menu'); pop = p; p.cellule = cell;
  p.innerHTML = OPS_TABLEAU.filter(function (o) { return opTableau(b.rows, o[0], r, c); }).map(function (o) {
    return '<button class="mi" type="button" role="menuitem" data-op="' + o[0] + '">' + o[1] + '</button>';
  }).join('');
  var items = $$('.mi', p);
  function aller(i) { items[(i + items.length) % items.length].focus({ preventScroll: true }); }
  p.addEventListener('keydown', function (e) {
    var i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); aller(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); aller(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); aller(0); }
    else if (e.key === 'End') { e.preventDefault(); aller(-1); }
    else if (e.key === 'Escape' || e.key === 'Tab') {
      // le curseur revient dans la cellule (pas au clic extérieur, qui place le sien)
      e.preventDefault(); e.stopPropagation(); closePop(); if (document.contains(cell)) cell.focus({ preventScroll: true });
    }
  });
  p.addEventListener('click', function (e) {
    var x = e.target.closest('[data-op]'); if (!x) return;
    closePop(); var bb = byId(bid); if (bb) tableOp(bb, x.dataset.op, r, c);
  });
  if (!point) { var cr = cell.getBoundingClientRect(); point = { x: cr.left, y: cr.bottom }; }   // clavier : au bord de la cellule
  placePop(p, cell, point); aller(0);
}
app.addEventListener('contextmenu', function (e) {
  var cell = tableCell(e.target); if (!cell || e.ctrlKey || e.metaKey) return;
  e.preventDefault();
  if (pop && pop.cellule === cell) return;   // déjà ouvert par la touche Menu ou Maj+F10
  // clavier : coordonnées nulles, le menu s'ouvre au bord de la cellule
  openCellMenu(cell, e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : null);
});
app.addEventListener('keydown', function (e) {
  if (!(e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) return;
  var cell = tableCell(e.target); if (!cell) return;
  e.preventDefault(); openCellMenu(cell, null);
});
window.addEventListener('scroll', function () { if (pop && pop.cellule) closePop(); }, true);
