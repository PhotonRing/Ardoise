/* ---------- Pages ---------- */
function pageHash(i) { try { history.replaceState(null, '', '#p' + (i + 1)); } catch (_) {} }
function goPage(i, keepScroll) {
  i = Math.max(0, Math.min(doc.pages.length - 1, i));
  if (htimer) snapshot();
  if (i === doc.cur) return;
  maps.forEach(function (m) { var b = byId(m.blockId); if (b && mode === 'edit') b.view = m.getView(); });
  mapUi = { draw: null, kind: null, editOf: null, edit: null, add: null }; cheatBlock = null;
  closePop(); itb.style.display = 'none';
  doc.cur = i; render(); if (!keepScroll) scrollTo(0, 0); pageHash(i);
}
function addPage(after) {
  var pg = { id: uid(), title: '', blocks: [mk('header', {}), mk('p', {})] }, at = after == null ? doc.pages.length : after + 1;
  if (doc.pages[at] && doc.pages[at].sub) pg.sub = true;   // insérée au milieu d'un groupe : sous-page elle aussi
  change(function () { doc.pages.splice(at, 0, pg); doc.cur = at; });
  scrollTo(0, 0); pageHash(at); renamePage(at);
}
function dupPage(i) {
  var c = JSON.parse(JSON.stringify(doc.pages[i])); c.id = uid();
  c.blocks.forEach(function (b) { b.id = uid(); });
  var ch = pageHeader(c), nm = pageTitle(doc.pages[i], i) + ' (copie)';
  if (ch && textOf(ch.title)) ch.title = esc(nm); else c.title = nm;
  change(function () { doc.pages.splice(i + 1, 0, c); doc.cur = i + 1; }); scrollTo(0, 0); pageHash(i + 1);
}
function delPage(i) {
  if (doc.pages.length < 2) { toast('Un document garde au moins une page'); return; }
  if (!confirm('Supprimer la page « ' + pageTitle(doc.pages[i], i) + ' » et tout son contenu ? (Ctrl+Z pour annuler)')) return;
  change(function () { doc.pages.splice(i, 1); doc.cur = Math.min(i, doc.pages.length - 1); }); scrollTo(0, 0); pageHash(doc.cur);
}
function movePage(i, d) {
  var j = i + d; if (j < 0 || j >= doc.pages.length) return;
  change(function () { var p = doc.pages.splice(i, 1)[0]; doc.pages.splice(j, 0, p); doc.cur = j; }); pageHash(j);
}
function toggleSub(i) {
  if (i < 1) return;
  change(function () { var pg = doc.pages[i]; if (pg.sub) delete pg.sub; else pg.sub = true; navFold[doc.pages[pageParent(doc.pages, i)].id] = true; });
}
function goPageId(id) {
  for (var i = 0; i < doc.pages.length; i++) if (doc.pages[i].id === id) { goPage(i); return; }
  toast('Page introuvable : elle a sans doute été supprimée');
}
function renamePage(i) {
  // champ de saisie à la place du nom de la page (onglet ou sommaire)
  var btn = $('.pnav-tabs [data-pg="' + i + '"]', app), side = $('.pnav-side [data-pg="' + i + '"]', app);
  var host = (side && side.offsetParent !== null) ? side : btn; if (!host) return;
  // renommer une page change le grand titre de son en-tête (ou, sans en-tête, son nom)
  var pg = doc.pages[i], hd = pageHeader(pg), before = hd ? textOf(hd.title) : (pg.title || '');
  var inp = document.createElement('input'); inp.className = 'pnav-in'; inp.value = before; inp.placeholder = 'Page ' + (i + 1);
  host.replaceWith(inp); inp.focus(); inp.select();
  var done = false;
  function commit(ok) {
    if (done) return; done = true;
    var v = inp.value.trim();
    if (ok && v !== before) change(function () { if (hd) hd.title = esc(v); else pg.title = v; }); else render();
  }
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); commit(true); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); commit(false); } });
  inp.addEventListener('blur', function () { commit(true); });
}
function openPageMenu(anchor, i) {
  closePop();
  var p = document.createElement('div'); p.className = 'pop'; pop = p;
  var n = doc.pages.length;
  function mi(k, ic, label, dis) { return '<button class="mi" type="button" data-pa="' + k + '"' + (dis ? ' disabled style="opacity:.4"' : '') + '><span class="ic">' + ic + '</span><span>' + label + '</span></button>'; }
  var sub = i > 0 && doc.pages[i].sub;
  p.innerHTML = '<h4>' + esc(pageTitle(doc.pages[i], i)) + '</h4>' + mi('ren', '✎', 'Renommer') + mi('add', '+', 'Nouvelle page après') + mi('dup', '⧉', 'Dupliquer la page') +
    mi('sub', sub ? '↰' : '↳', sub ? 'Remonter au premier niveau' : 'Mettre en sous-page de « ' + esc(pageTitle(doc.pages[pageParent(doc.pages, Math.max(0, i - 1))], pageParent(doc.pages, Math.max(0, i - 1)))) + ' »', i === 0) +
    mi('up', '←', 'Déplacer avant', i === 0) + mi('down', '→', 'Déplacer après', i === n - 1) + '<div class="hr"></div>' + mi('del', '✕', 'Supprimer la page', n < 2);
  p.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pa]'); if (!b || b.disabled) return; closePop();
    var k = b.dataset.pa;
    if (k === 'ren') renamePage(i); else if (k === 'add') addPage(i); else if (k === 'dup') dupPage(i);
    else if (k === 'sub') toggleSub(i);
    else if (k === 'up') movePage(i, -1); else if (k === 'down') movePage(i, 1); else if (k === 'del') delPage(i);
  });
  placePop(p, anchor);
}
app.addEventListener('click', function (e) {
  var t = e.target;
  var lk = t.closest('a[href^="#pg-"]');
  if (lk && (mode === 'view' || e.ctrlKey || e.metaKey)) { e.preventDefault(); goPageId(lk.getAttribute('href').slice(4)); return; }
  var fb = t.closest('[data-pgfold]');
  if (fb) { var li = fb.closest('.toc-p'); navFold[doc.pages[+li.dataset.pgi].id] = tocFold(fb); return; }
  var pg = t.closest('[data-pg]'); if (pg && !t.closest('.pnav-in')) { e.preventDefault(); goPage(+pg.dataset.pg); return; }
  if (t.closest('[data-pgadd]') && mode === 'edit') { addPage(doc.cur); return; }
  var pm = t.closest('[data-pgm]'); if (pm && mode === 'edit') { openPageMenu(pm, +pm.dataset.pgm); return; }
});
app.addEventListener('dblclick', function (e) {
  var pg = e.target.closest('[data-pg]'); if (!pg || mode !== 'edit') return;
  e.preventDefault(); renamePage(+pg.dataset.pg);
});

