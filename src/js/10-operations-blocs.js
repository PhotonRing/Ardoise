/* ---------- Opérations sur les blocs ---------- */
function insertAt(i, type, props, focusIt) {
  var nb = mk(type, props || {});
  change(function () { doc.blocks.splice(i, 0, nb); revealBlock(nb.id); });
  if (focusIt !== false) focusField(nb.id, null, false);
  return nb;
}
function insertAfter(b, type, props) { return insertAt(b ? idx(b) + 1 : doc.blocks.length, type, props); }
function blockUnits() {
  // blocs visibles en édition, chacun avec les blocs que sa section pliée masque
  var fi = foldInfo(doc.blocks), out = [];
  doc.blocks.forEach(function (x, i) { if (fi.hidden[x.id] && out.length) out[out.length - 1].n++; else out.push({ i: i, n: 1, id: x.id }); });
  return out;
}
function moveBlock(b, d) {
  var us = blockUnits(), k = -1;
  for (var q = 0; q < us.length; q++) if (us[q].id === b.id) k = q;
  var j = k + d; if (k < 0 || j < 0 || j >= us.length) return;
  change(function () {
    var seg = doc.blocks.splice(us[k].i, us[k].n), at = d < 0 ? us[j].i : us[j].i + us[j].n - us[k].n;
    Array.prototype.splice.apply(doc.blocks, [at, 0].concat(seg)); revealBlock(b.id);
  });
  var el = $('.blk[data-id="' + b.id + '"]'); if (el) el.scrollIntoView({ block: 'nearest' });
}
function deleteBlock(b, focusPrev) {
  var i = idx(b);
  change(function () { doc.blocks.splice(i, 1); });
  var p = doc.blocks[Math.max(0, i - 1)];
  if (p && focusPrev) focusField(p.id, null, true);
}
function dupBlock(b) {
  var c = JSON.parse(JSON.stringify(b)); c.id = uid();
  change(function () { doc.blocks.splice(idx(b) + 1, 0, c); revealBlock(c.id); });
}
function replaceBlock(b, type) {
  if (type === 'p') { focusField(b.id); return; }
  var nb = mk(type, {});
  change(function () { doc.blocks.splice(idx(b), 1, nb); });
  if (type === 'image') pickImage(nb); else focusField(nb.id, null, false);
}

