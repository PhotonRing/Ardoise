/* ---------- Focus et curseur ---------- */
function focusField(bid, k, atEnd) {
  var sel = '[data-b="' + bid + '"]' + (k ? '[data-k="' + k + '"]' : '');
  var el = $(sel + '.fld', app) || $('textarea' + sel, app) || $('.blk[data-id="' + bid + '"] .fld', app) || $('.blk[data-id="' + bid + '"] textarea', app);
  if (!el) return;
  el.focus({ preventScroll: true });
  if (el.tagName === 'TEXTAREA') { var p = atEnd ? el.value.length : 0; el.setSelectionRange(p, p); }
  else caretTo(el, atEnd);
  var r = el.getBoundingClientRect();
  if (r.top < 60 || r.bottom > innerHeight - 20) el.scrollIntoView({ block: 'center' });
}
function caretTo(el, atEnd) {
  var r = document.createRange(); r.selectNodeContents(el); r.collapse(!atEnd);
  var s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
function caretAtStart(el) {
  var s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return false;
  var r = document.createRange(); r.selectNodeContents(el); r.setEnd(s.anchorNode, s.anchorOffset);
  return r.toString().replace(/\u200B/g, '') === '' && !r.cloneContents().querySelector('br');
}
function caretAtEnd(el) {
  var s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return false;
  var r = document.createRange(); r.selectNodeContents(el); r.setStart(s.anchorNode, s.anchorOffset);
  return r.toString().replace(/\u200B/g, '') === '';
}
// Sortir d'une mise en forme en ligne (pastille, code, lien, texte rouge) : flèche au bord de l'élément,
// ou clic à côté de lui. Le curseur est posé sur un espace sans chasse placé contre l'élément, sinon le
// navigateur le laisse à l'intérieur (notamment quand l'élément est seul sur sa ligne)
var INLINE_SEL = 'span.pill, span.alert, code, a';
function inlineEdge(fld, dir) {
  // élément en ligne dont le curseur (ou la fin de la sélection) touche le bord, dans le sens dir
  var s = getSelection(); if (!s.rangeCount) return null;
  var r = s.getRangeAt(0), node = dir > 0 ? r.endContainer : r.startContainer, off = dir > 0 ? r.endOffset : r.startOffset;
  var host = node.nodeType === 1 ? node : node.parentNode, il = host && host.closest ? host.closest(INLINE_SEL) : null;
  if (!il || il === fld || !fld.contains(il)) return null;
  var t = document.createRange(); t.selectNodeContents(il);
  if (dir > 0) t.setStart(node, off); else t.setEnd(node, off);
  return t.toString().replace(/\u200B/g, '') === '' ? il : null;
}
function exitInline(il, dir) {
  var sib = dir > 0 ? il.nextSibling : il.previousSibling, tn;
  if (sib && sib.nodeType === 3 && sib.nodeValue.charAt(dir > 0 ? 0 : sib.nodeValue.length - 1) === '\u200B') tn = sib;
  else { tn = document.createTextNode('\u200B'); il.parentNode.insertBefore(tn, dir > 0 ? il.nextSibling : il); }
  var r = document.createRange(); r.setStart(tn, dir > 0 ? 1 : tn.nodeValue.length - 1); r.collapse(true);
  var s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
function caretOffset(el) {
  // position du curseur en nombre de caractères depuis le début du champ
  var s = getSelection(); if (!s.rangeCount || !el.contains(s.anchorNode)) return 0;
  var r = document.createRange(); r.selectNodeContents(el); r.setEnd(s.anchorNode, s.anchorOffset);
  return r.toString().length;
}
function setCaretOffset(el, n) {
  var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), t, r = document.createRange();
  while ((t = w.nextNode())) { if (n <= t.nodeValue.length) { r.setStart(t, n); r.collapse(true); var s = getSelection(); s.removeAllRanges(); s.addRange(r); return; } n -= t.nodeValue.length; }
  caretTo(el, true);
}
function extractTail(el) {
  var s = getSelection(); var r0 = s.getRangeAt(0); r0.deleteContents();
  var r = document.createRange(); r.selectNodeContents(el); r.setStart(r0.startContainer, r0.startOffset);
  var d = document.createElement('div'); d.appendChild(r.extractContents());
  return sanitize(d.innerHTML);
}
function fieldValue(el) {
  if (el.hasAttribute('data-rich')) return sanitize(el.innerHTML);
  return el.textContent.replace(/\s*\n\s*/g, ' ');
}
function nextField(el, dir) {
  var all = $$('.fld, textarea.code-ta', app), i = all.indexOf(el);
  var n = all[i + (dir || 1)]; if (n) { n.focus(); if (n.tagName !== 'TEXTAREA') caretTo(n, dir < 0); }
}

