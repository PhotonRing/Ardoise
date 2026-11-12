/* ---------- Barres collantes (menu de bloc, et toute barre posée dans une ancre .collant) ---------- */
// Le haut d'écran est le bas de la barre du haut, ou des onglets de pages, collés sous elle en édition. Sa hauteur
// change avec les paliers de largeur et la seconde rangée d'onglets : elle est mesurée ici et posée dans --haut-ecran,
// que lit l'ancre .collant (editor.css). Les deux éléments sont recréés au rendu : l'observateur est rebranché à chaque fois.
function mesurerHautEcran() {
  var haut = 0;
  [$('#ui .tb'), $('.pnav-tabs', app)].forEach(function (el) {
    if (!el) return;
    var cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (cs.display === 'none' || !r.height) return;
    // élément collé : sa place une fois collé (top + hauteur), pas sa place du moment
    var bas = cs.position === 'sticky' ? (parseFloat(cs.top) || 0) + r.height : r.bottom;
    if (bas > haut) haut = bas;
  });
  document.documentElement.style.setProperty('--haut-ecran', haut + 'px');
}
var hautObs = window.ResizeObserver ? new ResizeObserver(function () { mesurerHautEcran(); }) : null;
function suivreHautEcran() {
  if (hautObs) { hautObs.disconnect(); [$('#ui .tb'), $('.pnav-tabs', app)].forEach(function (el) { if (el) hautObs.observe(el); }); }
  mesurerHautEcran();
}
window.addEventListener('resize', mesurerHautEcran);

// De combien remonter la page pour que la ligne du curseur sorte de sous une barre collante (0 si rien ne la couvre).
function decalageCurseur(curseur, barres, marge) {
  var d = 0;
  barres.forEach(function (b) {
    if (curseur.bottom > b.top && curseur.top < b.bottom + marge) d = Math.max(d, b.bottom + marge - curseur.top);
  });
  return d;
}
// La ligne du curseur ne reste pas cachée sous la barre collante de son bloc : vérifié quand le curseur bouge ou
// qu'on tape (selectionchange), jamais pendant un simple défilement.
var collantTick = 0;
document.addEventListener('selectionchange', function () {
  if (mode !== 'edit' || collantTick) return;
  collantTick = requestAnimationFrame(function () {
    collantTick = 0;
    var s = getSelection(); if (!s.rangeCount) return;
    var f = fieldOf(s.focusNode), blk = f && f.closest('.blk'); if (!blk) return;
    var rg = document.createRange(); rg.setStart(s.focusNode, s.focusOffset);
    var c = rg.getBoundingClientRect(); if (!c.height) c = f.getBoundingClientRect();
    var barres = $$('.collant', blk).filter(function (a) { return a.parentNode === blk; }).map(function (a) {
      var b = a.firstElementChild; return b && getComputedStyle(b).visibility === 'visible' ? b.getBoundingClientRect() : null;
    }).filter(Boolean);
    var d = decalageCurseur(c, barres, 4); if (d) scrollBy(0, -d);
  });
});
