/* ---------- Raccourcis globaux ---------- */
document.addEventListener('keydown', function (e) {
  if (!doc) return;
  var mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  // pendant une composition (clavier Android), la touche arrive en « Process » / « Unidentified »
  if (k.length > 1 && mod && /^Key[A-Z]$/.test(e.code || '')) k = e.code.slice(3).toLowerCase();
  if (mod && k === 's') { e.preventDefault(); save(e.shiftKey); return; }
  if (mod && k === 'e' && !e.shiftKey) { e.preventDefault(); toggleMode(); return; }
  if (e.altKey && (e.key === 'PageDown' || e.key === 'PageUp')) { e.preventDefault(); goPage(doc.cur + (e.key === 'PageDown' ? 1 : -1)); return; }
  // dans un menu, la touche reste au champ ; dans la fenêtre d'une puce de requête, elle annule le document (sauf dans un champ de saisie)
  var dansMenu = pop && pop.contains(e.target) && (!pop.classList.contains('q-fen') || e.target.matches('input[type=search], input[type=number]'));
  if (mode === 'edit' && mod && (k === 'z' || k === 'y') && !$('.modal-bg', ui) && !dansMenu) {
    e.preventDefault(); if (k === 'y' || e.shiftKey) redo(); else undo(); return;
  }
  if (e.key === 'Escape' && pop) { closePop(); return; }
  if (e.key === 'Escape' && mode === 'edit' && !$('.modal-bg', ui) && !(e.target.matches && e.target.matches('.map-q'))) { if (endMapModes()) e.preventDefault(); }
});

