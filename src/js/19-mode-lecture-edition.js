/* ---------- Mode lecture / édition ---------- */
// bloc d'ancrage dans la vue cible (ctx comme renderPage) : le bloc lui-même, sinon le titre plié qui le masque,
// sinon (bloc qui n'affiche rien) le bloc affiché le plus proche, le précédent d'abord
function anchorBlock(d, ctx, id) {
  ctx = rctx(ctx, d);
  var blocks = d.pages[ctx.page].blocks, vf = ctx.folds, edit = ctx.view === 'edit';
  var fi = foldInfo(blocks, edit ? null : function (b) { return vf[b.id] != null ? vf[b.id] : !!b.folded; });
  var shown = function (b) { return !fi.hidden[b.id] && (edit || !!renderBlock(b, d, ctx, null)); };
  var a = fi.hidden[id] || id, i = -1, j;
  blocks.forEach(function (b, k) { if (b.id === a) i = k; });
  if (i < 0 || shown(blocks[i])) return a;
  for (j = i - 1; j >= 0; j--) if (shown(blocks[j])) return blocks[j].id;
  for (j = i + 1; j < blocks.length; j++) if (shown(blocks[j])) return blocks[j].id;
  return a;
}
// haut utile de l'écran : sous la barre d'outils fixe de l'édition
function viewTop() { var tb = $('.tb'); return tb ? tb.getBoundingClientRect().bottom : 0; }
// élément affiché d'un bloc : .blk[data-id] en édition, [data-bid] en lecture
function blockEl(id) { return $((mode === 'edit' ? '.blk[data-id="' : '[data-bid="') + id + '"]', app); }
// premier bloc affiché dont le bas passe sous le haut utile de l'écran, et son écart à ce haut
function topBlock() {
  var line = viewTop(), els = $$(mode === 'edit' ? '.blk[data-id]' : '[data-bid]', app);
  for (var i = 0; i < els.length; i++) {
    if (!els[i].getClientRects().length) continue;   // masqué (section pliée en lecture)
    var r = els[i].getBoundingClientRect();
    if (r.bottom > line) return { id: els[i].getAttribute(mode === 'edit' ? 'data-id' : 'data-bid'), dy: r.top - line };
  }
  return null;
}
var anchorHold = null, anchorT = 0;   // ancrage en cours de la dernière bascule, recalé au chargement des images au-dessus
var ANCHOR_STOP = ['wheel', 'touchstart', 'keydown', 'mousedown'];   // gestes du lecteur qui font céder l'ancrage
function anchorStop() { anchorHold = null; anchorListen(false); }
function anchorListen(on) { ANCHOR_STOP.forEach(function (t) { if (on) addEventListener(t, anchorStop, { once: true, passive: true }); else removeEventListener(t, anchorStop); }); }
function toggleMode() {
  session.valider();
  if (mode === 'view' && doc.lock && !unlocked) { askPassword(function () { toggleMode(); }); return; }
  if (mode === 'view' && doc.newer) { newerNotice(true); return; }
  // les écouteurs de la bascule précédente partent : la touche Ctrl+E en cours ne doit pas couper le nouvel ancrage
  clearTimeout(anchorT); anchorListen(false);
  var y = scrollY, top = topBlock();
  mode = mode === 'edit' ? 'view' : 'edit';
  closePop(); itb.style.display = 'none';
  render();
  var el = top && blockEl(anchorBlock(doc, viewCtx(), top.id));
  if (!el) { anchorHold = null; scrollTo(0, y); return; }
  // le bloc du haut de l'écran garde son écart au haut utile, maintenant et quand une image au-dessus finit de charger
  var hold = anchorHold = { el: el, dy: top.dy };
  var fix = function () { if (anchorHold === hold && el.isConnected) scrollBy(0, el.getBoundingClientRect().top - viewTop() - hold.dy); };
  fix();
  $$('img', app).forEach(function (im) {
    if (!im.complete && el.compareDocumentPosition(im) & Node.DOCUMENT_POSITION_PRECEDING) im.addEventListener('load', fix, { once: true });
  });
  // l'ancrage cède dès que le lecteur agit sur la page ; après la touche Ctrl+E en cours, qui remonte encore jusqu'à window
  anchorT = setTimeout(function () { anchorListen(true); });
}

