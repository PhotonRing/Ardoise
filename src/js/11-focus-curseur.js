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
  return r.toString() === '' && !r.cloneContents().querySelector('br');
}
function caretAtEnd(el) {
  var s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return false;
  var r = document.createRange(); r.selectNodeContents(el); r.setStart(s.anchorNode, s.anchorOffset);
  return r.toString() === '';
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

