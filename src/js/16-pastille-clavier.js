/* ---------- Pastille au clavier ---------- */
// « # » en début de mot puis des lettres, dans un champ riche, ouvre sous le curseur la liste des pastilles du document
// (pastillesProposees, 07-requetes.js) ; la saisie reste du texte jusqu'au choix. Détection par input, pour le clavier virtuel.
var diese = null, dieseEcarte = null;   // liste ouverte : { fld, noeud, debut, fin, saisie, lignes, cur } ; saisie fermée par Échap
function dieseAvant(n, fld) {
  // nœud qui précède n dans le champ (en remontant les enveloppes), ou null en début de champ
  while (n && n !== fld && !n.previousSibling) n = n.parentNode;
  return n && n !== fld ? n.previousSibling : null;
}
function saisieDiese(fld) {
  // « # » + lettres juste avant le curseur, en début de champ, de ligne ou après un blanc ; sinon null (C#, page#ancre, « # 3 »)
  var s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return null;
  var n = s.anchorNode, off = s.anchorOffset; if (!n || n.nodeType !== 3 || !fld.contains(n)) return null;
  var dans = n.parentNode.closest('span.pill, code, a'); if (dans && fld.contains(dans)) return null;
  var m = n.nodeValue.slice(0, off).match(/(^|[\s\u00a0])\u200B*#([^\s\u00a0\u200B#]+)$/); if (!m) return null;
  var saisie = m[2]; if (saisie.toLowerCase() === saisie.toUpperCase() && !/\d/.test(saisie)) return null;   // au moins une lettre ou un chiffre
  if (m.index === 0 && !m[1]) {
    var p = dieseAvant(n, fld);
    var bord = !p || p.nodeName === 'BR' || p.nodeName === 'DIV' || (p.nodeType === 1 && /\b(tab|ln)\b/.test(p.className)) || (p.nodeType === 3 && /(^|[\s\u00a0])$/.test(p.nodeValue));
    if (!bord) return null;
  }
  return { fld: fld, noeud: n, debut: off - saisie.length - 1, fin: off, saisie: saisie };
}
function dieseDessin() {
  var d = diese;
  pop.innerHTML = d.lignes.map(function (l, i) {
    var pill = '<span class="pill pa-' + l.couleur + '">' + esc(l.nom) + '</span>';
    return '<button type="button" class="mi' + (l.creer ? ' diese-creer' : '') + (i === d.cur ? ' act' : '') + '" data-di="' + i + '">' + (l.creer ? 'Créer la pastille « ' + pill + ' »' : pill) + '</button>';
  }).join('');
  // sous la saisie (au-dessus si la place manque en bas)
  var r = document.createRange(); r.setStart(d.noeud, d.debut); r.setEnd(d.noeud, d.fin);
  var rc = r.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight, top = rc.bottom + 6;
  if (top + h > innerHeight - 8 && rc.top - h - 6 > 8) top = rc.top - h - 6;
  pop.style.left = Math.min(Math.max(8, rc.left), innerWidth - w - 8) + 'px'; pop.style.top = Math.max(8, top) + 'px';
}
function dieseOuvrir(x) {
  var cur = diese && diese.noeud === x.noeud && diese.debut === x.debut ? diese.cur : 0;
  if (!diese) {
    closePop();
    var p = document.createElement('div'); p.className = 'pop diese-pop'; p.ancre = x.fld; ui.appendChild(p); pop = p;
    p.addEventListener('mousedown', function (e) { e.preventDefault(); });   // le curseur reste dans le champ
    p.addEventListener('click', function (e) { var b = e.target.closest('[data-di]'); if (b) diesePoser(+b.dataset.di); });
    popClose = function () { diese = null; };
  }
  x.lignes = pastillesProposees(doc, x.saisie); x.cur = Math.min(cur, x.lignes.length - 1); diese = x;
  dieseDessin();
}
function dieseFermer() { if (diese) closePop(); }
function diesePoser(i) {
  // remplace « # » + lettres par la pastille, curseur juste après et hors d'elle ; une seule étape d'historique
  var l = diese && diese.lignes[i], fld = diese && diese.fld; dieseFermer(); if (!l) return;
  var x = saisieDiese(fld); if (!x) return;
  session.valider();
  var r = document.createRange(); r.setStart(x.noeud, x.debut); r.setEnd(x.noeud, x.fin); r.deleteContents();
  var el = document.createElement('span'); el.className = 'pill'; el.textContent = l.nom; r.insertNode(el);
  paintPill(el); exitInline(el, 1); fire(fld);
  session.valider();
}
app.addEventListener('input', function (e) {
  var el = e.target;
  if (mode !== 'edit' || !el.matches || !el.matches('.fld[data-rich]')) { dieseFermer(); return; }
  var x = saisieDiese(el);
  if (!x || (dieseEcarte && dieseEcarte.noeud === x.noeud && dieseEcarte.debut === x.debut)) { dieseFermer(); return; }
  dieseEcarte = null;
  if (diese || /^insert/.test(e.inputType || 'insertText')) dieseOuvrir(x);
});
app.addEventListener('keydown', function (e) {
  if (!diese || e.ctrlKey || e.metaKey || e.altKey) return;
  var k = e.key, n = diese.lignes.length;
  if (k === 'ArrowDown' || k === 'ArrowUp') { diese.cur = (diese.cur + (k === 'ArrowDown' ? 1 : n - 1)) % n; dieseDessin(); }
  else if (k === 'Enter' || k === 'Tab') diesePoser(diese.cur);
  else if (k === 'Escape') { dieseEcarte = { noeud: diese.noeud, debut: diese.debut }; dieseFermer(); }
  else return;
  e.preventDefault(); e.stopPropagation();   // ni nouvelle ligne, ni cellule suivante, ni autre raccourci
}, true);
app.addEventListener('beforeinput', function (e) {
  // Entrée du clavier virtuel, sans keydown utilisable
  if (diese && (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak')) { e.preventDefault(); diesePoser(diese.cur); }
});
document.addEventListener('selectionchange', function () {
  if (!diese) return;
  var x = saisieDiese(diese.fld); if (!x || x.noeud !== diese.noeud || x.debut !== diese.debut) dieseFermer();
});
app.addEventListener('focusout', function (e) { if (diese && e.target === diese.fld) dieseFermer(); });
