/* ---------- Opérations sur les blocs ---------- */
// insère un bloc neuf à la place i d'une liste (par défaut, la page affichée) ; un groupe neuf reçoit le curseur dans son titre
function insertAt(i, type, props, focusIt, liste) {
  var nb = mk(type, props || {});
  session.modifier(function () { (liste || doc.blocks).splice(i, 0, nb); revealBlock(nb.id); });
  if (focusIt !== false) focusField(nb.id, type === 'group' ? 'title' : null, false);
  return nb;
}
// insère après le bloc b, dans sa liste (la page, ou le groupe qui le contient) ; un type refusé dans un groupe va après le groupe
function insertAfter(b, type, props, focusIt) {
  var o = position(b); if (!o) return insertAt(doc.blocks.length, type, props, focusIt);
  if (o.parent && HORS_GROUPE[type]) return insertAt(idx(o.parent) + 1, type, props, focusIt);
  return insertAt(o.i + 1, type, props, focusIt, o.liste);
}
// ajoute un bloc à la fin d'un groupe (déplié au besoin)
function insertInGroup(g, type) { return insertAt((g.blocks || []).length, type, {}, true, g.blocks); }
function blockUnits() {
  // blocs visibles en édition, chacun avec les blocs que sa section pliée masque
  var fi = foldInfo(doc.blocks), out = [];
  doc.blocks.forEach(function (x, i) { if (fi.hidden[x.id] && out.length) out[out.length - 1].n++; else out.push({ i: i, n: 1, id: x.id }); });
  return out;
}
function moveBlock(b, d) {
  var o = position(b);
  if (o && o.parent) {
    // bloc d'un groupe : il change de place dans son groupe ; le premier monte juste au-dessus, le dernier descend juste en dessous
    var j0 = o.i + d;
    session.modifier(function () {
      if (j0 < 0 || j0 >= o.liste.length) sortirDuGroupe(doc.blocks, b.id, d < 0);
      else { o.liste.splice(o.i, 1); o.liste.splice(j0, 0, b); }
      revealBlock(b.id);
    });
    var eg = $('.blk[data-id="' + b.id + '"]'); if (eg) eg.scrollIntoView({ block: 'nearest' });
    return;
  }
  var us = blockUnits(), k = -1;
  for (var q = 0; q < us.length; q++) if (us[q].id === b.id) k = q;
  var j = k + d; if (k < 0 || j < 0 || j >= us.length) return;
  session.modifier(function () {
    var seg = doc.blocks.splice(us[k].i, us[k].n), at = d < 0 ? us[j].i : us[j].i + us[j].n - us[k].n;
    Array.prototype.splice.apply(doc.blocks, [at, 0].concat(seg)); revealBlock(b.id);
  });
  var el = $('.blk[data-id="' + b.id + '"]'); if (el) el.scrollIntoView({ block: 'nearest' });
}
// supprime un bloc (un groupe part avec tout son contenu) ; le curseur va au bloc précédent de la même liste, sinon au titre du groupe
function deleteBlock(b, focusPrev) {
  var o = position(b); if (!o) return;
  session.modifier(function () { o.liste.splice(o.i, 1); });
  var p = o.liste[Math.max(0, o.i - 1)];
  if (focusPrev && o.parent && o.i === 0) focusField(o.parent.id, 'title', true);
  else if (p && focusPrev) focusField(p.id, null, true);
}
// copie placée juste après l'original, identifiants neufs (pour chaque bloc d'un groupe aussi)
function dupBlock(b) {
  var o = position(b), c = copieBloc(b); if (!o) return;
  session.modifier(function () { o.liste.splice(o.i + 1, 0, c); revealBlock(c.id); });
}
function replaceBlock(b, type) {
  if (type === 'p') { focusField(b.id); return; }
  var o = position(b); if (!o) return;
  if (o.parent && HORS_GROUPE[type]) { focusField(b.id); return; }   // le menu d'un bloc d'un groupe ne le propose pas
  var nb = mk(type, {});
  session.modifier(function () { o.liste.splice(o.i, 1, nb); });
  if (type === 'image') pickImage(nb); else focusField(nb.id, type === 'group' ? 'title' : null, false);
}

// menu ⋯ d'un bloc : envelopper dans un groupe neuf (curseur dans son titre), sortir du groupe, dégrouper
function mettreEnGroupe(b) {
  var g = null; session.modifier(function () { g = mettreDansGroupe(doc.blocks, b.id); });
  if (g) focusField(g.id, 'title', false);
}
function sortirBloc(b) { session.modifier(function () { sortirDuGroupe(doc.blocks, b.id); }); focusField(b.id, null, false); }
function degrouperBloc(g) {
  var premier = g.blocks[0];
  session.modifier(function () { degrouper(doc.blocks, g.id); });
  if (premier) focusField(premier.id, null, false);
}
