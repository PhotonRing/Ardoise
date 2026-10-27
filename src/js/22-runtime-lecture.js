function tlFit(root) {
  // marge au-dessus de la frise = hauteur réelle du titre incliné le plus long ; marges latérales = débord du dernier titre
  Array.prototype.forEach.call((root || document).querySelectorAll('.tl-h-in'), function (g) {
    var items = g.children; if (!items.length) return;
    var mx = 0, last = 0, lh = 17;
    Array.prototype.forEach.call(g.querySelectorAll('.tl-h-title'), function (t, i, all) {
      var w = Math.min(t.scrollWidth, 200); lh = t.offsetHeight || lh;
      if (w > mx) mx = w; if (i === all.length - 1) last = w;
    });
    var cw = items[0].getBoundingClientRect().width || 92;
    g.style.setProperty('--cw', cw + 'px');
    g.style.paddingTop = Math.ceil((mx + lh) * 0.7071 + 12) + 'px';
    var side = Math.max(12, Math.ceil(last * 0.7071 + 18 - cw / 2));
    g.style.paddingLeft = g.style.paddingRight = side + 'px';
  });
  Array.prototype.forEach.call((root || document).querySelectorAll('.tl-v-slab .tl-seg-txt'), function (lb) {
    var row = lb.closest('.tl-v-seg'), a = row && row.previousElementSibling, b2 = row && row.nextElementSibling;
    var da = a && a.querySelector('.tl-dot'), db = b2 && b2.querySelector('.tl-dot'); if (!da || !db) return;
    lb.style.transform = '';
    var ra = da.getBoundingClientRect(), rb = db.getBoundingClientRect(), r = lb.getBoundingClientRect();
    if (r.left > ra.right) return;   // écran étroit : le libellé reste sur sa ligne, à droite du rail
    var mid = (ra.top + ra.height / 2 + rb.top + rb.height / 2) / 2;
    lb.style.transform = 'translateY(' + (mid - (r.top + r.height / 2)).toFixed(1) + 'px)';
  });
}
function tlTips() {
  var refit = function () { tlFit(document); };
  window.addEventListener('resize', refit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
  if (document.readyState !== 'loading') refit(); else document.addEventListener('DOMContentLoaded', refit);
  // bulle façon BD sous la pastille d'une chronologie horizontale : immédiate, au survol, au clavier ou au toucher
  var tip = null, cur = null;
  function hide() { if (tip) { tip.remove(); tip = null; } cur = null; }
  function show(it) {
    if (cur === it) return;
    hide();
    if (document.documentElement.classList.contains('is-edit') || !it.closest('.tl-tips')) return;
    cur = it;
    var dot = it.querySelector('.tl-dot'), date = it.querySelector('.tl-h-date'), src = it.querySelector('.tl-h-tip');
    if (!dot || !src) return;
    tip = document.createElement('div'); tip.className = 'tl-bubble'; tip.setAttribute('role', 'tooltip');
    tip.innerHTML = src.innerHTML;
    tip.style.setProperty('--bc', getComputedStyle(dot).backgroundColor);
    document.body.appendChild(tip);
    var d = dot.getBoundingClientRect(), r = date && date.textContent ? date.getBoundingClientRect() : d, w = tip.offsetWidth, h = tip.offsetHeight;
    var cx = d.left + d.width / 2, left = Math.max(8, Math.min(innerWidth - w - 8, cx - w / 2)), top = r.bottom + 12;
    if (top + h > innerHeight - 8 && d.top - h - 14 > 8) { top = d.top - h - 14; tip.classList.add('up'); }
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
    tip.style.setProperty('--ax', Math.max(18, Math.min(w - 18, cx - left)) + 'px');
    requestAnimationFrame(function () { if (tip) tip.classList.add('on'); });
  }
  document.addEventListener('pointerover', function (e) {
    var it = e.target && e.target.closest ? e.target.closest('.tl-h-item') : null;
    if (it) show(it); else if (cur && document.activeElement !== cur) hide();
  });
  document.addEventListener('focusin', function (e) { var it = e.target && e.target.closest ? e.target.closest('.tl-h-item') : null; if (it) show(it); });
  document.addEventListener('focusout', function (e) { if (cur && e.target === cur) hide(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
  window.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
}
function viewScript() {
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]'); if (!b) return;
    var box = b.closest('.code,.codebox'), pre = box.querySelector('pre');
    var t = pre.classList.contains('src') ? Array.prototype.map.call(pre.children, function (l) { return l.textContent; }).join('\n') : pre.textContent;
    var old = b.textContent;
    function done(m) { b.textContent = m; setTimeout(function () { b.textContent = old; }, 1600); }
    function sel() { var r = document.createRange(); r.selectNodeContents(pre); var s = getSelection(); s.removeAllRanges(); s.addRange(r); done('Sélectionné : Ctrl+C'); }
    try { navigator.clipboard.writeText(t).then(function () { done('Copié ✓'); }, sel); } catch (_) { sel(); }
  });
  var K = 'bp:' + (document.documentElement.getAttribute('data-docid') || document.title) + ':';
  Array.prototype.forEach.call(document.querySelectorAll('ul.check input'), function (c) {
    try { var v = localStorage.getItem(K + c.id); if (v !== null) c.checked = v === '1'; } catch (_) {}
    c.addEventListener('change', function () { try { localStorage.setItem(K + c.id, c.checked ? '1' : '0'); } catch (_) {} });
  });
}
function exportPages() {
  // export statique : bascule entre les pages (adresse #p2, #p3…), sommaire et onglets
  var pages = Array.prototype.slice.call(document.querySelectorAll('.pg')), spy = navSpy();
  function show(i, noScroll) {
    i = Math.max(0, Math.min(pages.length - 1, i || 0));
    pages.forEach(function (p, k) { p.hidden = k !== i; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-pg]'), function (b) {
      var on = +b.getAttribute('data-pg') === i, w = b.closest('.ptab-w,.toc-p');
      if (w) w.classList.toggle('on', on); if (on) { b.setAttribute('aria-current', 'page'); document.title = b.textContent; } else b.removeAttribute('aria-current');
    });
    if (typeof tlFit === 'function') tlFit(pages[i]);
    window.dispatchEvent(new Event('resize'));
    if (!noScroll) scrollTo(0, 0);
    spy();
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-pg]'); if (!b) return;
    e.preventDefault(); var i = +b.getAttribute('data-pg'); show(i);
    try { history.replaceState(null, '', '#p' + (i + 1)); } catch (_) {}
  });
  var m = location.hash.match(/^#p(\d+)$/);
  navLayout(); show(m ? +m[1] - 1 : 0, true);
}
function exportStatic() {
  if (isSealed() && !confirm('L’export statique n’est pas chiffré : la page exportée sera lisible par toute personne qui obtient le fichier. Continuer ?')) return;
  if (htimer) snapshot();
  var r = document.documentElement;
  var html = '<!doctype html>\n<html lang="fr" data-palette="' + esc(doc.palette) + '" data-typo="' + esc(doc.typo) + '"' + (doc.theme !== 'auto' ? ' data-theme="' + esc(doc.theme) + '"' : '') +
    ' data-npages="' + doc.pages.length + '" data-nav="' + esc(doc.nav || 'auto') + '" data-w="' + (+doc.width || 820) + '" data-docid="' + esc(doc.id) + '">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<title>' + esc(docTitle()) + '</title>\n' +
    $$('link[rel=stylesheet], link[rel=preconnect]').map(function (l) { return l.outerHTML; }).join('\n') + '\n<style>' + $('#page-css').textContent + '</style>\n</head>\n<body>\n' +
    navHTML(doc, false, true) + doc.pages.map(function (pg, i) {
      var c = doc.cur; doc.cur = i; var h = '<div class="pg" data-pgi="' + i + '"' + (i ? ' hidden' : '') + '>' + renderPage(doc, false) + '</div>'; doc.cur = c; return h;
    }).join('\n') + '\n<script>(' + viewScript.toString() + ')();' + tlFit.toString() + '(' + tlTips.toString() + ')();' + navLayout.toString() + navSpy.toString() + '(' + exportPages.toString() + ')();<\/script>\n' +
    (doc.pages.some(function (pg) { return pg.blocks.some(function (b) { return b.type === 'map'; }); }) ?
      '<script id="ardoise-geo" type="application/json">' + $('#ardoise-geo').textContent + '<\/script>\n<script>\n' + ardoiseMapKit.toString() +
      '\n(function () { var K = ardoiseMapKit(); Array.prototype.forEach.call(document.querySelectorAll(".map[data-state]"), function (el) { var st = JSON.parse(el.getAttribute("data-state")); K.mount(el, st, { edit: false, locked: !!st.lock, hideBg: !!st.hideBg }); }); })();\n<\/script>\n' : '') +
    '</body>\n</html>\n';
  download(html, fileName().replace(/\.html?$/i, '') + '-lecture.html');
  toast('Page statique téléchargée');
}
function printPage() { var m = mode; if (m === 'edit') { mode = 'view'; render(); } setTimeout(function () { window.print(); if (m === 'edit') { mode = 'edit'; render(); } }, 50); }
function copyJSON() {
  if (htimer) snapshot();
  var base = { title: docTitle(), palette: doc.palette, typo: doc.typo, width: doc.width, theme: doc.theme, nav: doc.nav };
  if (doc.pages.length > 1) base.pages = doc.pages.map(function (pg) { return { title: pg.title, blocks: pg.blocks }; }); else { base.pageTitle = doc.pages[0].title || undefined; base.blocks = doc.pages[0].blocks; }
  var t = JSON.stringify(base, null, 2);
  try { navigator.clipboard.writeText(t).then(function () { toast('JSON copié dans le presse-papiers'); }, function () { showJSON(t); }); } catch (_) { showJSON(t); }
}
function showJSON(t) { var m = modal('JSON de la page', '<textarea readonly>' + esc(t) + '</textarea>', [{ label: 'Fermer', primary: true }]); var ta = $('textarea', m); ta.focus(); ta.select(); }
function importJSON() {
  var m = modal('Importer du JSON', '<p class="muted">Collez un document (objet avec un tableau <code>blocks</code>, ou <code>pages</code> pour plusieurs pages). Le contenu actuel sera remplacé ; Ctrl+Z permet de revenir en arrière.</p><textarea placeholder="{ &quot;blocks&quot;: [ … ] }"></textarea><p class="muted" id="jerr" style="color:var(--bad)"></p>', [
    { label: 'Annuler' },
    { label: 'Importer', primary: true, fn: function (bg) {
      var raw = $('textarea', bg).value, d;
      try { d = JSON.parse(raw); } catch (e) { $('#jerr', bg).textContent = 'JSON invalide : ' + e.message; return false; }
      if (Array.isArray(d)) d = { blocks: d };
      var nd = normalize(d); if (!nd) { $('#jerr', bg).textContent = 'Il manque un tableau « blocks » (ou « pages »).'; return false; }
      nd.id = doc.id; nd.savedAt = doc.savedAt; if (doc.mapKey) nd.mapKey = doc.mapKey; else delete nd.mapKey; if (doc.lock) nd.lock = doc.lock; else delete nd.lock;
      var seen = {}, nb = 0; nd.pages.forEach(function (pg) { pg.blocks.forEach(function (b) { if (seen[b.id]) b.id = uid(); seen[b.id] = 1; nb++; }); });
      change(function () { doc = nd; }); pageHash(0);
      toast(nb + ' blocs importés' + (nd.pages.length > 1 ? ' sur ' + nd.pages.length + ' pages' : ''));
    } }]);
  $('textarea', m).focus();
}

