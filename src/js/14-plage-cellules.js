/* ---------- Plage de cellules d'un tableau (édition) ----------
   Chaque cellule est un champ éditable à part : la plage est un état de l'éditeur, pas la sélection du navigateur.
   Maj+clic, glisser à la souris ou Maj+flèche au bord d'une cellule la posent ; Ctrl+C la copie (grilleEnTexte,
   grilleEnHtml : 05-presse-papier.js), Ctrl+X la coupe, Suppr ou Retour arrière la vident ; un clic simple ou une saisie
   la défont. Les lignes masquées par le filtre (14-filtre-lignes.js) ne sont ni surlignées, ni copiées, ni vidées.
   Les écouteurs sont en capture : ils passent avant la saisie (12-saisie.js) et ne l'arrêtent que lorsqu'ils agissent. */
var plageCellules = null;   // { b, r1, c1 : ancre, la cellule du curseur ; r2, c2 : extrémité }
var plageDepart = null;     // cellule où un glisser à la souris a commencé
function posCellule(el) { var m = el.dataset.k.split('.'); return { b: el.dataset.b, r: +m[1], c: +m[2] }; }
function lignesMasquees(b) {
  var out = [];
  b.rows.forEach(function (x, r) { var c = cellAt(b, r, 0); if (c && c.closest('tr[hidden]')) out.push(r); });
  return out;
}
// surlignage, réappliqué après chaque rendu (07-rendu.js) ; la plage tombe si son tableau a disparu ou rétréci
function poserPlage() {
  $$('.fld.plage', app).forEach(function (f) { f.classList.remove('plage'); });
  var p = plageCellules, b = p && mode === 'edit' ? byId(p.b) : null;
  if (!b || b.type !== 'table' || Math.max(p.r1, p.r2) >= b.rows.length || Math.max(p.c1, p.c2) >= b.rows[0].length) { plageCellules = null; return; }
  for (var r = Math.min(p.r1, p.r2); r <= Math.max(p.r1, p.r2); r++) {
    for (var c = Math.min(p.c1, p.c2); c <= Math.max(p.c1, p.c2); c++) { var f = cellAt(b, r, c); if (f && !f.closest('tr[hidden]')) f.classList.add('plage'); }
  }
}
function definirPlage(a, r2, c2) { plageCellules = { b: a.b, r1: a.r, c1: a.c, r2: r2, c2: c2 }; poserPlage(); }
function defairePlage() { if (plageCellules) { plageCellules = null; poserPlage(); } }
// plage avec ses lignes masquées, pour la copie et le vidage
function plageVisible(b) { var p = plageCellules; return { r1: p.r1, c1: p.c1, r2: p.r2, c2: p.c2, sauf: lignesMasquees(b) }; }
function viderPlage() {
  var p = plageCellules, b = p && byId(p.b); if (!b) return;
  var pl = plageVisible(b); plageCellules = null;
  session.modifier(function () {
    for (var r = Math.min(pl.r1, pl.r2); r <= Math.max(pl.r1, pl.r2); r++) {
      if (pl.sauf.indexOf(r) < 0) for (var c = Math.min(pl.c1, pl.c2); c <= Math.max(pl.c1, pl.c2); c++) b.rows[r][c] = '';
    }
  }, { b: b.id, k: 'rows.' + pl.r1 + '.' + pl.c1, end: false });
  lastCell = { b: b.id, r: pl.r1, c: pl.c1 };
}
// copie : document.execCommand('copy') déclenche l'événement même quand le curseur n'a rien sélectionné
document.addEventListener('copy', function (e) {
  var p = plageCellules, b = p && byId(p.b), cd = e.clipboardData; if (!b || !cd) return;
  e.preventDefault(); e.stopPropagation();
  var pl = plageVisible(b);
  cd.setData('text/plain', grilleEnTexte(b.rows, pl)); cd.setData('text/html', grilleEnHtml(b.rows, pl, doc.id));
}, true);
document.addEventListener('cut', function (e) { if (plageCellules) { e.preventDefault(); e.stopPropagation(); document.execCommand('copy'); viderPlage(); } }, true);
// cellule voisine (flèche) d'une cellule, lignes masquées sautées (ligneVoisine), ou null au bord du tableau
function celluleVoisine(b, r, c, key) {
  if (key === 'ArrowLeft') return c > 0 ? { r: r, c: c - 1 } : null;
  if (key === 'ArrowRight') return c < b.rows[0].length - 1 ? { r: r, c: c + 1 } : null;
  var v = ligneVoisine(b, r, key === 'ArrowUp' ? -1 : 1);
  return v >= 0 ? { r: v, c: c } : null;
}
function auBordDeCellule(el, key) {
  // mêmes bords que cellArrow (12-saisie.js) : au milieu du texte, Maj+flèche garde la sélection de texte
  if (key === 'ArrowLeft') return caretAtStart(el);
  if (key === 'ArrowRight') return caretAtEnd(el);
  return caretLine(el, key === 'ArrowUp' ? -1 : 1);
}
app.addEventListener('keydown', function (e) {
  if (mode !== 'edit') return;
  var cell = tableCell(e.target), p = plageCellules;
  if (cell && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) {
    var b = byId(cell.dataset.b), a = posCellule(cell), dep = p && p.b === a.b ? { r: p.r2, c: p.c2 } : null;
    if (!dep && !auBordDeCellule(cell, e.key)) return;
    var z = celluleVoisine(b, dep ? dep.r : a.r, dep ? dep.c : a.c, e.key);
    e.preventDefault(); e.stopPropagation();
    if (z) definirPlage(dep ? { b: p.b, r: p.r1, c: p.c1 } : a, z.r, z.c);
    return;
  }
  if (!p) return;
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && /^[cx]$/i.test(e.key)) {
    e.preventDefault(); e.stopPropagation();
    document.execCommand('copy');
    if (e.key.toLowerCase() === 'x') viderPlage();
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); viderPlage(); return; }
  if (/^(Shift|Control|Alt|AltGraph|Meta|CapsLock)$/.test(e.key)) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
  defairePlage();
}, true);
// souris : Maj+clic depuis la cellule du curseur, ou glisser d'une cellule à une autre ; tout autre clic défait la plage
// (clic droit compris : le menu des cellules agit sur la cellule cliquée, sans plage)
app.addEventListener('mousedown', function (e) {
  var cell = tableCell(e.target);
  if (cell && e.button === 0 && e.shiftKey) {
    var f = plageCellules ? cellAt(byId(plageCellules.b) || {}, plageCellules.r1, plageCellules.c1) : tableCell(document.activeElement);
    if (f && f.dataset.b === cell.dataset.b && f !== cell) { e.preventDefault(); var z = posCellule(cell); definirPlage(posCellule(f), z.r, z.c); return; }
  }
  defairePlage();
  plageDepart = cell && e.button === 0 && !e.shiftKey ? cell : null;
}, true);
app.addEventListener('mouseover', function (e) {
  if (!plageDepart || !(e.buttons & 1)) return;
  var cell = tableCell(e.target); if (!cell || cell.dataset.b !== plageDepart.dataset.b) return;
  if (cell === plageDepart && !plageCellules) return;
  document.documentElement.classList.add('plage-glisse');   // plus de sélection de texte pendant le glisser
  var z = posCellule(cell); definirPlage(posCellule(plageDepart), z.r, z.c);
});
document.addEventListener('mouseup', function () { plageDepart = null; document.documentElement.classList.remove('plage-glisse'); });
// le curseur quitte le tableau de la plage (filtre, autre champ) : la plage tombe
app.addEventListener('focusin', function (e) {
  var cell = tableCell(e.target);
  if (plageCellules && !(cell && cell.dataset.b === plageCellules.b)) defairePlage();
});
