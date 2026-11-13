/* ---------- Pages ---------- */
// adresse de la page affichée, sans entrée d'historique (opérations de page, import)
function pageHash(i) { remplacerAdresse(adressePage(doc.pages, i)); }
// sansEntree : retour par Précédent / Suivant, ou lien qui crée lui-même son entrée (goLink)
function goPage(i, keepScroll, sansEntree) {
  i = Math.max(0, Math.min(doc.pages.length - 1, i));
  session.valider();
  if (i === doc.cur) return;
  if (!sansEntree) noterDefilement();
  maps.forEach(function (m) { var b = byId(m.blockId); if (b && mode === 'edit') b.view = m.getView(); });
  mapUi = { draw: null, kind: null, editOf: null, edit: null, add: null }; cheatBlock = null;
  closePop(); itb.style.display = 'none';
  if (mode === 'edit') viewCol = {};   // colonne rouverte par un saut vers une carte : refermée en quittant la page
  pageAncestors(doc.pages, i).forEach(function (a) { if (navFold[doc.pages[a].id] === false) delete navFold[doc.pages[a].id]; });
  doc.cur = i; render(); if (!keepScroll) scrollTo(0, 0);
  if (!sansEntree) naviguer(adressePage(doc.pages, i));
}
function insertPage(at, lv) {
  var pg = { id: uid(), title: '', blocks: [mk('header', {}), mk('p', {})] }; if (lv) pg.lv = lv;
  session.modifier(function () { doc.pages.splice(at, 0, pg); doc.cur = at; });
  scrollTo(0, 0); pageHash(at); renamePage(at);
}
function addPage(after) {
  // nouvelle page après « after » et ses sous-pages, au même niveau (à la fin, au premier niveau, sans « after »)
  if (after == null) insertPage(doc.pages.length, 0); else insertPage(pageEnd(doc.pages, after), pageLv(doc.pages, after));
}
function addSubPage(i) { navFold[doc.pages[i].id] = true; saveNavFold(); insertPage(pageEnd(doc.pages, i), pageLv(doc.pages, i) + 1); }
function dupPage(i) {
  // copie de la page seule (sans ses sous-pages), placée après elle et ses sous-pages
  var c = JSON.parse(JSON.stringify(doc.pages[i])), at = pageEnd(doc.pages, i); c.id = uid();
  c.blocks = c.blocks.map(copieBloc);   // identifiants neufs, blocs des groupes compris
  var ch = pageHeader(c), nm = pageTitle(doc.pages[i], i) + ' (copie)';
  if (ch && textOf(ch.title)) ch.title = esc(nm); else c.title = nm;
  session.modifier(function () { doc.pages.splice(at, 0, c); doc.cur = at; }); scrollTo(0, 0); pageHash(at);
}
function delPage(i) {
  var n = pageEnd(doc.pages, i) - i;
  if (doc.pages.length - n < 1) { toast('Un document garde au moins une page'); return; }
  if (!confirm('Supprimer la page « ' + pageTitle(doc.pages[i], i) + ' »' + (n > 2 ? ' et ses ' + (n - 1) + ' sous-pages' : n > 1 ? ' et sa sous-page' : '') + ', avec tout leur contenu ? (Ctrl+Z pour annuler)')) return;
  session.modifier(function () { doc.pages.splice(i, n); doc.cur = Math.min(i, doc.pages.length - 1); }); scrollTo(0, 0); pageHash(doc.cur);
}
function movePageTo(i, j, where) {
  // déplace la page i et ses sous-pages : avant la page j ('before'), après j et ses sous-pages ('after'), ou dans j en dernière sous-page ('inside')
  var pages = doc.pages, end = pageEnd(pages, i);
  if (j >= i && j < end) return false;   // dans ses propres sous-pages
  var seg = pages.slice(i, end), base = pageLv(pages, i), tgt = pages[j], nl = pageLv(pages, j) + (where === 'inside' ? 1 : 0), curId = pages[doc.cur].id;
  session.modifier(function () {
    pages.splice(i, end - i);
    var t = pages.indexOf(tgt), at = where === 'before' ? t : pageEnd(pages, t);
    seg.forEach(function (p) { var l = Math.min(8, (+p.lv || 0) - base + nl); if (l > 0) p.lv = l; else delete p.lv; });
    Array.prototype.splice.apply(pages, [at, 0].concat(seg));
    for (var k = 0; k < pages.length; k++) if (pages[k].id === curId) doc.cur = k;
    if (where === 'inside') navFold[tgt.id] = true;
  });
  saveNavFold(); pageHash(doc.cur); return true;
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
    if (ok && v !== before) session.modifier(function () { if (hd) hd.title = esc(v); else pg.title = v; }); else render();
  }
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); commit(true); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); commit(false); } });
  inp.addEventListener('blur', function () { commit(true); });
}
function openPageMenu(anchor, i) {
  closePop();
  var p = document.createElement('div'); p.className = 'pop'; pop = p;
  var pages = doc.pages, ps = prevSibling(pages, i), ns = nextSibling(pages, i), par = pageParent(pages, i), n = pageEnd(pages, i) - i;
  function mi(k, ic, label, dis) { return '<button class="mi" type="button" data-pa="' + k + '"' + (dis ? ' disabled style="opacity:.4"' : '') + '><span class="ic">' + ic + '</span><span>' + label + '</span></button>'; }
  function nm(j) { return '« ' + esc(pageTitle(pages[j], j)) + ' »'; }
  p.innerHTML = '<h4>' + esc(pageTitle(pages[i], i)) + '</h4>' + mi('ren', '✎', 'Renommer') + mi('add', '+', 'Nouvelle page après') + mi('addsub', '↳', 'Nouvelle sous-page') + mi('dup', '⧉', 'Dupliquer la page') +
    '<div class="hr"></div>' + mi('up', '↑', 'Monter', ps < 0) + mi('down', '↓', 'Descendre', ns < 0) +
    mi('in', '→', ps < 0 ? 'Mettre en sous-page de la page précédente' : 'Mettre en sous-page de ' + nm(ps), ps < 0) +
    mi('out', '←', par < 0 ? 'Remonter d’un niveau' : 'Sortir de ' + nm(par), par < 0) +
    '<div class="hr"></div>' + mi('del', '✕', n > 1 ? 'Supprimer la page et ses sous-pages' : 'Supprimer la page', pages.length - n < 1) +
    '<p class="muted" style="margin:6px 8px 2px;font-size:12px;max-width:260px">Astuce : glissez une page dans le sommaire pour la déplacer ou la ranger dans une autre.</p>';
  p.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pa]'); if (!b || b.disabled) return; closePop();
    var k = b.dataset.pa;
    if (k === 'ren') renamePage(i); else if (k === 'add') addPage(i); else if (k === 'addsub') addSubPage(i); else if (k === 'dup') dupPage(i);
    else if (k === 'up') movePageTo(i, ps, 'before'); else if (k === 'down') movePageTo(i, ns, 'after');
    else if (k === 'in') movePageTo(i, ps, 'inside'); else if (k === 'out') movePageTo(i, par, 'after');
    else if (k === 'del') delPage(i);
  });
  placePop(p, anchor);
}
app.addEventListener('click', function (e) {
  var t = e.target;
  var lk = t.closest('a[href^="#pg-"]');
  if (lk && (mode === 'view' || e.ctrlKey || e.metaKey || lk.closest('.toc-blk, .q-res'))) { e.preventDefault(); goLink(lk.getAttribute('href')); return; }
  var sec = t.closest('a[data-sec]');
  // section du sommaire latéral : une entrée d'historique, avant le défilement fait par Reader.navSpy
  if (sec && byId(sec.dataset.sec)) { noterDefilement(); naviguer(adressePage(doc.pages, doc.cur, sec.dataset.sec)); }
  if (sec && mode === 'edit' && byId(sec.dataset.sec) && !$('.blk[data-id="' + sec.dataset.sec + '"]', app)) { var sid = sec.dataset.sec; session.modifier(function () { revealBlock(sid); }); }
  var kd = t.closest('[data-kbdep]');
  if (kd) { var dp = kd.dataset.kbdep.split('|'); kbDepMenu(kd, dp[0], dp[1]); return; }
  var kg = t.closest('[data-kbgo]');
  if (kg) { var gp = kg.dataset.kbgo.split('|'); kbGo(gp[0], gp[1]); return; }
  var kf = t.closest('[data-kbfold]');
  if (kf) { var fp = kf.dataset.kbfold.split('|'); kbFold(fp[0], fp[1]); return; }
  var km = t.closest('[data-kbmove]');
  if (km) { var kp = km.dataset.kbmove.split('|'), kb = byId(kp[0]); if (kb) kbMoveMenu(km, kb, +kp[1], +kp[2]); return; }
  var qc = t.closest('[data-qchk]');
  if (qc) {
    // case cochée depuis un bloc requête : la vraie case, dans sa liste d'origine (enregistré, en lecture comme en édition)
    var qp = qc.dataset.qchk.split('|'), qpi = pageIndex(doc.pages, qp[0]), qo = qpi >= 0 && ouEst(doc.pages[qpi].blocks, qp[1]), qb = qo && qo.b;   // liste d'un groupe comprise
    if (qb && getPath(qb, qp[2]) != null) { var sy = scrollY; session.modifier(function () { setPath(qb, qp[2], !getPath(qb, qp[2])); }); scrollTo(0, sy); }
    return;
  }
  var qs = t.closest('[data-qsort]');
  if (qs) {
    var qhost = qs.closest('[data-qid]'), qblk = qhost && byId(qhost.dataset.qid);
    if (!qblk) return;
    var cur = qSortSpec(qblk, viewCtx()), by = qs.dataset.qsort, dir = cur.by === by && cur.dir === 'asc' ? 'desc' : 'asc', sy2 = scrollY;
    if (mode === 'edit') session.modifier(function () { qblk.sortBy = by; qblk.sortDir = dir; });
    else { viewSort[qblk.id] = { by: by, dir: dir }; render(); }   // lecture : rien n'est enregistré
    scrollTo(0, sy2); return;
  }
  var vfb = t.closest('[data-vfold]');
  if (vfb && mode === 'view') { var hd = vfb.parentNode; viewFold[hd.id.slice(2)] = !Reader.foldToggle(hd); return; }   // lecture : rien n'est enregistré
  var fb = t.closest('[data-pgfold]');
  if (fb) { var li = fb.closest('.toc-p'); navFold[doc.pages[+li.dataset.pgi].id] = Reader.tocFold(fb); saveNavFold(); return; }
  var ps = t.closest('[data-pgsub]'); if (ps && mode === 'edit') { addSubPage(+ps.dataset.pgsub); return; }
  var pg = t.closest('[data-pg]'); if (pg && !t.closest('.pnav-in')) { e.preventDefault(); goPage(+pg.dataset.pg); return; }
  if (t.closest('[data-pgadd]') && mode === 'edit') { addPage(doc.cur); return; }
  var pm = t.closest('[data-pgm]'); if (pm && mode === 'edit') { openPageMenu(pm, +pm.dataset.pgm); return; }
});
app.addEventListener('dblclick', function (e) {
  var pg = e.target.closest('[data-pg]'); if (!pg || mode !== 'edit') return;
  e.preventDefault(); renamePage(+pg.dataset.pg);
});


/* Glisser-déposer des pages dans le sommaire (édition) : avant, après, ou dans une page */
var pgDrag = null, pgDrop = null;
function pgDropClear() { $$('.toc-pr.drop-before,.toc-pr.drop-after,.toc-pr.drop-inside', app).forEach(function (r) { r.classList.remove('drop-before', 'drop-after', 'drop-inside'); }); }
app.addEventListener('dragstart', function (e) {
  var row = e.target.closest && e.target.closest('.pnav-side .toc-pr[draggable]'); if (!row || mode !== 'edit') return;
  pgDrag = +row.parentNode.dataset.pgi; pgDrop = null; row.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', pageTitle(doc.pages[pgDrag], pgDrag)); } catch (_) {}
});
app.addEventListener('dragover', function (e) {
  if (pgDrag == null) return;
  var row = e.target.closest && e.target.closest('.pnav-side .toc-pr'); pgDropClear(); pgDrop = null;
  if (!row) return;
  var j = +row.parentNode.dataset.pgi; if (j >= pgDrag && j < pageEnd(doc.pages, pgDrag)) return;   // dans ses propres sous-pages
  var r = row.getBoundingClientRect(), y = (e.clientY - r.top) / r.height, li = row.parentNode;
  var where = y < 0.3 ? 'before' : (y > 0.7 && !li.classList.contains('open')) ? 'after' : 'inside';
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  pgDrop = { j: j, where: where }; row.classList.add('drop-' + where);
});
app.addEventListener('drop', function (e) {
  if (pgDrag == null) return;
  e.preventDefault(); var from = pgDrag, d = pgDrop; pgDragEnd();
  if (d) movePageTo(from, d.j, d.where);
});
function pgDragEnd() { pgDropClear(); $$('.toc-pr.dragging', app).forEach(function (r) { r.classList.remove('dragging'); }); pgDrag = null; pgDrop = null; }
app.addEventListener('dragend', function () { if (pgDrag != null) pgDragEnd(); });
// lecture : le pli d'un groupe repliable (<details>) est gardé pour la session, jamais enregistré, pour survivre à un nouveau rendu
document.addEventListener('toggle', function (e) {
  var g = e.target; if (mode !== 'view' || !g.matches || !g.matches('details.grp[data-bid]')) return;
  viewFold[g.dataset.bid] = !g.open;
}, true);
