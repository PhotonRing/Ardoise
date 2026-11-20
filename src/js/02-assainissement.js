/* ---------- Assainissement du texte riche ---------- */
// palettes de la barre de mise en forme : [classe, nom] ; Rouge garde la classe alert de l'ancien bouton « A » (aucune migration)
var COULEURS_TEXTE = [['alert', 'Rouge'], ['c-orange', 'Orange'], ['c-vert', 'Vert'], ['c-bleu', 'Bleu'], ['c-violet', 'Violet'], ['c-gris', 'Gris']];
var SURLIGNAGES = [['s-jaune', 'Jaune'], ['s-vert', 'Vert'], ['s-bleu', 'Bleu'], ['s-rose', 'Rose'], ['s-gris', 'Gris']];
// pastille, formule, couleurs et surlignages, et pc-N : couleur d'exception d'une pastille ; un ancien taquet (span.tab) est défait
var SPAN_CLASSES = ['pill', 'formule'].concat(COULEURS_TEXTE.concat(SURLIGNAGES).map(function (x) { return x[0]; }));
var DROP = /^(script|style|iframe|object|embed|meta|link|title|head|template|svg|math|noscript|input|button|select|textarea|img|video|audio|canvas|form)$/;
var BLOCKY = /^(div|p|li|h[1-6]|tr|blockquote|pre|dt|dd|section|article)$/;
var sanCache = new Map();
function sanitize(html) {
  html = String(html == null ? '' : html).replace(/\u200B/g, '');   // espaces sans chasse posés pour sortir d'une pastille
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
// collage HTML dans un champ d'une ligne : blancs hors balises compactés (l'insertion en ferait des espaces insécables)
function compacterLigne(html) {
  var morceaux = String(html == null ? '' : html).split(/(<(?:[^>"']|"[^"]*"|'[^']*')*>)/), i;
  for (i = 0; i < morceaux.length; i += 2) morceaux[i] = morceaux[i].replace(/[ \t\n\r\f]+/g, ' ');
  for (i = 0; i < morceaux.length; i += 2) { morceaux[i] = morceaux[i].replace(/^ /, ''); if (morceaux[i]) break; }
  for (i = morceaux.length - 1; i >= 0; i -= 2) { morceaux[i] = morceaux[i].replace(/ $/, ''); if (morceaux[i]) break; }
  return morceaux.join('');
}
// collage de texte brut dans un champ d'une ligne : un < ou un > y est du texte, pas une balise
function compacterTexte(texte) { return String(texte == null ? '' : texte).replace(/\s+/g, ' ').trim(); }
function walk(src, dst) {
  var kids = Array.prototype.slice.call(src.childNodes);
  for (var i = 0; i < kids.length; i++) {
    var n = kids[i];
    if (n.nodeType === 3) { dst.appendChild(document.createTextNode(n.nodeValue)); continue; }
    if (n.nodeType !== 1) continue;
    var tag = n.tagName.toLowerCase(), el = null;
    if (tag === 'math' || (tag === 'span' && n.classList.contains('formule'))) { formuleRelue(n, tag, dst); continue; }
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
      var cls = Array.prototype.filter.call(n.classList, function (c) { return SPAN_CLASSES.indexOf(c) >= 0 || (/^pc-\d{1,2}$/.test(c) && +c.slice(3) < TAG_COLORS && n.classList.contains('pill')); });
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
// formule (05-formules.js) : l'élément rendu, ou un <math> qui porte sa source LaTeX en annotation, est relu en
// <span class="formule">source</span> ; la forme stockée garde son texte ; un <math> sans annotation est jeté
function formuleRelue(n, tag, dst) {
  var an = n.querySelector('annotation[encoding="application/x-tex"]');
  var src = an ? an.textContent : (tag === 'span' && !n.querySelector('math') ? n.textContent : '');
  if (!src.trim()) return;
  var el = document.createElement('span'); el.className = 'formule'; el.textContent = src; dst.appendChild(el);
}
var R = sanitize;
function textOf(html) { var d = document.createElement('div'); d.innerHTML = R(html); return d.textContent.replace(/\s+/g, ' ').trim(); }
function isBlank(html) { return !textOf(html); }

