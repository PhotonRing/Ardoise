/* ---------- Mode lecture / édition ---------- */
function toggleMode() {
  if (htimer) snapshot();
  if (mode === 'view' && doc.lock && !unlocked) { askPassword(function () { toggleMode(); }); return; }
  mode = mode === 'edit' ? 'view' : 'edit';
  closePop(); itb.style.display = 'none';
  var y = scrollY; render(); scrollTo(0, y);
}

