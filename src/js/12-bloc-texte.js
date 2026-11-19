/* ---------- Bloc texte : saisie des lignes ---------- */
// Le champ d'un bloc texte (data-texte) contient une div.lg par ligne. Les gestes à l'intérieur du bloc changent ce DOM
// en place puis passent par la saisie (fire), ce qui garde le curseur ; ceux qui touchent un autre bloc passent par session.modifier.
function lignesDe(el) { return Array.prototype.filter.call(el.children, function (x) { return x.classList.contains('lg'); }); }
function ligneVideEl(lg) { return lg.textContent.replace(/​/g, '') === '' && !lg.querySelector('img'); }
function poserNiveau(lg, n) { n = Math.max(0, Math.min(LIGNE_LV_MAX, n)); if (n) lg.dataset.lv = n; else lg.removeAttribute('data-lv'); }
function niveauEl(lg) { return +lg.dataset.lv || 0; }
// tout nœud du champ rangé dans une ligne (une suppression ou un collage natifs en laissent hors des lignes) ; curseur gardé par un repère
function reparerLignes(el) {
  var egares = Array.prototype.some.call(el.childNodes, function (n) { return !(n.nodeType === 1 && n.nodeName === 'DIV' && n.classList.contains('lg')); });
  if (egares) {
    var s = getSelection(), rep = null;
    if (s.rangeCount && s.isCollapsed && el.contains(s.anchorNode)) { rep = document.createElement('span'); rep.setAttribute('data-repere', ''); s.getRangeAt(0).insertNode(rep); }
    var cur = null;
    Array.prototype.slice.call(el.childNodes).forEach(function (n) {
      if (n.nodeType === 1 && (n.nodeName === 'DIV' || n.nodeName === 'P')) {
        cur = null; if (n.nodeName === 'DIV' && n.classList.contains('lg')) return;
        var d = document.createElement('div'); d.className = 'lg'; while (n.firstChild) d.appendChild(n.firstChild); n.replaceWith(d); return;
      }
      if (n.nodeType === 3 && !n.nodeValue.trim() && !cur && n !== rep) { n.remove(); return; }   // blancs entre deux lignes
      if (n.nodeName === 'BR') { if (cur) { n.remove(); cur = null; return; } cur = document.createElement('div'); cur.className = 'lg'; n.replaceWith(cur); cur.appendChild(n); cur = null; return; }
      if (!cur) { cur = document.createElement('div'); cur.className = 'lg'; el.insertBefore(cur, n); }
      cur.appendChild(n);
    });
    if (rep && rep.parentNode) { var r = document.createRange(); r.setStartBefore(rep); r.collapse(true); rep.remove(); s.removeAllRanges(); s.addRange(r); }
  }
  if (!el.firstChild) { var v = document.createElement('div'); v.className = 'lg'; el.appendChild(v); caretTo(v, false); }
  lignesDe(el).forEach(function (lg) { if (!lg.firstChild) lg.appendChild(document.createElement('br')); });   // ligne vide : le curseur peut y entrer
}
// DOM → lignes (valeur du champ à chaque saisie)
function lignesDuChamp(el) {
  reparerLignes(el);
  return normLignes(lignesDe(el).map(function (lg) { return ligne(sanitize(lg.innerHTML), niveauEl(lg)); }));
}
function ligneDuNoeud(el, n) { while (n && n.parentNode !== el) n = n.parentNode; return n && n.nodeType === 1 && n.classList.contains('lg') ? n : null; }
// curseur au début (dir < 0) ou à la fin (dir > 0) de sa ligne
function auBordDeLigne(lg, r, dir) {
  var t = document.createRange(); t.selectNodeContents(lg);
  if (dir < 0) t.setEnd(r.startContainer, r.startOffset); else t.setStart(r.endContainer, r.endOffset);
  if (t.toString().replace(/​/g, '') !== '') return false;
  var brs = t.cloneContents().querySelectorAll('br');
  return !brs.length || (dir > 0 && brs.length === 1 && lg.lastChild && lg.lastChild.nodeName === 'BR');   // le <br> qui tient une ligne vide
}
// joint la ligne b à la fin de la ligne a ; curseur à la jointure
function joindreLignes(el, a, b) {
  if (ligneVideEl(a)) a.innerHTML = '';
  if (ligneVideEl(b) && !b.querySelector('br:not(:last-child)')) b.innerHTML = '';
  var n = a.childNodes.length;
  while (b.firstChild) a.appendChild(b.firstChild);
  b.remove();
  if (!a.firstChild) a.appendChild(document.createElement('br'));
  var r = document.createRange(); r.setStart(a, Math.min(n, a.childNodes.length)); r.collapse(true);
  var s = getSelection(); s.removeAllRanges(); s.addRange(r);
  fire(el);
}
// curseur dans la ligne i d'un bloc texte, au caractère off (après un rendu)
function caretLigne(bid, i, off) {
  var el = $('.fld[data-b="' + bid + '"][data-texte]', app); if (!el) return;
  var lg = lignesDe(el)[i]; if (!lg) return;
  el.focus({ preventScroll: true }); setCaretOffset(lg, off);
}
// Retour arrière au début de la première ligne : bloc vide supprimé, ou jonction au bloc du dessus
function retourAuBloc(el, b) {
  var ls = lignesDuChamp(el), o = position(b); if (!o) return;
  var pb = o.liste[o.i - 1];
  if (texteVide(ls) && (o.parent || doc.blocks.length > 1)) { deleteBlock(b, true); return; }
  if (pb && pb.type === 'texte') {
    var der = pb.lignes.length - 1, off = htmlText(pb.lignes[der].html).length;
    session.modifier(function () {
      var j = {}, k; for (k in pb.lignes[der]) j[k] = pb.lignes[der][k];
      j.html = pb.lignes[der].html + ls[0].html;
      pb.lignes = pb.lignes.slice(0, der).concat([j], ls.slice(1)); o.liste.splice(o.i, 1);
    });
    caretLigne(pb.id, der, off); return;
  }
  if (pb && ['h2', 'h3', 'subtitle'].indexOf(pb.type) >= 0 && ls.length === 1) {
    var lon = htmlText(pb.html).length;
    session.modifier(function () { pb.html = pb.html + ls[0].html; o.liste.splice(o.i, 1); }, { b: pb.id, end: true });
    var t = $('.fld[data-b="' + pb.id + '"]', app); if (t) setCaretOffset(t, lon);
  }
}
// touches d'un bloc texte ; vrai si la touche est traitée ici (le reste du gestionnaire de 12-saisie.js est alors sauté)
function toucheTexte(e, el, b) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return false;
  var s = getSelection(); if (!s.rangeCount || !el.contains(s.anchorNode)) return false;
  var r = s.getRangeAt(0), lignes = lignesDe(el), lg = ligneDuNoeud(el, r.startContainer), i = lignes.indexOf(lg);
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!s.isCollapsed) { r.deleteContents(); reparerLignes(el); lignes = lignesDe(el); r = s.getRangeAt(0); lg = ligneDuNoeud(el, r.startContainer); i = lignes.indexOf(lg); }
    if (!lg) return true;
    if (ligneVideEl(lg) && i === lignes.length - 1) {
      // ligne vide en dernière ligne : elle remonte d'un niveau, puis au niveau 0 laisse la place à un bloc texte neuf
      if (niveauEl(lg) > 0) { poserNiveau(lg, niveauEl(lg) - 1); fire(el); return true; }
      if (lignes.length > 1) lg.remove();
      b.lignes = lignesDuChamp(el); insertAfter(b, 'texte', {}); return true;
    }
    var fin = document.createRange(); fin.selectNodeContents(lg); fin.setStart(r.startContainer, r.startOffset);
    var nl = document.createElement('div'); nl.className = 'lg'; poserNiveau(nl, niveauEl(lg)); nl.appendChild(fin.extractContents());
    if (ligneVideEl(nl) && !nl.querySelector('br:not(:last-child)')) nl.innerHTML = '<br>';
    if (ligneVideEl(lg) && !lg.querySelector('br')) lg.innerHTML = '<br>';
    lg.after(nl); caretTo(nl, false); fire(el); return true;
  }
  if (e.key === 'Tab') {
    // ±1 niveau sur toutes les lignes touchées par la sélection
    e.preventDefault();
    var a = lignes.indexOf(ligneDuNoeud(el, r.startContainer)), z = lignes.indexOf(ligneDuNoeud(el, r.endContainer));
    if (a < 0 || z < 0) return true;
    for (var j = a; j <= z; j++) poserNiveau(lignes[j], niveauEl(lignes[j]) + (e.shiftKey ? -1 : 1));
    fire(el); return true;
  }
  if (!lg) return false;
  if (e.key === 'Backspace' && s.isCollapsed && auBordDeLigne(lg, r, -1)) {
    e.preventDefault();
    if (niveauEl(lg) > 0) { poserNiveau(lg, niveauEl(lg) - 1); fire(el); return true; }
    if (i > 0) { joindreLignes(el, lignes[i - 1], lg); return true; }
    retourAuBloc(el, b); return true;
  }
  if (e.key === 'Delete' && s.isCollapsed && i < lignes.length - 1 && auBordDeLigne(lg, r, 1)) { e.preventDefault(); joindreLignes(el, lg, lignes[i + 1]); return true; }
  if (e.key === '/' && texteVide(lignesDuChamp(el))) { e.preventDefault(); slashMenu(el, b); return true; }
  // flèches haut et bas : de ligne en ligne dans le champ ; on n'en sort que depuis la première ou la dernière ligne
  if (e.key === 'ArrowUp' && i > 0) return true;
  if (e.key === 'ArrowDown' && i < lignes.length - 1) return true;
  return false;
}
