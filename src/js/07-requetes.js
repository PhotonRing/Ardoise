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
function queryRecords(b, pi, noTags) {
  var recs = [];
  queryBlocks(b, pi).forEach(function (x) {
    var bl = x.blk;
    if (b.src === 'table' && bl.type === 'table' && bl.rows.length > 1) {
      var head = bl.rows[0].map(function (h, j) { return htmlText(h).replace(/\s+/g, ' ').trim() || 'Colonne ' + (j + 1); });
      bl.rows.slice(1).forEach(function (r) { recs.push({ x: x, cells: r.map(function (c, j) { return { k: head[j], v: c }; }), tags: pillKeys(r.join(' ')) }); });
    } else if (b.src === 'check' && (bl.type === 'check' || bl.type === 'cards')) {
      var add = function (it, path, par) { recs.push({ x: x, html: it.html, done: !!it.done, tags: pillKeys(it.html), path: path, par: par }); };
      if (bl.type === 'check') bl.items.forEach(function (it, i) {
        // sous-case : texte de la case parente (la plus proche au-dessus, d'un niveau inférieur)
        var lv = +it.lv || 0, par = '';
        for (var j = i - 1; lv > 0 && j >= 0; j--) if ((+bl.items[j].lv || 0) < lv) { par = htmlText(bl.items[j].html).replace(/\s+/g, ' ').trim(); break; }
        add(it, 'items.' + i + '.done', par);
      });
      else bl.cards.forEach(function (c, ci) { var t = textOf(c.title); (c.checks || []).forEach(function (it, j) { add(it, 'cards.' + ci + '.checks.' + j + '.done', t); }); });
    } else if ((b.src || 'facts') === 'facts' && bl.type === 'facts') {
      recs.push({ x: x, cells: bl.items.map(function (it) { return { k: String(it.k || '').trim() || 'Clé', v: it.v, alert: it.alert }; }), tags: pillKeys(bl.items.map(function (it) { return it.v; }).join(' ')) });
    }
  });
  // cases à cocher : toutes, cochées ou non cochées
  if (b.src === 'check' && (b.state === 'done' || b.state === 'todo')) recs = recs.filter(function (r) { return b.state === 'done' ? r.done : !r.done; });
  var want = noTags ? [] : b.tags || [];
  if (want.length) recs = recs.filter(function (r) { return b.match === 'all' ? want.every(function (t) { return r.tags.indexOf(t) >= 0; }) : want.some(function (t) { return r.tags.indexOf(t) >= 0; }); });
  return recs;
}
function filterRecs(recs, tags, match, state) {
  // pastilles (au moins une / toutes) et, pour les cases à cocher, état (cochées / non cochées)
  tags = tags || [];
  return recs.filter(function (r) {
    if (state === 'done' && !r.done) return false;
    if (state === 'todo' && r.done) return false;
    if (!tags.length) return true;
    return match === 'all' ? tags.every(function (t) { return r.tags.indexOf(t) >= 0; }) : tags.some(function (t) { return r.tags.indexOf(t) >= 0; });
  });
}
function scopeTags(b, pi, recs) {
  // pastilles présentes dans les éléments cherchés de la portée (fiches, lignes ou cases), dans l'ordre du document
  var names = {}, out = [];
  docTags().forEach(function (t) { names[t.key] = t.name; });
  (recs || queryRecords(b, pi, true)).forEach(function (r) { r.tags.forEach(function (k) { if (out.indexOf(k) < 0) out.push(k); }); });
  return out.map(function (k) { return { key: k, name: names[k] || k }; });
}
function qChips(act, i, avail, want, title) {
  // pastilles cliquables d'un filtre ; une pastille choisie mais absente de la portée reste affichée (barrée)
  var list = avail.slice();
  (want || []).forEach(function (k) { if (!list.some(function (t) { return t.key === k; })) list.push({ key: k, name: k, gone: true }); });
  if (!list.length) return '<span class="muted q-hint">Aucune pastille ici.</span>';
  return list.map(function (t) {
    var on = (want || []).indexOf(t.key) >= 0;
    return '<button type="button" class="pill pa-' + tagColor(t.key) + ' q-chip' + (t.gone ? ' q-gone' : '') + '" data-act="' + act + '"' + (i != null ? ' data-i="' + i + '"' : '') + ' data-tag="' + esc(t.key) + '" aria-pressed="' + on + '" title="' + (t.gone ? 'Absente de la portée choisie · ' : '') + (on ? 'Retirer de ' : 'Ajouter à ') + title + '">' + esc(t.name) + '</button>';
  }).join('');
}
function qScopeHref(b) {
  // page ou section visée par la requête (pas de lien pour « tout le document » ni « cette page »)
  var m = String(b.scope || '').match(/^(?:pg:(.+)|sec:([^/]+)\/(.+))$/);
  return !m ? '' : m[1] ? '#pg-' + m[1] : '#pg-' + m[2] + '/' + m[3];
}
function qDefCard(b) { return b.src === 'check' ? { label: '', tags: [], match: 'any', state: 'done', total: 'all' } : { label: '', tags: [], match: 'any', state: 'all', total: 'none' }; }
function qCardLabel(b, c, names) {
  // texte par défaut d'une carte (remplacé par le texte saisi)
  var src = b.src || 'facts', base = src === 'check' ? (c.state === 'done' ? 'cases cochées' : c.state === 'todo' ? 'cases à cocher restantes' : 'cases à cocher') : src === 'table' ? 'lignes de tableaux' : 'fiches de faits';
  var t = (c.tags || []).map(function (k) { return names[k] || k; });
  return base + (t.length ? ' · ' + t.join(c.match === 'all' ? ' + ' : ' ou ') : '');
}
function qCards(b, pi, e, recs) {
  // vue nombre : une carte par compteur, à la suite ; chaque carte compte les résultats du bloc qui ont ses
  // propres pastilles (et, pour les cases, leur état), éventuellement rapportés à un total
  var names = {}; docTags().forEach(function (t) { names[t.key] = t.name; });
  var avail = e ? scopeTags(b, pi, recs) : null, cards = b.cards && b.cards.length ? b.cards : [qDefCard(b)], chk = b.src === 'check';
  var o = function (v, cur, label) { return '<option value="' + v + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + label + '</option>'; };
  var stSel = function (p, cur) { return chk ? '<select data-act="set" data-prop="' + p + '">' + o('all', cur || 'all', 'toutes') + o('done', cur, 'cochées') + o('todo', cur, 'non cochées') + '</select>' : ''; };
  return '<div class="q-cards">' + cards.map(function (c, i) {
    var num = filterRecs(recs, c.tags, c.match, c.state).length;
    var tot = c.total === 'all' ? recs.length : c.total === 'filter' ? filterRecs(recs, c.ttags, c.tmatch, c.tstate).length : null;
    var pc = tot ? Math.min(100, Math.round(num * 100 / tot)) : 0, def = qCardLabel(b, c, names);
    var lab = e ? '<span class="fld q-lab" contenteditable="true" spellcheck="true" data-b="' + b.id + '" data-k="cards.' + i + '.label" data-nl data-ph="' + esc(def) + '">' + esc(c.label || '') + '</span>'
      : '<span class="q-lab">' + esc(String(c.label || '').trim() || def) + '</span>';
    var form = !e ? '' : '<div class="q-cform">' +
      '<div class="q-row"><span class="q-lbl">Compter</span>' + stSel('cards.' + i + '.state', c.state) + qChips('q-ctag', i, avail, c.tags, 'cette carte') +
      ((c.tags || []).length > 1 ? '<select data-act="set" data-prop="cards.' + i + '.match">' + o('any', c.match || 'any', 'au moins une') + o('all', c.match, 'toutes') + '</select>' : '') + '</div>' +
      '<div class="q-row"><span class="q-lbl">sur</span><select data-act="set" data-prop="cards.' + i + '.total">' + o('none', c.total || 'none', 'rien (nombre seul)') + o('all', c.total, 'tous les résultats') + o('filter', c.total, 'un autre filtre…') + '</select>' +
      (c.total === 'filter' ? stSel('cards.' + i + '.tstate', c.tstate) + qChips('q-ttag', i, avail, c.ttags, 'ce total') +
        ((c.ttags || []).length > 1 ? '<select data-act="set" data-prop="cards.' + i + '.tmatch">' + o('any', c.tmatch || 'any', 'au moins une') + o('all', c.tmatch, 'toutes') + '</select>' : '') : '') + '</div>' +
      (cards.length > 1 ? '<button type="button" class="q-cdel" data-act="q-card-del" data-i="' + i + '" title="Supprimer cette carte">×</button>' : '') + '</div>';
    var href = qScopeHref(b), tag = href && !e ? 'a' : 'div';
    return '<' + tag + ' class="q-count' + (href ? ' q-linked' : '') + '"' + (tag === 'a' ? ' href="' + esc(href) + '" title="Ouvrir la page ou la section concernée"' : '') + '><b>' + num + (tot != null ? '<small> / ' + tot + '</small>' : '') + '</b>' + lab +
      (href && e ? '<a class="q-go" href="' + esc(href) + '" title="Ouvrir la page ou la section concernée">↗</a>' : '') +
      (tot != null ? '<div class="q-bar" role="progressbar" aria-valuenow="' + pc + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pc + '%"></i></div>' : '') + form + '</' + tag + '>';
  }).join('') + (e ? '<button type="button" class="q-cadd" data-act="q-card-add" title="Ajouter une carte de nombre">+ Carte</button>' : '') + '</div>';
}
function qSource(x) {
  var pg = doc.pages[x.pi], t = pageTitle(pg, x.pi), st = x.sec ? textOf(x.sec.type === 'step' ? x.sec.title : x.sec.html) : '';
  return '<a class="q-src" href="#pg-' + esc(pg.id) + (x.sec ? '/' + esc(x.sec.id) : '') + '">' + esc(t) + (st ? ' › ' + esc(st) : '') + '</a>';
}
var viewSort = {};   // tri choisi en lecture d'un clic sur un en-tête (id du bloc → { by, dir }) : jamais enregistré
var staticRender = false;   // export statique : résultats sans interaction
function qSortKey(v) {
  // valeur de tri : nombre, date (jj/mm/aaaa, aaaa-mm-jj) ou texte ; vide : toujours à la fin
  var t = htmlText(v).replace(/\s+/g, ' ').trim(), m;
  if (!t) return null;
  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})/))) return { d: Date.UTC(+m[1], +m[2] - 1, +m[3]) };
  if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) return { d: Date.UTC(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]) };
  var n = t.replace(/[\s  ]/g, '').replace(',', '.').match(/^-?\d+(\.\d+)?/);
  if (n && /^-?[\d\s  ]+([.,]\d+)?\s*[%€$a-zA-Z]{0,4}$/.test(t)) return { n: +n[0] };
  return { s: t };
}
function qCompare(a, b) {
  if (!a || !b) return !a && !b ? 0 : !a ? 1 : -1;
  if (a.n != null && b.n != null) return a.n - b.n;
  if (a.d != null && b.d != null) return a.d - b.d;
  var x = a.s != null ? a.s : String(a.n != null ? a.n : a.d), y = b.s != null ? b.s : String(b.n != null ? b.n : b.d);
  return x.localeCompare(y, 'fr', { numeric: true, sensitivity: 'base' });
}
function qSortSpec(b) { var v = mode === 'view' && !staticRender && viewSort[b.id]; return v || { by: b.sortBy || '', dir: b.sortDir || 'asc' }; }
function qSortOptions(b, recs) {
  // choix de tri : colonnes (fiches, lignes) ou élément / état (cases), et source
  if ((b.src || 'facts') === 'check') return [['txt', 'Élément'], ['done', 'État (cochées)'], ['src', 'Source']];
  var cols = [], seen = {};
  recs.forEach(function (r) { r.cells.forEach(function (c) { var k = c.k.toLowerCase(); if (!seen[k]) { seen[k] = 1; cols.push(['c:' + k, c.k]); } }); });
  return cols.concat([['src', 'Source']]);
}
function qSrcText(x) { var pg = doc.pages[x.pi]; return pageTitle(pg, x.pi) + (x.sec ? ' ' + textOf(x.sec.type === 'step' ? x.sec.title : x.sec.html) : ''); }
function qSorted(b, recs) {
  var sp = qSortSpec(b); if (!sp.by) return recs;
  var key = function (r) {
    if (sp.by === 'src') return { s: qSrcText(r.x) };
    if (sp.by === 'txt') return qSortKey(r.html);
    if (sp.by === 'done') return { n: r.done ? 1 : 0 };
    var k = sp.by.slice(2); for (var i = 0; i < r.cells.length; i++) if (r.cells[i].k.toLowerCase() === k) return qSortKey(r.cells[i].v);
    return null;
  };
  var withK = recs.map(function (r, i) { return { r: r, k: key(r), i: i }; });
  withK.sort(function (x, y) {
    var c = qCompare(x.k, y.k); if (!x.k || !y.k) return c || x.i - y.i;   // les vides restent à la fin, dans les deux sens
    return (sp.dir === 'desc' ? -c : c) || x.i - y.i;
  });
  return withK.map(function (x) { return x.r; });
}
function qBox(r) {
  // case cochable depuis la requête (sauf dans l'export statique) : coche la vraie case dans sa liste
  var lab = r.done ? 'Décocher' : 'Cocher';
  return staticRender ? '<span class="q-box" aria-label="' + (r.done ? 'cochée' : 'non cochée') + '">' + (r.done ? '☑' : '☐') + '</span>'
    : '<button type="button" class="q-box" data-qchk="' + esc(doc.pages[r.x.pi].id + '|' + r.x.blk.id + '|' + r.path) + '" aria-pressed="' + r.done + '" title="' + lab + ' (dans sa liste d’origine)">' + (r.done ? '☑' : '☐') + '</button>';
}
function qTh(b, key, label) {
  // en-tête de tableau : un clic trie (enregistré en édition, pour la lecture en cours seulement en lecture)
  var sp = qSortSpec(b), on = sp.by === key;
  if (staticRender) return '<th>' + esc(label) + '</th>';
  return '<th><button type="button" class="q-th" data-qsort="' + esc(key) + '" title="Trier">' + esc(label) + (on ? '<span class="q-dir">' + (sp.dir === 'desc' ? ' ↓' : ' ↑') + '</span>' : '') + '</button></th>';
}
function queryResult(b, pi, e) {
  var recs = queryRecords(b, pi), src = b.src || 'facts', view = b.view || 'table';
  if (view === 'count') return qCards(b, pi, e, recs);
  if (!recs.length) return '<p class="muted q-empty">Aucun résultat.</p>';
  recs = qSorted(b, recs);
  var total = recs.length, lim = Math.max(0, +b.limit || 0);
  if (lim && recs.length > lim) recs = recs.slice(0, lim);
  var more = recs.length < total ? '<p class="muted q-more">' + recs.length + ' premiers résultats sur ' + total + '</p>' : '';
  var val = function (c) { var h = R(c.v); return c.alert ? '<span class="alert">' + h + '</span>' : h; };
  var item = function (r) { return (r.par ? '<span class="q-par">' + esc(r.par) + ' › </span>' : '') + R(r.html); };
  if (src === 'check') {
    if (view === 'list') return '<ul class="q-list q-checks">' + recs.map(function (r) { return '<li' + (r.done ? ' class="done"' : '') + '>' + qBox(r) + '<span class="q-it">' + item(r) + '</span>' + qSource(r.x) + '</li>'; }).join('') + '</ul>' + more;
    return '<div class="tablewrap"><table class="q-table"><thead><tr>' + qTh(b, 'done', '✓') + qTh(b, 'txt', 'Élément') + qTh(b, 'src', 'Source') + '</tr></thead><tbody>' +
      recs.map(function (r) { return '<tr' + (r.done ? ' class="done"' : '') + '><td class="q-boxc">' + qBox(r) + '</td><td>' + item(r) + '</td><td>' + qSource(r.x) + '</td></tr>'; }).join('') + '</tbody></table></div>' + more;
  }
  // fiches de faits et lignes de tableaux : colonnes réunies par nom, dans l'ordre d'apparition
  var cols = [], ck = {};
  recs.forEach(function (r) { r.cells.forEach(function (c) { var k = c.k.toLowerCase(); if (!(k in ck)) { ck[k] = cols.length; cols.push(c.k); } }); });
  var cellsOf = function (r) { var o = []; r.cells.forEach(function (c) { var k = ck[c.k.toLowerCase()]; if (o[k] == null) o[k] = c; }); return o; };
  if (view === 'list') {
    return '<ul class="q-list">' + recs.map(function (r) {
      var parts = cellsOf(r).map(function (c, j) { return c && !isBlank(c.v) ? '<span class="q-kv"><span class="q-k">' + esc(cols[j]) + '</span> ' + val(c) + '</span>' : ''; }).filter(Boolean);
      return '<li>' + qSource(r.x) + '<span class="q-kvs">' + (parts.join('') || '<span class="muted">—</span>') + '</span></li>';
    }).join('') + '</ul>' + more;
  }
  return '<div class="tablewrap"><table class="q-table"><thead><tr>' + cols.map(function (c) { return qTh(b, 'c:' + c.toLowerCase(), c); }).join('') + qTh(b, 'src', 'Source') + '</tr></thead><tbody>' +
    recs.map(function (r) { var o = cellsOf(r); return '<tr>' + cols.map(function (c, j) { return '<td>' + (o[j] ? val(o[j]) : '') + '</td>'; }).join('') + '<td>' + qSource(r.x) + '</td></tr>'; }).join('') + '</tbody></table></div>' + more;
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
  var want = b.tags || [], chips = qChips('q-tag', null, scopeTags(b, doc.cur), want, 'tous les résultats');
  var pageScope = sc === 'here' || /^pg:/.test(sc);
  return '<div class="q-form">' +
    '<label>Chercher <select data-act="set" data-prop="src">' + o('facts', b.src, 'les fiches de faits') + o('table', b.src, 'les lignes de tableaux') + o('check', b.src, 'les cases à cocher') + '</select></label>' +
    (b.src === 'check' ? '<select data-act="set" data-prop="state" title="État des cases">' + o('all', b.state || 'all', 'toutes') + o('done', b.state, 'cochées') + o('todo', b.state, 'non cochées') + '</select>' : '') +
    '<label>dans <select data-act="set" data-prop="scope" class="q-scope">' + scopes + '</select></label>' +
    (pageScope ? '<label class="q-tog"><input type="checkbox" data-qsub' + (b.sub ? ' checked' : '') + '> et ses sous-pages</label>' : '') +
    '<div class="q-tags"><span class="q-lbl">' + (b.view === 'count' ? 'Parmi ceux qui ont les pastilles' : 'Avec les pastilles') + '</span>' + chips +
    (want.length > 1 ? '<select data-act="set" data-prop="match" title="Combinaison des pastilles">' + o('any', b.match || 'any', 'au moins une') + o('all', b.match, 'toutes') + '</select>' : '') +
    (want.length ? '' : '<span class="muted q-hint">(aucune choisie : tout est retenu)</span>') + '</div>' +
    '<label>Afficher <select data-act="set" data-prop="view">' + o('table', b.view, 'en tableau') + o('list', b.view, 'en liste') + o('count', b.view, 'le nombre') + '</select></label>' +
    (b.view !== 'count' ? '<label>trier par <select data-act="set" data-prop="sortBy">' + o('', b.sortBy || '', 'ordre du document') +
      qSortOptions(b, queryRecords(b, doc.cur)).map(function (x) { return o(x[0], b.sortBy || '', esc(x[1])); }).join('') + '</select></label>' +
      (b.sortBy ? '<select data-act="set" data-prop="sortDir" title="Sens du tri">' + o('asc', b.sortDir || 'asc', 'croissant') + o('desc', b.sortDir, 'décroissant') + '</select>' : '') +
      '<label>limiter à <select data-act="set" data-prop="limit">' + [0, 3, 5, 10, 20, 50, 100].map(function (n) { return o(n, +b.limit || 0, n ? n + ' résultats' : 'tous'); }).join('') + '</select></label>' : '') +
    '</div>';
}
