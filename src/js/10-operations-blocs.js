/* ---------- Opérations sur les blocs ---------- */
function insertAt(i, type, props, focusIt) {
  var nb = mk(type, props || {});
  change(function () { doc.blocks.splice(i, 0, nb); });
  if (focusIt !== false) focusField(nb.id, null, false);
  return nb;
}
function insertAfter(b, type, props) { return insertAt(b ? idx(b) + 1 : doc.blocks.length, type, props); }
function moveBlock(b, d) {
  var i = idx(b), j = i + d; if (j < 0 || j >= doc.blocks.length) return;
  change(function () { doc.blocks.splice(i, 1); doc.blocks.splice(j, 0, b); });
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
  change(function () { doc.blocks.splice(idx(b) + 1, 0, c); });
}
function replaceBlock(b, type) {
  if (type === 'p') { focusField(b.id); return; }
  var nb = mk(type, {});
  change(function () { doc.blocks.splice(idx(b), 1, nb); });
  if (type === 'image') pickImage(nb); else focusField(nb.id, null, false);
}

