/* ---------- Choix des colonnes et des champs des cartes d'une requête (formulaire d'édition), colonnes Y de la vue regroupée ----------
   Mode, cases, poignée et Alt+↑ / Alt+↓ sur une case ; le nouveau champ colonnes (ou champs, liste data-qliste="champs") vient des
   fonctions pures de 07-requetes.js (qColMode, qColBasculer, qColDeplacer, qChampBasculer, qChampDeplacer). Chaque geste est une
   étape « colonnes modifiées » ou « champs des cartes modifiés » ; la case « bloquées seulement », « filtres modifiés » (05-libelle-etape.js). */
function colonnesBloc(el) { var x = el.closest('.blk'); return x ? byId(x.dataset.id) : null; }
function ecrireColonnes(b, calcul, focus) {
  var neuf = calcul(qColonnesDispo(b, queryRecords(b, doc, doc.cur), b.view === 'list').dispo);   // dans l'ordre du réglage affiché
  holdBar(b.id); session.modifier(function () { b.colonnes = neuf; });
  // la case touchée garde le focus après le rendu
  caseFocus(b, focus);
}
function caseFocus(b, focus) {
  var c = focus && $$('.blk[data-id="' + b.id + '"] input[data-qcol], .blk[data-id="' + b.id + '"] input[data-qchamp]', app).filter(function (x) { return (x.dataset.qcol || x.dataset.qchamp) === focus; })[0];
  if (c) c.focus({ preventScroll: true });
}
function ecrireChamps(b, neuf, focus) { holdBar(b.id); session.modifier(function () { b.champs = neuf; }); caseFocus(b, focus); }
// déplacement d'une ligne de la liste li (colonnes ou champs des cartes) au rang vers
function deplacerLigne(b, li, cle, vers) {
  if (li.parentNode.dataset.qliste === 'champs') ecrireChamps(b, qChampDeplacer(b, cle, vers), cle);
  else ecrireColonnes(b, function (dp) { return qColDeplacer(b, dp, cle, vers); }, cle);
}
app.addEventListener('change', function (e) {
  var el = e.target, b; if (mode !== 'edit') return;
  if (el.matches('select[data-qcolmode]') && (b = colonnesBloc(el))) ecrireColonnes(b, function (dp) { return qColMode(b, dp, el.value); });
  else if (el.matches('input[data-qcol]') && (b = colonnesBloc(el))) ecrireColonnes(b, function (dp) { return qColBasculer(b, dp, el.dataset.qcol); }, el.dataset.qcol);
  else if (el.matches('input[data-qchamp]') && (b = colonnesBloc(el))) ecrireChamps(b, qChampBasculer(b, el.dataset.qchamp), el.dataset.qchamp);
  else if (el.matches('input[data-qbloquees]') && (b = colonnesBloc(el))) { holdBar(b.id); session.modifier(function () { if (el.checked) b.bloquees = true; else delete b.bloquees; }); }
  else if (el.matches('input[data-qregy]') && (b = colonnesBloc(el))) {
    // vue regroupée : colonnes Y dont on veut les valeurs uniques (qRegBasculerY, 07-requetes.js)
    var cle = el.dataset.qregy, ys = qRegBasculerY(b, queryRecords(b, doc, doc.cur), cle);
    holdBar(b.id); session.modifier(function () { b.regY = ys; }, { b: b.id }, 'vue modifiée');
    var c = $$('.blk[data-id="' + b.id + '"] input[data-qregy]', app).filter(function (x) { return x.dataset.qregy === cle; })[0];
    if (c) c.focus({ preventScroll: true });
  }
});
app.addEventListener('keydown', function (e) {
  var el = e.target;
  if (mode !== 'edit' || !e.altKey || e.ctrlKey || e.metaKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || !el.matches || !el.matches('input[data-qcol], input[data-qchamp]')) return;
  e.preventDefault(); e.stopPropagation();
  var b = colonnesBloc(el), li = el.closest('.q-col'), at = $$('.q-col', li.parentNode).indexOf(li), cle = el.dataset.qcol || el.dataset.qchamp;
  if (b && at + (e.key === 'ArrowUp' ? -1 : 1) >= 0) deplacerLigne(b, li, cle, at + (e.key === 'ArrowUp' ? -1 : 1));
});
// glisser par la poignée : la colonne se pose avant ou après la ligne visée, selon la moitié survolée
var colGlisse = null;
app.addEventListener('mousedown', function (e) { var g = e.target.closest && e.target.closest('.q-grip'); if (g && mode === 'edit') g.closest('.q-col').setAttribute('draggable', 'true'); });
document.addEventListener('mouseup', function () { if (!colGlisse) $$('.q-col[draggable]', app).forEach(function (x) { x.removeAttribute('draggable'); }); });
function colMarque(li, apres) {
  $$('.q-drop-avant, .q-drop-apres', app).forEach(function (x) { x.classList.remove('q-drop-avant', 'q-drop-apres'); });
  if (li) li.classList.add(apres ? 'q-drop-apres' : 'q-drop-avant');
}
function colCible(e) {
  var li = e.target.closest && e.target.closest('.q-col'); if (!li || !colGlisse || li.parentNode !== colGlisse.li.parentNode) return null;
  var r = li.getBoundingClientRect(); return { li: li, apres: e.clientX > r.left + r.width / 2 };
}
app.addEventListener('dragstart', function (e) {
  var li = e.target.closest && e.target.closest('.q-col[draggable]'); if (!li) return;
  colGlisse = { li: li, cle: li.dataset.qcolk }; li.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', li.textContent.trim()); } catch (_) {}
});
app.addEventListener('dragover', function (e) {
  if (!colGlisse) return;
  var t = colCible(e); colMarque(t && t.li, t && t.apres);
  if (t) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
});
function colFin() { colMarque(null); $$('.q-col[draggable]', app).forEach(function (x) { x.removeAttribute('draggable'); x.classList.remove('dragging'); }); colGlisse = null; }
app.addEventListener('drop', function (e) {
  if (!colGlisse) return;
  var t = colCible(e), g = colGlisse; e.preventDefault(); colFin();
  if (!t || t.li === g.li) return;
  var lis = $$('.q-col', t.li.parentNode), de = lis.indexOf(g.li), vers = lis.indexOf(t.li) + (t.apres ? 1 : 0);
  if (vers > de) vers--;   // la colonne quitte sa place avant d'être posée
  var b = colonnesBloc(t.li); if (b) deplacerLigne(b, t.li, g.cle, vers);
});
app.addEventListener('dragend', function () { if (colGlisse) colFin(); });
