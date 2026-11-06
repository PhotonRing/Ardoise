/* ---------- Historique (annuler / rétablir) : adaptateur DOM de la session (05-session.js) ---------- */
function settleInput() {
  // termine la saisie en cours avant de redessiner : un clavier Android (même physique) compose le mot
  // en cours et le réinjecterait dans le champ recréé, d'où une ligne en double
  var a = document.activeElement;
  if (!a || !app.contains(a) || !(a.isContentEditable || a.tagName === 'TEXTAREA')) return null;
  var f = { b: a.dataset.b, k: a.dataset.k }; a.blur();
  return f.b ? f : null;
}
function undo() { session.annuler(settleInput()); }
function redo() { session.retablir(settleInput()); }
// boutons de la barre, et ceux du menu plein écran s'il est ouvert (16-interface.js)
function updateUndo() {
  var h = session.historique();
  [[$('#ui [data-ui=undo]'), $('#ui [data-ui=redo]')], sheet ? [$('[data-sh=undo]', sheet), $('[data-sh=redo]', sheet)] : []].forEach(function (ur) {
    if (ur[0]) ur[0].disabled = !h.annuler; if (ur[1]) ur[1].disabled = !h.retablir;
  });
}
// après annuler/rétablir, le curseur revient dans le champ seulement si son bloc existe encore
session.abonner('rendu', function (focus, info) { render(info.historique && !(focus && byId(focus.b)) ? null : focus); });
session.abonner('historique', function () { updateUndo(); });
