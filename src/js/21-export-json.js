/* ---------- Nouveau, export, JSON ---------- */
function newDoc(kind) {
  if (dirty && !confirm('Les modifications non enregistrées de cette page seront perdues (un brouillon reste dans le navigateur). Continuer ?')) return;
  saveDraft();
  doc = normalize(TEMPLATES[kind]()); doc.id = uid() + uid(); doc.savedAt = null;
  fileHandle = null; handleGranted = false; downloadMode = false; dirty = false; unlocked = false;
  hist = []; hpos = -1; snapshot();
  mode = 'edit'; render(); scrollTo(0, 0);
  setStatus('warn', 'Nouveau document · Ctrl+S pour choisir le fichier');
  focusField(doc.blocks[0].id, 'title');
}
