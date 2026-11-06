/* ---------- Mode lecture / édition ---------- */
function toggleMode() {
  session.valider();
  if (mode === 'view' && doc.lock && !unlocked) { askPassword(function () { toggleMode(); }); return; }
  if (mode === 'view' && doc.newer) { newerNotice(true); return; }
  mode = mode === 'edit' ? 'view' : 'edit';
  closePop(); itb.style.display = 'none';
  var y = scrollY; render(); scrollTo(0, y);
}

