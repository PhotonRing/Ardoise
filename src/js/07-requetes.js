/* ---------- Bloc requête ---------- */
// Recherche dans le document, sans syntaxe : les fiches de faits, les lignes de tableaux ou les cases à cocher
// d'une portée (document, page, page et sous-pages, section), filtrées par pastilles ; vue tableau, liste ou nombre.
var Q_SRC = { facts: ['Fiches de faits', 'fiche', 'fiches'], table: ['Lignes de tableaux', 'ligne', 'lignes'], check: ['Cases à cocher', 'case', 'cases'] };
function pillKeys(html) {
  // noms des pastilles d'un texte enrichi
  var out = [], re = /<span class="pill[^"]*"[^>]*>((?:(?!<\/?span\b)[\s\S])*?)<\/span>/g, m;
  while ((m = re.exec(String(html || '')))) { var k = tagKey(htmlText(m[1])); if (k && out.indexOf(k) < 0) out.push(k); }
  return out;
}
function eachText(blocks, fn) {
  // parcourt les textes des blocs (sans les images, le code ni les identifiants), sans rien modifier
  (function walk(o) {
    if (Array.isArray(o)) { o.forEach(function (v) { if (typeof v === 'string') fn(v); else if (v && typeof v === 'object') walk(v); }); return; }
    for (var k in o) { if (MIG_SKIP[k]) continue; var v = o[k]; if (typeof v === 'string') { if (v.indexOf('pill') >= 0) fn(v); } else if (v && typeof v === 'object') walk(v); }
  })(blocks);
}
function docTags() {
  // pastilles utilisées dans le document : [{ key, name }] dans l'ordre d'apparition (nom tel qu'écrit la première fois)
  var seen = {}, out = [], re = /<span class="pill[^"]*"[^>]*>((?:(?!<\/?span\b)[\s\S])*?)<\/span>/g;
  doc.pages.forEach(function (pg) {
    eachText(pg.blocks, function (s) {
      var m; re.lastIndex = 0;
      while ((m = re.exec(s))) { var name = htmlText(m[1]).replace(/\s+/g, ' ').trim(), k = tagKey(name); if (k && !seen[k]) { seen[k] = 1; out.push({ key: k, name: name }); } }
    });
  });
  return out;
}
function queryBlocks(b, pi) {
  // blocs de la portée : [{ blk, pi, sec }] (sec : titre de section qui contient le bloc, ou null)
  var pages = doc.pages, s = b.scope || 'doc', m, list = [], from = 0, to = 0, region = null;
  if (s === 'doc') { from = 0; to = pages.length; }
  else if (s === 'here' || (m = s.match(/^pg:(.+)$/))) { var p = s === 'here' ? pi : pageIndex(m[1]); if (p < 0) return []; from = p; to = b.sub ? pageEnd(pages, p) : p + 1; }
  else if ((m = s.match(/^sec:([^/]+)\/(.+)$/))) {
    var sp = pageIndex(m[1]); if (sp < 0) return [];
    var bl = pages[sp].blocks, hi = -1; for (var k = 0; k < bl.length; k++) if (bl[k].id === m[2]) hi = k;
    if (hi < 0) return [];
    var hl = foldLevel(bl[hi]), end = hi + 1; while (end < bl.length) { var l = foldLevel(bl[end]); if (l >= 0 && l <= hl) break; end++; }
    from = sp; to = sp + 1; region = [hi, end];
  } else return [];
  for (var i = from; i < to; i++) {
    var sec = null;
    pages[i].blocks.forEach(function (x, j) {
      if (foldLevel(x) > 0) sec = x; else if (foldLevel(x) === 0) sec = null;
      if (region && (j < region[0] || j >= region[1])) return;
      if (x !== b) list.push({ blk: x, pi: i, sec: sec });
    });
  }
  return list;
}
function queryRecords(b, pi) {
  var recs = [];
  queryBlocks(b, pi).forEach(function (x) {
    var bl = x.blk;
    if (b.src === 'table' && bl.type === 'table' && bl.rows.length > 1) {
      var head = bl.rows[0].map(function (h, j) { return htmlText(h).replace(/\s+/g, ' ').trim() || 'Colonne ' + (j + 1); });
      bl.rows.slice(1).forEach(function (r) { recs.push({ x: x, cells: r.map(function (c, j) { return { k: head[j], v: c }; }), tags: pillKeys(r.join(' ')) }); });
    } else if (b.src === 'check' && (bl.type === 'check' || bl.type === 'cards')) {
      var its = bl.type === 'check' ? bl.items : [].concat.apply([], bl.cards.map(function (c) { return c.checks || []; }));
      its.forEach(function (it) { recs.push({ x: x, html: it.html, done: !!it.done, tags: pillKeys(it.html) }); });
    } else if ((b.src || 'facts') === 'facts' && bl.type === 'facts') {
      recs.push({ x: x, cells: bl.items.map(function (it) { return { k: String(it.k || '').trim() || 'Clé', v: it.v, alert: it.alert }; }), tags: pillKeys(bl.items.map(function (it) { return it.v; }).join(' ')) });
    }
  });
  var want = b.tags || [];
  if (want.length) recs = recs.filter(function (r) { return b.match === 'all' ? want.every(function (t) { return r.tags.indexOf(t) >= 0; }) : want.some(function (t) { return r.tags.indexOf(t) >= 0; }); });
  return recs;
}
function qSource(x) {
  var pg = doc.pages[x.pi], t = pageTitle(pg, x.pi), st = x.sec ? textOf(x.sec.type === 'step' ? x.sec.title : x.sec.html) : '';
  return '<a class="q-src" href="#pg-' + esc(pg.id) + (x.sec ? '/' + esc(x.sec.id) : '') + '">' + esc(t) + (st ? ' › ' + esc(st) : '') + '</a>';
}
function queryResult(b, pi) {
  var recs = queryRecords(b, pi), src = b.src || 'facts', view = b.view || 'table', lab = Q_SRC[src] || Q_SRC.facts;
  if (view === 'count') {
    if (src === 'check') {
      var done = recs.filter(function (r) { return r.done; }).length, pc = recs.length ? Math.round(done * 100 / recs.length) : 0;
      return '<div class="q-count"><b>' + done + '<small> / ' + recs.length + '</small></b><span>' + (recs.length > 1 ? 'cases cochées' : 'case cochée') + '</span>' +
        '<div class="q-bar" role="progressbar" aria-valuenow="' + pc + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pc + '%"></i></div></div>';
    }
    return '<div class="q-count"><b>' + recs.length + '</b><span>' + (recs.length > 1 ? lab[2] : lab[1]) + (src === 'facts' ? ' de faits' : src === 'table' ? ' de tableaux' : '') + '</span></div>';
  }
  if (!recs.length) return '<p class="muted q-empty">Aucun résultat.</p>';
  var val = function (c) { var h = R(c.v); return c.alert ? '<span class="alert">' + h + '</span>' : h; };
  if (src === 'check') {
    if (view === 'list') return '<ul class="q-list q-checks">' + recs.map(function (r) { return '<li' + (r.done ? ' class="done"' : '') + '><span class="q-box" aria-label="' + (r.done ? 'cochée' : 'non cochée') + '">' + (r.done ? '☑' : '☐') + '</span><span>' + R(r.html) + '</span>' + qSource(r.x) + '</li>'; }).join('') + '</ul>';
    return '<div class="tablewrap"><table class="q-table"><thead><tr><th></th><th>Élément</th><th>Source</th></tr></thead><tbody>' +
      recs.map(function (r) { return '<tr' + (r.done ? ' class="done"' : '') + '><td class="q-box">' + (r.done ? '☑' : '☐') + '</td><td>' + R(r.html) + '</td><td>' + qSource(r.x) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  // fiches de faits et lignes de tableaux : colonnes réunies par nom, dans l'ordre d'apparition
  var cols = [], ck = {};
  recs.forEach(function (r) { r.cells.forEach(function (c) { var k = c.k.toLowerCase(); if (!(k in ck)) { ck[k] = cols.length; cols.push(c.k); } }); });
  var cellsOf = function (r) { var o = []; r.cells.forEach(function (c) { var k = ck[c.k.toLowerCase()]; if (o[k] == null) o[k] = c; }); return o; };
  if (view === 'list') {
    return '<ul class="q-list">' + recs.map(function (r) {
      var parts = cellsOf(r).map(function (c, j) { return c && !isBlank(c.v) ? '<span class="q-kv"><span class="q-k">' + esc(cols[j]) + '</span> ' + val(c) + '</span>' : ''; }).filter(Boolean);
      return '<li>' + qSource(r.x) + '<span class="q-kvs">' + (parts.join('') || '<span class="muted">—</span>') + '</span></li>';
    }).join('') + '</ul>';
  }
  return '<div class="tablewrap"><table class="q-table"><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '<th>Source</th></tr></thead><tbody>' +
    recs.map(function (r) { var o = cellsOf(r); return '<tr>' + cols.map(function (c, j) { return '<td>' + (o[j] ? val(o[j]) : '') + '</td>'; }).join('') + '<td>' + qSource(r.x) + '</td></tr>'; }).join('') + '</tbody></table></div>';
}
function queryForm(b) {
  // formulaire de la requête (édition)
  var o = function (v, cur, label, extra) { return '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? ' selected' : '') + (extra || '') + '>' + label + '</option>'; };
  var sc = b.scope || 'doc', scopes = o('doc', sc, 'Tout le document') + o('here', sc, 'Cette page');
  doc.pages.forEach(function (pg, i) {
    var pad = new Array(pageLv(doc.pages, i) + 1).join('   ');
    scopes += o('pg:' + pg.id, sc, pad + 'Page « ' + esc(pageTitle(pg, i)) + ' »');
    sectionsOf(pg).forEach(function (x) { scopes += o('sec:' + pg.id + '/' + x.id, sc, pad + '   ' + (x.lv > 1 ? '   ' : '') + '§ ' + esc((x.n ? x.n + ' · ' : '') + x.t)); });
  });
  var tags = docTags(), want = b.tags || [];
  want.forEach(function (k) { if (!tags.some(function (t) { return t.key === k; })) tags.push({ key: k, name: k }); });   // pastille choisie qui n'existe plus
  var chips = tags.length ? tags.map(function (t) {
    var on = want.indexOf(t.key) >= 0;
    return '<button type="button" class="pill pa-' + tagColor(t.key) + ' q-chip" data-act="q-tag" data-tag="' + esc(t.key) + '" aria-pressed="' + on + '" title="' + (on ? 'Retirer du filtre' : 'Ajouter au filtre') + '">' + esc(t.name) + '</button>';
  }).join('') : '<span class="muted">Aucune pastille dans le document.</span>';
  var pageScope = sc === 'here' || /^pg:/.test(sc);
  return '<div class="q-form">' +
    '<label>Chercher <select data-act="set" data-prop="src">' + o('facts', b.src, 'les fiches de faits') + o('table', b.src, 'les lignes de tableaux') + o('check', b.src, 'les cases à cocher') + '</select></label>' +
    '<label>dans <select data-act="set" data-prop="scope" class="q-scope">' + scopes + '</select></label>' +
    (pageScope ? '<label class="q-tog"><input type="checkbox" data-qsub' + (b.sub ? ' checked' : '') + '> et ses sous-pages</label>' : '') +
    '<div class="q-tags"><span class="q-lbl">Avec les pastilles</span>' + chips +
    (want.length > 1 ? '<select data-act="set" data-prop="match" title="Combinaison des pastilles">' + o('any', b.match || 'any', 'au moins une') + o('all', b.match, 'toutes') + '</select>' : '') +
    (want.length ? '' : '<span class="muted q-hint">(aucune choisie : tout est retenu)</span>') + '</div>' +
    '<label>Afficher <select data-act="set" data-prop="view">' + o('table', b.view, 'en tableau') + o('list', b.view, 'en liste') + o('count', b.view, 'le nombre') + '</select></label>' +
    '</div>';
}
