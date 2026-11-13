/* ---------- Bloc requête ---------- */
// Recherche dans le document, sans syntaxe : les fiches de faits, les lignes de tableaux ou les cases à cocher
// d'une portée (document, page, page et sous-pages, section), filtrées par pastilles ; vue tableau, liste ou nombre.
var Q_SRC = { facts: ['Fiches de faits', 'fiche', 'fiches'], table: ['Lignes de tableaux', 'ligne', 'lignes'], check: ['Cases à cocher', 'case', 'cases'], kanban: ['Cartes de kanban', 'carte', 'cartes'] };
function pillKeys(html) {
  // noms des pastilles d'un texte enrichi
  var out = [];
  eachPill(html, function (inner) { var k = tagKey(htmlText(inner)); if (k && out.indexOf(k) < 0) out.push(k); });   // eachPill : 05-migrations.js
  return out;
}
function eachText(blocks, fn) {
  // parcourt les textes des blocs (sans les images, le code ni les identifiants), sans rien modifier
  (function walk(o) {
    if (Array.isArray(o)) { o.forEach(function (v) { if (typeof v === 'string') fn(v); else if (v && typeof v === 'object') walk(v); }); return; }
    for (var k in o) { if (MIG_SKIP[k]) continue; var v = o[k]; if (typeof v === 'string') { if (v.indexOf('pill') >= 0) fn(v); } else if (v && typeof v === 'object') walk(v); }
  })(blocks);
}
function docTags(d) {
  // pastilles utilisées dans le document : [{ key, name }] dans l'ordre d'apparition (nom tel qu'écrit la première fois)
  var seen = {}, out = [];
  d.pages.forEach(function (pg) {
    eachText(pg.blocks, function (s) {
      eachPill(s, function (inner) { var name = htmlText(inner).replace(/\s+/g, ' ').trim(), k = tagKey(name); if (k && !seen[k]) { seen[k] = 1; out.push({ key: k, name: name }); } });
    });
  });
  return out;
}
function knownTagColor(d, key) { var t = d.tags && d.tags[key]; return t ? t.c : null; }   // couleur du registre, sans y inscrire le nom
function tagUsage(d) {
  // noms du registre : [{ key, name, n, pages: [{ pi, title }] }] ; n compte les pastilles des textes (exceptions comprises) ;
  // le nom est celui du texte, sinon celui vu au rendu pendant la session, sinon la clé
  var by = {}, out = [];
  for (var k in d.tags || {}) { by[k] = { key: k, name: seenTagName(k), n: 0, pages: [] }; out.push(by[k]); }
  docTags(d).forEach(function (t) { if (by[t.key]) by[t.key].name = t.name; });
  d.pages.forEach(function (pg, pi) {
    eachText(pg.blocks, function (s) {
      eachPill(s, function (inner) {
        var u = by[tagKey(htmlText(inner))]; if (!u) return;
        u.n++; if (!u.pages.length || u.pages[u.pages.length - 1].pi !== pi) u.pages.push({ pi: pi, title: pageTitle(pg, pi) });
      });
    });
  });
  return out.sort(function (a, c) { return a.name.localeCompare(c.name, 'fr', { sensitivity: 'base' }); });
}
function sansAccents(s) { return tagKey(s).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }   // comparaison sans casse ni accents
function pastillesProposees(d, saisie) {
  // liste de la pastille au clavier : [{ nom, cle, couleur, creer? }] ; préfixe avant sous-chaîne, puis apparitions, puis
  // alphabet ; 8 lignes au plus, dont la ligne « Créer » si aucun nom n'est identique (en tête si aucun ne correspond)
  var s = sansAccents(saisie), cle = tagKey(saisie), egal = false;
  var l = tagUsage(d).map(function (t) { var i = sansAccents(t.name).indexOf(s); if (t.key === cle) egal = true; return { t: t, p: i === 0 ? 0 : 1, i: i }; })
    .filter(function (x) { return x.i >= 0; })
    .sort(function (a, b) { return a.p - b.p || b.t.n - a.t.n || a.t.name.localeCompare(b.t.name, 'fr', { sensitivity: 'base' }); })
    .map(function (x) { return { nom: x.t.name, cle: x.t.key, couleur: knownTagColor(d, x.t.key) }; });
  if (!cle || egal) return l.slice(0, 8);
  return l.slice(0, 7).concat([{ nom: String(saisie).replace(/\s+/g, ' ').trim(), cle: cle, couleur: nextTagColor(d.tags || {}), creer: true }]);
}
function queryBlocks(b, d, pi) {
  // blocs de la portée, vue depuis la page pi : [{ blk, pi, sec }] (sec : titre de section qui contient le bloc, ou null)
  var pages = d.pages, s = b.scope || 'doc', m, list = [], from = 0, to = 0, region = null;
  if (s === 'doc') { from = 0; to = pages.length; }
  else if (s === 'here' || (m = s.match(/^pg:(.+)$/))) { var p = s === 'here' ? pi : pageIndex(pages, m[1]); if (p < 0) return []; from = p; to = b.sub ? pageEnd(pages, p) : p + 1; }
  else if ((m = s.match(/^sec:([^/]+)\/(.+)$/))) {
    var sp = pageIndex(pages, m[1]); if (sp < 0) return [];
    var bl = pages[sp].blocks, hi = -1; for (var k = 0; k < bl.length; k++) if (bl[k].id === m[2]) hi = k;
    if (hi < 0) return [];
    var hl = foldLevel(bl[hi]), end = hi + 1; while (end < bl.length) { var l = foldLevel(bl[end]); if (l >= 0 && l <= hl) break; end++; }
    from = sp; to = sp + 1; region = [hi, end];
  } else return [];
  for (var i = from; i < to; i++) {
    var sec = null;
    // blocs d'un groupe compris : ils appartiennent à la section du groupe (j : position du bloc ou de son groupe)
    blocsDe(pages[i].blocks, function (x, liste, k, parent) {
      var j = parent ? pages[i].blocks.indexOf(parent) : k;
      if (!parent) { if (foldLevel(x) > 0) sec = x; else if (foldLevel(x) === 0) sec = null; }
      if (region && (j < region[0] || j >= region[1])) return;
      if (x !== b) list.push({ blk: x, pi: i, sec: sec });
    });
  }
  return list;
}
function queryRecords(b, d, pi, noTags) {
  var recs = [];
  queryBlocks(b, d, pi).forEach(function (x) {
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
    } else if (b.src === 'kanban' && bl.type === 'kanban') {
      (bl.cols || []).forEach(function (c, ci) {
        (c.cards || []).forEach(function (k) {
          recs.push({ x: x, kb: k, late: kbLate(k.due, ci === bl.cols.length - 1), due: String(k.due || ''), prio: KB_PRIO[k.prio] ? k.prio : '', who: tagKey(k.who || ''), col: tagKey(c.title || ''), colName: String(c.title || '').trim() || 'Colonne ' + (ci + 1), tags: pillKeys((k.title || '') + ' ' + (k.html || '')),
            cells: [{ k: 'Titre', v: k.title }, { k: 'Colonne', v: esc(c.title || '') }, { k: 'Priorité', v: KB_PRIO[k.prio] ? k.prio.toUpperCase() : '' }, { k: 'Échéance', v: k.due ? kbDate(k.due) : '' }, { k: 'Responsable', v: esc(k.who || '') }] });
        });
      });
    } else if ((b.src || 'facts') === 'facts' && bl.type === 'facts') {
      recs.push({ x: x, cells: bl.items.map(function (it) { return { k: String(it.k || '').trim() || 'Clé', v: it.v, alert: it.alert }; }), tags: pillKeys(bl.items.map(function (it) { return it.v; }).join(' ')) });
    }
  });
  // kanban : une colonne, un responsable, une priorité, une échéance
  if (b.src === 'kanban' && b.col) recs = recs.filter(function (r) { return r.col === b.col; });
  if (b.src === 'kanban') recs = recs.filter(qKbKeep(b));
  // cases à cocher : toutes, cochées ou non cochées
  if (b.src === 'check' && (b.state === 'done' || b.state === 'todo')) recs = recs.filter(function (r) { return b.state === 'done' ? r.done : !r.done; });
  var want = noTags ? [] : b.tags || [];
  if (want.length) recs = recs.filter(function (r) { return b.match === 'all' ? want.every(function (t) { return r.tags.indexOf(t) >= 0; }) : want.some(function (t) { return r.tags.indexOf(t) >= 0; }); });
  return recs;
}
function filterRecs(recs, tags, match, state, col) {
  // pastilles (au moins une / toutes) et, pour les cases à cocher, état (cochées / non cochées)
  tags = tags || [];
  return recs.filter(function (r) {
    if (state === 'done' && !r.done) return false;
    if (state === 'todo' && r.done) return false;
    if (col && r.col !== col) return false;
    if (!tags.length) return true;
    return match === 'all' ? tags.every(function (t) { return r.tags.indexOf(t) >= 0; }) : tags.some(function (t) { return r.tags.indexOf(t) >= 0; });
  });
}
// Filtres des cartes de kanban : responsable (kbWho : clé du nom, « - » sans responsable), priorité (kbPrio : p1, p2,
// p3, p12 pour P1 ou P2, « - » sans priorité) et échéance (kbDue, avec kbDueN et kbDueU pour « dans les N jours /
// semaines / mois ») ; une échéance dépassée ne compte pas dans la dernière colonne (« terminé »), comme sur le kanban
var Q_DUE = [['', 'toutes les échéances'], ['late', 'échéance dépassée'], ['today', 'échéance aujourd’hui'], ['next', 'échéance dans les…'],
  ['soon', 'dépassée ou dans les…'], ['after', 'échéance au-delà de…'], ['set', 'avec une échéance'], ['none', 'sans échéance']];
function qKbKeep(b) {
  var who = b.kbWho || '', pr = b.kbPrio || '', due = b.kbDue || '', n = Math.max(1, Math.min(999, Math.round(+b.kbDueN) || 7)), u = b.kbDueU || 'j';
  var today = kbToday(), lim = kbToday(n, u);
  return function (r) {
    if (who && (who === '-' ? r.who : r.who !== who)) return false;
    if (pr && (pr === '-' ? r.prio : pr === 'p12' ? r.prio !== 'p1' && r.prio !== 'p2' : r.prio !== pr)) return false;
    if (!due) return true;
    var d = r.due, next = !!d && d >= today && d <= lim;
    return due === 'late' ? r.late : due === 'today' ? d === today : due === 'next' ? next : due === 'soon' ? r.late || next
      : due === 'after' ? !!d && d > lim : due === 'set' ? !!d : !d;
  };
}
function qKbWhos(b, d, pi) {
  // responsables des cartes de la portée : [{ key, name }] dans l'ordre d'apparition
  var seen = {}, out = [];
  queryBlocks(b, d, pi).forEach(function (x) {
    if (x.blk.type !== 'kanban') return;
    (x.blk.cols || []).forEach(function (c) { (c.cards || []).forEach(function (k) { var n = String(k.who || '').replace(/\s+/g, ' ').trim(), key = tagKey(n); if (key && !seen[key]) { seen[key] = 1; out.push({ key: key, name: n }); } }); });
  });
  return out.sort(function (a, c) { return a.name.localeCompare(c.name, 'fr', { sensitivity: 'base' }); });
}
function qKbForm(b, d, pi) {
  var o = function (v, cur, label) { return '<option value="' + esc(v) + '"' + (String(cur || '') === String(v) ? ' selected' : '') + '>' + label + '</option>'; };
  var whos = qKbWhos(b, d, pi), w = b.kbWho || '';
  if (w && w !== '-' && !whos.some(function (x) { return x.key === w; })) whos.push({ key: w, name: w });
  var due = b.kbDue || '', withN = due === 'next' || due === 'soon' || due === 'after';
  return '<select data-act="set" data-prop="kbWho" title="Responsable des cartes">' + o('', w, 'tous les responsables') + whos.map(function (x) { return o(x.key, w, 'responsable : ' + esc(x.name)); }).join('') + o('-', w, 'sans responsable') + '</select>' +
    '<select data-act="set" data-prop="kbPrio" title="Priorité des cartes">' + o('', b.kbPrio, 'toutes les priorités') + o('p1', b.kbPrio, 'priorité P1') + o('p2', b.kbPrio, 'priorité P2') + o('p3', b.kbPrio, 'priorité P3') + o('p12', b.kbPrio, 'priorité P1 ou P2') + o('-', b.kbPrio, 'sans priorité') + '</select>' +
    '<select data-act="set" data-prop="kbDue" title="Échéance des cartes">' + Q_DUE.map(function (x) { return o(x[0], due, x[1]); }).join('') + '</select>' +
    (withN ? '<input type="number" class="q-num" data-prop="kbDueN" min="1" max="999" value="' + (Math.max(1, Math.round(+b.kbDueN) || 7)) + '" title="Nombre de jours, de semaines ou de mois">' +
      '<select data-act="set" data-prop="kbDueU" title="Unité">' + o('j', b.kbDueU || 'j', 'jours') + o('s', b.kbDueU, 'semaines') + o('m', b.kbDueU, 'mois') + '</select>' : '');
}
function scopeTags(b, d, pi, recs) {
  // pastilles présentes dans les éléments cherchés de la portée (fiches, lignes ou cases), dans l'ordre du document
  var names = {}, out = [];
  docTags(d).forEach(function (t) { names[t.key] = t.name; });
  (recs || queryRecords(b, d, pi, true)).forEach(function (r) { r.tags.forEach(function (k) { if (out.indexOf(k) < 0) out.push(k); }); });
  return out.map(function (k) { return { key: k, name: names[k] || k }; });
}
function kbColumns(b, d, pi) {
  // colonnes des kanbans de la portée (vides comprises) : [{ key, name }] dans l'ordre d'apparition
  var seen = {}, out = [];
  queryBlocks(b, d, pi).forEach(function (x) {
    if (x.blk.type !== 'kanban') return;
    (x.blk.cols || []).forEach(function (c, ci) { var k = tagKey(c.title || ''); if (!seen[k]) { seen[k] = 1; out.push({ key: k, name: String(c.title || '').trim() || 'Colonne ' + (ci + 1) }); } });
  });
  return out;
}
function qColSel(b, prop, cur, cols) {
  var o = function (v, label) { return '<option value="' + esc(v) + '"' + ((cur || '') === v ? ' selected' : '') + '>' + label + '</option>'; };
  var list = cols.slice(); if (cur && !list.some(function (x) { return x.key === cur; })) list.push({ key: cur, name: cur });
  return '<select data-act="set" data-prop="' + prop + '" title="Colonne du kanban">' + o('', 'toutes les colonnes') + list.map(function (x) { return o(x.key, 'en « ' + esc(x.name) + ' »'); }).join('') + '</select>';
}
function qChips(d, act, i, avail, want, title) {
  // pastilles cliquables d'un filtre ; une pastille choisie mais absente de la portée reste affichée (barrée)
  // la couleur est lue au registre sans y inscrire le nom : hors registre, la puce reste grise
  var list = avail.slice();
  (want || []).forEach(function (k) { if (!list.some(function (t) { return t.key === k; })) list.push({ key: k, name: k, gone: true }); });
  if (!list.length) return '<span class="muted q-hint">Aucune pastille ici.</span>';
  return list.map(function (t) {
    var on = (want || []).indexOf(t.key) >= 0, c = knownTagColor(d, t.key);
    var gone = t.gone ? (c == null ? 'Absente du document · ' : 'Absente de la portée choisie · ') : '';
    return '<button type="button" class="pill' + (c == null ? '' : ' pa-' + c) + ' q-chip' + (t.gone ? ' q-gone' : '') + '" data-act="' + act + '"' + (i != null ? ' data-i="' + i + '"' : '') + ' data-tag="' + esc(t.key) + '" aria-pressed="' + on + '" title="' + gone + (on ? 'Retirer de ' : 'Ajouter à ') + title + '">' + esc(t.name) + '</button>';
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
  var src = b.src || 'facts', base = src === 'check' ? (c.state === 'done' ? 'cases cochées' : c.state === 'todo' ? 'cases à cocher restantes' : 'cases à cocher') : src === 'table' ? 'lignes de tableaux' : src === 'kanban' ? 'cartes' + (c.col ? ' en ' + (names['\u0000col:' + c.col] || c.col) : '') : 'fiches de faits';
  var t = (c.tags || []).map(function (k) { return names[k] || k; });
  return base + (t.length ? ' · ' + t.join(c.match === 'all' ? ' + ' : ' ou ') : '');
}
function qCards(b, d, ctx, recs) {
  var pi = ctx.page, e = ctx.edit;
  // vue nombre : une carte par compteur, à la suite ; chaque carte compte les résultats du bloc qui ont ses
  // propres pastilles (et, pour les cases, leur état), éventuellement rapportés à un total
  var names = {}; docTags(d).forEach(function (t) { names[t.key] = t.name; });
  var avail = e ? scopeTags(b, d, pi, recs) : null, cards = b.cards && b.cards.length ? b.cards : [qDefCard(b)], chk = b.src === 'check', kbc = b.src === 'kanban' ? kbColumns(b, d, pi) : [];
  kbc.forEach(function (x) { names['\u0000col:' + x.key] = x.name; });
  var o = function (v, cur, label) { return '<option value="' + v + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + label + '</option>'; };
  var stSel = function (p, cur) { if (kbc.length || b.src === 'kanban') return qColSel(b, p.replace(/state$/, 'col'), (function () { var m = p.match(/^cards\.(\d+)\.(t?)state$/); return m ? cards[+m[1]][m[2] + 'col'] : ''; })(), kbc); return chk ? '<select data-act="set" data-prop="' + p + '">' + o('all', cur || 'all', 'toutes') + o('done', cur, 'cochées') + o('todo', cur, 'non cochées') + '</select>' : ''; };
  return '<div class="q-cards">' + cards.map(function (c, i) {
    var num = filterRecs(recs, c.tags, c.match, c.state, c.col).length;
    var tot = c.total === 'all' ? recs.length : c.total === 'filter' ? filterRecs(recs, c.ttags, c.tmatch, c.tstate, c.tcol).length : null;
    var pc = tot ? Math.min(100, Math.round(num * 100 / tot)) : 0, def = qCardLabel(b, c, names);
    var lab = e ? '<span class="fld q-lab" contenteditable="true" spellcheck="true" data-b="' + b.id + '" data-k="cards.' + i + '.label" data-nl data-ph="' + esc(def) + '">' + esc(c.label || '') + '</span>'
      : '<span class="q-lab">' + esc(String(c.label || '').trim() || def) + '</span>';
    var form = !e ? '' : '<div class="q-cform">' +
      '<div class="q-row"><span class="q-lbl">Compter</span>' + stSel('cards.' + i + '.state', c.state) + qChips(d, 'q-ctag', i, avail, c.tags, 'cette carte') +
      ((c.tags || []).length > 1 ? '<select data-act="set" data-prop="cards.' + i + '.match">' + o('any', c.match || 'any', 'au moins une') + o('all', c.match, 'toutes') + '</select>' : '') + '</div>' +
      '<div class="q-row"><span class="q-lbl">sur</span><select data-act="set" data-prop="cards.' + i + '.total">' + o('none', c.total || 'none', 'rien (nombre seul)') + o('all', c.total, 'tous les résultats') + o('filter', c.total, 'un autre filtre…') + '</select>' +
      (c.total === 'filter' ? stSel('cards.' + i + '.tstate', c.tstate) + qChips(d, 'q-ttag', i, avail, c.ttags, 'ce total') +
        ((c.ttags || []).length > 1 ? '<select data-act="set" data-prop="cards.' + i + '.tmatch">' + o('any', c.tmatch || 'any', 'au moins une') + o('all', c.tmatch, 'toutes') + '</select>' : '') : '') + '</div>' +
      (cards.length > 1 ? '<button type="button" class="q-cdel" data-act="q-card-del" data-i="' + i + '" title="Supprimer cette carte">×</button>' : '') + '</div>';
    var href = qScopeHref(b), tag = href && !e ? 'a' : 'div';
    return '<' + tag + ' class="q-count' + (href ? ' q-linked' : '') + '"' + (tag === 'a' ? ' href="' + esc(href) + '" title="Ouvrir la page ou la section concernée"' : '') + '><b>' + num + (tot != null ? '<small> / ' + tot + '</small>' : '') + '</b>' + lab +
      (href && e ? '<a class="q-go" href="' + esc(href) + '" title="Ouvrir la page ou la section concernée">↗</a>' : '') +
      (tot != null ? '<div class="q-bar" role="progressbar" aria-valuenow="' + pc + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pc + '%"></i></div>' : '') + form + '</' + tag + '>';
  }).join('') + (e ? '<button type="button" class="q-cadd" data-act="q-card-add" title="Ajouter une carte de nombre">+ Carte</button>' : '') + '</div>';
}
function qSource(d, x) {
  var pg = d.pages[x.pi], t = pageTitle(pg, x.pi), st = x.sec ? textOf(x.sec.type === 'step' ? x.sec.title : x.sec.html) : '';
  return '<a class="q-src" href="#pg-' + esc(pg.id) + (x.sec ? '/' + esc(x.sec.id) : '') + '">' + esc(t) + (st ? ' › ' + esc(st) : '') + '</a>';
}
var viewSort = {};   // tri choisi en lecture d'un clic sur un en-tête (id du bloc → { by, dir }) : jamais enregistré
var viewFiltre = {};   // filtre des lignes d'un tableau ou d'une requête (id du bloc → texte cherché ; champ ouvert si la clé existe) : jamais enregistré
function ligneCorrespond(cellules, terme) {
  // une ligne correspond si l'une de ses cellules (HTML, pastilles comprises) contient le terme, sans casse ni accents
  var t = sansAccents(terme); if (!t) return true;
  return cellules.some(function (c) { return sansAccents(textOf(c)).indexOf(t) >= 0; });
}
function lignesAffichees(lignes, terme, connues, gardees) {
  // affichée : correspond, ou ajoutée depuis le dernier changement du terme (absente de connues), ou gardée (focus pendant la saisie)
  return lignes.map(function (l) { return connues.indexOf(l) < 0 || gardees.indexOf(l) >= 0 || ligneCorrespond(l, terme); });
}
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
function qSortSpec(b, ctx) { var v = ctx.sort[b.id]; return v || { by: b.sortBy || '', dir: b.sortDir || 'asc' }; }   // tri de session : vue 'read' seulement
function qSortOptions(b, recs) {
  // choix de tri : colonnes (fiches, lignes) ou élément / état (cases), et source
  if ((b.src || 'facts') === 'check') return [['txt', 'Élément'], ['done', 'État (cochées)'], ['src', 'Source']];
  var cols = [], seen = {};
  recs.forEach(function (r) { r.cells.forEach(function (c) { var k = c.k.toLowerCase(); if (!seen[k]) { seen[k] = 1; cols.push(['c:' + k, c.k]); } }); });
  return cols.concat([['src', 'Source']]);
}
function qSrcText(d, x) { var pg = d.pages[x.pi]; return pageTitle(pg, x.pi) + (x.sec ? ' ' + textOf(x.sec.type === 'step' ? x.sec.title : x.sec.html) : ''); }
function qSorted(b, d, ctx, recs) {
  var sp = qSortSpec(b, ctx); if (!sp.by) return recs;
  var key = function (r) {
    if (sp.by === 'src') return { s: qSrcText(d, r.x) };
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
function qBox(d, ctx, r) {
  // case cochable depuis la requête (sauf dans l'export statique) : coche la vraie case dans sa liste
  var lab = r.done ? 'Décocher' : 'Cocher';
  return ctx.static ? '<span class="q-box" aria-label="' + (r.done ? 'cochée' : 'non cochée') + '">' + (r.done ? '☑' : '☐') + '</span>'
    : '<button type="button" class="q-box" data-qchk="' + esc(d.pages[r.x.pi].id + '|' + r.x.blk.id + '|' + r.path) + '" aria-pressed="' + r.done + '" title="' + lab + ' (dans sa liste d’origine)">' + (r.done ? '☑' : '☐') + '</button>';
}
function qTh(b, ctx, key, label) {
  // en-tête de tableau : un clic trie (enregistré en édition, pour la lecture en cours seulement en lecture)
  var sp = qSortSpec(b, ctx), on = sp.by === key;
  if (ctx.static) return '<th>' + esc(label) + '</th>';
  return '<th><button type="button" class="q-th" data-qsort="' + esc(key) + '" title="Trier">' + esc(label) + (on ? '<span class="q-dir">' + (sp.dir === 'desc' ? ' ↓' : ' ↑') + '</span>' : '') + '</button></th>';
}
function qKanban(b, d, ctx, recs) {
  var pi = ctx.page;
  // résultats regroupés en colonnes : colonne du kanban, état des cases, ou valeur d'une colonne choisie
  var src = b.src || 'facts', groups = [], gi = {};
  var add = function (key, name, r) { if (!(key in gi)) { gi[key] = groups.length; groups.push({ name: name, recs: [] }); } if (r) groups[gi[key]].recs.push(r); };
  var gb = src === 'check' || src === 'kanban' ? '' : (b.groupBy || (qSortOptions(b, recs)[0] || [''])[0]);
  if (src === 'check') { add('0', 'Non cochées'); add('1', 'Cochées'); }
  if (src === 'kanban') kbColumns(b, d, pi).forEach(function (c) { if (!b.col || c.key === b.col) add(c.key, c.name); });   // colonnes vides comprises
  recs.forEach(function (r) {
    if (src === 'kanban') return add(r.col, r.colName, r);
    if (src === 'check') return add(r.done ? '1' : '0', '', r);
    var c = null; for (var i = 0; i < r.cells.length; i++) if ('c:' + r.cells[i].k.toLowerCase() === gb) c = r.cells[i];
    var t = c ? htmlText(c.v).replace(/\s+/g, ' ').trim() : ''; add(t.toLowerCase(), t || '(vide)', r);
  });
  var card = function (r) {
    if (src === 'kanban') { var k = r.kb; return '<article class="kb-card' + (r.prio ? ' prio-' + r.prio : '') + '"><div class="kb-ct">' + R(k.title) + '</div>' + (isBlank(k.html) ? '' : '<div class="kb-tx">' + R(k.html) + '</div>') +
      (k.due || k.who || r.prio ? '<div class="kb-meta">' + kbPrio(r.prio) + (k.due ? '<span class="kb-due' + (r.late ? ' late' : '') + '">' + esc(kbDate(k.due, true)) + '</span>' : '') + kbWho(k.who) + '</div>' : '') + qSource(d, r.x) + '</article>'; }
    if (src === 'check') return '<article class="kb-card' + (r.done ? ' done' : '') + '"><div class="q-it">' + qBox(d, ctx, r) + ' ' + (r.par ? '<span class="q-par">' + esc(r.par) + ' › </span>' : '') + R(r.html) + '</div>' + qSource(d, r.x) + '</article>';
    return '<article class="kb-card"><div class="q-kvs">' + r.cells.filter(function (c) { return 'c:' + c.k.toLowerCase() !== gb && !isBlank(c.v); }).map(function (c) { return '<span class="q-kv"><span class="q-k">' + esc(c.k) + '</span> ' + R(c.v) + '</span>'; }).join('') + '</div>' + qSource(d, r.x) + '</article>';
  };
  return '<div class="kb kb-q"><div class="kb-cols">' + groups.map(function (g) {
    return '<section class="kb-col"><div class="kb-head"><span class="kb-title">' + esc(g.name) + '</span><span class="kb-n">' + g.recs.length + '</span></div><div class="kb-list">' + (g.recs.map(card).join('') || '<p class="kb-empty">—</p>') + '</div></section>';
  }).join('') + '</div></div>';
}
function queryResult(b, d, ctx) {
  // résultats du bloc requête b, rendu dans la page ctx.page du document d
  ctx = renderCtx(d, ctx);
  var recs = queryRecords(b, d, ctx.page), src = b.src || 'facts', view = b.view || 'table';
  if (view === 'count') return qCards(b, d, ctx, recs);
  if (!recs.length) return '<p class="muted q-empty">Aucun résultat.</p>';
  recs = qSorted(b, d, ctx, recs);
  if (view === 'kanban') return qKanban(b, d, ctx, recs);
  var total = recs.length, lim = Math.max(0, +b.limit || 0);
  if (lim && recs.length > lim) recs = recs.slice(0, lim);
  var more = recs.length < total ? '<p class="muted q-more">' + recs.length + ' premiers résultats sur ' + total + '</p>' : '';
  var val = function (c) { var h = R(c.v); return c.alert ? '<span class="alert">' + h + '</span>' : h; };
  var item = function (r) { return (r.par ? '<span class="q-par">' + esc(r.par) + ' › </span>' : '') + R(r.html); };
  if (src === 'check') {
    if (view === 'list') return '<ul class="q-list q-checks">' + recs.map(function (r) { return '<li' + (r.done ? ' class="done"' : '') + '>' + qBox(d, ctx, r) + '<span class="q-it">' + item(r) + '</span>' + qSource(d, r.x) + '</li>'; }).join('') + '</ul>' + more;
    return '<div class="tablewrap"><table class="q-table"><thead><tr>' + qTh(b, ctx, 'done', '✓') + qTh(b, ctx, 'txt', 'Élément') + qTh(b, ctx, 'src', 'Source') + '</tr></thead><tbody>' +
      recs.map(function (r) { return '<tr' + (r.done ? ' class="done"' : '') + '><td class="q-boxc">' + qBox(d, ctx, r) + '</td><td>' + item(r) + '</td><td>' + qSource(d, r.x) + '</td></tr>'; }).join('') + '</tbody></table></div>' + more;
  }
  // fiches de faits et lignes de tableaux : colonnes réunies par nom, dans l'ordre d'apparition
  var cols = [], ck = {};
  recs.forEach(function (r) { r.cells.forEach(function (c) { var k = c.k.toLowerCase(); if (!(k in ck)) { ck[k] = cols.length; cols.push(c.k); } }); });
  var cellsOf = function (r) { var o = []; r.cells.forEach(function (c) { var k = ck[c.k.toLowerCase()]; if (o[k] == null) o[k] = c; }); return o; };
  if (view === 'list') {
    return '<ul class="q-list">' + recs.map(function (r) {
      var parts = cellsOf(r).map(function (c, j) { return c && !isBlank(c.v) ? '<span class="q-kv"><span class="q-k">' + esc(cols[j]) + '</span> ' + val(c) + '</span>' : ''; }).filter(Boolean);
      return '<li>' + qSource(d, r.x) + '<span class="q-kvs">' + (parts.join('') || '<span class="muted">—</span>') + '</span></li>';
    }).join('') + '</ul>' + more;
  }
  return '<div class="tablewrap"><table class="q-table"><thead><tr>' + cols.map(function (c) { return qTh(b, ctx, 'c:' + c.toLowerCase(), c); }).join('') + qTh(b, ctx, 'src', 'Source') + '</tr></thead><tbody>' +
    recs.map(function (r) { var o = cellsOf(r); return '<tr>' + cols.map(function (c, j) { return '<td>' + (o[j] ? val(o[j]) : '') + '</td>'; }).join('') + '<td>' + qSource(d, r.x) + '</td></tr>'; }).join('') + '</tbody></table></div>' + more;
}
function queryForm(b, d, ctx) {
  var pi = ctx.page;
  // formulaire de la requête (édition)
  var o = function (v, cur, label, extra) { return '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? ' selected' : '') + (extra || '') + '>' + label + '</option>'; };
  var sc = b.scope || 'doc', scopes = o('doc', sc, 'Tout le document') + o('here', sc, 'Cette page');
  d.pages.forEach(function (pg, i) {
    var pad = new Array(pageLv(d.pages, i) + 1).join('   ');
    scopes += o('pg:' + pg.id, sc, pad + 'Page « ' + esc(pageTitle(pg, i)) + ' »');
    sectionsOf(pg).forEach(function (x) { scopes += o('sec:' + pg.id + '/' + x.id, sc, pad + '   ' + (x.lv > 1 ? '   ' : '') + '§ ' + esc((x.n ? x.n + ' · ' : '') + x.t)); });
  });
  var want = b.tags || [], chips = qChips(d, 'q-tag', null, scopeTags(b, d, pi), want, 'tous les résultats');
  var pageScope = sc === 'here' || /^pg:/.test(sc);
  return '<div class="q-form">' +
    '<label>Chercher <select data-act="set" data-prop="src">' + o('facts', b.src, 'les fiches de faits') + o('table', b.src, 'les lignes de tableaux') + o('check', b.src, 'les cases à cocher') + o('kanban', b.src, 'les cartes de kanban') + '</select></label>' +
    (b.src === 'kanban' ? qColSel(b, 'col', b.col, kbColumns(b, d, pi)) + qKbForm(b, d, pi) : '') +
    (b.src === 'check' ? '<select data-act="set" data-prop="state" title="État des cases">' + o('all', b.state || 'all', 'toutes') + o('done', b.state, 'cochées') + o('todo', b.state, 'non cochées') + '</select>' : '') +
    '<label>dans <select data-act="set" data-prop="scope" class="q-scope">' + scopes + '</select></label>' +
    (pageScope ? '<label class="q-tog"><input type="checkbox" data-qsub' + (b.sub ? ' checked' : '') + '> et ses sous-pages</label>' : '') +
    '<div class="q-tags"><span class="q-lbl">' + (b.view === 'count' ? 'Parmi ceux qui ont les pastilles' : 'Avec les pastilles') + '</span>' + chips +
    (want.length > 1 ? '<select data-act="set" data-prop="match" title="Combinaison des pastilles">' + o('any', b.match || 'any', 'au moins une') + o('all', b.match, 'toutes') + '</select>' : '') +
    (want.length ? '' : '<span class="muted q-hint">(aucune choisie : tout est retenu)</span>') + '</div>' +
    '<label>Afficher <select data-act="set" data-prop="view">' + o('table', b.view, 'en tableau') + o('list', b.view, 'en liste') + o('kanban', b.view, 'en colonnes') + o('count', b.view, 'le nombre') + '</select></label>' +
    (b.view === 'kanban' && b.src !== 'check' && b.src !== 'kanban' ? '<label>regroupées par <select data-act="set" data-prop="groupBy">' + qSortOptions(b, queryRecords(b, d, pi)).filter(function (x) { return x[0] !== 'src'; }).map(function (x, n) { return o(x[0], b.groupBy || (n === 0 ? x[0] : ''), esc(x[1])); }).join('') + '</select></label>' : '') +
    (b.view !== 'count' ? '<label>trier par <select data-act="set" data-prop="sortBy">' + o('', b.sortBy || '', 'ordre du document') +
      qSortOptions(b, queryRecords(b, d, pi)).map(function (x) { return o(x[0], b.sortBy || '', esc(x[1])); }).join('') + '</select></label>' +
      (b.sortBy ? '<select data-act="set" data-prop="sortDir" title="Sens du tri">' + o('asc', b.sortDir || 'asc', 'croissant') + o('desc', b.sortDir, 'décroissant') + '</select>' : '') +
      (b.view === 'kanban' ? '' : '<label>limiter à <select data-act="set" data-prop="limit">' + [0, 3, 5, 10, 20, 50, 100].map(function (n) { return o(n, +b.limit || 0, n ? n + ' résultats' : 'tous'); }).join('') + '</select></label>') : '') +
    '</div>';
}
