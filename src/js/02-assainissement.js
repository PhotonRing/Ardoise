/* ---------- Assainissement du texte riche ---------- */
var SPAN_CLASSES = ['pill', 'p-ok', 'p-bad', 'p-warn', 'p-info', 'alert'];
var DROP = /^(script|style|iframe|object|embed|meta|link|title|head|template|svg|math|noscript|input|button|select|textarea|img|video|audio|canvas|form)$/;
var BLOCKY = /^(div|p|li|h[1-6]|tr|blockquote|pre|dt|dd|section|article)$/;
var sanCache = new Map();
function sanitize(html) {
  html = String(html == null ? '' : html);
  if (!/[<&]/.test(html)) return html;
  if (sanCache.has(html)) return sanCache.get(html);
  var t = document.createElement('template'); t.innerHTML = html;
  var out = document.createElement('div');
  walk(t.content, out);
  var s = out.innerHTML.replace(/(<br>\s*)+$/, '');
  if (sanCache.size > 2000) sanCache.clear();
  sanCache.set(html, s);
  return s;
}
function walk(src, dst) {
  var kids = Array.prototype.slice.call(src.childNodes);
  for (var i = 0; i < kids.length; i++) {
    var n = kids[i];
    if (n.nodeType === 3) { dst.appendChild(document.createTextNode(n.nodeValue)); continue; }
    if (n.nodeType !== 1) continue;
    var tag = n.tagName.toLowerCase(), el = null;
    if (DROP.test(tag)) continue;
    if (tag === 'br') { dst.appendChild(document.createElement('br')); continue; }
    if (tag === 'b' || tag === 'strong') el = document.createElement('b');
    else if (tag === 'i' || tag === 'em') el = document.createElement('i');
    else if (tag === 'u') el = document.createElement('u');
    else if (tag === 's' || tag === 'strike' || tag === 'del') el = document.createElement('s');
    else if (tag === 'code' || tag === 'kbd' || tag === 'samp') el = document.createElement('code');
    else if (tag === 'a') {
      var h = (n.getAttribute('href') || '').trim();
      if (/^(https?:|mailto:|#)/i.test(h)) {
        el = document.createElement('a'); el.setAttribute('href', h);
        if (/^https?:/i.test(h)) { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener'); }
      }
    } else if (tag === 'span') {
      var cls = Array.prototype.filter.call(n.classList, function (c) { return SPAN_CLASSES.indexOf(c) >= 0; });
      if (cls.length) { el = document.createElement('span'); el.className = cls.join(' '); }
      else {
        var st = n.getAttribute('style') || '';
        if (/font-weight:\s*(bold|[6-9]00)/i.test(st)) el = document.createElement('b');
        else if (/font-style:\s*italic/i.test(st)) el = document.createElement('i');
      }
    }
    if (el) { walk(n, el); if (el.childNodes.length) dst.appendChild(el); }
    else walk(n, dst);
    if (BLOCKY.test(tag) && n.nextSibling && dst.lastChild && dst.lastChild.nodeName !== 'BR') dst.appendChild(document.createElement('br'));
  }
}
var R = sanitize;
function textOf(html) { var d = document.createElement('div'); d.innerHTML = R(html); return d.textContent.replace(/\s+/g, ' ').trim(); }
function isBlank(html) { return !textOf(html); }

