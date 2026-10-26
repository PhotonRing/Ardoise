/* ---------- Clics sur les actions des blocs ---------- */
app.addEventListener('click', function (e) {
  var cp = e.target.closest('[data-copy]');
  if (cp && mode === 'view') { copyCode(cp); return; }
  var a = e.target.closest('[data-act]'); if (!a || mode !== 'edit') return;
  var blkEl = a.closest('.blk'), b = blkEl ? byId(blkEl.dataset.id) : null, i = +a.dataset.i;
  switch (a.dataset.act) {
    case 'add-after': openBlockMenu(a, function (t) { var nb = insertAfter(b, t); if (t === 'image') pickImage(nb); }); break;
    case 'add-end': openBlockMenu(a, function (t) { var nb = insertAt(doc.blocks.length, t); if (t === 'image') pickImage(nb); }); break;
    case 'up': moveBlock(b, -1); break;
    case 'down': moveBlock(b, 1); break;
    case 'dup': dupBlock(b); break;
    case 'del': deleteBlock(b, false); break;
    case 'toggle': keepView(b); change(function () { var pr = a.dataset.prop; b[pr] = pr === 'cities' ? b[pr] === false : !b[pr]; }); break;
    case 'tl-add': change(function () { b.items.push({ date: '', title: '', text: '', color: 'accent' }); }, { b: b.id, k: 'items.' + b.items.length + '.date' }); break;
    case 'tl-ins': change(function () { b.items.splice(i + 1, 0, { date: '', title: '', text: '', color: (b.items[i] || {}).color || 'accent' }); }, { b: b.id, k: 'items.' + (i + 1) + '.date' }); break;
    case 'tl-del': change(function () { b.items.splice(i, 1); }); break;
    case 'tl-up': if (i > 0) change(function () { var t = b.items[i]; b.items[i] = b.items[i - 1]; b.items[i - 1] = t; }); break;
    case 'tl-down': if (i < b.items.length - 1) change(function () { var t = b.items[i]; b.items[i] = b.items[i + 1]; b.items[i + 1] = t; }); break;
    case 'tl-color': var TLC = ['accent', 'info', 'ok', 'warn', 'bad']; change(function () { var it = b.items[i]; it.color = TLC[(TLC.indexOf(it.color || 'accent') + 1) % TLC.length]; }); break;
    case 'fact-add': change(function () { b.items.push({ k: 'Clé', v: '', alert: false }); }, { b: b.id, k: 'items.' + b.items.length + '.v' }); break;
    case 'fact-del': change(function () { b.items.splice(i, 1); }); break;
    case 'fact-alert': change(function () { b.items[i].alert = !b.items[i].alert; }); break;
    case 'card-add': change(function () { b.cards.push({ title: '', text: '', checks: [] }); }, { b: b.id, k: 'cards.' + b.cards.length + '.title' }); break;
    case 'card-del': change(function () { b.cards.splice(i, 1); }); break;
    case 'item-add':
      var base = a.dataset.k, arr = getPath(b, base);
      change(function () { arr.push({ html: '', done: false }); }, { b: b.id, k: base + '.' + arr.length + '.html' }); break;
    case 'check-reset': change(function () { b.items.forEach(function (it) { it.done = false; }); }); break;
    case 'row-add': tableOp(b, 'row-add'); break;
    case 'col-add': tableOp(b, 'col-add'); break;
    case 'row-del': tableOp(b, 'row-del'); break;
    case 'col-del': tableOp(b, 'col-del'); break;
    case 'img-pick': pickImage(b); break;
    case 'map-addmode': var ma = mapOf(b.id), on = a.getAttribute('aria-pressed') !== 'true'; a.setAttribute('aria-pressed', on ? 'true' : 'false'); mapUi.add = on ? b.id : null; mapUi.draw = null; cheatBlock = b.id; setTimeout(updateCheat); $$('.blk[data-id="' + b.id + '"] [data-act=map-draw]', app).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); if (ma) { ma.setDrawMode(null); ma.setAddMode(on); } break;
    case 'mk-del': keepView(b); change(function () { b.markers.splice(i, 1); }); break;
    case 'map-draw':
      var md = mapOf(b.id), kind = a.dataset.kind, dOn = a.getAttribute('aria-pressed') !== 'true';
      mapUi.draw = dOn ? b.id : null; mapUi.kind = dOn ? kind : null; mapUi.add = null; cheatBlock = b.id; setTimeout(updateCheat);
      $$('.blk[data-id="' + b.id + '"] [data-act=map-draw]', app).forEach(function (x) { x.setAttribute('aria-pressed', String(dOn && x.dataset.kind === kind)); });
      var am = $('.blk[data-id="' + b.id + '"] [data-act=map-addmode]', app); if (am) am.setAttribute('aria-pressed', 'false');
      if (md) { md.setAddMode(false); md.setDrawMode(dOn ? kind : null); }
      break;
    case 'shape-edit':
      var sk = a.dataset.kind, on2 = !(mapUi.editOf === b.id && mapUi.edit && mapUi.edit.kind === sk && mapUi.edit.i === i);
      mapUi.editOf = on2 ? b.id : null; mapUi.edit = on2 ? { kind: sk, i: i } : null; mapUi.add = null; mapUi.draw = null; cheatBlock = b.id; setTimeout(updateCheat);
      $$('.blk[data-id="' + b.id + '"] [data-act=shape-edit]', app).forEach(function (x) { x.setAttribute('aria-pressed', String(on2 && x.dataset.kind === sk && +x.dataset.i === i)); });
      var mze = mapOf(b.id);
      if (mze) mze.setEdit(on2 ? sk : null, i);
      $$('.mk-panel[data-b="' + b.id + '"] .mk-item', app).forEach(function (it) { it.classList.remove('on'); }); if (on2) { var bt2 = a.closest('.mk-item'); if (bt2) bt2.classList.add('on'); }
      if (sk === 'route') { keepView(b); render(); }
      if (on2) {
        var circ = sk === 'zone' && b.zones[i] && b.zones[i].shape === 'circle';
        if (sk === 'marker') toast('Glissez le point pour le déplacer, son étiquette pour la déplacer ; double-clic sur l’étiquette pour la remettre ; Échap pour terminer.', 5000); else
        toast(circ ? 'Glissez le carré pour déplacer le cercle, le rond pour changer le rayon (Alt : sans aimantation)' : 'Glissez les carrés pour déplacer, les ronds pour ajouter ; double-clic sur un carré pour supprimer ; Alt : sans aimantation. Les autres éléments sont figés ; Échap pour terminer.', 5500);
      }
      break;
    case 'route-dist': keepView(b); change(function () { b.routes[i].hideDist = !b.routes[i].hideDist; }); break;
    case 'panel-min':
      panelMin = !panelMin; try { localStorage.setItem(LS + 'panelmin', panelMin ? '1' : '0'); } catch (_) {}
      $$('.mk-panel', app).forEach(function (pn) { pn.classList.toggle('min', panelMin); var bt = pn.querySelector('[data-act=panel-min]'); if (bt) bt.textContent = panelMin ? '▸' : '–'; });
      break;
    case 'route-del': keepView(b); if (mapUi.editOf === b.id) { mapUi.editOf = null; mapUi.edit = null; } change(function () { b.routes.splice(i, 1); }); break;
    case 'zone-del': keepView(b); if (mapUi.editOf === b.id) { mapUi.editOf = null; mapUi.edit = null; } change(function () { b.zones.splice(i, 1); }); break;
    case 'img-alt': var v = prompt('Texte alternatif de l’image :', b.alt || ''); if (v !== null) change(function () { b.alt = v; }); break;
  }
});
function tableOp(b, op) {
  var rows = b.rows, cols = rows[0].length;
  var cur = lastCell && lastCell.b === b.id ? lastCell : { r: rows.length - 1, c: cols - 1 };
  change(function () {
    if (op === 'row-add') rows.splice(cur.r + 1, 0, rows[0].map(function () { return ''; }));
    if (op === 'col-add') rows.forEach(function (r, j) { r.splice(cur.c + 1, 0, j === 0 ? 'Colonne' : ''); });
    if (op === 'row-del' && rows.length > 2 && cur.r > 0) rows.splice(cur.r, 1);
    if (op === 'col-del' && cols > 1) rows.forEach(function (r) { r.splice(cur.c, 1); });
  });
  lastCell = null;
}
function copyCode(btn) {
  var box = btn.closest('.code, .codebox'), pre = box && box.querySelector('pre'); if (!pre) return;
  var t = pre.classList.contains('src') ? $$('span.l', pre).map(function (l) { return l.textContent; }).join('\n') : pre.textContent;
  var old = btn.textContent;
  function done(m) { btn.textContent = m; setTimeout(function () { btn.textContent = old; }, 1600); }
  function sel() { var r = document.createRange(); r.selectNodeContents(pre); var s = getSelection(); s.removeAllRanges(); s.addRange(r); done('Sélectionné : Ctrl+C'); }
  try { navigator.clipboard.writeText(t).then(function () { done('Copié ✓'); }, sel); } catch (_) { sel(); }
}

