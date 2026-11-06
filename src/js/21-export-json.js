/* ---------- Nouveau, export, JSON ---------- */
function newDoc(kind) {
  if (dirty && !confirm('Les modifications non enregistrées de cette page seront perdues (un brouillon reste dans le navigateur). Continuer ?')) return;
  saveDraft();
  synStop();
  mode = 'edit';
  session.remplacer(template(kind), 'nouveau');
  scrollTo(0, 0);
  setStatus('warn', 'Nouveau document · Ctrl+S pour choisir le fichier');
  focusField(doc.blocks[0].id, 'title');
}
