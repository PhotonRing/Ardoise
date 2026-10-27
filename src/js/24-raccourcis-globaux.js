/* ---------- Raccourcis globaux ---------- */
document.addEventListener('keydown', function (e) {
  if (!doc) return;
  var mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (mod && k === 's') { e.preventDefault(); save(e.shiftKey); return; }
  if (mod && k === 'e' && !e.shiftKey) { e.preventDefault(); toggleMode(); return; }
  if (e.altKey && (e.key === 'PageDown' || e.key === 'PageUp')) { e.preventDefault(); goPage(doc.cur + (e.key === 'PageDown' ? 1 : -1)); return; }
  if (mode === 'edit' && mod && (k === 'z' || k === 'y') && !$('.modal-bg', ui) && !(pop && pop.contains(e.target))) {
    e.preventDefault(); if (k === 'y' || e.shiftKey) redo(); else undo(); return;
  }
  if (e.key === 'Escape' && pop) { closePop(); return; }
  if (e.key === 'Escape' && mode === 'edit' && !$('.modal-bg', ui) && !(e.target.matches && e.target.matches('.map-q'))) { if (endMapModes()) e.preventDefault(); }
});

