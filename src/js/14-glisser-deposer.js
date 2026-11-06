/* ---------- Glisser-déposer des blocs ---------- */
var dragId = null, dropLine = null, dropTarget = null;
app.addEventListener('mousedown', function (e) {
  var r = e.target.closest('.map-res [data-r]');
  if (r && r.closest('.ch-search')) { e.preventDefault(); chPick(r.closest('.ch-search').querySelector('.ch-q'), +r.dataset.r); return; }
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
      if (imgHost) { var ib = byId(imgHost.dataset.b); session.modifier(function () { ib.src = src; }); return; }
      var at = t ? idx(byId(t.id)) + (t.before ? 0 : 1) : doc.blocks.length;
      insertAt(at, 'image', { src: src }, false);
    });
    endDrag(); return;
  }
  if (!dragId || !t) { endDrag(); return; }
  e.preventDefault();
  var b = byId(dragId), target = byId(t.id);
  if (b && target && b !== target) session.modifier(function () {
    // un titre plié emmène les blocs de sa section ; déposé après un titre plié, on passe après sa section
    var us = blockUnits(), ub = null, ut = null;
    us.forEach(function (u) { if (u.id === b.id) ub = u; if (u.id === target.id) ut = u; });
    var seg = doc.blocks.splice(idx(b), ub ? ub.n : 1);
    Array.prototype.splice.apply(doc.blocks, [idx(target) + (t.before ? 0 : (ut ? ut.n : 1)), 0].concat(seg));
    revealBlock(b.id);
  });
  endDrag();
});
app.addEventListener('dragend', endDrag);
document.addEventListener('mouseup', function () { if (!dragId) $$('.blk[draggable=true]', app).forEach(function (b) { b.removeAttribute('draggable'); }); });


/* ---------- Glisser-déposer des lignes et colonnes de tableau ---------- */
// poignées au survol d'une cellule : en haut de la colonne (dans l'en-tête), à gauche de la ligne (hors ligne d'en-tête)
function tgMake(kind) {
  var g = document.createElement('button'); g.type = 'button'; g.tabIndex = -1; g.className = 'tgrip tgrip-' + kind; g.style.display = 'none';
  g.title = kind === 'row' ? 'Glisser pour déplacer la ligne' : 'Glisser pour déplacer la colonne';
  g.textContent = kind === 'row' ? '⋮' : '⋯'; ui.appendChild(g);
  g.addEventListener('pointerdown', function (e) { tgStart(kind, e); });
  g.addEventListener('pointermove', tgMove);
  g.addEventListener('pointerup', function () { tgEnd(true); });
  g.addEventListener('pointercancel', function () { tgEnd(false); });
  return g;
}
var tgRow = null, tgCol = null, tgHover = null, tgDrag = null, tgLine = null;   // poignées créées au premier survol (après l'interface)
function tgHide() { if (tgDrag || !tgRow) return; tgRow.style.display = tgCol.style.display = 'none'; tgHover = null; }
function tgTable(bid) { return $('.blk[data-id="' + bid + '"] .tablewrap table', app); }
document.addEventListener('mousemove', function (e) {
  if (tgDrag) return;
  var t = e.target; if (!t || !t.closest || t.closest('.tgrip')) return;
  var c = mode === 'edit' ? t.closest('.blk[data-type=table] [data-cell]') : null;
  if (!c || !app.contains(c)) { tgHide(); return; }
  if (!tgRow) { tgRow = tgMake('row'); tgCol = tgMake('col'); }
  var m = c.dataset.k.split('.'), r = +m[1], col = +m[2], bid = c.dataset.b;
  if (tgHover && tgHover.b === bid && tgHover.r === r && tgHover.c === col) return;
  tgHover = { b: bid, r: r, c: col };
  var tb = tgTable(bid), wrap = tb.parentNode.getBoundingClientRect(), head = $('[data-b="' + bid + '"][data-k="rows.0.' + col + '"]', app).getBoundingClientRect(), cr = c.getBoundingClientRect();
  tgCol.style.display = head.left + head.width / 2 > wrap.left && head.left + head.width / 2 < wrap.right ? 'block' : 'none';
  tgCol.style.left = (head.left + head.width / 2 - 13) + 'px'; tgCol.style.top = (head.top + 1) + 'px';
  if (r > 0) { tgRow.style.display = 'block'; tgRow.style.left = (wrap.left + 2) + 'px'; tgRow.style.top = (cr.top + Math.min(cr.height, 40) / 2 - 11) + 'px'; }
  else tgRow.style.display = 'none';
}, { passive: true });
window.addEventListener('scroll', tgHide, true);
function tgMarks(on) {
  if (!tgDrag) return;
  var tb = tgTable(tgDrag.b.id); if (!tb) return;
  $$('tr', tb).forEach(function (tr, i) {
    $$('th,td', tr).forEach(function (cell, j) { cell.classList.toggle('tdrag', on && (tgDrag.kind === 'row' ? i === tgDrag.from : j === tgDrag.from)); });
  });
}
function tgStart(kind, e) {
  if (!tgHover || e.button > 0) return;
  var b = byId(tgHover.b); if (!b) return;
  e.preventDefault();
  tgDrag = { kind: kind, b: b, from: kind === 'row' ? tgHover.r : tgHover.c, to: null, grip: e.currentTarget };
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  document.documentElement.classList.add('tg-dragging'); tgMarks(true);
}
function tgMove(e) {
  if (!tgDrag) return;
  var tb = tgTable(tgDrag.b.id); if (!tb) return;
  var trs = $$('tr', tb), tr = tb.getBoundingClientRect(), wr = tb.parentNode.getBoundingClientRect(), to, x, y;
  if (!tgLine) { tgLine = document.createElement('div'); tgLine.className = 'drop-line'; ui.appendChild(tgLine); }
  if (tgDrag.kind === 'row') {
    to = trs.length;
    for (var i = 1; i < trs.length; i++) { var rr = trs[i].getBoundingClientRect(); if (e.clientY < rr.top + rr.height / 2) { to = i; break; } }
    y = to < trs.length ? trs[to].getBoundingClientRect().top : trs[trs.length - 1].getBoundingClientRect().bottom;
    tgLine.style.left = wr.left + 'px'; tgLine.style.width = wr.width + 'px'; tgLine.style.height = '3px'; tgLine.style.top = (y - 1.5) + 'px';
  } else {
    var hs = $$('th,td', trs[0]); to = hs.length;
    for (var j = 0; j < hs.length; j++) { var hr = hs[j].getBoundingClientRect(); if (e.clientX < hr.left + hr.width / 2) { to = j; break; } }
    x = to < hs.length ? hs[to].getBoundingClientRect().left : hs[hs.length - 1].getBoundingClientRect().right;
    x = Math.max(wr.left, Math.min(wr.right, x));
    tgLine.style.top = Math.max(wr.top, tr.top) + 'px'; tgLine.style.height = Math.min(wr.height, tr.height) + 'px'; tgLine.style.width = '3px'; tgLine.style.left = (x - 1.5) + 'px';
  }
  var same = to === tgDrag.from || to === tgDrag.from + 1;
  tgDrag.to = same ? null : to; tgLine.style.display = same ? 'none' : 'block';
}
function tgEnd(apply) {
  if (!tgDrag) return;
  var d = tgDrag; tgMarks(false); tgDrag = null; tgHover = null;
  document.documentElement.classList.remove('tg-dragging');
  if (tgLine) tgLine.style.display = 'none'; tgRow.style.display = tgCol.style.display = 'none';
  if (!apply || d.to == null) return;
  var rows = d.b.rows, at = d.to > d.from ? d.to - 1 : d.to;
  session.modifier(function () {
    if (d.kind === 'row') rows.splice(at, 0, rows.splice(d.from, 1)[0]);
    else rows.forEach(function (r) { r.splice(at, 0, r.splice(d.from, 1)[0]); });
  });
  lastCell = d.kind === 'row' ? { b: d.b.id, r: at, c: 0 } : { b: d.b.id, r: 1, c: at };
}
document.addEventListener('keydown', function (e) { if (tgDrag && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); tgEnd(false); } }, true);

/* ---------- Glisser-déposer des cartes de kanban (édition : par la poignée ; lecture : la carte entière) ---------- */
var kbDrag = null, kbDrop = null, kbLine = null;
app.addEventListener('mousedown', function (e) { var g = e.target.closest && e.target.closest('.kb-grip'); if (g) g.closest('.kb-card').setAttribute('draggable', 'true'); });
app.addEventListener('dragstart', function (e) {
  var c = e.target.closest && e.target.closest('.kb-card[draggable=true]'); if (!c) return;
  kbDrag = { b: c.closest('[data-kb]').dataset.kb, ci: +c.dataset.ci, ki: +c.dataset.ki }; kbDrop = null; c.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', c.textContent.trim().slice(0, 80)); } catch (_) {}
});
app.addEventListener('dragover', function (e) {
  if (!kbDrag) return;
  var col = e.target.closest && e.target.closest('[data-kb="' + kbDrag.b + '"] .kb-col');
  if (!kbLine) { kbLine = document.createElement('div'); kbLine.className = 'drop-line'; ui.appendChild(kbLine); }
  if (!col) { kbLine.style.display = 'none'; kbDrop = null; return; }
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  var cards = $$('.kb-card', col), k = cards.length, list = $('.kb-list', col);
  for (var i = 0; i < cards.length; i++) { var r = cards[i].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { k = i; break; } }
  kbDrop = { tc: +col.dataset.ci, tk: k };
  var lr = list.getBoundingClientRect(), y = k < cards.length ? cards[k].getBoundingClientRect().top - 5 : (cards.length ? cards[cards.length - 1].getBoundingClientRect().bottom + 3 : lr.top + 4);
  kbLine.style.left = (lr.left + 4) + 'px'; kbLine.style.width = (lr.width - 8) + 'px'; kbLine.style.height = '3px'; kbLine.style.top = y + 'px'; kbLine.style.display = 'block';
});
app.addEventListener('drop', function (e) {
  if (!kbDrag) return;
  e.preventDefault(); var d = kbDrag, t = kbDrop; kbEnd();
  var b = byId(d.b); if (b && t) kbMove(b, d.ci, d.ki, t.tc, t.tk);
});
function kbEnd() {
  if (kbLine) kbLine.style.display = 'none';
  $$('.kb-card.dragging', app).forEach(function (c) { c.classList.remove('dragging'); });
  $$('.kb-edit .kb-card[draggable]', app).forEach(function (c) { c.removeAttribute('draggable'); });
  kbDrag = null; kbDrop = null;
}
app.addEventListener('dragend', function () { if (kbDrag) kbEnd(); });
