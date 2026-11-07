/* ---------- Mode lecture / édition ---------- */
// haut utile de l'écran : sous la barre d'outils fixe de l'édition
function viewTop() { var tb = $('.tb'); return tb ? tb.getBoundingClientRect().bottom : 0; }
// marque d'un bloc affiché selon le mode : attribut d'id et sélecteur (.blk[data-id] en édition, [data-bid] en lecture), du bloc id ou de tous
function blockMark(id) { var a = mode === 'edit' ? 'data-id' : 'data-bid'; return { attr: a, sel: (mode === 'edit' ? '.blk[' : '[') + a + (id == null ? '' : '="' + id + '"') + ']' }; }
function blockEl(id) { return $(blockMark(id).sel, app); }
// premier bloc affiché dont le bas passe sous le haut utile de l'écran, et son écart à ce haut
function topBlock() {
  var line = viewTop(), mk = blockMark(), els = $$(mk.sel, app);
  for (var i = 0; i < els.length; i++) {
    if (!els[i].getClientRects().length) continue;   // masqué (section pliée en lecture)
    var r = els[i].getBoundingClientRect();
    if (r.bottom > line) return { id: els[i].getAttribute(mk.attr), dy: r.top - line };
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

