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
/* ---------- Collage et copie (règles : 05-lignes.js) ---------- */
// couper dans un bloc texte : la sélection part et ses deux lignes de bord se joignent (sans commande d'édition : un couper lancé
// par execCommand('cut') refuse une seconde commande pendant son événement)
function couperLignes(el, r) {
  var a = ligneDuNoeud(el, r.startContainer), z = ligneDuNoeud(el, r.endContainer);
  r.deleteContents();
  if (a && z && a !== z && a.parentNode && z.parentNode) { joindreLignes(el, a, z); return; }
  reparerLignes(el); fire(el);
}
// lignes collées au curseur : la ligne du curseur est coupée, la première ligne collée se joint à son début, la dernière à sa fin ;
// chaque ligne collée garde son niveau, la première prend celui de la ligne du curseur. Une seule étape d'historique (fire).
function collerLignes(el, ls) {
  var s = getSelection(); if (!ls.length || !s.rangeCount) return;
  if (!s.isCollapsed) { s.getRangeAt(0).deleteContents(); reparerLignes(el); }
  var r = s.getRangeAt(0), lg = ligneDuNoeud(el, r.startContainer);
  if (!lg) { lg = lignesDe(el)[lignesDe(el).length - 1]; r = document.createRange(); r.selectNodeContents(lg); r.collapse(false); }
  if (ls.length === 1) {
    // inséré à la main : insertHTML de Chrome change une pastille collée seule en span à styles calculés
    var t = document.createElement('template'); t.innerHTML = ls[0].html;
    var der1 = t.content.lastChild; if (!der1) return;
    r.insertNode(t.content);
    var c1 = document.createRange(); c1.setStartAfter(der1); c1.collapse(true); s.removeAllRanges(); s.addRange(c1);
    $$('span.pill', el).forEach(paintPill);
    fire(el); return;
  }
  var fin = document.createRange(); fin.selectNodeContents(lg); fin.setStart(r.startContainer, r.startOffset);
  var queue = document.createElement('div'); queue.appendChild(fin.extractContents());
  if (ligneVideEl(lg)) lg.innerHTML = '';
  lg.insertAdjacentHTML('beforeend', ls[0].html);
  var der = lg;
  ls.slice(1).forEach(function (l) { var d = document.createElement('div'); d.className = 'lg'; poserNiveau(d, +l.lv || 0); d.innerHTML = l.html; der.after(d); der = d; });
  var n = der.childNodes.length;
  if (!ligneVideEl(queue) || queue.querySelector('br:not(:last-child)')) while (queue.firstChild) der.appendChild(queue.firstChild);
  [lg, der].forEach(function (x) { if (!x.firstChild) x.appendChild(document.createElement('br')); });
  var c = document.createRange(); c.setStart(der, Math.min(n, der.childNodes.length)); c.collapse(true); s.removeAllRanges(); s.addRange(c);
  $$('span.pill', el).forEach(paintPill);
  fire(el);
}
// lignes d'une partie (plage p) d'un bloc texte : une par ligne clonée ; une sélection dans une seule ligne en garde le niveau
function lignesDeLaPlage(t, p) {
  var box = document.createElement('div'); box.appendChild(p.cloneContents());
  var lgs = Array.prototype.filter.call(box.children, function (x) { return x.classList.contains('lg'); });
  if (!lgs.length) { var lg = ligneDuNoeud(t, p.startContainer); return [ligne(sanitize(box.innerHTML), lg ? niveauEl(lg) : 0)]; }
  return lgs.map(function (x) { return ligne(sanitize(x.innerHTML), niveauEl(x)); });
}
// copie d'une sélection qui touche un bloc texte (édition et lecture) : { html, texte }, ou null (la copie reste celle d'aujourd'hui).
// Les blocs texte passent par le module pur ; le reste de la sélection, comme la copie d'un passage à pastilles.
function copieDeSelection(r, idDoc) {
  var tx = $$('.texte', app).filter(function (t) { return r.intersectsNode(t); });
  if (!tx.length) return null;
  var html = [], texte = [], dc = r.startContainer, doff = r.startOffset;
  var morceau = function (fc, foff) {
    var a = document.createRange(); a.setStart(dc, doff); a.setEnd(fc, foff); if (a.collapsed) return;
    var box = document.createElement('div'); box.appendChild(a.cloneContents());
    $$('button, select, input, textarea, .collant, .blk-gut', box).forEach(function (x) { x.parentNode.removeChild(x); });   // commandes du bloc
    var h = pastillesSansCouleur(box.innerHTML, idDoc), t = texteBrutDePresse(h);
    if (t.trim() || box.querySelector('img')) { html.push(h); texte.push(t); }
  };
  tx.forEach(function (t) {
    var i = Array.prototype.indexOf.call(t.parentNode.childNodes, t);
    if (r.comparePoint(t.parentNode, i) === 0) morceau(t.parentNode, i);   // passage avant le bloc texte
    var p = document.createRange(); p.selectNodeContents(t);
    if (r.comparePoint(t, 0) < 0) p.setStart(r.startContainer, r.startOffset);
    if (r.comparePoint(t, t.childNodes.length) > 0) p.setEnd(r.endContainer, r.endOffset);
    var ls = lignesDeLaPlage(t, p);
    html.push(lignesEnHtml(ls, idDoc)); texte.push(lignesEnTexte(ls));
    if (r.comparePoint(t.parentNode, i + 1) === 0) { dc = t.parentNode; doff = i + 1; } else { dc = r.endContainer; doff = r.endOffset; }
  });
  morceau(r.endContainer, r.endOffset);
  return { html: html.join(''), texte: texte.join('\n') };
}
