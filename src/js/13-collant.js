/* ---------- Barres collantes (menu de bloc, et toute barre posée dans une ancre .collant) ---------- */
// Haut d'écran : bas de la barre du haut ou des onglets de pages ; sa hauteur varie (largeur, onglets), d'où sa mesure dans --haut-ecran (editor.css).
function barresDuHaut() { return [$('#ui .tb'), $('.pnav-tabs', app)]; }   // recréées au rendu : l'observateur est rebranché à chaque fois
function mesurerHautEcran() {
  var haut = 0;
  barresDuHaut().forEach(function (el) {
    if (!el) return;
    var cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (cs.display === 'none' || !r.height) return;
    // élément collé : sa place une fois collé (top + hauteur), pas sa place du moment
    var bas = cs.position === 'sticky' ? (parseFloat(cs.top) || 0) + r.height : r.bottom;
    if (bas > haut) haut = bas;
  });
  document.documentElement.style.setProperty('--haut-ecran', haut + 'px');
}
var observateurHaut = window.ResizeObserver ? new ResizeObserver(function () { mesurerHautEcran(); }) : null;
function suivreHautEcran() {
  if (observateurHaut) { observateurHaut.disconnect(); barresDuHaut().forEach(function (el) { if (el) observateurHaut.observe(el); }); }
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
// ligne du curseur sortie de sous la barre collante de son bloc quand le curseur bouge (selectionchange), jamais au simple défilement
var collantAttente = 0;   // image d'animation demandée
document.addEventListener('selectionchange', function () {
  if (mode !== 'edit' || collantAttente) return;
  collantAttente = requestAnimationFrame(function () {
    collantAttente = 0;
    var s = getSelection(); if (!s.rangeCount) return;
    var f = fieldOf(s.focusNode), blk = f && f.closest('.blk'); if (!blk) return;
    var rg = document.createRange(); rg.setStart(s.focusNode, s.focusOffset);
    var c = rg.getBoundingClientRect(); if (!c.height) c = f.getBoundingClientRect();
    var barres = $$('.collant', blk).map(function (a) {
      var b = a.firstElementChild; return b && getComputedStyle(b).visibility === 'visible' ? b.getBoundingClientRect() : null;
    }).filter(Boolean);
    var d = decalageCurseur(c, barres, 4); if (d) scrollBy(0, -d);
  });
});
