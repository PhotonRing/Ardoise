/* ---------- Rendu ---------- */
// bloc ancré (id b-<id>, même dans l'export) : cible du lien d'une requête vers un modèle diamant ou un bloc texte
function blocAncre(b) { return b.type === 'diamond' || b.type === 'texte'; }
function hlLine(line) {
  var e = esc(line);
  return /^\s*(#(?!!)|\/\/|--\s|;|rem\s|%)/i.test(line) ? '<span class="c">' + e + '</span>' : e;
}
// contexte du rendu, normalisé aux entrées publiques : page bornée au document, vue et ses booléens, plis et tris de session (lecture), plis du sommaire, état d'interface (édition), colonnes de kanban réduites ou affichées dans la session (hors export) ; champ absent = valeur neutre
function renderCtx(d, ctx) {
  ctx = ctx || {};
  var view = ctx.view === 'edit' || ctx.view === 'export' ? ctx.view : 'read';
  return { page: Math.max(0, Math.min(d.pages.length - 1, +ctx.page || 0)), view: view, edit: view === 'edit', static: view === 'export',
    folds: (view === 'read' && ctx.folds) || {}, sort: (view === 'read' && ctx.sort) || {}, navFolds: ctx.navFolds || {}, editor: (view === 'edit' && ctx.editor) || {},
    kbCols: (view !== 'export' && ctx.kbCols) || {} };
}
// un titre est-il plié : pli de lecture de la session, sinon l'état enregistré
function foldedIn(ctx) { var vf = ctx.folds; return function (b) { return vf[b.id] != null ? vf[b.id] : !!b.folded; }; }
// numéro affiché de chaque étape (id → numéro) : le numéro saisi, sinon le dernier numéro saisi recopié avec son dernier nombre augmenté (« 5. 2 » → « 5. 3 ») ; étapes nonum exclues
function stepNums(blocks) {
  var out = {}, pre = '', counter = 0, post = '';
  blocks.forEach(function (b) {
    if (b.type !== 'step' || b.nonum) return;
    var n = String(b.num || '').trim(), m = n.match(/^(.*?)(\d+)(\D*)$/);
    if (!n) n = pre + (++counter) + post; else if (m) { pre = m[1]; counter = +m[2]; post = m[3]; }
    out[b.id] = n;
  });
  return out;
}
// pastilles colorées du registre de d (15-pastilles.js) et formules rendues (05-formules.js) d'un rendu en texte HTML
function rendrePastillesEtFormules(html, d, edition) { return rendreFormules(paintPills(html, d), edition); }
function renderPage(d, ctx) {
  ctx = renderCtx(d, ctx);
  var edit = ctx.edit, blocks = d.pages[ctx.page].blocks, isF = foldedIn(ctx);
  var out = [], open = false, nums = stepNums(blocks), fi = foldInfo(blocks, edit ? null : isF), reg = edit ? null : foldRegions(blocks);
  blocks.forEach(function (b) {
    if (edit && fi.hidden[b.id]) return;   // dans une section pliée (édition)
    if (b.type === 'step' || b.type === 'footer') { if (open) out.push('</section>'); open = false; }
    if (b.type === 'step') { out.push('<section class="step"' + (edit ? '' : ' data-fl="1"') + '>'); open = true; }
    var inner = renderBlock(b, d, ctx, nums[b.id] || null);
    if (!edit && inner) {
      // lecture : ancre des titres, niveau (data-fl) pour plier au clic, état plié, blocs masqués (data-fh)
      var lv = foldLevel(b), fold = lv > 0 && reg[b.id] > 0, folded = fold && isF(b), at = '';
      if (b.type === 'step' || b.type === 'h2' || b.type === 'h3' || blocAncre(b)) at += ' id="b-' + b.id + '"';
      if (lv >= 0) at += ' data-fl="' + lv + '"';
      if (folded) at += ' data-folded';
      if (fi.hidden[b.id]) at += ' data-fh';
      if (!ctx.static) at += ' data-bid="' + b.id + '"';   // ancrage de la bascule vers l'édition (19-mode-lecture-edition.js)
      inner = inner.replace(/^<(\w+)/, '<$1' + at);
      if (fold) inner = inner.replace(/^(<\w+[^>]*>)/, '$1<button type="button" class="fold-v" data-vfold aria-expanded="' + !folded + '" title="Plier / déplier la section"></button>');
    }
    out.push(edit ? wrapEdit(b, inner, fi.count[b.id] || 0, ctx.editor, d.pages.length) : inner);
  });
  if (open) out.push('</section>');
  if (edit) out.push('<button class="add-end" type="button" data-act="add-end">+ Ajouter un bloc</button>');
  return rendrePastillesEtFormules('<div class="wrap" style="--w:' + (+d.width || 820) + 'px">' + out.join('\n') + '</div>', d, edit);
}
// bloc d'ancrage de la bascule dans la vue ctx : le bloc, sinon le titre plié qui le masque, sinon (bloc qui n'affiche rien) le bloc affiché le plus proche, le précédent d'abord
function anchorBlock(d, ctx, id) {
  ctx = renderCtx(d, ctx);
  var blocks = d.pages[ctx.page].blocks, edit = ctx.edit, fi = foldInfo(blocks, edit ? null : foldedIn(ctx));
  var shown = function (b) { return !fi.hidden[b.id] && (edit || !!renderBlock(b, d, ctx, null)); };
  // bloc d'un groupe : lui-même si son groupe est affiché et ouvert, sinon l'ancrage de son groupe
  var go = ouEst(blocks, id);
  if (go && go.parent) {
    var gp = go.parent, gplie = !edit && ctx.folds[gp.id] != null ? !!ctx.folds[gp.id] : !!gp.folded;
    if (!gplie && !fi.hidden[gp.id]) return id;
    id = gp.id;
  }
  var a = fi.hidden[id] || id, i = -1, j;
  blocks.forEach(function (b, k) { if (b.id === a) i = k; });
  if (i < 0 || shown(blocks[i])) return a;
  for (j = i - 1; j >= 0; j--) if (shown(blocks[j])) return blocks[j].id;
  for (j = i + 1; j < blocks.length; j++) if (shown(blocks[j])) return blocks[j].id;
  return a;
}
function renderBlock(b, d, ctx, num) {
  var e = ctx.edit, editorUi = ctx.editor;
  function f(tag, cls, k, val, o) {
    o = o || {};
    var rich = o.rich !== false, body = rich ? R(val) : esc(val);
    if (!e) return '<' + tag + (cls ? ' class="' + cls + '"' : '') + '>' + body + '</' + tag + '>';
    return '<' + tag + ' class="' + (cls ? cls + ' ' : '') + 'fld' + (o.soft ? ' soft' : '') + '" contenteditable="true" spellcheck="true" data-b="' + b.id + '" data-k="' + k + '"' +
      (rich ? ' data-rich' : '') + (o.li ? ' data-li' : '') + (o.cell ? ' data-cell' : '') + (o.ml ? ' data-ml' : '') + (o.nl ? ' data-nl' : '') +
      ' data-ph="' + esc(o.ph || '') + '">' + body + '</' + tag + '>';
  }
  function checks(base, arr) {
    if (!arr.length) return e ? '<button class="mini-add" type="button" data-act="item-add" data-k="' + base + '">+ case à cocher</button>' : '';
    // ordre d'affichage (liste à cocher) : l'ordre saisi reste celui du document ; les sous-éléments suivent leur parent
    var order = b.type === 'check' && (b.order === 'doneFirst' || b.order === 'doneLast') ? checkOrder(arr, b.order) : arr.map(function (x, k) { return k; });
    return '<ul class="check">' + order.map(function (i) {
      var it = arr[i], id = b.id + '-' + base.replace(/\./g, '-') + '-' + i;
      return '<li' + (it.lv > 0 ? ' class="lv-' + Math.min(6, +it.lv) + '"' : '') + '><input type="checkbox" id="' + id + '" data-b="' + b.id + '" data-k="' + base + '.' + i + '.done"' + (it.done ? ' checked' : '') + '>' +
        (e ? f('div', 'lbl', base + '.' + i + '.html', it.html, { li: 1, ph: 'Élément' }) : '<label for="' + id + '">' + R(it.html) + '</label>') + '</li>';
    }).join('') + '</ul>';
  }
  function ta(cls) {
    var lg = HL.resolve(b.lang, b.code, b.name);
    return '<div class="ta-wrap v-' + (cls || b.variant || 'dark') + '"><pre class="ta-hl" aria-hidden="true">' + HL.html(b.code, lg) + '\n</pre>' +
      '<textarea class="code-ta ' + (cls || '') + '" data-b="' + b.id + '" data-k="code" spellcheck="false" wrap="off" rows="1" placeholder="Coller ou écrire du code…">' + esc(b.code) + '</textarea></div>';
  }
  // contexte x du rendu : ce que lit un rendu, sans globale ; la facette rendu du type l'emporte sur l'ancien case (repli jusqu'au ticket 08)
  var x = { edit: e, editor: editorUi, ctx: ctx, d: d, num: num, f: f, checks: checks, ta: ta }, rb = facette(b.type, 'rendu');
  if (rb) return rb(b, x);
  switch (b.type) {
    // famille texte et titres (ticket 02)
    // famille cadres (ticket 03)
    // famille carte et chronologie (ticket 04)
    // famille listes et tableaux (ticket 05)
    // famille requête et kanban (ticket 06)
    // famille médias (ticket 07)
  }
  return '';
}
function checkOrder(arr, order) {
  // indices des éléments dans l'ordre d'affichage : à chaque niveau, cochés avant ou après les autres (tri stable)
  var root = { kids: [] }, stack = [{ lv: -1, n: root }];
  arr.forEach(function (it, i) {
    var lv = +it.lv || 0, n = { i: i, done: !!it.done, kids: [] };
    while (stack.length > 1 && stack[stack.length - 1].lv >= lv) stack.pop();
    stack[stack.length - 1].n.kids.push(n); stack.push({ lv: lv, n: n });
  });
  var out = [];
  (function walk(list) {
    list.map(function (n, k) { return { n: n, k: k }; }).sort(function (x, y) {
      var dx = x.n.done ? 1 : 0, dy = y.n.done ? 1 : 0; if (order === 'doneFirst') { dx = 1 - dx; dy = 1 - dy; }
      return dx - dy || x.k - y.k;
    }).forEach(function (x) { out.push(x.n.i); walk(x.n.kids); });
  })(root.kids);
  return out;
}
function opt(v, cur, label) { return '<option value="' + v + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + label + '</option>'; }
function tog(prop, on, label, title) { return '<button type="button" data-act="toggle" data-prop="' + prop + '" aria-pressed="' + (on ? 'true' : 'false') + '" title="' + (title || '') + '">' + label + '</button>'; }
function act(a, label, title, extra) { return '<button type="button" data-act="' + a + '" title="' + (title || '') + '"' + (extra || '') + '>' + label + '</button>'; }
function settings(b) {
  var rg = facette(b.type, 'reglages');
  if (rg) return rg(b);
  switch (b.type) {
    // famille texte et titres (ticket 02)
    // famille cadres (ticket 03)
    // famille carte et chronologie (ticket 04)
    // famille listes et tableaux (ticket 05)
    // famille médias (ticket 07)
  }
  return '';
}
function foldLevel(b) { return b.type === 'step' || b.type === 'h2' ? 1 : b.type === 'h3' ? 2 : b.type === 'header' || b.type === 'footer' ? 0 : -1; }
function foldRegions(blocks) {
  // nombre de blocs de chaque section (titre de section, étape, sous-section), pliée ou non
  var n = {}, levels = blocks.map(foldLevel);
  blocks.forEach(function (b, i) {
    if (levels[i] <= 0) return;
    // ce que ce titre masquerait s'il était seul plié (règle de Reader.foldHidden)
    n[b.id] = Reader.foldHidden(levels, levels.map(function (_, j) { return j === i; })).filter(function (h) { return h === i; }).length;
  });
  return n;
}
function foldInfo(blocks, isFolded) {
  // blocs masqués par une section pliée (règle de Reader.foldHidden, la même que la page exportée)
  // hidden : id du bloc → id du titre plié qui le masque ; count : nombre de blocs masqués par titre
  var hidden = {}, count = {};
  var r = Reader.foldHidden(blocks.map(foldLevel), blocks.map(function (b) { return isFolded ? isFolded(b) : b.folded; }));
  r.forEach(function (h, i) { if (h < 0) return; var hid = blocks[h].id; hidden[blocks[i].id] = hid; count[hid] = (count[hid] || 0) + 1; });
  return { hidden: hidden, count: count };
}
// bloc caché en édition : par une section pliée (lui ou son groupe), ou par son groupe plié
function cacheEnEdition(blocks, id) {
  var o = ouEst(blocks, id); if (!o) return false;
  return !!foldInfo(blocks).hidden[(o.parent || o.b).id] || !!(o.parent && o.parent.folded);
}
function revealBlock(id, blocks) {
  // déplie le groupe qui contient ce bloc et les sections qui le masquent, parmi blocks (par défaut, la page affichée)
  blocks = blocks || doc.blocks;
  var o = ouEst(blocks, id); if (o && o.parent) { o.parent.folded = false; id = o.parent.id; }
  for (var n = 0; n < 20; n++) { var h = foldInfo(blocks).hidden[id], hb = h && blocks.filter(function (b) { return b.id === h; })[0]; if (!hb) return; delete hb.folded; }
}
function wrapEdit(b, inner, nHidden, editorUi, nPages) {
  var s = settings(b), fl = foldLevel(b) > 0;
  return '<div class="blk' + (editorUi && editorUi.bar != null && b.id === editorUi.bar ? ' bar-on' : '') + (fl && b.folded ? ' folded' : '') + '" data-id="' + b.id + '" data-type="' + b.type + '"' + (fl ? ' data-fold' : '') + '>' +
    (fl ? '<button type="button" class="fold-t" data-act="fold" aria-expanded="' + !b.folded + '" title="' + (b.folded ? 'Déplier' : 'Plier') + ' la section (en édition seulement)">›</button>' : '') +
    '<div class="blk-gut"><button type="button" class="g-add" data-act="add-after" title="Insérer un bloc dessous">+</button><button type="button" class="g-drag" data-act="drag" title="Glisser pour déplacer">⋮⋮</button></div>' +
    '<div class="collant"><div class="blk-bar"><span class="tname">' + T[b.type].label + '</span>' + (s ? '<span class="bsep"></span>' + s : '') + '<span class="bsep"></span>' +
    // une action par ligne : deux tickets qui en ajoutent chacun une fusionnent sans conflit
    act('add-after', '+', 'Insérer un bloc dessous') +
    act('up', '↑', 'Monter (Alt+↑)') +
    act('down', '↓', 'Descendre (Alt+↓)') +
    act('dup', '⧉', 'Dupliquer') +
    (b.type !== 'header' && b.type !== 'footer' && nPages > 1 ? act('deplacer-page', '⇥', 'Déplacer vers la page…') : '') +
    act('menu-bloc', '⋯', 'Plus d’actions') +
    '<button type="button" class="del" data-act="del" title="Supprimer">✕</button></div></div>' + inner +
    (fl && b.folded ? '<button type="button" class="fold-more" data-act="fold">' + (nHidden ? '⋯ ' + nHidden + ' bloc' + (nHidden > 1 ? 's' : '') + ' masqué' + (nHidden > 1 ? 's' : '') : 'Section pliée, sans contenu') + ' · déplier</button>' : '') + '</div>';
}

function pageHeader(pg) { return pg.blocks.filter(function (b) { return b.type === 'header'; })[0] || null; }
function pageTitle(pg, i) {
  // le nom d'une page est le grand titre de son en-tête ; à défaut, le nom saisi ; sinon « Page N »
  var h = pageHeader(pg), t = h ? titreTexte(h.title) : '';
  return t || (pg.title || '').trim() || 'Page ' + (i + 1);
}
// nom d'une page dans les onglets de pages et le sommaire : HTML assaini du grand titre (formules rendues par navHTML)
function titrePageHTML(pg, i) { var h = pageHeader(pg); return h && titreTexte(h.title) ? titreHTML(h.title) : esc(pageTitle(pg, i)); }
// nom d'une page dans le titre de la fenêtre : formules retirées (titreFenetre, 02-assainissement.js)
function titreFenetrePage(pg, i) { var h = pageHeader(pg), t = h ? titreFenetre(h.title) : ''; return t || pageTitle(pg, i); }
function curTitle() { return pageTitle(doc.pages[doc.cur], doc.cur); }
function titreFenetrePageCourante() { return titreFenetrePage(doc.pages[doc.cur], doc.cur); }
function sectionsOf(pg) {
  var out = [], nums = stepNums(pg.blocks);
  pg.blocks.forEach(function (b) {
    // t : titre en texte (formule lue $source$) ; h : HTML assaini du titre pour le sommaire (formules rendues par navHTML)
    var x = b.type === 'step' ? { id: b.id, src: b.title, def: 'Étape', n: nums[b.id] || null, lv: 1 } : b.type === 'h2' ? { id: b.id, src: b.html, def: 'Section', lv: 1 } :
      b.type === 'h3' ? { id: b.id, src: b.html, def: 'Sous-section', lv: 2 } : null;
    if (!x) return;
    var t = titreTexte(x.src), it = { id: x.id, t: t || x.def, h: t ? titreHTML(x.src) : esc(x.def), lv: x.lv };
    if (b.type === 'step') it.n = x.n;
    out.push(it);
  });
  return out;
}
/* Arborescence des pages : liste à plat (ordre de lecture), chaque page a un niveau (lv, absent = 0) ;
   les sous-pages d'une page la suivent directement, avec un niveau de plus */
function pageIndex(pages, pid) { for (var i = 0; i < pages.length; i++) if (pages[i].id === pid) return i; return -1; }
function pageLv(pages, i) { return +pages[i].lv || 0; }
function pageEnd(pages, i) { var lv = pageLv(pages, i), j = i + 1; while (j < pages.length && pageLv(pages, j) > lv) j++; return j; }   // fin de la page et de ses sous-pages (exclue)
// déplacement d'un bloc vers une autre page : page qui contient un bloc (-1 sinon) ; blocs emportés à partir de l'indice i
// (un titre de section emporte ce qu'il masquerait s'il était seul plié, plié ou non ; un autre bloc part seul, un groupe avec ses blocs)
// pageDuBloc : 05-document.js (enfants des groupes compris)
function uniteDuBloc(blocks, i) {
  var levels = blocks.map(foldLevel); if (levels[i] <= 0) return 1;
  return 1 + Reader.foldHidden(levels, levels.map(function (_, j) { return j === i; })).filter(function (h) { return h === i; }).length;
}
// retire l'unité du bloc bid de la page de et l'ajoute à la fin de la page vers, avant son pied de page final ; la section
// pliée qui la recevrait est dépliée. Rend le nombre de blocs déplacés, ou false (en-tête ou pied de page, même page, bloc ou page absents)
function deplacerVersPage(pages, de, bid, vers) {
  var src = pages[de], dst = pages[vers]; if (!src || !dst || de === vers) return false;
  var o = ouEst(src.blocks, bid);
  if (!o || o.b.type === 'header' || o.b.type === 'footer') return false;
  // un bloc d'un groupe part seul ; un bloc de la page emporte son unité (un groupe part entier)
  var seg = o.liste.splice(o.i, o.parent ? 1 : uniteDuBloc(src.blocks, o.i)), at = dst.blocks.length;
  while (at > 0 && dst.blocks[at - 1].type === 'footer') at--;
  Array.prototype.splice.apply(dst.blocks, [at, 0].concat(seg));
  revealBlock(bid, dst.blocks);
  return seg.length;
}
function pageParent(pages, i) { var lv = pageLv(pages, i); for (var j = i - 1; j >= 0; j--) if (pageLv(pages, j) < lv) return j; return -1; }
function pageRoot(pages, i) { var p; while ((p = pageParent(pages, i)) >= 0) i = p; return i; }
function pageAncestors(pages, i) { var out = []; while ((i = pageParent(pages, i)) >= 0) out.push(i); return out; }
function pageKids(pages, i) { var out = [], lv = pageLv(pages, i), end = pageEnd(pages, i); for (var j = i + 1; j < end; j++) if (pageLv(pages, j) === lv + 1) out.push(j); return out; }
function prevSibling(pages, i) { var lv = pageLv(pages, i); for (var j = i - 1; j >= 0; j--) { var l = pageLv(pages, j); if (l === lv) return j; if (l < lv) return -1; } return -1; }
function nextSibling(pages, i) { var j = pageEnd(pages, i); return j < pages.length && pageLv(pages, j) === pageLv(pages, i) ? j : -1; }
var viewFold = {};   // sections pliées / dépliées en lecture (id → plié) : jamais enregistré
var viewCol = {};   // colonnes de kanban réduites / affichées pour soi (id de colonne → { red, base : valeur du fichier }) : jamais enregistré, vidé à chaque bascule de mode
var navFold = {};   // pages dépliées (true) ou repliées (false) à la main dans le sommaire, mémorisé par document dans ce navigateur
function loadNavFold(d) { d = d || doc; try { navFold = JSON.parse(localStorage.getItem(LS + 'fold:' + d.id) || '{}') || {}; } catch (_) { navFold = {}; } }
function saveNavFold() { try { localStorage.setItem(LS + 'fold:' + doc.id, JSON.stringify(navFold)); } catch (_) {} }
function navHTML(d, ctx) {
  // vue 'export' : toutes les pages sont présentes et le script de la page exportée bascule de l'une à l'autre
  ctx = renderCtx(d, ctx);
  var edit = ctx.edit, all = ctx.static, nf = ctx.navFolds;
  var pages = d.pages, cur = ctx.page, w = +d.width || 820, curRoot = pageRoot(pages, cur), anc = pageAncestors(pages, cur);
  var roots = pages.map(function (pg, i) { return i; }).filter(function (i) { return pageLv(pages, i) === 0; });
  var menu = function (i, always) { return edit && (always || i === cur) ? '<button type="button" class="pnav-m" data-pgm="' + i + '" title="Options de la page" aria-label="Options de la page">⋯</button>' : ''; };
  var pgBtn = function (cls, i) { return '<button type="button" class="' + cls + '" data-pg="' + i + '" data-pgg="' + pageRoot(pages, i) + '"' + (i === cur ? ' aria-current="page"' : '') + ' data-titre="' + esc(titreFenetrePage(pages[i], i)) + '">' + titrePageHTML(pages[i], i) + '</button>'; };
  var tab = function (i) { var dl = pageLv(pages, i); return '<span class="ptab-w' + (i === cur || (i === curRoot && !all) ? ' on' : '') + (dl > 1 ? ' d' + Math.min(dl, 4) : '') + '">' + pgBtn('ptab', i) + menu(i) + '</span>'; };
  // onglets : pages de premier niveau, puis une seconde rangée avec toutes les sous-pages de la page affichée
  var tabs = '<nav class="pnav-tabs" aria-label="Pages"><div class="tabs-in" style="max-width:' + w + 'px">' + roots.map(tab).join('') +
    (edit ? '<button type="button" class="ptab-add" data-pgadd title="Ajouter une page">+ Page</button>' : '') + '</div>' +
    roots.map(function (g) {
      var end = pageEnd(pages, g); if (end === g + 1 || (!all && g !== curRoot)) return '';
      var desc = []; for (var j = g + 1; j < end; j++) desc.push(j);
      return '<div class="tabs-sub" data-grp="' + g + '" style="max-width:' + w + 'px"' + (g === curRoot ? '' : ' hidden') + '>' + desc.map(tab).join('') + '</div>';
    }).join('') + '</nav>';
  // sommaire : arborescence repliable (la page affichée et ses parents sont dépliés, sauf choix contraire)
  var entry = function (i) {
    var kids = pageKids(pages, i), secs = (all || i === cur) ? sectionsOf(pages[i]) : [];
    var open = !!kids.length && (nf[pages[i].id] != null ? nf[pages[i].id] : anc.indexOf(i) >= 0 || i === cur);
    var fold = kids.length ? '<button type="button" class="toc-f" data-pgfold aria-expanded="' + open + '" title="Afficher / masquer les sous-pages">›</button>' : '<span class="toc-f"></span>';
    return '<li class="toc-p' + (i === cur ? ' on' : '') + (kids.length ? ' has-kids' + (open ? ' open' : '') : '') + '" data-pgi="' + i + '">' +
      '<div class="toc-pr"' + (edit ? ' draggable="true"' : '') + '>' + fold + pgBtn('toc-pb', i) +
      (edit ? '<button type="button" class="toc-a" data-pgsub="' + i + '" title="Nouvelle sous-page" aria-label="Nouvelle sous-page">+</button>' + menu(i, true) : '') + '</div>' +
      (secs.length ? '<ol class="toc-s">' + secs.map(function (x) {
        return '<li class="lv' + x.lv + '"><a href="#b-' + x.id + '" data-sec="' + x.id + '">' + (x.n ? '<span class="toc-n">' + esc(x.n) + '</span>' : '') + '<span>' + x.h + '</span></a></li>';
      }).join('') + '</ol>' : '') +
      (kids.length ? '<ol class="toc-c">' + kids.map(entry).join('') + '</ol>' : '') + '</li>';
  };
  var side = '<aside class="pnav-side" aria-label="Sommaire"><ol class="toc">' + roots.map(entry).join('') + '</ol>' +
    (edit ? '<button type="button" class="toc-add" data-pgadd>+ Page</button>' : '') + '</aside>';
  return rendrePastillesEtFormules(tabs + side, d, false);   // titres du sommaire
}
function navReveal(keep) {
  // garde visible la page affichée dans le sommaire (qui défile) et dans les onglets
  var side = $('.pnav-side', app), tabs = $('.pnav-tabs .tabs-in', app), sub = $('.pnav-tabs .tabs-sub:not([hidden])', app);
  if (keep) { if (side) side.scrollTop = keep.side; if (tabs) tabs.scrollLeft = keep.tabs; }
  [[side, '.toc-p.on > .toc-pr', 'y'], [tabs, '.ptab-w.on', 'x'], [sub, '.ptab-w.on', 'x']].forEach(function (z) {
    var box = z[0], el = box && $(z[1], box); if (!el || box.offsetParent === null) return;
    var r = el.getBoundingClientRect(), br = box.getBoundingClientRect();
    if (z[2] === 'y' && (r.top < br.top || r.bottom > br.bottom)) box.scrollTop += r.top - br.top - br.height / 3;
    if (z[2] === 'x' && (r.left < br.left || r.right > br.right)) box.scrollLeft += r.left - br.left - 24;
  });
}
function applyTheme() {
  var r = document.documentElement;
  r.setAttribute('data-palette', doc.palette);
  r.setAttribute('data-typo', doc.typo);
  var th = mode === 'view' && viewerTheme ? viewerTheme : doc.theme;   // en lecture, le thème choisi par le lecteur l'emporte
  if (th === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', th);
  r.classList.toggle('is-edit', mode === 'edit');
  r.setAttribute('data-npages', doc.pages.length); r.setAttribute('data-nav', doc.nav || 'auto'); r.setAttribute('data-w', +doc.width || 820);
  Reader.navLayout(); paintFavicon();
  document.title = titreFenetrePageCourante();
}
var navSpyFn = null, lastNav = '', derivedT = 0;
var pointerBusy = false, navPending = false;
function refreshDerived() {
  // après une saisie : met à jour ce qui découle du contenu sans tout redessiner (le curseur et le clic en cours sont préservés)
  clearTimeout(derivedT); derivedT = 0;
  if (!doc) return;
  var vc = viewCtx(), nh = navHTML(doc, vc);
  if (nh !== lastNav && !$('.pnav-in', app)) {
    var tmp = document.createElement('div'); tmp.innerHTML = nh;
    var side = $('.pnav-side', app), ns = tmp.querySelector('.pnav-side'), ot = $('.pnav-tabs', app), nt = tmp.querySelector('.pnav-tabs');
    var shape = function (root) { return root ? $$('[data-pg],a[data-sec]', root).map(function (x) { return x.getAttribute('data-pg') || x.getAttribute('data-sec'); }).join('|') : ''; };
    if (side && ns && ot && nt && shape(side) === shape(ns) && shape(ot) === shape(nt)) {
      // même structure : mise à jour du texte en place (un clic en cours sur le sommaire n'est pas perdu)
      [[ot, nt], [side, ns]].forEach(function (pr) {
        var oldE = $$('[data-pg],a[data-sec]', pr[0]), newE = $$('[data-pg],a[data-sec]', pr[1]);
        oldE.forEach(function (o, k) { if (o.innerHTML !== newE[k].innerHTML) o.innerHTML = newE[k].innerHTML; });
      });
      lastNav = nh;
    } else if (pointerBusy) {
      navPending = true;   // structure changée pendant un clic : reconstruction juste après le clic
    } else {
      var st = side ? side.scrollTop : 0;
      if (ot && nt) { ot.replaceWith(nt); suivreHautEcran(); }
      if (side && ns) { side.replaceWith(ns); ns.scrollTop = st; }
      lastNav = nh;
      if (navSpyFn) navSpyFn();
    }
  }
  // blocs requête de la page : résultats et formulaire recalculés après la saisie (une pastille ajoutée ou retirée
  // d'un texte change les puces du filtre, un titre change la liste des portées)
  tousBlocs(doc.blocks).forEach(function (b) {
    if (b.type !== 'query') return;
    // en édition le bloc est dans .blk[data-id], en lecture dans .q-blk[data-qid]
    var box = $('.blk[data-id="' + b.id + '"] .q-res, .q-blk[data-qid="' + b.id + '"] > .q-res', app);
    if (box && !box.contains(document.activeElement)) {   // pas pendant la saisie d'un texte de carte
      var h = rendrePastillesEtFormules(queryResult(b, doc, vc), doc, false); if (box.innerHTML !== h) { box.innerHTML = h; filtrerBloc(b.id); if (fen && fen.b === b.id) fenPlacer(); }   // filtre des lignes et fenêtre (accrochée aux puces des cartes) hors de .q-res : remis
    }
    var form = mode === 'edit' && $('.blk[data-id="' + b.id + '"] .q-puces:not(.q-cpuces)', app);
    if (form && !form.contains(document.activeElement)) {   // pas pendant que le focus est sur une puce
      var tmp = document.createElement('div'); tmp.innerHTML = qLignePuces(b, doc, vc.page);
      var nf = tmp.firstChild; if (nf && !nf.isEqualNode(form)) { form.replaceWith(nf); if (fen && fen.b === b.id) fenPlacer(); }
    }
    if (fen && fen.b === b.id && !fen.p.contains(document.activeElement)) fenGarnir();   // pastilles de la portée, noms de page
  });
  // blocs sommaire de la page : la liste suit les titres saisis
  tousBlocs(doc.blocks).forEach(function (b) {
    if (b.type !== 'summary') return;
    var box = $('.blk[data-id="' + b.id + '"] .toc-blk-l', app); if (!box) return;
    var h = summaryList(b, doc, vc.page) || summaryEmpty(b); if (box.innerHTML !== h) box.innerHTML = h;
  });
  // numérotation automatique des étapes (pastilles vides qui affichent le numéro calculé)
  var nums = stepNums(doc.blocks);
  Object.keys(nums).forEach(function (id) {
    var badge = $('.blk[data-id="' + id + '"] .num', app); if (badge && badge.getAttribute('data-ph') !== nums[id]) badge.setAttribute('data-ph', nums[id]);
  });
  chRefreshLinked();   // cartes dont les valeurs viennent d'un tableau
  var ft = titreFenetrePageCourante(), ct = curTitle(); if (document.title !== ft) document.title = ft;
  var dn = $('#ui .doc-name'); if (dn && dn.textContent !== ct) dn.textContent = ct;
}
function refreshDerivedSoon() { clearTimeout(derivedT); derivedT = setTimeout(refreshDerived, 250); }
function fileAppHTML(d, page) {
  // aperçu de la page enregistré dans le fichier (#app) : vue de lecture sans plis ni tris de session, quel que soit le mode
  var ctx = { page: page, view: 'read' };
  return navHTML(d, ctx) + renderPage(d, ctx);
}
function viewCtx() {
  // contexte du rendu à l'écran : page affichée, mode, plis et tris de la session, colonnes réduites de la session, état d'interface de l'édition
  var ed = mode === 'edit';
  return renderCtx(doc, { page: doc.cur, view: ed ? 'edit' : 'read', folds: viewFold, sort: viewSort, navFolds: navFold, kbCols: viewCol,
    editor: ed ? { bar: barHold, map: mapUi, panelMin: panelMin, paste: chPaste, routePaste: rtPaste } : null });
}
function render(focus) {
  var os = $('.pnav-side', app), ot = $('.pnav-tabs .tabs-in', app), keep = { side: os ? os.scrollTop : 0, tabs: ot ? ot.scrollLeft : 0 };
  kbColsPerimes(viewCol, doc);
  // forme en édition décalée dans sa liste (annulation, modification reçue) : suivie ; disparue : l'édition s'arrête
  if (mapUi.edit) { var suivie = mapShapeFollow(byId(mapUi.editOf), mapUi.edit); if (suivie) mapUi.edit = suivie; else mapUi = mapModeNext(mapUi, null, null); }
  var vc = viewCtx(), fq = filtreFocus();
  lastNav = navHTML(doc, vc);
  app.innerHTML = lastNav + renderPage(doc, vc);
  applyTheme();
  if (navSpyFn) navSpyFn();
  if (mode === 'edit') { $$('textarea.code-ta', app).forEach(function (t) { autosize(t); syncCodeLayer(t); }); $$('textarea.formule-ta', app).forEach(autosize); }
  mountMaps();
  Reader.tlFit(app);
  poserFiltres(fq);   // filtres des lignes de la session, réappliqués à chaque rendu
  poserPlage();   // plage de cellules surlignée, après le filtre qui décide des lignes visibles (14-plage-cellules.js)
  fenApresRendu();   // fenêtre d'une puce de requête ouverte : regarnie sous sa puce (16-puces-requete.js)
  renderChrome();
  suivreHautEcran();
  updateCheat();
  synPaintPeers();
  navReveal(keep);
  if (focus) focusField(focus.b, focus.k, focus.end !== false);
  placerBarreMiseEnForme();   // barre détachée par le rendu : replacée si le curseur est encore dans un texte riche
}
// Données par pays (choroplèthe) : réglages et valeurs, dans le panneau « Éléments de la carte »
var chPaste = null;   // bloc dont la zone « Coller un tableau » est ouverte
var rtPaste = null;   // zone « Coller un itinéraire » ouverte : { b: bloc, i: itinéraire remplacé ou -1 pour en créer un }
var CH_LABELS = [['value', 'Valeurs'], ['both', 'Noms + valeurs'], ['name', 'Noms'], ['none', 'Sans étiquette']];
var CH_DEC = [['auto', 'Décimales auto'], ['0', '0 décimale'], ['1', '1 décimale'], ['2', '2 décimales'], ['k', 'Abrégé (k, M)']];
function chRaw(v) {
  // valeur saisie, telle quelle (sans arrondi), avec séparateur de milliers et virgule décimale
  if (v == null) return '';
  var t = String(v); if (/e/i.test(t)) return t.replace('.', ',');
  var neg = t.charAt(0) === '-', p = t.replace('-', '').split('.');
  return (neg ? '-' : '') + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f') + (p[1] ? ',' + p[1] : '');
}
// Source « tableau » : les valeurs sont lues dans un bloc tableau du document (colonne des pays, colonne des valeurs)
function chTables(d) {
  var out = [];
  d.pages.forEach(function (pg, pi) { blocsDe(pg.blocks, function (x) { if (x.type === 'table' && x.rows && x.rows.length) out.push({ b: x, pg: pg, pi: pi }); }); });
  return out;
}
function chTableLabel(d, t) {
  var hd = t.b.rows[0].map(function (c) { return textOf(c); }).filter(Boolean).join(' · ') || 'sans en-tête';
  if (hd.length > 42) hd = hd.slice(0, 41) + '…';
  return 'Tableau « ' + hd + ' »' + (d.pages.length > 1 ? ' · ' + (pageTitle(t.pg, t.pi)) : '');
}
function chGuessCols(tb) {
  // colonne des pays : celle où le plus de cellules sont des pays ; des valeurs : une autre, la plus numérique
  var K = MapKit.choro, rows = tb.rows.slice(1), n = (tb.rows[0] || []).length, best = [-1, -1], bk = 0, bv = 1;
  for (var j = 0; j < n; j++) { var c = rows.filter(function (r) { return K.match(textOf(r[j])); }).length; if (c > best[0]) { best[0] = c; bk = j; } }
  for (var j2 = 0; j2 < n; j2++) { if (j2 === bk) continue; var c2 = rows.filter(function (r) { return K.num(textOf(r[j2])) != null; }).length; if (c2 > best[1]) { best[1] = c2; bv = j2; } }
  return { k: bk, v: Math.min(bv, Math.max(0, n - 1)) };
}
function chView(b, d) {
  // réglages tels que la carte les affiche : avec une source tableau, les valeurs viennent du tableau
  var ch = b.choro; if (!ch || !ch.src) return ch;
  var out = {}; for (var k in ch) out[k] = ch[k];
  var info = { n: 0, bad: [], dup: [], missing: false }, data = {}, t = null;
  d.pages.forEach(function (pg) { blocsDe(pg.blocks, function (x) { if (x.id === ch.src.b && x.type === 'table') t = x; }); });
  if (!t) info.missing = true;
  else {
    if (!MapKit) MapKit = ardoiseMapKit();
    var K = MapKit.choro, ck = +ch.src.k || 0, cv = +ch.src.v || 0;
    t.rows.slice(1).forEach(function (r) {
      var name = textOf(r[ck] || ''), raw = textOf(r[cv] || ''); if (!name && !raw) return;
      var id = K.match(name);
      if (!id) { if (name) info.bad.push(name); return; }
      if (id in data) info.dup.push(name);
      data[id] = raw ? K.num(raw) : null; info.n++;
    });
  }
  out.data = data; Object.defineProperty(out, 'info', { value: info, enumerable: false });
  return out;
}
function choroPanel(b, d, editorUi) {
  if (!b.choro) return '';
  if (!MapKit) MapKit = ardoiseMapKit();
  var K = MapKit.choro, vw = chView(b, d), c = K.clean(vw), S = K.scale(c), I = K.index(), id = b.id, src = b.choro.src, info = vw.info;
  var sel = function (p, cur, list, title) { return '<select class="ch-set" data-b="' + id + '" data-p="' + p + '" title="' + title + '">' + list.map(function (x) { return opt(x[0], cur, esc(x[1])); }).join('') + '</select>'; };
  var txt = function (p, val, ph, cls, title) { return '<input class="mk-in ch-txt' + (cls ? ' ' + cls : '') + '" data-b="' + id + '" data-p="' + p + '" value="' + esc(val) + '" placeholder="' + ph + '" title="' + (title || ph) + '">'; };
  var tg = function (a, on, label, title) { return '<button type="button" class="mk-b mk-t" data-act="' + a + '" aria-pressed="' + !!on + '" title="' + title + '">' + label + '</button>'; };
  var rows = Object.keys(c.data).filter(function (k) { return I.by[k]; }).sort(function (x, y) { return I.by[x].name.localeCompare(I.by[y].name, 'fr'); });
  var classed = c.scale === 'quant' || c.scale === 'eq', perso = c.pal === 'perso' || c.pal === 'perso3';
  var defCols = c.pal === 'perso3' ? ['#2166ac', '#f3efec', '#b2182b'] : ['#eef5fb', '#0c3b72'];
  var tabs = chTables(d), srcSel = '<select class="ch-src" data-b="' + id + '" title="D’où viennent les valeurs">' + opt('', src ? src.b : '', 'Valeurs saisies ici') +
    tabs.map(function (t) { return opt(t.b.id, src ? src.b : '', esc(chTableLabel(d, t))); }).join('') + (src && info.missing ? opt(src.b, src.b, 'Tableau supprimé') : '') + '</select>';
  var srcCols = '';
  if (src && !info.missing) {
    var tb = null; tabs.forEach(function (t) { if (t.b.id === src.b) tb = t.b; });
    var heads = tb.rows[0].map(function (h, j) { return [j, textOf(h) || 'Colonne ' + (j + 1)]; });
    srcCols = '<div class="ch-r"><span class="rd-u">Pays</span>' + sel('src.k', src.k, heads, 'Colonne des noms ou codes de pays') + '<span class="rd-u">Valeurs</span>' + sel('src.v', src.v, heads, 'Colonne des valeurs') + '</div>' +
      '<p class="muted ch-info">' + info.n + ' pays lu' + (info.n > 1 ? 's' : '') + ' dans le tableau' +
      (info.bad.length ? ' · non reconnu' + (info.bad.length > 1 ? 's' : '') + ' : ' + esc(info.bad.slice(0, 5).join(', ')) + (info.bad.length > 5 ? '…' : '') : '') +
      (info.dup.length ? ' · en double : ' + esc(info.dup.slice(0, 3).join(', ')) : '') + '. Modifiez les valeurs dans le tableau.</p>';
  } else if (src) srcCols = '<p class="muted ch-info">Le tableau lié n’existe plus : choisissez une autre source.</p>';
  return '<div class="ch-wrap" data-b="' + id + '"><div class="mk-h">Données par pays</div><div class="ch-box">' +
    '<div class="ch-r">' + srcSel + '</div>' + srcCols +
    '<div class="ch-r">' + txt('title', c.title, 'Titre de la légende') + txt('unit', c.unit, 'Unité', 'ch-unit', 'Unité, ajoutée après chaque valeur (ex. %, hab., €)') + '</div>' +
    '<div class="ch-r">' + sel('scale', c.scale, K.scales, 'Échelle des couleurs : linéaire ou logarithmique (dégradé continu), quantiles ou intervalles égaux (classes)') + (classed ? sel('classes', c.classes, [3, 4, 5, 6, 7, 8, 9].map(function (n) { return [n, n + ' classes']; }), 'Nombre de classes') : '') + '</div>' +
    '<div class="ch-r">' + sel('pal', c.pal, K.pals, 'Palette') + '<button type="button" class="mk-b" data-act="ch-rev" aria-pressed="' + c.rev + '" title="Inverser la palette">⇄</button></div>' +
    (perso ? '<div class="ch-r ch-cols">' + defCols.map(function (d, k) { return '<input type="color" class="ch-col" data-b="' + id + '" data-k="' + k + '" value="' + (c.cols[k] || d) + '" title="' + (k === 0 ? 'Valeurs basses' : k === defCols.length - 1 ? 'Valeurs hautes' : 'Milieu') + '">'; }).join('<span class="ch-arr">→</span>') + '</div>' : '') +
    (c.scale === 'lin' ? '<div class="ch-r"><span class="rd-u">Centre</span>' + txt('mid', chRaw(c.mid), 'facultatif', 'ch-mid', 'Valeur placée au milieu de la palette (utile avec une palette divergente)') + '</div>' : '') +
    '<div class="ch-r">' + sel('labels', c.labels, CH_LABELS, 'Étiquettes sur la carte') + sel('dec', c.dec, CH_DEC, 'Format des nombres (k = milliers, M = millions, Md = milliards)') + '</div>' +
    '<div class="ch-r">' + tg('ch-parts', c.parts, 'Territoires détachés', 'Répéter l’étiquette sur les territoires détachés du pays (Guyane, Réunion, Canaries, Alaska…) et sur les territoires rattachés') +
      tg('ch-sov', c.sov, 'Territoires rattachés', 'Colorer les territoires sans valeur propre (Nouvelle-Calédonie, Groenland, Porto Rico…) comme leur pays souverain') + '</div>' +
    '<div class="ch-r">' + tg('ch-legend', c.legend, 'Légende', 'Afficher la légende sur la carte') +
      tg('ch-unitlab', c.unitLab, 'Unité sur la carte', 'Ajouter l’unité après chaque valeur affichée sur les pays (elle reste dans la légende et l’infobulle)') +
      (src ? '' : tg('ch-paste', editorUi.paste === id, 'Coller un tableau…', 'Importer deux colonnes copiées d’un tableur')) +
      '<button type="button" class="mk-b mk-t ch-off" data-act="ch-off" title="Retirer les couleurs et toutes les données par pays">Retirer</button></div>' +
    (!src && editorUi.paste === id ? '<div class="ch-paste"><textarea class="ch-ta" data-b="' + id + '" rows="5" spellcheck="false" placeholder="Une ligne par pays : nom (ou code ISO) puis valeur, séparés par une tabulation ou un point-virgule. Copiez deux colonnes d’un tableur."></textarea>' +
      '<div class="ch-r"><button type="button" class="ub" data-act="ch-import">Importer</button><label class="ch-repl"><input type="checkbox"> Remplacer les données existantes</label></div></div>' : '') +
    (src ? '' : '<div class="map-search ch-search"><input type="text" class="ch-q" data-b="' + id + '" placeholder="Ajouter un pays…" autocomplete="off" spellcheck="false"><div class="map-res" hidden></div></div>') +
    (rows.length ? '' : '<p class="muted">' + (src ? 'Aucun pays reconnu dans le tableau.' : 'Aucun pays : ajoutez-en un, cliquez sur un pays de la carte ou collez un tableau.') + '</p>') +
    rows.map(function (k) {
      var v = c.data[k], col = S.color(v);
      return '<div class="ch-row" data-b="' + id + '" data-id="' + k + '"><span class="ch-sw"' + (col ? ' style="background:' + col + '"' : '') + '></span><span class="ch-n" title="' + esc(I.by[k].name) + ' (' + k + ')">' + esc(I.by[k].name) + '</span>' +
        (src ? '<span class="ch-ro">' + (v == null ? '—' : chRaw(v)) + '</span>'
          : '<input class="mk-in ch-v" data-b="' + id + '" data-id="' + k + '" value="' + chRaw(v) + '" placeholder="—" inputmode="decimal" title="Valeur (vide : sans donnée)">' +
            '<button type="button" class="mk-b" data-act="ch-del" data-id="' + k + '" title="Retirer ce pays">×</button>') + '</div>';
    }).join('') + '</div></div>';
}
function chRefresh(b) {
  // valeur ou texte modifié sans redessiner le bloc : couleurs de la liste et carte mises à jour
  var vw = chView(b, doc), K = MapKit.choro, S = K.scale(K.clean(vw)), m = mapOf(b.id);
  $$('.ch-row[data-b="' + b.id + '"]', app).forEach(function (r) { var col = S.color(vw.data[r.dataset.id]); r.querySelector('.ch-sw').style.background = col || ''; });
  if (m) m.setChoro(vw);
}
function chLinked(tableId) { return tousBlocs(doc.blocks).some(function (x) { return x.type === 'map' && x.choro && x.choro.src && x.choro.src.b === tableId; }); }
function chRefreshLinked() {
  // tableau source modifié : cartes et listes des données mises à jour (sauf pendant une saisie dans la liste)
  tousBlocs(doc.blocks).forEach(function (b) {
    if (b.type !== 'map' || !b.choro || !b.choro.src) return;
    var m = mapOf(b.id); if (m) m.setChoro(chView(b, doc));
    var w = $('.ch-wrap[data-b="' + b.id + '"]', app); if (w && !w.contains(document.activeElement)) { var h = choroPanel(b, doc, viewCtx().editor); if (w.outerHTML !== h) w.outerHTML = h; }
  });
}
function chSearch(inp) {
  var res = inp.parentNode.querySelector('.map-res'), q = MapKit.choro.norm(inp.value), b = byId(inp.dataset.b), items = [];
  if (!q) { res.hidden = true; res.innerHTML = ''; res._items = []; return; }
  var I = MapKit.choro.index(), first = [], other = [], seen = {};
  MapKit.data().countries.forEach(function (c) {
    var keys = [c.name, c.id].concat(c.aka).map(MapKit.choro.norm), pre = keys.some(function (k) { return k.indexOf(q) === 0; });
    if (pre) first.push(c); else if (q.length >= 3 && keys.some(function (k) { return k.indexOf(q) > 0; })) other.push(c);
  });
  first.sort(function (x, y) { return x.name.localeCompare(y.name, 'fr'); });
  first.concat(other).forEach(function (c) { if (!seen[c.id] && items.length < 10) { seen[c.id] = 1; items.push(c); } });
  res._items = items; res._cur = 0;
  res.innerHTML = items.length ? items.map(function (c, i) { var has = b.choro && c.id in b.choro.data; return '<button type="button" class="mi' + (i ? '' : ' act') + '" data-r="' + i + '"><span><b>' + esc(c.name) + '</b><small>' + c.id + (has ? ' · déjà dans la liste' : '') + '</small></span></button>'; }).join('')
    : '<div class="menu-empty">Aucun pays trouvé.</div>';
  res.hidden = false;
}
function chFocus(b, id) {
  var v = $('.ch-v[data-b="' + b.id + '"][data-id="' + id + '"]', app);
  if (!v) { var row = $('.ch-row[data-b="' + b.id + '"][data-id="' + id + '"]', app); if (row) { cheatBlock = b.id; updateCheat(); row.scrollIntoView({ block: 'nearest' }); row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); } return; }
  cheatBlock = b.id; updateCheat(); v.focus({ preventScroll: true }); v.select(); var r = v.closest('.ch-row'); r.scrollIntoView({ block: 'nearest' });
}
function chPick(inp, i) {
  var res = inp.parentNode.querySelector('.map-res'), c = (res._items || [])[i]; if (!c) return;
  var b = byId(inp.dataset.b); inp.value = ''; res.hidden = true;
  if (!(c.id in b.choro.data)) { keepView(b); session.modifier(function () { b.choro.data[c.id] = null; }); }
  chFocus(b, c.id);
}
function chImport(b, text, replace) {
  // deux colonnes collées (tableur, CSV) : nom ou code du pays, puis valeur ; renvoie le compte rendu
  var K = MapKit.choro, ok = {}, bad = [], n = 0;
  String(text || '').split(/\r?\n/).forEach(function (line, li) {
    line = line.trim(); if (!line) return;
    var m = line.match(/^(.+?)\s*[\t;|]\s*(.*)$/) || line.match(/^(.+?)\s*,\s*(-?[\d\s\u00a0\u202f.]+(?:,\d+)?\s*%?)$/) || line.match(/^(.+?)\s+([-−]?[\d\u00a0\u202f.,]+\s*%?)$/);
    if (!m) { if (li) bad.push(line); return; }
    var name = m[1].replace(/^["']|["']$/g, ''), raw = m[2].split(/[\t;|]/)[0].replace(/^["']|["']$/g, ''), v = K.num(raw), id = K.match(name);
    if (!id) { if (li || v != null) bad.push(name); return; }
    if (v == null && raw.trim()) { bad.push(name + ' (valeur « ' + raw.trim() + ' »)'); return; }
    ok[id] = v; n++;
  });
  if (n) { keepView(b); session.modifier(function () { if (replace) { b.choro.data = {}; b.choro.lp = {}; } for (var k in ok) b.choro.data[k] = ok[k]; }); }
  return { n: n, bad: bad };
}
function parseRoutePaste(text, d, except) {
  // liste collée, une ligne par point : coordonnées puis libellé facultatif (après tabulation ou point-virgule) ; except = itinéraire remplacé
  var pts = [], names = [], bad = [];
  // coupe au premier séparateur : [avant, reste], le reste garde ses autres séparateurs ; sans séparateur, [texte, '']
  var cut = function (s) { var j = s.search(/[\t;]/); return j < 0 ? [s, ''] : [s.slice(0, j), s.slice(j + 1)]; };
  String(text || '').split(/\r?\n/).forEach(function (line, li) {
    if (!line.trim()) return;
    // deux colonnes de nombres (lat puis lon) d'abord : « 48,38 ; -4,47 » ne doit pas se lire 48 puis 38
    var f1 = cut(line), f2 = cut(f1[1]), two = /^\s*-?\d+(?:[.,]\d+)?\s*°?\s*[EWO]?\s*$/i.test(f2[0]);
    var c = two ? parseLL(f1[0] + ' ' + f2[0]) : null, lab = f2[1];
    if (!c) { c = parseLL(f1[0]); lab = f1[1]; }
    if (!c) { bad.push(li + 1); return; }
    lab = lab.trim();
    pts.push([c.lat, c.lon]); names.push(lab || routeNear(d, c.lat, c.lon, except));
  });
  return { pts: pts, names: names, bad: bad };
}
function routeNear(d, lat, lon, except) {
  // nom du lieu du document le plus proche à moins de 50 m : points de toutes les cartes, étapes nommées des autres itinéraires
  if (!MapKit) MapKit = ardoiseMapKit();
  var best = '', bd = 50;
  var see = function (n, la, lo) { if (!n) return; var m = MapKit.gcDist([lat, lon], [la, lo]); if (m < bd) { bd = m; best = n; } };
  d.pages.forEach(function (pg) { blocsDe(pg.blocks, function (x) {
    if (x.type !== 'map') return;
    (x.markers || []).forEach(function (mk) { see(String(mk.label || '').trim(), +mk.lat, +mk.lon); });
    (x.routes || []).forEach(function (r, i) {
      if (except && except.b === x.id && except.i === i) return;
      (r.pts || []).forEach(function (p, j) { see(String((r.names || [])[j] || '').trim(), +p[0], +p[1]); });
    });
  }); });
  return best;
}
function applyRoutePaste(b, text, i) {
  // crée un itinéraire (i < 0) ou remplace les points de b.routes[i], en gardant nom et couleur ; rien sous deux points,
  // ni sur un itinéraire disparu pendant que la zone de collage était ouverte (annulation, modification reçue) : gone
  if (i >= 0 && !b.routes[i]) return { n: 0, bad: [], ok: false, gone: true };
  var rep = parseRoutePaste(text, doc, i >= 0 ? { b: b.id, i: i } : null), ok = rep.pts.length >= 2;
  if (ok) {
    keepView(b);
    session.modifier(function () {
      if (i < 0) { b.routes.push({ label: '', color: 'accent', pts: rep.pts, names: rep.names }); return; }
      // positions d'étiquettes posées pour les anciens points : noms d'étapes (np), nom de l'itinéraire (lp), ancien décalage (no)
      var r = b.routes[i]; r.pts = rep.pts; r.names = rep.names; delete r.np; delete r.no; delete r.lp;
    });
  }
  return { n: rep.pts.length, bad: rep.bad, ok: ok };
}
var panelMin = false;   // panneau « Éléments de la carte » réduit (préférence de ce navigateur, lue au démarrage)
var MapKit = null, maps = [], mapUi = { draw: null, kind: null, editOf: null, edit: null, add: null }, cheatBlock = null;
var MK_COLORS = [['accent', 'Accent'], ['ok', 'Vert'], ['bad', 'Rouge'], ['warn', 'Orange'], ['info', 'Bleu']];
// un seul mode de carte sur la page (want : null, { add }, { draw: genre }, { edit: { kind, i } }) ; redemander l'actif le coupe
function mapModeNext(ui, id, want) {
  var suivant = { draw: null, kind: null, editOf: null, edit: null, add: null };
  if (!want || id == null) return suivant;
  if (want.add) { if (ui.add !== id) suivant.add = id; return suivant; }
  if (want.draw) { if (!(ui.draw === id && ui.kind === want.draw)) { suivant.draw = id; suivant.kind = want.draw; } return suivant; }
  var w = want.edit, cur = ui.editOf === id && ui.edit;
  if (w && !(cur && cur.kind === w.kind && cur.i === w.i)) { suivant.editOf = id; suivant.edit = { kind: w.kind, i: w.i }; }
  return suivant;
}
function mapShapeList(b, kind) { return kind === 'marker' ? b.markers : kind === 'zone' ? b.zones : b.routes; }
// la forme en cours d'édition existe-t-elle encore ? chacune se cherche dans sa liste (un marqueur parmi les marqueurs)
function mapShapeAlive(b, ed) { var list = b && ed && mapShapeList(b, ed.kind); return !!(list && list[ed.i]); }
function mapShapeGeo(s) { return JSON.stringify([s.lat, s.lon, s.shape, s.c, s.r, s.pts]); }
// forme en édition suivie d'un rendu à l'autre : par sa géométrie, sinon à son rang si la liste garde sa longueur ; null si disparue
function mapShapeFollow(b, ed) {
  var list = b && ed && mapShapeList(b, ed.kind); if (!list) return null;
  var i = ed.i, geo = function (j) { return list[j] ? mapShapeGeo(list[j]) : null; };
  if (ed.geo != null && geo(i) !== ed.geo) {
    var j = -1; for (var k = 0; k < list.length && j < 0; k++) if (geo(k) === ed.geo) j = k;
    i = j >= 0 ? j : list.length === ed.n ? i : -1;
  }
  return list[i] ? { kind: ed.kind, i: i, n: list.length, geo: geo(i) } : null;
}
function mapOf(id) { for (var i = 0; i < maps.length; i++) if (maps[i].blockId === id) return maps[i]; return null; }
function keepView(b) { var m = b && mapOf(b.id); if (m && mode === 'edit') b.view = m.getView(); }
function mountMaps() {
  maps.forEach(function (m) { m.destroy(); }); maps = [];
  if (mode !== 'edit') { mapUi = { draw: null, kind: null, editOf: null, edit: null, add: null }; cheatBlock = null; }
  $$('.map[data-mapid]', app).forEach(function (el) {
    var b = byId(el.dataset.mapid); if (!b) return;
    if (!MapKit) MapKit = ardoiseMapKit();
    if (!b.routes) b.routes = [];
    var ed = mode === 'edit';
    var focusIn = function (sel) { cheatBlock = b.id; updateCheat(); var inp = $(sel, app); if (inp) { inp.focus({ preventScroll: true }); var it = inp.closest('.mk-item'); if (it) it.scrollIntoView({ block: 'nearest' }); } };
    var inst = MapKit.mount(el, { view: b.view, bg: b.bg, markers: b.markers, zones: b.zones, routes: b.routes, choro: chView(b, doc), cities: b.cities !== false, countries: b.countries !== false, key: doc.mapKey }, {
      edit: ed, locked: !ed && !!b.lock, hideBg: !ed && !!b.hideBg,
      onView: function (v) { if (ed) { b.view = v; marquerModifie(); } },
      onBg: function (bg) { if (!ed) return; b.bg = bg; marquerModifie(); var s = $('.blk[data-id="' + b.id + '"] select[data-prop=bg]', app); if (s) s.value = bg; },
      onAdd: function (lat, lon) { addMarker(b, lat, lon, ''); },
      onMove: function (i, lat, lon) { keepView(b); session.modifier(function () { b.markers[i].lat = lat; b.markers[i].lon = lon; }); },
      onPin: function (i) { focusIn('.mk-in[data-b="' + b.id + '"][data-mk="' + i + '"][data-p=label]'); },
      onZone: function (z) {
        keepView(b); mapUi.draw = null;
        var nz = { label: '', color: 'accent', shape: z.shape }; if (z.shape === 'circle') { nz.c = z.c; nz.r = z.r; } else nz.pts = z.pts;
        session.modifier(function () { b.zones.push(nz); });
        focusIn('.zn-in[data-b="' + b.id + '"][data-zn="' + (b.zones.length - 1) + '"]');
      },
      onRoute: function (pts) {
        keepView(b); mapUi.draw = null;
        session.modifier(function () { b.routes.push({ label: '', color: 'accent', pts: pts, names: pts.map(function () { return ''; }) }); });
        focusIn('.rt-in[data-b="' + b.id + '"][data-rt="' + (b.routes.length - 1) + '"]');
      },
      onDrawEnd: function () { if (mapUi.draw === b.id) setMapMode(null, null); },
      onZoneEdit: function (i, z) {
        keepView(b);
        session.modifier(function () { var t = b.zones[i]; t.shape = z.shape; if (z.shape === 'circle') { t.c = z.c; t.r = z.r; delete t.pts; } else { t.pts = z.pts; delete t.c; delete t.r; } });
      },
      onRouteEdit: function (i, pts, names, np) { keepView(b); session.modifier(function () { var r = b.routes[i]; r.pts = pts; r.names = names; r.np = np; delete r.no; }); },
      onLabelMove: function (kind, i, j, ll) {
        keepView(b);
        session.modifier(function () {
          if (kind === 'marker') { var mk = b.markers[i]; if (ll) mk.lp = ll; else delete mk.lp; return; }
          if (kind === 'zone') { var z = b.zones[i]; delete z.lo; if (ll) z.lp = ll; else delete z.lp; return; }
          var r = b.routes[i]; delete r.no;
          if (kind === 'route') { if (ll) r.lp = ll; else delete r.lp; return; }
          if (!r.np) r.np = r.pts.map(function () { return null; });
          while (r.np.length < r.pts.length) r.np.push(null);
          r.np[j] = ll;
        });
      },
      onChoroLabel: function (id, ll) { keepView(b); session.modifier(function () { if (!b.choro.lp) b.choro.lp = {}; if (ll) b.choro.lp[id] = ll; else delete b.choro.lp[id]; }); },
      onCountryPick: function (id) {
        cheatBlock = b.id; updateCheat();
        var vw = chView(b, doc);
        if (vw && id in vw.data) { chFocus(b, id); return; }
        if (b.choro && b.choro.src) { var cn = MapKit.choro.index().by[id]; toast((cn ? cn.name : id) + ' ne figure pas dans le tableau source'); return; }
        var q = $('.ch-q[data-b="' + b.id + '"]', app), c = MapKit.choro.index().by[id]; if (!q || !c) return;
        q.value = c.name; q.focus({ preventScroll: true }); chSearch(q);
      },
      onStepPick: function (i, j) { focusIn('.st-in[data-b="' + b.id + '"][data-rt="' + i + '"][data-s="' + j + '"]'); },
      onPick: function (kind, i) { focusIn(kind === 'zone' ? '.zn-in[data-b="' + b.id + '"][data-zn="' + i + '"]' : '.rt-in[data-b="' + b.id + '"][data-rt="' + i + '"]'); }
    });
    inst.blockId = b.id; maps.push(inst);
    if (ed && mapUi.editOf === b.id && mapUi.edit) {
      // forme disparue (annulation, modification reçue) : le rendu a déjà relâché son ✎, on quitte l'édition
      if (mapShapeAlive(b, mapUi.edit)) inst.setEdit(mapUi.edit.kind, mapUi.edit.i); else setMapMode(null, null);
    }
    if (ed && mapUi.draw === b.id) inst.setDrawMode(mapUi.kind);
    if (ed && mapUi.add === b.id) inst.setAddMode(true);
  });
}
function addMarker(b, lat, lon, label) {
  keepView(b);
  session.modifier(function () { b.markers.push({ lat: lat, lon: lon, label: label || '', color: 'accent' }); });
  if (!label) { var inp = $('.mk-in[data-b="' + b.id + '"][data-mk="' + (b.markers.length - 1) + '"][data-p=label]', app); if (inp) inp.focus({ preventScroll: true }); }
}
function parseLL(s) {
  var m = String(s).trim().match(/^(-?\d+(?:[.,]\d+)?)\s*°?\s*([NS])?\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)\s*°?\s*([EWO])?$/i);
  if (!m) return null;
  var lat = parseFloat(m[1].replace(',', '.')), lon = parseFloat(m[3].replace(',', '.'));
  if (m[2] && /s/i.test(m[2])) lat = -Math.abs(lat);
  if (m[4] && /[wo]/i.test(m[4])) lon = -Math.abs(lon);
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return null;
  return { lat: +lat.toFixed(5), lon: +lon.toFixed(5) };
}
var placeIdx = null;
function places() {
  if (placeIdx) return placeIdx;
  if (!MapKit) MapKit = ardoiseMapKit();
  var D = MapKit.data(), cn = D.cn || [];
  placeIdx = D.cities.map(function (c) {
    var shown = c[1] || c[0];
    return { n: norm(shown), n2: c[1] ? norm(c[0]) : '', label: shown, lat: c[3], lon: c[2],
      sub: (cn[c[4]] || '') + ' · ' + (c[7] ? 'capitale' : 'ville') + (c[5] >= 1 ? ' · ' + (c[5] >= 1000 ? (c[5] / 1000).toFixed(1).replace('.0', '').replace('.', ',') + ' M' : c[5] + ' k') + ' hab.' : '') };
  }).concat(D.ports.map(function (p) {
    return { n: norm(p[0]), n2: '', label: p[0], lat: p[2], lon: p[1], sub: (p[3] >= 0 && cn[p[3]] ? cn[p[3]] + ' · ' : '') + 'port' };
  }));
  return placeIdx;
}
function mapSearch(inp) {
  var res = inp.parentNode.querySelector('.map-res'), q = inp.value.trim(), items = [];
  if (!q) { res.hidden = true; res.innerHTML = ''; res._items = []; return; }
  var c = parseLL(q);
  if (c) items.push({ label: '', lat: c.lat, lon: c.lon, t: 'Point ' + c.lat + ', ' + c.lon, sub: 'Coordonnées' });
  var nq = norm(q), first = [], other = [];
  places().forEach(function (pl) {
    if (pl.n.indexOf(nq) === 0 || (pl.n2 && pl.n2.indexOf(nq) === 0)) first.push(pl);
    else if (nq.length >= 3 && (pl.n.indexOf(nq) > 0 || (pl.n2 && pl.n2.indexOf(nq) > 0))) other.push(pl);
  });
  first.concat(other).slice(0, 10).forEach(function (pl) { items.push({ label: pl.label, lat: pl.lat, lon: pl.lon, t: pl.label, sub: pl.sub }); });
  res._items = items; res._cur = 0;
  res.innerHTML = items.length ? items.map(function (it, i) { return '<button type="button" class="mi' + (i ? '' : ' act') + '" data-r="' + i + '"><span><b>' + esc(it.t) + '</b><small>' + esc(it.sub) + '</small></span></button>'; }).join('')
    : '<div class="menu-empty">Aucune ville ni aucun port trouvé. Vous pouvez entrer des coordonnées « latitude, longitude ».</div>';
  res.hidden = false;
}
function pickResult(inp, i) {
  var res = inp.parentNode.querySelector('.map-res'), it = (res._items || [])[i]; if (!it) return;
  var b = byId(inp.dataset.b), m = mapOf(b.id);
  if (m) { m.center(+it.lat, +it.lon, 6); }
  inp.value = ''; res.hidden = true;
  addMarker(b, +it.lat, +it.lon, it.label);
}
function paintCode(t, b) {
  var pre = t.previousElementSibling; if (!pre || !pre.classList.contains('ta-hl')) return;
  pre.innerHTML = HL.html(t.value, HL.resolve(b.lang, t.value, b.name)) + '\n';
}
function syncCodeLayer(t) {
  // le calque coloré reprend exactement les marges et la police de la zone de saisie
  var pre = t.previousElementSibling; if (!pre || !pre.classList.contains('ta-hl')) return;
  var cs = getComputedStyle(t);
  pre.style.padding = cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft;
  pre.style.font = cs.font; pre.style.tabSize = cs.tabSize; pre.style.letterSpacing = cs.letterSpacing;
  pre.scrollLeft = t.scrollLeft;
}
function autosize(t) { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; }

