/* ---------- Glisser-déposer des blocs ---------- */
var dragId = null, dropLine = null, dropTarget = null;
app.addEventListener('mousedown', function (e) {
  var r = e.target.closest('.map-res [data-r]');
  if (r) { e.preventDefault(); pickResult(r.closest('.map-search').querySelector('.map-q'), +r.dataset.r); return; }
  var h = e.target.closest('.g-drag'); if (!h) return;
  var blk = h.closest('.blk'); blk.setAttribute('draggable', 'true');
});
app.addEventListener('dragstart', function (e) {
  var blk = e.target.closest && e.target.closest('.blk[draggable=true]'); if (!blk) return;
  dragId = blk.dataset.id; blk.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'bloc'); } catch (_) {}
});
app.addEventListener('dragover', function (e) {
  if (mode !== 'edit') return;
  var hasFile = e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0;
  if (!dragId && !hasFile) return;
  e.preventDefault();
  var blks = $$('.blk', app), best = null, before = true;
  for (var i = 0; i < blks.length; i++) {
    var r = blks[i].getBoundingClientRect();
    if (e.clientY < r.top + r.height / 2) { best = blks[i]; before = true; break; }
    best = blks[i]; before = false;
  }
  dropTarget = best ? { id: best.dataset.id, before: before } : null;
  if (!dropLine) { dropLine = document.createElement('div'); dropLine.className = 'drop-line'; ui.appendChild(dropLine); }
  if (best) { var rr = best.getBoundingClientRect(); dropLine.style.left = rr.left + 'px'; dropLine.style.width = rr.width + 'px'; dropLine.style.top = ((before ? rr.top - 14 : rr.bottom + 12)) + 'px'; dropLine.style.display = 'block'; }
});
function endDrag() {
  if (dropLine) dropLine.style.display = 'none';
  $$('.blk[draggable=true]', app).forEach(function (b) { b.removeAttribute('draggable'); b.classList.remove('dragging'); });
  dragId = null;
}
app.addEventListener('drop', function (e) {
  if (mode !== 'edit') return;
  var files = Array.prototype.filter.call((e.dataTransfer && e.dataTransfer.files) || [], function (f) { return /^image\//.test(f.type); });
  var t = dropTarget;
  if (files.length) {
    e.preventDefault();
    var imgHost = e.target.closest && e.target.closest('.img-drop');
    readImage(files[0], function (src) {
      if (imgHost) { var ib = byId(imgHost.dataset.b); change(function () { ib.src = src; }); return; }
      var at = t ? idx(byId(t.id)) + (t.before ? 0 : 1) : doc.blocks.length;
      insertAt(at, 'image', { src: src }, false);
    });
    endDrag(); return;
  }
  if (!dragId || !t) { endDrag(); return; }
  e.preventDefault();
  var b = byId(dragId), target = byId(t.id);
  if (b && target && b !== target) change(function () {
    doc.blocks.splice(idx(b), 1);
    doc.blocks.splice(idx(target) + (t.before ? 0 : 1), 0, b);
  });
  endDrag();
});
app.addEventListener('dragend', endDrag);
document.addEventListener('mouseup', function () { if (!dragId) $$('.blk[draggable=true]', app).forEach(function (b) { b.removeAttribute('draggable'); }); });

