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
function updateUndo() { var h = session.historique(), u = $('#ui [data-ui=undo]'), r = $('#ui [data-ui=redo]'); if (u) u.disabled = !h.annuler; if (r) r.disabled = !h.retablir; }
function change(fn, focus) { session.modifier(fn, focus); }
function snapshot() { session.consigner(); }
// après annuler/rétablir, le curseur revient dans le champ seulement si son bloc existe encore
session.abonner('rendu', function (focus, info) { render(info.historique && !(focus && byId(focus.b)) ? null : focus); });
session.abonner('historique', function () { updateUndo(); });
