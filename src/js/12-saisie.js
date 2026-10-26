/* ---------- Saisie ---------- */
app.addEventListener('input', function (e) {
  var el = e.target;
  if (el.matches('textarea.code-ta')) { var b = byId(el.dataset.b); if (b) { b.code = el.value; autosize(el); paintCode(el, b); markDirty(); } return; }
  if (el.matches('.mk-in[data-p=label]')) { var bm = byId(el.dataset.b); bm.markers[+el.dataset.mk].label = el.value; var mm = mapOf(bm.id); if (mm) mm.setMarkers(bm.markers); markDirty(); return; }
  if (el.matches('.map-q')) { mapSearch(el); return; }
  if (el.matches('.rt-in')) { var br = byId(el.dataset.b); br.routes[+el.dataset.rt].label = el.value; var mr = mapOf(br.id); if (mr) mr.setRoutes(br.routes); markDirty(); return; }
  if (el.matches('.rd-in')) return;
  if (el.matches('.st-in')) { var bs = byId(el.dataset.b), rr = bs.routes[+el.dataset.rt]; if (!rr.names) rr.names = rr.pts.map(function () { return ''; }); rr.names[+el.dataset.s] = el.value; var ms = mapOf(bs.id); if (ms) ms.setRoutes(bs.routes); markDirty(); return; }
  if (el.matches('.zn-in')) { var bz = byId(el.dataset.b); bz.zones[+el.dataset.zn].label = el.value; var mz = mapOf(bz.id); if (mz) mz.setZones(bz.zones); markDirty(); return; }
  if (!el.classList || !el.classList.contains('fld')) return;
  if (el.textContent === '' && !el.querySelector('img')) el.innerHTML = '';
  var bl = byId(el.dataset.b); if (!bl) return;
  setPath(bl, el.dataset.k, fieldValue(el));
  if (bl.type === 'header' && el.dataset.k === 'title' && pageHeader(doc.pages[doc.cur]) === bl) {
    // le nom de la page suit son titre en direct : onglet du navigateur, barre d'outils, onglets et sommaire
    var ct = curTitle(); document.title = ct;
    var dn = $('#ui .doc-name'); if (dn) dn.textContent = ct;
    $$('.pnav-tabs [data-pg="' + doc.cur + '"], .pnav-side [data-pg="' + doc.cur + '"]', app).forEach(function (x) { x.textContent = ct; });
  }
  if (bl.type === 'code' && el.dataset.k === 'name') { var tcode = $('.blk[data-id="' + bl.id + '"] textarea.code-ta', app); if (tcode) paintCode(tcode, bl); }
  if (bl.type === 'timeline' && bl.orient === 'h') { clearTimeout(bl._tlT); bl._tlT = setTimeout(function () { var hb = $('.blk[data-id="' + bl.id + '"] .tl-h', app); if (hb) { var tmp = document.createElement('div'); tmp.innerHTML = renderBlock(bl, false, null); var nh = tmp.querySelector('.tl-h'); if (nh) { hb.replaceWith(nh); tlFit($('.blk[data-id="' + bl.id + '"]', app)); } } }, 250); }
  if (bl.type === 'step' && el.dataset.k === 'num') { /* la numérotation automatique se met à jour au prochain rendu */ }
  markDirty();
});
app.addEventListener('change', function (e) {
  var el = e.target;
  if (el.matches('input[type=checkbox][data-k]')) {
    var b = byId(el.dataset.b); if (!b) return;
    setPath(b, el.dataset.k, el.checked); snapshot(); markDirty(true); return;
  }
  if (el.matches('.rt-color')) { var brc = byId(el.dataset.b); keepView(brc); change(function () { brc.routes[+el.dataset.rt].color = el.value; }); return; }
  if (el.matches('.rd-in')) {
    var bd = byId(el.dataset.b), zi = +el.dataset.zn, km = parseFloat(el.value.replace(',', '.'));
    if (!(km > 0)) { toast('Rayon non reconnu : indiquez un nombre de kilomètres'); el.value = String(+(bd.zones[zi].r / 1000).toFixed(2)).replace('.', ','); return; }
    keepView(bd); change(function () { bd.zones[zi].r = Math.round(km * 1000); }); return;
  }
  if (el.matches('.tl-seg-sel')) { var bt = byId(el.dataset.b), ti = +el.dataset.i; change(function () { if (el.value === 'solid') delete bt.items[ti].segs; else bt.items[ti].segs = el.value; }); return; }
  if (el.matches('.zn-color')) { var bzc = byId(el.dataset.b); keepView(bzc); change(function () { bzc.zones[+el.dataset.zn].color = el.value; }); return; }
  if (el.matches('.mk-color')) { var bc = byId(el.dataset.b); keepView(bc); change(function () { bc.markers[+el.dataset.mk].color = el.value; }); return; }
  if (el.matches('.mk-in[data-p=ll]')) {
    var bl2 = byId(el.dataset.b), i2 = +el.dataset.mk, cc = parseLL(el.value);
    if (!cc) { toast('Coordonnées non reconnues. Format : latitude, longitude (ex. 48.38, -4.47)'); el.value = bl2.markers[i2].lat + ', ' + bl2.markers[i2].lon; return; }
    keepView(bl2); change(function () { bl2.markers[i2].lat = cc.lat; bl2.markers[i2].lon = cc.lon; }); return;
  }
  if (el.matches('select[data-act=set]')) {
    var blk = byId(el.closest('.blk').dataset.id), prop = el.dataset.prop, v = el.value;
    keepView(blk); change(function () { blk[prop] = (prop === 'min' || prop === 'height') ? +v : v; }, { b: blk.id });
  }
});
app.addEventListener('scroll', function (e) { var t = e.target; if (t && t.matches && t.matches('textarea.code-ta')) { var pre = t.previousElementSibling; if (pre) { pre.scrollLeft = t.scrollLeft; pre.scrollTop = t.scrollTop; } } }, true);
app.addEventListener('focusout', function (e) {
  if (e.target.matches && e.target.matches('.map-q')) { var res = e.target.parentNode.querySelector('.map-res'); setTimeout(function () { res.hidden = true; }, 150); }
});
app.addEventListener('focusin', function (e) {
  var el = e.target;
  if (el.hasAttribute && el.hasAttribute('data-cell')) { var m = el.dataset.k.split('.'); lastCell = { b: el.dataset.b, r: +m[1], c: +m[2] }; }
});
var lastCell = null;

app.addEventListener('keydown', function (e) {
  var el = e.target;
  if (el.matches('textarea.code-ta')) {
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      var s = el.selectionStart, en = el.selectionEnd, v = el.value;
      if (e.shiftKey) {
        var ls = v.lastIndexOf('\n', s - 1) + 1;
        if (v.substr(ls, 2) === '  ') { el.setRangeText('', ls, ls + 2, 'end'); }
      } else el.setRangeText('  ', s, en, 'end');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return;
  }
  if (el.matches('.map-q')) {
    var res = el.parentNode.querySelector('.map-res'), n = (res._items || []).length;
    if (e.key === 'Enter') { e.preventDefault(); if (n) pickResult(el, res._cur || 0); }
    else if (e.key === 'Escape') { el.value = ''; res.hidden = true; }
    else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && n) {
      e.preventDefault(); res._cur = Math.max(0, Math.min(n - 1, (res._cur || 0) + (e.key === 'ArrowDown' ? 1 : -1)));
      $$('.mi', res).forEach(function (m, j) { m.classList.toggle('act', j === res._cur); });
    }
    return;
  }
  if (el.matches('.mk-in')) { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } return; }
  if (!el.classList || !el.classList.contains('fld')) return;
  var b = byId(el.dataset.b), k = el.dataset.k;
  if (!b) return;
  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); moveBlock(b, e.key === 'ArrowUp' ? -1 : 1); focusField(b.id, k); return; }
  if (e.key === 'Enter') {
    if (e.isComposing) return;
    var rich = el.hasAttribute('data-rich');
    if (e.shiftKey || el.hasAttribute('data-ml')) { e.preventDefault(); if (rich) document.execCommand('insertLineBreak'); return; }
    e.preventDefault();
    if (el.hasAttribute('data-li')) { splitItem(b, k, el); return; }
    if (el.hasAttribute('data-cell')) { var m = k.split('.'); var below = $('[data-b="' + b.id + '"][data-k="rows.' + (+m[1] + 1) + '.' + m[2] + '"]', app); if (below) { below.focus(); caretTo(below, true); } return; }
    if (b.type === 'p') {
      var tail = extractTail(el); b.html = sanitize(el.innerHTML);
      insertAt(idx(b) + 1, 'p', { html: tail }); return;
    }
    if (el.hasAttribute('data-nl') && ['header', 'h2', 'h3', 'step'].indexOf(b.type) >= 0) {
      if (b.type === 'header' && k !== 'lede') { nextField(el, 1); return; }
      insertAt(idx(b) + 1, 'p', {}); return;
    }
    nextField(el, 1); return;
  }
  if (e.key === 'Backspace' && caretAtStart(el)) {
    if (el.hasAttribute('data-li')) {
      var lp = listParts(k), arr = getPath(b, lp.base);
      if (arr.length > 1 && el.textContent === '') { e.preventDefault(); change(function () { arr.splice(lp.i, 1); }, { b: b.id, k: lp.base + '.' + Math.max(0, lp.i - 1) + lp.suf, end: true }); return; }
      if (lp.i > 0) {
        e.preventDefault(); var cur = sanitize(el.innerHTML), prevKey = lp.base + '.' + (lp.i - 1) + lp.suf, prev = getPath(b, prevKey);
        change(function () { setPath(b, prevKey, prev + cur); arr.splice(lp.i, 1); }, { b: b.id, k: prevKey, end: true }); return;
      }
    }
    if (b.type === 'p') {
      var i = idx(b), pb = doc.blocks[i - 1];
      if (el.textContent === '' && doc.blocks.length > 1) { e.preventDefault(); deleteBlock(b, true); return; }
      if (pb && ['p', 'h2', 'h3'].indexOf(pb.type) >= 0) {
        e.preventDefault(); var html = sanitize(el.innerHTML);
        change(function () { pb.html = pb.html + html; doc.blocks.splice(i, 1); }, { b: pb.id, end: true }); return;
      }
    }
  }
  if (e.key === '/' && b.type === 'p' && el.textContent === '') {
    e.preventDefault(); openBlockMenu(el, function (t) { replaceBlock(b, t); }, function () { focusField(b.id); });
    return;
  }
  if (e.key === 'Tab' && el.hasAttribute('data-cell')) { e.preventDefault(); nextField(el, e.shiftKey ? -1 : 1); return; }
  if (e.key === 'ArrowUp' && caretAtStart(el) && !e.shiftKey) { e.preventDefault(); nextField(el, -1); return; }
  if (e.key === 'ArrowDown' && caretAtEnd(el) && !e.shiftKey) { e.preventDefault(); nextField(el, 1); return; }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && el.hasAttribute('data-rich')) {
    var kk = e.key.toLowerCase();
    if (kk === 'k') { e.preventDefault(); inlineAction('link'); }
    else if (kk === 'u') { e.preventDefault(); document.execCommand('underline'); }
    else if (e.key === '`' || kk === 'j') { e.preventDefault(); inlineAction('code'); }
  }
});
function listParts(k) { var m = k.match(/^(.*)\.(\d+)(\.html)?$/); return { base: m[1], i: +m[2], suf: m[3] || '' }; }
function splitItem(b, k, el) {
  var lp = listParts(k), arr = getPath(b, lp.base);
  if (el.textContent === '' && lp.i === arr.length - 1 && arr.length > 1 && b.type !== 'cards') {
    // Entrée sur un élément vide en fin de liste : sortir de la liste
    change(function () { arr.pop(); }); insertAt(idx(b) + 1, 'p', {}); return;
  }
  var tail = extractTail(el); var head = sanitize(el.innerHTML);
  change(function () {
    if (lp.suf) { arr[lp.i].html = head; arr.splice(lp.i + 1, 0, { html: tail, done: false }); }
    else { arr[lp.i] = head; arr.splice(lp.i + 1, 0, tail); }
  }, { b: b.id, k: lp.base + '.' + (lp.i + 1) + lp.suf, end: false });
}

app.addEventListener('paste', function (e) {
  var el = e.target;
  if (mode !== 'edit') return;
  var cd = e.clipboardData; if (!cd) return;
  var files = Array.prototype.filter.call(cd.files || [], function (f) { return /^image\//.test(f.type); });
  if (files.length && !el.matches('textarea')) {
    e.preventDefault();
    var host = el.closest && el.closest('.blk'); var b = host ? byId(host.dataset.id) : null;
    readImage(files[0], function (src) {
      if (b && b.type === 'image') change(function () { b.src = src; });
      else insertAfter(b, 'image', { src: src });
    });
    return;
  }
  if (!el.classList || !el.classList.contains('fld')) return;
  e.preventDefault();
  var html = cd.getData('text/html'), text = cd.getData('text/plain');
  if (el.hasAttribute('data-rich') && html) {
    var clean = sanitize(html.replace(/<!--[\s\S]*?-->/g, '').replace(/^[\s\S]*<body[^>]*>|<\/body>[\s\S]*$/gi, ''));
    if (!el.hasAttribute('data-ml') && !el.hasAttribute('data-li') && b0type(el) !== 'p') clean = clean.replace(/<br>/g, ' ');
    document.execCommand('insertHTML', false, clean);
  } else {
    if (!el.hasAttribute('data-rich') || (!el.hasAttribute('data-ml') && b0type(el) !== 'p')) text = text.replace(/\s*\n\s*/g, ' ');
    document.execCommand('insertText', false, text);
  }
});
function b0type(el) { var b = byId(el.dataset.b); return b ? b.type : ''; }

