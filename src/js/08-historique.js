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
// boutons de la barre, et ceux du menu plein écran s'il est ouvert (16-interface.js) : possibilité et libellé reçus de la session
function updateUndo(h) {
  h = h || session.historique();
  var titre = function (nom, lib, touche) { return nom + (lib ? ' : ' + lib : '') + ' (' + touche + ')'; };
  var u = $('#ui [data-ui=undo]'), r = $('#ui [data-ui=redo]');
  if (u) { u.disabled = !h.annuler; u.title = titre('Annuler', h.libelleAnnuler, 'Ctrl+Z'); u.setAttribute('aria-label', u.title); }
  if (r) { r.disabled = !h.retablir; r.title = titre('Rétablir', h.libelleRetablir, 'Ctrl+Maj+Z'); r.setAttribute('aria-label', r.title); }
  if (!sheet) return;
  [['undo', h.annuler, h.libelleAnnuler], ['redo', h.retablir, h.libelleRetablir]].forEach(function (x) {
    var b = $('[data-sh=' + x[0] + ']', sheet); if (!b) return;
    b.disabled = !x[1]; var sub = $('.sub', b); if (sub) { sub.textContent = x[2] || ''; sub.title = x[2] || ''; }
  });
}
// après annuler/rétablir, le curseur revient dans le champ seulement si son bloc existe encore
session.abonner('rendu', function (focus, info) { render(info.historique && !(focus && byId(focus.b)) ? null : focus); });
session.abonner('historique', function (h) { updateUndo(h); });
