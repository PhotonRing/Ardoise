/* ---------- Bloc requête ---------- */
// Recherche dans le document, sans syntaxe : les fiches de faits, les lignes de tableaux ou les cases à cocher
// d'une portée (document, page, page et sous-pages, section), filtrées par pastilles ; vue tableau, liste ou nombre.
var Q_SRC = { facts: ['Fiches de faits', 'fiche', 'fiches'], table: ['Lignes de tableaux', 'ligne', 'lignes'], check: ['Cases à cocher', 'case', 'cases'], kanban: ['Cartes de kanban', 'carte', 'cartes'], diamond: ['Modèles diamant', 'modèle', 'modèles'] };
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
      var index = kbCards(bl);   // dépendances : index des cartes calculé une fois par kanban (07-kanban.js)
      (bl.cols || []).forEach(function (c, ci) {
        (c.cards || []).forEach(function (k) {
          var dp = kbDeps(bl, k.id, index);
          recs.push({ x: x, kb: k, bloquee: dp.blocked, attend: dp.waits, late: kbLate(k.due, ci === bl.cols.length - 1), due: String(k.due || ''), prio: KB_PRIO[k.prio] ? k.prio : '', who: tagKey(k.who || ''), col: tagKey(c.title || ''), colName: String(c.title || '').trim() || 'Colonne ' + (ci + 1), tags: pillKeys((k.title || '') + ' ' + (k.html || '')),
            cells: [{ k: 'Titre', v: k.title }, { k: 'Colonne', v: esc(c.title || '') }, { k: 'Priorité', v: KB_PRIO[k.prio] ? k.prio.toUpperCase() : '' }, { k: 'Échéance', v: k.due ? kbDate(k.due) : '' }, { k: 'Responsable', v: esc(k.who || '') }] });
        });
      });
    } else if ((b.src || 'facts') === 'facts' && bl.type === 'facts') {
      recs.push({ x: x, cells: bl.items.map(function (it) { return { k: String(it.k || '').trim() || 'Clé', v: it.v, alert: it.alert }; }), tags: pillKeys(bl.items.map(function (it) { return it.v; }).join(' ')) });
    } else if (b.src === 'diamond' && bl.type === 'diamond') {
      // un résultat par modèle diamant : titre puis sommets (DIA_SOMMETS : 03-types-de-blocs.js) ; pastilles de tous les champs
      var dc = [{ k: 'Titre', v: bl.title }].concat(DIA_SOMMETS.map(function (s) { return { k: s.nom, v: bl[s.cle] }; }));
      recs.push({ x: x, cells: dc, tags: pillKeys(dc.map(function (c) { return c.v || ''; }).join(' ')) });
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
    if (b.bloquees && !r.bloquee) return false;   // « Bloquées » : une carte attendue n'est pas dans la dernière colonne
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
  var src = b.src || 'facts', base = src === 'check' ? (c.state === 'done' ? 'cases cochées' : c.state === 'todo' ? 'cases à cocher restantes' : 'cases à cocher') : src === 'table' ? 'lignes de tableaux' : src === 'kanban' ? 'cartes' + (c.col ? ' en ' + (names['\u0000col:' + c.col] || c.col) : '') : src === 'diamond' ? 'modèles diamant' : 'fiches de faits';
  var t = (c.tags || []).map(function (k) { return names[k] || k; });
  return base + (t.length ? ' · ' + t.join(c.match === 'all' ? ' + ' : ' ou ') : '');
}
// compteurs de la vue nombre : { num, tot (null sans total), def (texte par défaut), label (texte affiché) } par carte (partagé avec l'export Office)
function qCompteurs(b, d, pi, recs) {
  var names = {}; docTags(d).forEach(function (t) { names[t.key] = t.name; });
  if (b.src === 'kanban') kbColumns(b, d, pi).forEach(function (x) { names['\u0000col:' + x.key] = x.name; });
  return (b.cards && b.cards.length ? b.cards : [qDefCard(b)]).map(function (c) {
    var tot = c.total === 'all' ? recs.length : c.total === 'filter' ? filterRecs(recs, c.ttags, c.tmatch, c.tstate, c.tcol).length : null, def = qCardLabel(b, c, names);
    return { num: filterRecs(recs, c.tags, c.match, c.state, c.col).length, tot: tot, def: def, label: String(c.label || '').trim() || def };
  });
}
function qCards(b, d, ctx, recs) {
  var pi = ctx.page, e = ctx.edit;
  // vue nombre : une carte par compteur, à la suite ; chaque carte compte les résultats du bloc qui ont ses
  // propres pastilles (et, pour les cases, leur état), éventuellement rapportés à un total
  var avail = e ? scopeTags(b, d, pi, recs) : null, cards = b.cards && b.cards.length ? b.cards : [qDefCard(b)], chk = b.src === 'check', kbc = b.src === 'kanban' ? kbColumns(b, d, pi) : [];
  var compteurs = qCompteurs(b, d, pi, recs);
  var o = function (v, cur, label) { return '<option value="' + v + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + label + '</option>'; };
  var stSel = function (p, cur) { if (kbc.length || b.src === 'kanban') return qColSel(b, p.replace(/state$/, 'col'), (function () { var m = p.match(/^cards\.(\d+)\.(t?)state$/); return m ? cards[+m[1]][m[2] + 'col'] : ''; })(), kbc); return chk ? '<select data-act="set" data-prop="' + p + '">' + o('all', cur || 'all', 'toutes') + o('done', cur, 'cochées') + o('todo', cur, 'non cochées') + '</select>' : ''; };
  return '<div class="q-cards">' + cards.map(function (c, i) {
    var cpt = compteurs[i], num = cpt.num, tot = cpt.tot, def = cpt.def;
    var pc = tot ? Math.min(100, Math.round(num * 100 / tot)) : 0;
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
  // lien vers la section du résultat ; un modèle diamant, ancré (id b-<id>, 07-rendu.js), est visé lui-même
  var pg = d.pages[x.pi], t = pageTitle(pg, x.pi), st = x.sec ? textOf(x.sec.type === 'step' ? x.sec.title : x.sec.html) : '';
  var cible = x.blk && x.blk.type === 'diamond' ? x.blk.id : x.sec ? x.sec.id : '';
  return '<a class="q-src" href="#pg-' + esc(pg.id) + (cible ? '/' + esc(cible) : '') + '">' + esc(t) + (st ? ' › ' + esc(st) : '') + '</a>';
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
// nombre d'un texte, pour le tri comme pour la colonne N : espaces de milliers, ou points de milliers devant une virgule
// décimale (1.234,5), virgule ou point décimal, unité courte (4 h, 12 %, 3 €) ; null si ce n'est pas un nombre
function qLireNombre(t) {
  var m = String(t).replace(/[\s\u00a0\u202f]+/g, '').match(/^([-+]?)(\d{1,3}(?:\.\d{3})+,\d+|\d+(?:[.,]\d+)?)[%€$a-zA-Z]{0,4}$/);
  if (!m) return null;
  var n = +(/,/.test(m[2]) && /\./.test(m[2]) ? m[2].replace(/\./g, '') : m[2]).replace(',', '.');
  return m[1] === '-' ? -n : n;
}
function qSortKey(v) {
  // valeur de tri : nombre, date (jj/mm/aaaa, aaaa-mm-jj) ou texte ; vide : toujours à la fin
  var t = htmlText(v).replace(/\s+/g, ' ').trim(), m;
  if (!t) return null;
  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})/))) return { d: Date.UTC(+m[1], +m[2] - 1, +m[3]) };
  if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) return { d: Date.UTC(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]) };
  var n = qLireNombre(t);
  return n != null ? { n: n } : { s: t };
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
    if (sp.by === 'att') return qAttendTexte(r) ? { s: qAttendTexte(r) } : null;
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
// résultats regroupés en colonnes : colonne du kanban, état des cases, ou valeur d'une colonne choisie (gb) ; partagé avec l'export Office
function qRegroupements(b, d, pi, recs) {
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
  return { groups: groups, gb: gb };
}
function qKanban(b, d, ctx, recs) {
  var src = b.src || 'facts', qg = qRegroupements(b, d, ctx.page, recs), groups = qg.groups, gb = qg.gb;
  var cc = src === 'kanban' ? null : qColonnesAffichees(b, recs), cols = cc ? cc.cols : [];
  var card = function (r) {
    if (src === 'kanban') return qCarteKanban(b, d, r);
    // carte des autres sources : colonnes choisies dans leur ordre (Source à sa place), sans la colonne de regroupement
    // les valeurs voisines (case et élément, ou paires clé valeur) vont dans un même conteneur ; Source le coupe là où elle est rangée
    var o = cc.cellsOf(r), kvs = [], parts = [], boite = src === 'check' ? 'q-it' : 'q-kvs';
    var fin = function () { if (kvs.length) parts.push('<div class="' + boite + '">' + kvs.join(src === 'check' ? ' ' : '') + '</div>'); kvs = []; };
    cols.forEach(function (c) {
      if (c.source) { fin(); parts.push(qSource(d, r.x)); }
      else if (c.coche) kvs.push(qBox(d, ctx, r));
      else if (c.element) kvs.push((r.par ? '<span class="q-par">' + esc(r.par) + ' › </span>' : '') + R(r.html));
      else if (o[c.j] && 'c:' + c.nom.toLowerCase() !== gb && !isBlank(o[c.j].v)) kvs.push('<span class="q-kv"><span class="q-k">' + esc(c.nom) + '</span> ' + R(o[c.j].v) + '</span>');
    });
    fin();
    return '<article class="kb-card' + (r.done ? ' done' : '') + '">' + parts.join('') + '</article>';
  };
  return '<div class="kb kb-q"><div class="kb-cols">' + groups.map(function (g) {
    return '<section class="kb-col"><div class="kb-head"><span class="kb-title">' + esc(g.name) + '</span><span class="kb-n">' + g.recs.length + '</span></div><div class="kb-list">' + (g.recs.map(card).join('') || '<p class="kb-empty">—</p>') + '</div></section>';
  }).join('') + '</div></div>';
}
// Champs des cartes d'une requête en vue kanban (champ champs : { masques, ordre }) ; absent = champs d'avant, sans « Attend ».
// Le titre est toujours affiché ; l'ordre et le masquage suivent la règle du choix des colonnes (mode « Toutes sauf… »).
var Q_CHAMPS = [{ cle: 'texte', nom: 'Texte' }, { cle: 'priorite', nom: 'Priorité' }, { cle: 'echeance', nom: 'Échéance' }, { cle: 'responsable', nom: 'Responsable' }, { cle: 'source', nom: 'Source' }, { cle: 'attend', nom: 'Attend' }];
function qChampsReglage(b) {
  var ch = b.champs || {};
  return { colonnes: { mode: 'sauf', noms: Array.isArray(ch.masques) ? ch.masques : b.champs ? [] : ['attend'], ordre: Array.isArray(ch.ordre) ? ch.ordre : [] } };
}
function qChampsRanges(b) { return qColonnesRangees(qChampsReglage(b), Q_CHAMPS); }
function qChampVisible(b, cle) { return qColonneVisible(qChampsReglage(b), cle); }
function qChampsAffiches(b) { return qColonnesChoisies(qChampsReglage(b), Q_CHAMPS); }
// gestes : nouveau champ champs, d'après les gestes du choix des colonnes
function qChampsNeuf(c) { return { masques: c.noms, ordre: c.ordre }; }
function qChampBasculer(b, cle) { return qChampsNeuf(qColBasculer(qChampsReglage(b), Q_CHAMPS, cle)); }
function qChampDeplacer(b, cle, vers) { return qChampsNeuf(qColDeplacer(qChampsReglage(b), Q_CHAMPS, cle, vers)); }
function qCarteKanban(b, d, r) {
  // titre, puis les champs choisis dans leur ordre ; priorité, échéance et responsable voisins partagent une ligne
  // « Attend » sans lien de défilement : la carte attendue n'est pas toujours sur la page de la requête
  var k = r.kb, parts = ['<div class="kb-ct">' + R(k.title) + '</div>'], meta = [];
  var fin = function () { if (meta.length) parts.push('<div class="kb-meta">' + meta.join('') + '</div>'); meta = []; };
  qChampsAffiches(b).forEach(function (c) {
    if (c.cle === 'priorite') meta.push(kbPrio(r.prio));
    else if (c.cle === 'echeance') { if (k.due) meta.push('<span class="kb-due' + (r.late ? ' late' : '') + '">' + esc(kbDate(k.due, true)) + '</span>'); }
    else if (c.cle === 'responsable') meta.push(kbWho(k.who));
    else {
      fin();
      if (c.cle === 'texte' && !isBlank(k.html)) parts.push('<div class="kb-tx">' + R(k.html) + '</div>');
      else if (c.cle === 'attend') parts.push(kbAttendHtml(r.x.blk, r.attend, r.bloquee, true));
      else if (c.cle === 'source') parts.push(qSource(d, r.x));
    }
    meta = meta.filter(Boolean);
  });
  fin();
  return '<article class="kb-card' + (r.prio ? ' prio-' + r.prio : '') + (r.bloquee ? ' kb-blocked' : '') + '">' + parts.join('') + '</article>';
}
function qAttendTexte(r) { return (r.attend || []).map(kbCardTitle).join(', '); }   // colonne « Attend » : titres des cartes attendues
// colonnes réunies par nom, dans l'ordre d'apparition, et cellules d'un résultat rangées par colonne (partagé avec l'export Office)
function qColonnes(recs) {
  var cols = [], ck = {};
  recs.forEach(function (r) { r.cells.forEach(function (c) { var k = c.k.toLowerCase(); if (!(k in ck)) { ck[k] = cols.length; cols.push(c.k); } }); });
  return { cols: cols, cellsOf: function (r) { var o = []; r.cells.forEach(function (c) { var k = ck[c.k.toLowerCase()]; if (o[k] == null) o[k] = c; }); return o; } };
}
// Choix des colonnes (champ colonnes : { mode : 'toutes' | 'sauf' | 'seulement', noms, ordre }) ; absent = toutes. Clé d'une colonne :
// son nom sans casse ni espaces superflus, « Source » a la clé réservée '#source' ; une clé inconnue est ignorée (colonne disparue ou renommée)
var Q_SOURCE = '#source', Q_ATTEND = '#attend';
function qCleCol(nom) { return tagKey(nom); }
// réglage en vigueur : sans choix, une requête sur les cartes de kanban masque « Attend » (affichée en la cochant)
function qColReglage(b) { return b.colonnes || (b.src === 'kanban' ? { mode: 'sauf', noms: [Q_ATTEND], ordre: [] } : {}); }
function qColonneVisible(b, cle) {
  var ch = qColReglage(b), noms = Array.isArray(ch.noms) ? ch.noms : [];
  return ch.mode === 'sauf' ? noms.indexOf(cle) < 0 : ch.mode === 'seulement' ? noms.indexOf(cle) >= 0 : true;
}
function qColonnesRangees(b, dispo) {
  // dispo : [{ cle, nom… }] dans l'ordre d'apparition → les mêmes, celles de ordre d'abord, puis les autres dans leur ordre
  var ch = qColReglage(b), ordre = Array.isArray(ch.ordre) ? ch.ordre : [], out = [];
  ordre.forEach(function (k) { dispo.forEach(function (c) { if (c.cle === k && out.indexOf(c) < 0) out.push(c); }); });
  return out.concat(dispo.filter(function (c) { return out.indexOf(c) < 0; }));
}
function qColonnesChoisies(b, dispo) { return qColonnesRangees(b, dispo).filter(function (c) { return qColonneVisible(b, c.cle); }); }
// colonnes disponibles d'une requête (cases à cocher : ✓, Élément, Source ; sinon colonnes réunies, Attend pour les cartes de kanban, puis Source) et cellules d'un résultat ;
// en vue liste (hors cases), Source reste en tête tant qu'elle n'a pas été déplacée (partagé avec le formulaire et l'export Office)
function qColonnesDispo(b, recs, liste) {
  var src = { cle: Q_SOURCE, nom: 'Source', source: true };
  if ((b.src || 'facts') === 'check') return { dispo: [{ cle: '✓', nom: '✓', coche: true }, { cle: 'élément', nom: 'Élément', element: true }, src], cellsOf: function () { return []; } };
  var cc = qColonnes(recs), dispo = cc.cols.map(function (n, j) { return { cle: qCleCol(n), nom: n, j: j }; });
  if (b.src === 'kanban') dispo.push({ cle: Q_ATTEND, nom: 'Attend', attend: true });
  return { dispo: liste && !qColSourceBougee(b) ? [src].concat(dispo) : dispo.concat([src]), cellsOf: cc.cellsOf };
}
// Source n'entre dans ordre que si l'auteur l'a déplacée elle-même ; sinon, en tête de dispo (vue liste), elle y reste
function qColSourceBougee(b) { var ch = qColReglage(b); return Array.isArray(ch.ordre) && ch.ordre.indexOf(Q_SOURCE) >= 0; }
function qColPlacees(b, dispo) {
  var tete = dispo[0] && dispo[0].cle === Q_SOURCE && !qColSourceBougee(b) ? dispo[0] : null, r = qColonnesRangees(b, tete ? dispo.slice(1) : dispo);
  return tete ? [tete].concat(r) : r;
}
function qColonnesAffichees(b, recs, liste) {
  var x = qColonnesDispo(b, recs, liste);
  return { cols: qColPlacees(b, x.dispo).filter(function (c) { return qColonneVisible(b, c.cle); }), cellsOf: x.cellsOf };
}
// gestes du choix des colonnes : nouveau champ colonnes d'après les colonnes disponibles (dispo de qColonnesDispo, hors liste) ;
// les clés qui n'y sont plus sont purgées ; le premier choix part de « Toutes sauf… »
function qColNeuf(dispo, mode, noms, ordre) {
  var la = function (k) { return dispo.some(function (c) { return c.cle === k; }); };
  return { mode: mode, noms: noms.filter(la), ordre: ordre.filter(la) };
}
function qColActuel(b) { var ch = qColReglage(b); return { mode: ch.mode === 'sauf' || ch.mode === 'seulement' ? ch.mode : 'toutes', noms: (ch.noms || []).slice(), ordre: (ch.ordre || []).slice() }; }
function qColBasculer(b, dispo, cle) {
  var ch = qColActuel(b), at = ch.noms.indexOf(cle);
  if (ch.mode === 'toutes') return qColNeuf(dispo, 'sauf', [cle], ch.ordre);
  if (at >= 0) ch.noms.splice(at, 1); else ch.noms.push(cle);
  return qColNeuf(dispo, ch.mode, ch.noms, ch.ordre);
}
function qColMode(b, dispo, mode) {
  // « Seulement… » garde les colonnes visibles, « Toutes sauf… » masque les cachées : le résultat ne change pas au changement de mode
  var ch = qColActuel(b), rangees = qColonnesRangees(b, dispo);
  var noms = mode === 'toutes' ? [] : rangees.filter(function (c) { return qColonneVisible(b, c.cle) === (mode === 'seulement'); }).map(function (c) { return c.cle; });
  return qColNeuf(dispo, mode, noms, ch.ordre);
}
function qColDeplacer(b, dispo, cle, vers) {
  // dispo dans l'ordre du réglage (vers : position dans ce réglage) ; Source reste hors de ordre si l'on déplace une autre colonne
  var ch = qColActuel(b), cles = qColPlacees(b, dispo).map(function (c) { return c.cle; }), at = cles.indexOf(cle);
  if (at < 0) return qColNeuf(dispo, ch.mode, ch.noms, ch.ordre);
  cles.splice(at, 1); cles.splice(Math.max(0, Math.min(cles.length, vers)), 0, cle);
  if (cle !== Q_SOURCE && !qColSourceBougee(b)) cles = cles.filter(function (k) { return k !== Q_SOURCE; });
  return qColNeuf(dispo, ch.mode, ch.noms, cles);
}
function qRegBasculerY(b, recs, cle) {
  // nouvelle liste regY : la colonne cochée ou décochée, dans l'ordre des colonnes disponibles, clés inconnues purgées
  var rg = qRegReglage(b, recs), ys = rg.ys.slice(), at = ys.indexOf(cle);
  if (at >= 0) ys.splice(at, 1); else ys.push(cle);
  return rg.dispo.map(function (c) { return c.cle; }).filter(function (k) { return ys.indexOf(k) >= 0 && k !== rg.x; });
}
function qColTri(c) { return c.source ? 'src' : c.coche ? 'done' : c.element ? 'txt' : c.attend ? 'att' : 'c:' + c.nom.toLowerCase(); }   // clé de tri d'une colonne
// Regroupement (vue « Regroupée », réutilisé par la carte de chaleur) : un groupe par valeur unique de la colonne X, valeurs uniques des colonnes Y.
// Valeurs comparées sans casse ni espaces superflus ; une cellule faite seulement de pastilles donne une valeur par pastille (comparée par son nom)
function qValeursCellule(html) {
  var h = String(html || ''), out = [], vu = {};
  var ajout = function (cle, v) { if (cle && !vu[cle]) { vu[cle] = 1; out.push({ cle: cle, html: v }); } };
  if (!htmlText(h.replace(PILL_RE, '')).replace(/[\s ​,;]+/g, '') && PILL_RE.test(h)) {
    PILL_RE.lastIndex = 0;
    h.replace(PILL_RE, function (m, cls, attrs, inner) { ajout(tagKey(htmlText(inner)), m); return m; });
    return out;
  }
  PILL_RE.lastIndex = 0;
  ajout(tagKey(htmlText(h)), h.trim());
  return out;
}
function qRegrouper(recs, cleX, clesY) {
  // → [{ cle, valeur (HTML de la première apparition), vide, n, lignes, uniques: { cléY: [HTML] } }] dans l'ordre de première apparition
  var groupes = [], gi = {};
  var cellule = function (r, cle) { for (var i = 0; i < r.cells.length; i++) if (qCleCol(r.cells[i].k) === cle) return r.cells[i].v; return ''; };
  recs.forEach(function (r) {
    var vx = cellule(r, cleX), cle = tagKey(htmlText(vx)), g;
    if (!(('$' + cle) in gi)) {
      gi['$' + cle] = groupes.length;
      g = { cle: cle, valeur: cle ? String(vx).trim() : '(vide)', vide: !cle, n: 0, lignes: [], uniques: {}, vus: {} };
      clesY.forEach(function (y) { g.uniques[y] = []; g.vus[y] = {}; });
      groupes.push(g);
    }
    g = groupes[gi['$' + cle]]; g.n++; g.lignes.push(r);
    clesY.forEach(function (y) { qValeursCellule(cellule(r, y)).forEach(function (v) { if (!g.vus[y][v.cle]) { g.vus[y][v.cle] = 1; g.uniques[y].push(v.html); } }); });
  });
  groupes.forEach(function (g) { delete g.vus; });
  return groupes;
}
function qGroupesTries(groupes, by, dir) {
  // by : '' (première apparition), 'c:<colonne X>' (valeur, les vides à la fin) ou '#n' (nombre de lignes)
  if (!by) return groupes;
  var k = function (g) { return by === '#n' ? { n: g.n } : g.vide ? null : qSortKey(g.valeur); };
  return groupes.map(function (g, i) { return { g: g, k: k(g), i: i }; }).sort(function (x, y) {
    var c = qCompare(x.k, y.k); if (!x.k || !y.k) return c || x.i - y.i;
    return (dir === 'desc' ? -c : c) || x.i - y.i;
  }).map(function (x) { return x.g; });
}
function qRegReglage(b, recs) {
  // colonnes X et Y retenues (clés connues seulement) ; X absent : première colonne disponible
  var dispo = qColonnesDispo(b, recs).dispo.filter(function (c) { return !c.source; }), la = function (k) { return dispo.some(function (c) { return c.cle === k; }); };
  var x = la(b.regX) ? b.regX : (dispo[0] ? dispo[0].cle : ''), nom = function (k) { for (var i = 0; i < dispo.length; i++) if (dispo[i].cle === k) return dispo[i].nom; return k; };
  var ys = (Array.isArray(b.regY) ? b.regY : []).filter(function (k, i, a) { return la(k) && k !== x && a.indexOf(k) === i; });
  return { x: x, ys: ys, nom: nom, dispo: dispo };
}
// tri des groupes : sur X ou sur le nombre de lignes ; un autre tri (resté de la vue tableau) ne joue pas : « Sans tri »
function qRegTriDe(sp, rg) { return sp.by === '#n' || (sp.by.slice(0, 2) === 'c:' && qCleCol(sp.by.slice(2)) === rg.x) ? sp : { by: '', dir: 'asc' }; }
function qRegTri(b, ctx, rg) { return qRegTriDe(qSortSpec(b, ctx), rg); }
// tri réglé dans le bloc qui joue vraiment (puce et fenêtre du tri)
function qTriBloc(b, d, pi) { var sp = { by: b.sortBy || '', dir: b.sortDir === 'desc' ? 'desc' : 'asc' }; return qVue(b) === 'regroupee' ? qRegTriDe(sp, qRegReglage(b, queryRecords(b, d, pi))) : sp; }
function qRegSources(d, g) {
  // liens vers les lignes réunies : une entrée par source distincte, avec le nombre de lignes qui en viennent
  var vu = [], n = {};
  g.lignes.forEach(function (r) { var h = qSource(d, r.x); if (!(h in n)) { n[h] = 0; vu.push(h); } n[h]++; });
  return '<details class="q-reg-src"><summary>' + g.n + (g.n > 1 ? ' lignes' : ' ligne') + '</summary><ul>' + vu.map(function (h) { return '<li>' + h + (n[h] > 1 ? ' <span class="muted">× ' + n[h] + '</span>' : '') + '</li>'; }).join('') + '</ul></details>';
}
function qRegroupee(b, d, ctx, recs) {
  var rg = qRegReglage(b, recs), sp = qRegTri(b, ctx, rg), groupes = qGroupesTries(qRegrouper(recs, rg.x, rg.ys), sp.by, sp.dir);
  var total = groupes.length, lim = Math.max(0, +b.limit || 0);
  if (lim && groupes.length > lim) groupes = groupes.slice(0, lim);
  var more = groupes.length < total ? '<p class="muted q-more">' + groupes.length + ' premiers groupes sur ' + total + '</p>' : '';
  var titre = function (g) { return g.vide ? '<span class="muted">(vide)</span>' : R(g.valeur); };
  var uniques = function (g, y) { return g.uniques[y].map(R).join(', '); };
  if (b.regForme === 'tableau') return '<div class="tablewrap"><table class="q-reg-table"><thead><tr>' + qTh(b, ctx, 'c:' + rg.x, rg.nom(rg.x)) +
    rg.ys.map(function (y) { return '<th>' + esc(rg.nom(y)) + '</th>'; }).join('') + qTh(b, ctx, '#n', 'Lignes') + '</tr></thead><tbody>' +
    groupes.map(function (g) { return '<tr><td>' + titre(g) + '</td>' + rg.ys.map(function (y) { return '<td>' + uniques(g, y) + '</td>'; }).join('') + '<td class="q-reg-n">' + qRegSources(d, g) + '</td></tr>'; }).join('') + '</tbody></table></div>' + more;
  return '<div class="q-reg">' + groupes.map(function (g) {
    return '<section class="q-reg-f"><h4 class="q-reg-t">' + titre(g) + '<span class="kb-n">' + g.n + '</span></h4>' +
      (rg.ys.length ? '<dl class="facts">' + rg.ys.map(function (y) { return '<div class="fact"><dt>' + esc(rg.nom(y)) + '</dt><dd>' + uniques(g, y) + '</dd></div>'; }).join('') + '</dl>' : '') + qRegSources(d, g) + '</section>';
  }).join('') + '</div>' + more;
}
// Carte de chaleur (vue « Carte de chaleur ») : une colonne par valeur de X, une case par valeur de Y, des sous-cases par valeur de Z ;
// X, Y et Z comparés sur la cellule entière (qRegrouper), total = somme de la colonne N (nombre de lignes sans N) ; une seule échelle pour cases et sous-cases
var Q_CH_PALIERS = [6, 16, 28, 42, 100];   // part de la couleur d'accent de chaque palier, en % (page.css : .q-ch-p0 à .q-ch-p4)
// nombre d'une cellule (lu comme pour le tri) ; une valeur non numérique compte 0
function qNombre(html) { var n = qLireNombre(htmlText(String(html || ''))); return n == null ? 0 : n; }
function qNombreFr(n) { return String(Math.round(n * 100) / 100).replace('.', ','); }
function qChReglage(b, recs) {
  // colonnes X, Y, Z (facultative) et N (facultative) retenues, clés connues seulement ; X absent : première colonne, Y absent : la suivante
  var dispo = qColonnesDispo(b, recs).dispo.filter(function (c) { return !c.source; }), la = function (k) { return dispo.some(function (c) { return c.cle === k; }); };
  var nom = function (k) { for (var i = 0; i < dispo.length; i++) if (dispo[i].cle === k) return dispo[i].nom; return k; };
  var x = la(b.chX) ? b.chX : (dispo[0] ? dispo[0].cle : '');
  var autre = dispo.filter(function (c) { return c.cle !== x; })[0];
  var y = la(b.chY) && b.chY !== x ? b.chY : (autre ? autre.cle : '');
  var z = la(b.chZ) && b.chZ !== x && b.chZ !== y ? b.chZ : '';
  var n = la(b.chN) ? b.chN : '';
  return { x: x, y: y, z: z, n: n, nom: nom, dispo: dispo };
}
function qChaleur(recs, x, y, z, n) {
  // → { colonnes: [{ cle, valeur, vide, total, lignes, cases: [{ cle, valeur, vide, total, lignes, sous: [mêmes champs] }] }], min, max }
  var vals = [];
  var total = function (lignes) {
    if (!n) return lignes.length;
    return lignes.reduce(function (s, r) { for (var i = 0; i < r.cells.length; i++) if (qCleCol(r.cells[i].k) === n) return s + qNombre(r.cells[i].v); return s; }, 0);
  };
  var noeud = function (g) { return { cle: g.cle, valeur: g.valeur, vide: g.vide, total: total(g.lignes), lignes: g.lignes }; };
  var colonnes = qRegrouper(recs, x, []).map(function (g) {
    var col = noeud(g);
    col.cases = qRegrouper(g.lignes, y, []).map(function (gc) {
      var c = noeud(gc); vals.push(c.total);
      c.sous = z ? qRegrouper(gc.lignes, z, []).filter(function (gs) { return !gs.vide; }).map(function (gs) { var s = noeud(gs); vals.push(s.total); return s; }) : [];
      return c;
    });
    return col;
  });
  return { colonnes: colonnes, min: vals.length ? Math.min.apply(null, vals) : 0, max: vals.length ? Math.max.apply(null, vals) : 0 };
}
function qChPalier(total, min, max) { return max > min ? Math.min(4, Math.floor((total - min) / (max - min) * 5)) : 4; }
function qChaleurVue(b, d, ctx, recs) {
  var ch = qChReglage(b, recs), m = qChaleur(recs, ch.x, ch.y, ch.z, ch.n);
  var nomV = function (g) { return g.vide ? '<span class="muted">(vide)</span>' : R(g.valeur); };
  var bulle = function (g) {
    // lignes de la case : cellules non vides, puis la source ; 20 au plus
    var max = 20, l = g.lignes.slice(0, max).map(function (r) {
      return '<li>' + r.cells.filter(function (c) { return !isBlank(c.v); }).map(function (c) { return '<span class="q-kv"><span class="q-k">' + esc(c.k) + '</span> ' + R(c.v) + '</span>'; }).join(' ') + ' ' + qSource(d, r.x) + '</li>';
    }).join('');
    return '<div class="q-ch-tip" hidden><ul class="q-ch-l">' + l + '</ul>' + (g.lignes.length > max ? '<p class="muted">et ' + (g.lignes.length - max) + ' autres</p>' : '') + '</div>';
  };
  var boite = function (g, cls) {
    return '<div class="' + cls + ' q-ch-p' + qChPalier(g.total, m.min, m.max) + '" tabindex="0"><span class="q-ch-n">' + nomV(g) + '</span> <span class="q-ch-v">' + qNombreFr(g.total) + '</span>' + bulle(g);
  };
  var leg = '<div class="q-ch-leg"><span class="q-ch-lv">' + qNombreFr(m.min) + '</span>' + Q_CH_PALIERS.map(function (p, i) { return '<span class="q-ch-sw q-ch-p' + i + '"></span>'; }).join('') +
    '<span class="q-ch-lv">' + qNombreFr(m.max) + '</span><span class="muted">' + (ch.n ? 'somme de ' + esc(ch.nom(ch.n)) : 'nombre de lignes') + '</span></div>';
  return '<div class="q-ch-wrap"><div class="q-ch">' + m.colonnes.map(function (col) {
    return '<section class="q-ch-col"><h4 class="q-ch-t">' + nomV(col) + '<span class="kb-n">' + qNombreFr(col.total) + '</span></h4>' + col.cases.map(function (c) {
      return boite(c, 'q-ch-c') + (c.sous.length ? '<div class="q-ch-sous">' + c.sous.map(function (s) { return boite(s, 'q-ch-s') + '</div>'; }).join('') + '</div>' : '') + '</div>';
    }).join('') + '</section>';
  }).join('') + '</div></div>' + leg;
}
function queryResult(b, d, ctx) {
  // résultats du bloc requête b, rendu dans la page ctx.page du document d
  ctx = renderCtx(d, ctx);
  var recs = queryRecords(b, d, ctx.page), src = b.src || 'facts', view = b.view || 'table';
  if (view === 'count') return qCards(b, d, ctx, recs);
  if (!recs.length) return '<p class="muted q-empty">Aucun résultat.</p>';
  if (view === 'regroupee' && src === 'table') return qRegroupee(b, d, ctx, recs);   // le tri vise les groupes ; une autre source retombe sur le tableau
  if (view === 'chaleur' && src === 'table') return qChaleurVue(b, d, ctx, recs);   // ordre de première apparition, ni tri ni limite
  recs = qSorted(b, d, ctx, recs);
  if (view === 'kanban') return qKanban(b, d, ctx, recs);
  var total = recs.length, lim = Math.max(0, +b.limit || 0);
  if (lim && recs.length > lim) recs = recs.slice(0, lim);
  var more = recs.length < total ? '<p class="muted q-more">' + recs.length + ' premiers résultats sur ' + total + '</p>' : '';
  var val = function (c) { var h = R(c.v); return c.alert ? '<span class="alert">' + h + '</span>' : h; };
  var item = function (r) { return (r.par ? '<span class="q-par">' + esc(r.par) + ' › </span>' : '') + R(r.html); };
  // colonnes choisies, dans l'ordre choisi ; fiches et lignes : colonnes réunies par nom, dans l'ordre d'apparition
  var cc = qColonnesAffichees(b, recs, view === 'list'), cols = cc.cols, cellsOf = cc.cellsOf;
  if (view === 'list') {
    if (src === 'check') return '<ul class="q-list q-checks">' + recs.map(function (r) {
      return '<li' + (r.done ? ' class="done"' : '') + '>' + cols.map(function (c) { return c.coche ? qBox(d, ctx, r) : c.element ? '<span class="q-it">' + item(r) + '</span>' : qSource(d, r.x); }).join('') + '</li>';
    }).join('') + '</ul>' + more;
    return '<ul class="q-list">' + recs.map(function (r) {
      var o = cellsOf(r), parts = [], kvs = [], vu = false;
      // les valeurs voisines vont dans une même suite ; Source les coupe là où elle est rangée
      var fin = function () { if (kvs.length) parts.push('<span class="q-kvs">' + kvs.join('') + '</span>'); kvs = []; };
      cols.forEach(function (c) { if (c.source) { fin(); parts.push(qSource(d, r.x)); } else if (c.attend) { if (qAttendTexte(r)) { vu = true; kvs.push('<span class="q-kv"><span class="q-k">Attend</span> ' + esc(qAttendTexte(r)) + '</span>'); } } else if (o[c.j] && !isBlank(o[c.j].v)) { vu = true; kvs.push('<span class="q-kv"><span class="q-k">' + esc(c.nom) + '</span> ' + val(o[c.j]) + '</span>'); } });
      fin(); if (!vu) parts.push('<span class="q-kvs"><span class="muted">—</span></span>');
      return '<li>' + parts.join('') + '</li>';
    }).join('') + '</ul>' + more;
  }
  var td = function (c, r, o) { return c.source ? '<td>' + qSource(d, r.x) + '</td>' : c.coche ? '<td class="q-boxc">' + qBox(d, ctx, r) + '</td>' : c.element ? '<td>' + item(r) + '</td>' : c.attend ? '<td>' + esc(qAttendTexte(r)) + '</td>' : '<td>' + (o[c.j] ? val(o[c.j]) : '') + '</td>'; };
  return '<div class="tablewrap"><table class="q-table"><thead><tr>' + cols.map(function (c) { return qTh(b, ctx, qColTri(c), c.nom); }).join('') + '</tr></thead><tbody>' +
    recs.map(function (r) { var o = cellsOf(r); return '<tr' + (r.done ? ' class="done"' : '') + '>' + cols.map(function (c) { return td(c, r, o); }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' + more;
}
// Ligne de puces (édition) : le réglage se lit comme une phrase, chaque puce ouvre sa fenêtre (16-puces-requete.js).
// Un filtre posé est un champ présent ; ne pas le poser veut dire « tous ».
var Q_VUES = { table: 'Tableau', list: 'Liste', kanban: 'En colonnes', count: 'Nombre', regroupee: 'Regroupée', chaleur: 'Carte de chaleur' };
var Q_PRIO = { p1: 'P1', p2: 'P2', p3: 'P3', p12: 'P1 ou P2', '-': 'Sans priorité' };
var Q_UNITE = { j: ['jour', 'jours'], s: ['semaine', 'semaines'], m: ['mois', 'mois'] };
// filtres de chaque source, dans l'ordre de la ligne : [champ, nom dans « + Filtre »]
var Q_FILTRE_TAGS = [['tags', 'Pastilles']];
var Q_FILTRES = { facts: Q_FILTRE_TAGS, table: Q_FILTRE_TAGS, diamond: Q_FILTRE_TAGS, check: Q_FILTRE_TAGS.concat([['state', 'État des cases']]),
  kanban: Q_FILTRE_TAGS.concat([['col', 'Colonne du kanban'], ['kbWho', 'Responsable'], ['kbPrio', 'Priorité'], ['kbDue', 'Échéance'], ['bloquees', 'Bloquées']]) };
// vue rendue : les vues propres aux lignes de tableaux retombent sur le tableau (queryResult)
function qVue(b) { var v = b.view || 'table'; return !Q_VUES[v] || ((v === 'regroupee' || v === 'chaleur') && b.src !== 'table') ? 'table' : v; }
function qFiltrePose(b, prop) {
  var v = b[prop];
  return prop === 'tags' ? Array.isArray(v) && v.length > 0 : prop === 'state' ? v === 'done' || v === 'todo' : !!v;
}
function qFiltresProposes(b) { return (Q_FILTRES[b.src || 'facts'] || Q_FILTRE_TAGS).map(function (f) { return { prop: f[0], nom: f[1], pose: qFiltrePose(b, f[0]) }; }); }
function qDueN(b) { return Math.max(1, Math.min(999, Math.round(+b.kbDueN) || 7)); }
function qDueLibelle(b) {
  var n = qDueN(b), u = Q_UNITE[b.kbDueU] || Q_UNITE.j, dans = n > 1 ? 'dans les ' + n + ' ' + u[1] : 'dans 1 ' + u[0];
  return { late: 'Échéance dépassée', today: 'Échéance aujourd’hui', next: 'Échéance ' + dans, soon: 'Échéance dépassée ou ' + dans,
    after: 'Échéance au-delà de ' + n + ' ' + u[n > 1 ? 1 : 0], set: 'Avec une échéance', none: 'Sans échéance' }[b.kbDue] || String(b.kbDue);
}
function qNomsTags(d) { var noms = {}; docTags(d).forEach(function (t) { noms[t.key] = t.name; }); return noms; }
function qFiltreLibelle(b, d, pi, prop) {
  var nom = function (liste, k) { var x = liste.filter(function (y) { return y.key === k; })[0]; return x ? x.name : k; };
  if (prop === 'tags') { var noms = qNomsTags(d); return b.tags.map(function (k) { return noms[k] || k; }).join(b.match === 'all' ? ' et ' : ' ou '); }
  if (prop === 'state') return b.state === 'done' ? 'Cochées' : 'Non cochées';
  if (prop === 'col') return 'Colonne : ' + nom(kbColumns(b, d, pi), b.col);
  if (prop === 'kbWho') return b.kbWho === '-' ? 'Sans responsable' : 'Responsable : ' + nom(qKbWhos(b, d, pi), b.kbWho);
  if (prop === 'kbPrio') return Q_PRIO[b.kbPrio] || String(b.kbPrio);
  if (prop === 'kbDue') return qDueLibelle(b);
  return 'Bloquées';
}
function qPorteeLibelle(b, d) {
  var sc = b.scope || 'doc', m = String(sc).match(/^(?:pg:(.+)|sec:([^/]+)\/(.+))$/), sub = b.sub && (sc === 'here' || /^pg:/.test(sc)) ? ' et ses sous-pages' : '';
  if (sc === 'here') return 'Cette page' + sub;
  if (!m) return 'Tout le document';
  var pi = -1; d.pages.forEach(function (pg, i) { if (pg.id === (m[1] || m[2])) pi = i; });
  if (pi < 0) return m[1] ? 'Page introuvable' : 'Section introuvable';
  if (m[1]) return 'Page ' + pageTitle(d.pages[pi], pi) + sub;
  var s = sectionsOf(d.pages[pi]).filter(function (x) { return x.id === m[3]; })[0];
  return s ? 'Section ' + (s.n ? s.n + ' · ' : '') + s.t : 'Section introuvable';
}
function qColsLibelle(b, d, pi, v) {
  if (v === 'kanban' && b.src === 'kanban') { var n = qChampsAffiches(b).length; return n ? 'Cartes : ' + n + (n > 1 ? ' champs' : ' champ') : 'Cartes : titre seul'; }
  var recs = queryRecords(b, d, pi), tous = qColonnesDispo(b, recs).dispo.length, vus = qColonnesAffichees(b, recs).cols.length;
  return vus === tous ? 'Toutes les colonnes' : vus + (vus > 1 ? ' colonnes' : ' colonne') + ' sur ' + tous;
}
function qTriLibelle(b, d, pi) {
  var sp = qTriBloc(b, d, pi), by = sp.by; if (!by) return 'Sans tri';
  var nom = by === '#n' ? 'Nombre de lignes' : by === 'att' ? 'Attend' : '';
  if (!nom) qSortOptions(b, queryRecords(b, d, pi)).forEach(function (x) { if (x[0] === by) nom = x[1]; });
  return 'Tri : ' + (nom || by.replace(/^c:/, '')) + (sp.dir === 'desc' ? ' ↓' : ' ↑');
}
// puces de la ligne : [{ cle, quoi, libelle, prop? }] ; cle : src, scope, f:<champ du filtre>, plus, view, cols, sort
function qPuces(b, d, pi) {
  var v = qVue(b), out = [];
  var p = function (cle, quoi, libelle, prop) { var o = { cle: cle, quoi: quoi, libelle: libelle }; if (prop) o.prop = prop; out.push(o); };
  p('src', 'src', (Q_SRC[b.src || 'facts'] || Q_SRC.facts)[0]);
  p('scope', 'scope', qPorteeLibelle(b, d));
  qFiltresProposes(b).forEach(function (f) { if (f.pose) p('f:' + f.prop, 'filtre', qFiltreLibelle(b, d, pi, f.prop), f.prop); });
  p('plus', 'plus', '+ Filtre');
  p('view', 'view', Q_VUES[v]);
  if (v !== 'count' && v !== 'regroupee' && v !== 'chaleur') p('cols', 'cols', qColsLibelle(b, d, pi, v));
  if (v !== 'count' && v !== 'chaleur') p('sort', 'sort', qTriLibelle(b, d, pi));
  return out;
}
var Q_PUCE_TITRES = { src: 'Changer ce que la requête cherche', scope: 'Changer où chercher', filtre: 'Modifier ce filtre', plus: 'Ajouter un filtre', view: 'Changer la vue et ses réglages', cols: 'Choisir les colonnes', sort: 'Changer le tri' };
function qLignePuces(b, d, pi) {
  var pre = { src: 'Chercher', scope: 'dans' }, coul = function (k) { return knownTagColor(d, k); };
  // filtre de pastilles : les pastilles elles-mêmes, dans leur couleur
  var pastilles = function () { var noms = qNomsTags(d); return b.tags.map(function (k) { var c = coul(k); return '<span class="pill' + (c == null ? '' : ' pa-' + c) + '">' + esc(noms[k] || k) + '</span>'; }).join(b.match === 'all' ? ' <small>et</small> ' : ' <small>ou</small> '); };
  return '<div class="q-puces" role="toolbar" aria-label="Réglage de la requête">' + qPuces(b, d, pi).map(function (p) {
    var titre = p.cle === 'cols' && /^Cartes/.test(p.libelle) ? 'Choisir les champs des cartes' : Q_PUCE_TITRES[p.quoi];
    var btn = '<button type="button" class="q-puce' + (p.cle === 'plus' ? ' q-puce-plus' : '') + '" data-qpuce="' + p.cle + '" aria-haspopup="dialog" aria-expanded="false" title="' + titre + '">' +
      (pre[p.cle] ? '<small>' + pre[p.cle] + '</small> ' : '') + (p.prop === 'tags' ? pastilles() : esc(p.libelle)) + '</button>';
    if (p.quoi !== 'filtre') return (p.cle === 'view' ? '<span class="q-puce-sep" aria-hidden="true"></span>' : '') + btn;
    return '<span class="q-puce-f">' + btn + '<button type="button" class="q-puce-x" data-qretirer="' + p.prop + '" title="Retirer ce filtre" aria-label="Retirer le filtre « ' + esc(p.libelle) + ' »">×</button></span>';
  }).join('') + '</div>';
}
// contenu de la fenêtre d'une puce (cle de qPuces) ; gestes : data-qset (choix d'une valeur), data-qfiltre (« + Filtre »),
// select[data-act=set], input.q-num, q-tag, data-qsub et les gestes des colonnes (14-colonnes-requete.js)
function qFenetre(b, d, pi, cle) {
  var src = b.src || 'facts', v = qVue(b), h = function (t) { return '<h4>' + t + '</h4>'; };
  var choix = function (prop, val, cur, label, ic) { return '<button type="button" class="mi" data-qset="' + prop + '" data-v="' + esc(val) + '" aria-pressed="' + (String(cur == null ? '' : cur) === String(val)) + '">' + (ic ? '<span class="ic">' + ic + '</span>' : '') + '<span>' + label + '</span></button>'; };
  var seg = function (prop, cur, opts) { return '<div class="seg">' + opts.map(function (x) { return '<button type="button" data-qset="' + prop + '" data-v="' + x[0] + '" aria-pressed="' + (cur === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>'; };
  var o = function (val, cur, label) { return '<option value="' + esc(val) + '"' + (String(cur) === String(val) ? ' selected' : '') + '>' + label + '</option>'; };
  if (cle === 'src') return h('Chercher') + Object.keys(Q_SRC).map(function (k) { return choix('src', k, src, Q_SRC[k][0]); }).join('');
  if (cle === 'scope') {
    var sc = b.scope || 'doc', scopes = o('doc', sc, 'Tout le document') + o('here', sc, 'Cette page');
    d.pages.forEach(function (pg, i) {
      var pad = new Array(pageLv(d.pages, i) + 1).join('   ');
      scopes += o('pg:' + pg.id, sc, pad + 'Page « ' + esc(pageTitle(pg, i)) + ' »');
      sectionsOf(pg).forEach(function (x) { scopes += o('sec:' + pg.id + '/' + x.id, sc, pad + '   ' + (x.lv > 1 ? '   ' : '') + '§ ' + esc((x.n ? x.n + ' · ' : '') + x.t)); });
    });
    return h('Chercher dans') + '<div class="q-fen-b"><select data-act="set" data-prop="scope" class="q-scope" aria-label="Portée">' + scopes + '</select>' +
      (sc === 'here' || /^pg:/.test(sc) ? '<label class="q-tog"><input type="checkbox" data-qsub' + (b.sub ? ' checked' : '') + '> et ses sous-pages</label>' : '') + '</div>';
  }
  if (cle === 'plus') return h('Ajouter un filtre') + qFiltresProposes(b).map(function (f) {
    return '<button type="button" class="mi" data-qfiltre="' + f.prop + '"><span>' + f.nom + (f.pose ? '<small>déjà là</small>' : f.prop === 'bloquees' ? '<small>Attendent une carte pas finie</small>' : '') + '</span></button>';
  }).join('');
  if (cle === 'f:tags') {
    var want = b.tags || [];
    return h('Pastilles') + '<div class="q-fen-b"><input type="search" class="q-fen-q" placeholder="Rechercher une pastille…" aria-label="Rechercher une pastille">' +
      '<div class="q-fen-pills">' + qChips(d, 'q-tag', null, scopeTags(b, d, pi), want, 'ce filtre') + '</div>' +
      (want.length > 1 ? seg('match', b.match === 'all' ? 'all' : 'any', [['any', 'au moins une'], ['all', 'toutes']]) : '') + '</div>';
  }
  if (cle === 'f:state') return h('État des cases') + choix('state', 'done', b.state, 'Cochées') + choix('state', 'todo', b.state, 'Non cochées');
  if (cle === 'f:col') return h('Colonne du kanban') + kbColumns(b, d, pi).map(function (x) { return choix('col', x.key, b.col, 'En « ' + esc(x.name) + ' »'); }).join('');
  if (cle === 'f:kbWho') return h('Responsable') + qKbWhos(b, d, pi).map(function (x) { return choix('kbWho', x.key, b.kbWho, esc(x.name)); }).join('') + choix('kbWho', '-', b.kbWho, 'Sans responsable');
  if (cle === 'f:kbPrio') return h('Priorité') + ['p1', 'p2', 'p3', 'p12', '-'].map(function (k) { return choix('kbPrio', k, b.kbPrio, Q_PRIO[k]); }).join('');
  if (cle === 'f:kbDue') {
    var due = b.kbDue || '', withN = due === 'next' || due === 'soon' || due === 'after';
    return h('Échéance') + Q_DUE.slice(1).map(function (x) { return choix('kbDue', x[0], due, x[1].charAt(0).toUpperCase() + x[1].slice(1)); }).join('') +
      (withN ? '<div class="q-fen-b"><input type="number" class="q-num" data-prop="kbDueN" min="1" max="999" value="' + qDueN(b) + '" aria-label="Nombre de jours, de semaines ou de mois">' +
        seg('kbDueU', b.kbDueU || 'j', [['j', 'jours'], ['s', 'semaines'], ['m', 'mois']]) + '</div>' : '');
  }
  if (cle === 'view') {
    var vues = [['table', '▦'], ['list', '≡'], ['kanban', '▥'], ['count', '#']].concat(src === 'table' ? [['regroupee', '⊞'], ['chaleur', '▩']] : []);
    var reg = v === 'regroupee' ? qRegReglage(b, queryRecords(b, d, pi)) : null, regl = '';
    if (reg) regl += h('Regrouper') + '<div class="q-fen-b">' + qRegForm(b, reg) + '</div>';
    if (v === 'chaleur') regl += h('Carte de chaleur') + '<div class="q-fen-b">' + qChForm(b, qChReglage(b, queryRecords(b, d, pi))) + '</div>';   // ni tri, ni limite, ni choix des colonnes
    if (v === 'kanban' && src !== 'check' && src !== 'kanban') regl += '<div class="q-fen-b"><label>regroupées par <select data-act="set" data-prop="groupBy">' + qSortOptions(b, queryRecords(b, d, pi)).filter(function (x) { return x[0] !== 'src'; }).map(function (x, n) { return o(x[0], b.groupBy || (n === 0 ? x[0] : ''), esc(x[1])); }).join('') + '</select></label></div>';
    if (v !== 'kanban' && v !== 'count' && v !== 'chaleur') regl += '<div class="q-fen-b"><label>limiter à <select data-act="set" data-prop="limit">' + [0, 3, 5, 10, 20, 50, 100].map(function (n) { return o(n, +b.limit || 0, n ? n + (reg ? ' groupes' : ' résultats') : 'tous'); }).join('') + '</select></label></div>';
    return h('Vue') + vues.map(function (x) { return choix('view', x[0], v, Q_VUES[x[0]], x[1]); }).join('') + regl;
  }
  if (cle === 'cols') return v === 'kanban' && src === 'kanban' ? h('Champs des cartes') + qChampsForm(b) : h('Colonnes affichées') + qColForm(b, queryRecords(b, d, pi));
  if (cle === 'sort') {
    var opts = v === 'regroupee' ? (function (rg) { return [['c:' + rg.nom(rg.x).toLowerCase(), rg.nom(rg.x)], ['#n', 'Nombre de lignes']]; })(qRegReglage(b, queryRecords(b, d, pi))) : qSortOptions(b, queryRecords(b, d, pi));
    var tri = qTriBloc(b, d, pi);
    return h('Trier') + '<div class="q-fen-b"><select data-act="set" data-prop="sortBy" aria-label="Trier par">' + o('', tri.by, 'Sans tri (ordre du document)') + opts.map(function (x) { return o(x[0], tri.by, esc(x[1])); }).join('') + '</select>' +
      (tri.by ? seg('sortDir', tri.dir, [['asc', 'croissant ↑'], ['desc', 'décroissant ↓']]) : '') + '</div>';
  }
  return '';
}
function qChampsForm(b) {
  // champs des cartes en vue kanban : le titre est fixe, puis une ligne par champ (poignée, case) ; gestes : 14-colonnes-requete.js
  return '<div class="q-colonnes"><span class="q-lbl">Champs des cartes</span> <span class="muted q-hint">(titre toujours affiché)</span>' +
    '<ol class="q-cols" data-qliste="champs">' + qChampsRanges(b).map(function (c) {
      return '<li class="q-col" data-qcolk="' + esc(c.cle) + '"><span class="q-grip" title="Glisser pour déplacer (ou Alt+↑, Alt+↓ sur la case)" aria-hidden="true">⋮⋮</span>' +
        '<label><input type="checkbox" data-qchamp="' + esc(c.cle) + '"' + (qChampVisible(b, c.cle) ? ' checked' : '') + '> ' + esc(c.nom) + '</label></li>';
    }).join('') + '</ol></div>';
}
function qRegForm(b, rg) {
  // vue regroupée : colonne X (select), colonnes Y (cases, gestes : 14-colonnes-requete.js), forme
  var o = function (v, cur, label) { return '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + label + '</option>'; };
  return '<label>par <select data-act="set" data-prop="regX" title="Colonne qui regroupe">' + rg.dispo.map(function (c) { return o(c.cle, rg.x, esc(c.nom)); }).join('') + '</select></label>' +
    '<div class="q-regy"><span class="q-lbl">Valeurs de</span>' + rg.dispo.filter(function (c) { return c.cle !== rg.x; }).map(function (c) {
      return '<label class="q-tog"><input type="checkbox" data-qregy="' + esc(c.cle) + '"' + (rg.ys.indexOf(c.cle) >= 0 ? ' checked' : '') + '> ' + esc(c.nom) + '</label>';
    }).join('') + '</div>' +
    '<select data-act="set" data-prop="regForme" title="Forme des groupes">' + o('fiches', b.regForme === 'tableau' ? '' : 'fiches', 'en fiches') + o('tableau', b.regForme, 'en tableau') + '</select>';
}
function qChForm(b, ch) {
  // carte de chaleur : colonne X des colonnes de la matrice, Y des cases, Z facultative des sous-cases, N facultative de la somme
  var o = function (v, cur, label) { return '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + label + '</option>'; };
  var sel = function (prop, titre, cur, vide, sauf) {
    return '<select data-act="set" data-prop="' + prop + '" title="' + titre + '">' + (vide ? o('', cur, vide) : '') +
      ch.dispo.filter(function (c) { return sauf.indexOf(c.cle) < 0; }).map(function (c) { return o(c.cle, cur, esc(c.nom)); }).join('') + '</select>';
  };
  return '<label>colonnes <select data-act="set" data-prop="chX" title="Colonnes de la matrice">' + ch.dispo.map(function (c) { return o(c.cle, ch.x, esc(c.nom)); }).join('') + '</select></label>' +
    '<label>cases ' + sel('chY', 'Cases de chaque colonne', ch.y, '', [ch.x]) + '</label>' +
    '<label>sous-cases ' + sel('chZ', 'Sous-niveau de chaque case', ch.z, 'aucun sous-niveau', [ch.x, ch.y]) + '</label>' +
    '<label>couleur selon ' + sel('chN', 'Couleur des cases', ch.n, 'nombre de lignes', []) + '</label>';
}
function qColForm(b, recs) {
  // choix des colonnes : mode, puis une ligne par colonne disponible dans l'ordre choisi (poignée, case) ; gestes : 14-colonnes-requete.js
  var mode = qColReglage(b).mode || 'toutes', o = function (v, label) { return '<option value="' + v + '"' + (mode === v ? ' selected' : '') + '>' + label + '</option>'; };
  return '<div class="q-colonnes"><label><span class="q-lbl">Colonnes</span> <select data-qcolmode title="Colonnes affichées">' + o('toutes', 'toutes') + o('sauf', 'toutes sauf…') + o('seulement', 'seulement…') + '</select></label>' +
    '<ol class="q-cols">' + qColPlacees(b, qColonnesDispo(b, recs, b.view === 'list').dispo).map(function (c) {
      return '<li class="q-col" data-qcolk="' + esc(c.cle) + '"><span class="q-grip" title="Glisser pour déplacer (ou Alt+↑, Alt+↓ sur la case)" aria-hidden="true">⋮⋮</span>' +
        '<label><input type="checkbox" data-qcol="' + esc(c.cle) + '"' + (qColonneVisible(b, c.cle) ? ' checked' : '') + '> ' + esc(c.nom) + '</label></li>';
    }).join('') + '</ol></div>';
}
