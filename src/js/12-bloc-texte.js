/* ---------- Bloc texte : saisie des lignes ---------- */
// Le champ d'un bloc texte (data-texte) contient une div.lg par ligne. Les gestes à l'intérieur du bloc changent ce DOM
// en place puis passent par la saisie (fire), ce qui garde le curseur ; ceux qui touchent un autre bloc passent par session.modifier.
function lignesDe(el) { return Array.prototype.filter.call(el.children, function (x) { return x.classList.contains('lg'); }); }
function ligneVideEl(lg) { return lg.textContent.replace(/​/g, '') === '' && !lg.querySelector('img'); }
function poserNiveau(lg, n) { n = Math.max(0, Math.min(LIGNE_LV_MAX, n)); if (n) lg.dataset.lv = n; else lg.removeAttribute('data-lv'); }
function niveauEl(lg) { return +lg.dataset.lv || 0; }
// genre d'une ligne (data-g, absent pour une ligne de texte) ; une case qui change de genre ou qui naît perd sa coche,
// une case qui reste case la garde
function genreEl(lg) { return lg.dataset.g || ''; }
function poserGenre(lg, g) {
  if (genreEl(lg) !== g) lg.removeAttribute('data-done');
  if (g) lg.dataset.g = g; else lg.removeAttribute('data-g');
  lg.removeAttribute('data-n');
  if (g === 'soustitre') lg.removeAttribute('data-taille');   // le sous-titre a sa propre taille
}
// alignement (data-align, absent pour gauche) et taille (data-taille, absente pour Normal ; jamais sur un sous-titre)
function alignEl(lg) { return lg.dataset.align || ''; }
function poserAlign(lg, v) { if (v) lg.dataset.align = v; else lg.removeAttribute('data-align'); }
function tailleEl(lg) { return lg.dataset.taille || ''; }
function poserTaille(lg, v) { if (v && genreEl(lg) !== 'soustitre') lg.dataset.taille = v; else lg.removeAttribute('data-taille'); }
var GENRES_LISTE = ['puce', 'numero', 'case'];   // genres dont la ligne vide sort par Entrée et Retour arrière
function ligneDeEl(lg, html) {
  var o = ligne(html, niveauEl(lg));
  if (lg.dataset.g) o.genre = lg.dataset.g;
  if (lg.dataset.align) o.align = lg.dataset.align;
  if (lg.dataset.taille) o.taille = lg.dataset.taille;
  if (lg.hasAttribute('data-done')) o.done = true;
  return o;
}
// numéros affichés (data-n), recalculés par le module pur après chaque saisie
function numeroterChamp(el, lignes) {
  var nums = numerosDesLignes(lignes);
  lignesDe(el).forEach(function (lg, i) { if (nums[i]) lg.dataset.n = nums[i]; else lg.removeAttribute('data-n'); });
}
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
  return normLignes(lignesDe(el).map(function (lg) { return ligneDeEl(lg, sanitize(lg.innerHTML)); }));
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
// lignes touchées par la plage r (Tab, genre, alignement, taille) ; une sélection qui finit au tout début d'une ligne
// (triple-clic, Maj+↓) ne touche pas cette ligne
function lignesSousPlage(el, r) {
  var ls = lignesDe(el), a = ls.indexOf(ligneDuNoeud(el, r.startContainer)), z = ls.indexOf(ligneDuNoeud(el, r.endContainer));
  if (a < 0 || z < 0) return ls.filter(function (lg) { return r.intersectsNode(lg); });
  var fin = document.createRange(); fin.setStart(r.endContainer, r.endOffset);
  if (z > a && auBordDeLigne(ls[z], fin, -1)) z--;
  return ls.slice(a, z + 1);
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
    if (ligneVideEl(lg) && GENRES_LISTE.indexOf(genreEl(lg)) >= 0) {
      // puce, numéro ou case vide : un niveau de moins, puis au niveau 0 une ligne de texte
      if (niveauEl(lg) > 0) poserNiveau(lg, niveauEl(lg) - 1); else poserGenre(lg, '');
      fire(el); return true;
    }
    if (ligneVideEl(lg) && i === lignes.length - 1) {
      // ligne vide en dernière ligne : elle remonte d'un niveau, puis au niveau 0 laisse la place à un bloc texte neuf
      if (niveauEl(lg) > 0) { poserNiveau(lg, niveauEl(lg) - 1); fire(el); return true; }
      if (lignes.length > 1) lg.remove();
      b.lignes = lignesDuChamp(el); insertAfter(b, 'texte', {}); return true;
    }
    var fin = document.createRange(); fin.selectNodeContents(lg); fin.setStart(r.startContainer, r.startOffset);
    // la nouvelle ligne garde niveau, genre, alignement et taille ; une case naît non cochée, un sous-titre est suivi d'une ligne de texte
    var nl = document.createElement('div'); nl.className = 'lg'; poserNiveau(nl, niveauEl(lg)); poserGenre(nl, genreEl(lg) === 'soustitre' ? '' : genreEl(lg));
    poserAlign(nl, alignEl(lg)); poserTaille(nl, tailleEl(lg)); nl.appendChild(fin.extractContents());
    if (ligneVideEl(nl) && !nl.querySelector('br:not(:last-child)')) nl.innerHTML = '<br>';
    if (ligneVideEl(lg) && !lg.querySelector('br')) lg.innerHTML = '<br>';
    lg.after(nl); caretTo(nl, false); fire(el); return true;
  }
  if (e.key === 'Tab') {
    // ±1 niveau sur toutes les lignes touchées par la sélection
    e.preventDefault();
    lignesSousPlage(el, r).forEach(function (x) { poserNiveau(x, niveauEl(x) + (e.shiftKey ? -1 : 1)); });
    fire(el); return true;
  }
  if (!lg) return false;
  if (e.key === 'Backspace' && s.isCollapsed && auBordDeLigne(lg, r, -1)) {
    e.preventDefault();
    if (GENRES_LISTE.indexOf(genreEl(lg)) >= 0) { poserGenre(lg, ''); fire(el); return true; }   // puce, numéro, case : ligne de texte, niveau gardé
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
/* ---------- Genres de ligne : raccourcis et cases ---------- */
// raccourci complété par l'espace tapée au début d'une ligne de texte (« - », « 1. », « [ ] », « ## ») : la frappe forme une
// étape, la transformation une autre, pour que Ctrl+Z rende les caractères
function raccourciTexte(el, e) {
  if (!/^insert(Text|CompositionText)$/.test(e.inputType || '') || !/[ \u00a0]$/.test(e.data || '')) return;
  var s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return;
  var r = s.getRangeAt(0), lg = ligneDuNoeud(el, r.startContainer); if (!lg || genreEl(lg)) return;
  var avant = document.createRange(); avant.selectNodeContents(lg); avant.setEnd(r.startContainer, r.startOffset);
  var t = avant.toString(), rc = raccourciDeLigne(t);
  if (!rc || rc.html !== '' || avant.cloneContents().querySelector('*')) return;
  session.valider();
  avant.deleteContents(); poserGenre(lg, rc.genre);
  if (ligneVideEl(lg) && !lg.querySelector('br')) lg.innerHTML = '<br>';   // un nœud de texte vide ne tient pas la ligne
  var c = document.createRange(); c.setStart(lg, 0); c.collapse(true); s.removeAllRanges(); s.addRange(c);
  fire(el); session.valider();
}
// clic sur la marque d'une case (là où ::before la dessine) : le curseur ne bouge pas, la case est cochée ou décochée.
// Alignée à gauche ou justifiée, la marque occupe la marge de la ligne ; centrée ou à droite, les 1.6em devant le texte
function caseSousPointeur(e) {
  var lg = e.target.closest && e.target.closest('.texte > .lg[data-g="case"]'); if (!lg) return null;
  var g = lg.getBoundingClientRect(), cs = getComputedStyle(lg), pad = parseFloat(cs.paddingLeft) || 0;
  if (getComputedStyle(lg, '::before').position !== 'static') return e.clientX - g.left < pad ? lg : null;
  var w = 1.6 * (parseFloat(cs.fontSize) || 15), r = document.createRange(); r.selectNodeContents(lg);
  var t = Array.prototype.filter.call(r.getClientRects(), function (x) { return x.width > 0; })[0], x0;
  if (t) x0 = t.left;
  else x0 = alignEl(lg) === 'droite' ? g.right - parseFloat(cs.paddingRight || 0) : g.left + g.width / 2 + w / 2;   // ligne vide : marque seule
  var y0 = t ? t.top : g.top, y1 = t ? t.bottom : g.top + parseFloat(cs.lineHeight || 24);
  return e.clientX >= x0 - w && e.clientX < x0 && e.clientY >= y0 && e.clientY <= y1 ? lg : null;
}
// une étape d'historique, synchronisée (lignes.i.done), en édition comme en lecture (comme une Liste à cocher)
function basculerCase(lg) {
  var tx = lg.parentNode, bid = tx.dataset.b || tx.dataset.tx, b = byId(bid), i = lignesDe(tx).indexOf(lg);
  if (!b || !b.lignes || !b.lignes[i] || b.lignes[i].genre !== 'case') return;
  var oui = !lg.hasAttribute('data-done');
  session.valider();
  session.saisir(function () { if (oui) b.lignes[i].done = true; else delete b.lignes[i].done; }); session.valider();
  lg.toggleAttribute('data-done', oui);
  if (tousBlocs(doc.blocks).some(function (x) { return x.type === 'query'; })) refreshDerivedSoon();   // requêtes sur les cases à cocher
}
app.addEventListener('mousedown', function (e) {
  if (e.button !== 0) return;
  var lg = caseSousPointeur(e); if (!lg) return;
  e.preventDefault(); basculerCase(lg);
});
/* ---------- Collage et copie (règles : 05-lignes.js) ---------- */
// couper dans un bloc texte : la sélection part et ses deux lignes de bord se joignent (sans commande d'édition : un couper lancé
// par execCommand('cut') refuse une seconde commande pendant son événement)
function couperLignes(el, r) {
  var a = ligneDuNoeud(el, r.startContainer), z = ligneDuNoeud(el, r.endContainer);
  r.deleteContents();
  if (a && z && a !== z && a.parentNode && z.parentNode) { joindreLignes(el, a, z); return; }
  reparerLignes(el); fire(el);
}
// genre, niveau et coche d'une ligne collée posés sur une ligne du champ (alignement et taille jamais repris)
function poserLigneCollee(lg, l) {
  poserNiveau(lg, +l.lv || 0); poserGenre(lg, l.genre || '');
  if (l.genre === 'case' && l.done) lg.setAttribute('data-done', '');
}
// lignes collées au curseur : la ligne du curseur est coupée, la première ligne collée se joint à son début, la dernière à sa fin ;
// chaque ligne collée garde son niveau et son genre, la première prend ceux de la ligne du curseur, sauf si c'est une ligne de
// texte vide et que la première ligne collée a un genre : elle prend alors son genre, son niveau et sa coche. Une seule étape
// d'historique (fire).
function collerLignes(el, ls) {
  var s = getSelection(); if (!ls.length || !s.rangeCount) return;
  if (!s.isCollapsed) { s.getRangeAt(0).deleteContents(); reparerLignes(el); }
  var r = s.getRangeAt(0), lg = ligneDuNoeud(el, r.startContainer);
  if (!lg) { lg = lignesDe(el)[lignesDe(el).length - 1]; r = document.createRange(); r.selectNodeContents(lg); r.collapse(false); }
  if (ls[0].genre && !genreEl(lg) && ligneVideEl(lg)) poserLigneCollee(lg, ls[0]);
  if (ls.length === 1) {
    // inséré à la main : insertHTML de Chrome change une pastille collée seule en span à styles calculés
    var t = document.createElement('template'); t.innerHTML = ls[0].html;
    var der1 = t.content.lastChild; if (!der1) { fire(el); return; }
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
  ls.slice(1).forEach(function (l) { var d = document.createElement('div'); d.className = 'lg'; poserLigneCollee(d, l); d.innerHTML = l.html; der.after(d); der = d; });
  var n = der.childNodes.length;
  if (!ligneVideEl(queue) || queue.querySelector('br:not(:last-child)')) while (queue.firstChild) der.appendChild(queue.firstChild);
  [lg, der].forEach(function (x) { if (!x.firstChild) x.appendChild(document.createElement('br')); });
  var c = document.createRange(); c.setStart(der, Math.min(n, der.childNodes.length)); c.collapse(true); s.removeAllRanges(); s.addRange(c);
  $$('span.pill', el).forEach(paintPill);
  fire(el);
}
// lignes d'une partie (plage p) d'un bloc texte, avec leurs numéros affichés (data-n des lignes clonées) : { lignes, nums }.
// Une ligne clonée garde niveau, genre et coche ; une sélection dans une seule ligne en garde le niveau, et le genre si elle
// couvre toute la ligne
function lignesDeLaPlage(t, p) {
  var box = document.createElement('div'); box.appendChild(p.cloneContents());
  var lgs = Array.prototype.filter.call(box.children, function (x) { return x.classList.contains('lg'); });
  var num = function (x) { return (x && x.dataset.g === 'numero' && +x.dataset.n) || null; };
  if (!lgs.length) {
    var lg = ligneDuNoeud(t, p.startContainer), html = sanitize(box.innerHTML), sansZ = function (x) { return x.replace(/​/g, ''); };
    if (lg && sansZ(box.textContent) === sansZ(lg.textContent)) return { lignes: [ligneDeEl(lg, html)], nums: [num(lg)] };
    return { lignes: [ligne(html, lg ? niveauEl(lg) : 0)], nums: [null] };
  }
  return { lignes: lgs.map(function (x) { return ligneDeEl(x, sanitize(x.innerHTML)); }), nums: lgs.map(num) };
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
    var ls = lignesDeLaPlage(t, p);   // numéros affichés dans le bloc : la copie des lignes 3 et 4 d'une liste donne « 3. », « 4. »
    html.push(lignesEnHtml(ls.lignes, idDoc, ls.nums)); texte.push(lignesEnTexte(ls.lignes, ls.nums));
    if (r.comparePoint(t.parentNode, i + 1) === 0) { dc = t.parentNode; doff = i + 1; } else { dc = r.endContainer; doff = r.endOffset; }
  });
  morceau(r.endContainer, r.endOffset);
  return { html: html.join(''), texte: texte.join('\n') };
}
