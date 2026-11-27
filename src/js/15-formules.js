/* ---------- Formules dans un champ en édition ---------- */
// Une formule insérée dans le DOM sous sa forme stockée (<span class="formule">source</span>, après un collage) est
// remplacée sur place par son élément rendu, non éditable (05-formules.js), comme paintPill pour une pastille.
function peindreFormulesDans(el) {
  $$('span.formule', el).forEach(function (f) {
    if (f.querySelector('math')) return;
    var m = texEnMathML(f.textContent, 'ligne');
    if (!m) { f.parentNode.removeChild(f); return; }
    f.contentEditable = 'false'; f.innerHTML = m;
  });
}
/* ---------- Saisie `$…$` ---------- */
// Le `$` qui ferme `$…$` (règle des dollars, dollarsFermes) change la source en formule, dans un champ riche, hors code,
// lien et pastille. Détection par input, pour le clavier virtuel ; la transformation est une étape d'historique à part.
function saisieDollars(fld) {
  var s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return null;
  var n = s.anchorNode, off = s.anchorOffset; if (!n || n.nodeType !== 3 || !fld.contains(n)) return null;
  var dans = n.parentNode.closest('span.pill, span.formule, code, a'); if (dans && fld.contains(dans)) return null;
  var x = dollarsFermes(n.nodeValue.slice(0, off), n.nodeValue.slice(off)); if (!x) return null;
  var source = x.source.replace(/​/g, ''); if (!source.trim()) return null;
  return { noeud: n, debut: x.debut, fin: off, source: source };
}
function poserFormuleSaisie(fld) {
  var x = saisieDollars(fld); if (!x) return;
  session.valider();   // la frappe, `$` compris, est une étape : Ctrl+Z rend la source et ses dollars
  var r = document.createRange(); r.setStart(x.noeud, x.debut); r.setEnd(x.noeud, x.fin); r.deleteContents();
  var t = document.createElement('template'); t.innerHTML = formuleHTML(x.source, true); var f = t.content.firstChild;
  r.insertNode(f); exitInline(f, 1); fire(fld);
  session.valider();
}
app.addEventListener('input', function (e) {
  var el = e.target;
  if (mode !== 'edit' || e.isComposing || !/^insert(Text|CompositionText)$/.test(e.inputType || '') || !el.matches || !el.matches('.fld[data-rich]')) return;
  poserFormuleSaisie(el);
});
app.addEventListener('compositionend', function (e) {   // clavier virtuel : le `$` composé n'est relu qu'à la fin de la composition
  var el = mode === 'edit' && e.target.closest && e.target.closest('.fld[data-rich]'); if (el) poserFormuleSaisie(el);
});
/* ---------- Formule sautée et supprimée d'un coup ---------- */
// formule contre le curseur dans le sens dir, en passant les espaces sans chasse (posés par exitInline) et en traversant
// gras et teintes : { f, zw } (zw : [nœud, début, fin] des espaces sans chasse entre le curseur et elle), ou null
var ENVELOPPE_RE = /^(B|I|U|S|EM|STRONG|SPAN)$/;
function formuleVoisine(fld, dir) {
  var s = getSelection(); if (!s.rangeCount || !s.isCollapsed || !fld.contains(s.anchorNode)) return null;
  var n = s.anchorNode, off = s.anchorOffset, zw = [], x;
  var apres = function (c) {   // nœud voisin de c dans le sens dir, en sortant des enveloppes en ligne
    while (!(dir > 0 ? c.nextSibling : c.previousSibling)) { c = c.parentNode; if (c === fld || !ENVELOPPE_RE.test(c.nodeName) || c.matches('span.pill')) return null; }
    return dir > 0 ? c.nextSibling : c.previousSibling;
  };
  if (n.nodeType === 3) {
    var a = dir > 0 ? off : 0, b = dir > 0 ? n.nodeValue.length : off;
    if (n.nodeValue.slice(a, b).replace(/​/g, '')) return null;
    if (b > a) zw.push([n, a, b]);
    x = apres(n);
  } else x = (dir > 0 ? n.childNodes[off] : n.childNodes[off - 1]) || (n !== fld && ENVELOPPE_RE.test(n.nodeName) ? apres(n) : null);
  while (x) {
    if (x.nodeType === 3) { if (x.nodeValue.replace(/​/g, '')) return null; zw.push([x, 0, x.nodeValue.length]); x = apres(x); continue; }
    if (x.nodeType !== 1) return null;
    if (x.matches('span.formule')) return { f: x, zw: zw };
    if (!ENVELOPPE_RE.test(x.nodeName) || x.matches('span.pill') || !x.firstChild) return null;
    x = dir > 0 ? x.firstChild : x.lastChild;
  }
  return null;
}
app.addEventListener('keydown', function (e) {
  var el = e.target, k = e.key;
  if (mode !== 'edit' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.isComposing || !el.matches || !el.matches('.fld[data-rich]')) return;
  var dir = k === 'ArrowRight' || k === 'Delete' ? 1 : k === 'ArrowLeft' || k === 'Backspace' ? -1 : 0; if (!dir) return;
  var v = formuleVoisine(el, dir); if (!v) return;
  e.preventDefault(); e.stopPropagation();   // ni le geste du navigateur, ni la sortie d'une pastille (12-saisie.js)
  if (dir === (k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0)) { exitInline(v.f, dir); return; }
  session.valider();   // la frappe d'avant est une étape, la suppression de la formule en est une autre
  v.zw.forEach(function (z) { z[0].deleteData(z[1], z[2] - z[1]); });
  var p = v.f.parentNode, i = Array.prototype.indexOf.call(p.childNodes, v.f); p.removeChild(v.f);
  var r = document.createRange(); r.setStart(p, i); r.collapse(true);
  var s = getSelection(); s.removeAllRanges(); s.addRange(r);
  fire(el);
  session.valider();
}, true);
/* ---------- Gras, italique, souligné, barré autour d'une formule ---------- */
// La forme posée par le navigateur (execCommand ou raccourci) s'arrête aux bords d'un élément non éditable :
// <b>a </b>formule<b> b</b>. Une formule de la sélection rejoint la forme voisine de la même balise.
var FORME_BALISES = { formatBold: /^(B|STRONG)$/, formatItalic: /^(I|EM)$/, formatUnderline: /^U$/, formatStrikeThrough: /^(S|STRIKE)$/ };
function formulesDansLaForme(fld, balise) {
  var s = getSelection(); if (!s.rangeCount) return false;
  var voisin = function (n, dir) {   // élément voisin, espaces sans chasse passés
    for (n = dir > 0 ? n.nextSibling : n.previousSibling; n && n.nodeType === 3 && !n.nodeValue.replace(/​/g, ''); n = dir > 0 ? n.nextSibling : n.previousSibling);
    return n && n.nodeType === 1 && balise.test(n.nodeName) ? n : null;
  };
  var change = false;
  $$('span.formule', fld).forEach(function (f) {
    if (!s.containsNode(f, false)) return;
    var a = voisin(f, -1), z = voisin(f, 1); if (!a && !z) return;
    if (a) { while (a.nextSibling !== f) a.appendChild(a.nextSibling); a.appendChild(f); if (z) { while (z.firstChild) a.appendChild(z.firstChild); z.parentNode.removeChild(z); } }
    else { while (z.previousSibling !== f) z.insertBefore(z.previousSibling, z.firstChild); z.insertBefore(f, z.firstChild); }
    change = true;
  });
  return change;
}
app.addEventListener('input', function (e) {
  var el = e.target, balise = FORME_BALISES[e.inputType];
  if (mode === 'edit' && balise && el.matches && el.matches('.fld[data-rich]') && formulesDansLaForme(el, balise)) fire(el);
});
/* Fenêtre de la formule (édition) : un clic ou un toucher sur une formule ouvre sous elle sa source et l'aperçu en direct.
   Le texte ne change qu'à la fermeture (Entrée, Échap ou clic ailleurs : toutes valident) : une source modifiée est écrite
   en une étape d'historique, une source vidée retire la formule ; le curseur revient juste après la formule. */
function sourceFormule(el) { var a = el.querySelector('annotation'); return a ? a.textContent : el.textContent; }
function ouvrirFenetreFormule(el) {
  var fld = fieldOf(el); if (!fld) return;
  closePop(); hideLinkTip(); hidePillTip();
  var avant = sourceFormule(el);
  var p = document.createElement('div'); p.className = 'pop formule-pop'; pop = p;
  p.innerHTML = '<input class="menu-q" data-fsrc spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Source LaTeX de la formule" value="' + esc(avant) + '"><div class="f-apercu"></div>';
  var champ = $('[data-fsrc]', p), apercu = $('.f-apercu', p);
  var dessiner = function () { var m = texEnMathML(champ.value, 'ligne'); apercu.innerHTML = m || '<span class="muted">La formule sera retirée</span>'; };
  champ.addEventListener('input', dessiner);
  champ.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePop(); } });
  dessiner();
  placePop(p, el);
  popClose = function () { validerFormule(el, fld, avant, champ.value); };
  champ.focus({ preventScroll: true }); champ.select();
}
function validerFormule(el, fld, avant, source) {
  if (!fld.contains(el)) { if (source !== avant) toast('La formule a changé entre-temps : modifiez-la à nouveau'); return; }
  fld.focus({ preventScroll: true });
  exitInline(el, 1);   // curseur juste après la formule, gardé si elle est retirée
  if (source === avant) return;
  session.valider();   // la frappe en attente dans le champ est une étape, la formule en est une autre
  var m = texEnMathML(source, 'ligne');
  if (m) el.innerHTML = m; else el.parentNode.removeChild(el);
  fire(fld);
  session.valider();
}
app.addEventListener('mousedown', function (e) {
  // le navigateur ne pose pas la sélection autour de la formule : le clic ouvre sa fenêtre
  if (mode === 'edit' && e.target.closest && e.target.closest('.fld[data-rich] span.formule')) e.preventDefault();
});
app.addEventListener('click', function (e) {
  var el = mode === 'edit' && e.target.closest ? e.target.closest('span.formule') : null, fld = el && fieldOf(el);
  if (fld && fld.hasAttribute('data-rich') && fld.isContentEditable) ouvrirFenetreFormule(el);
});
