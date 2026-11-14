/* ---------- Choix des colonnes et des champs des cartes d'une requête, colonnes Y de la vue regroupée ----------
   Dans la fenêtre d'une puce (16-puces-requete.js), branchée par brancherColonnes : cases, « Afficher les nouvelles colonnes », poignée et Alt+↑ / Alt+↓ sur
   une case ; le nouveau champ colonnes (ou champs, liste data-qliste="champs") vient des fonctions pures de 07-requetes.js. */
function colonnesBloc(el) { var x = el.closest('.blk, .q-fen'); return x ? byId(x.dataset.id) : null; }
function ecrireColonnes(b, calcul, focus) {
  var neuf = calcul(qColonnesDispo(b, queryRecords(b, doc, doc.cur), b.view === 'list').dispo);   // dans l'ordre du réglage affiché
  holdBar(b.id); session.modifier(function () { b.colonnes = neuf; });
  // la case touchée garde le focus après le rendu
  caseFocus(b, focus, 'qcol', 'qchamp');
}
// case de la fenêtre du bloc b dont la clé (data-<attr>) vaut focus
function caseFocus(b, focus, attr, attr2) {
  var c = focus && $$('.q-fen[data-id="' + b.id + '"] input', ui).filter(function (x) { return x.dataset[attr] === focus || (attr2 && x.dataset[attr2] === focus); })[0];
  if (c) c.focus({ preventScroll: true });
}
function ecrireChamps(b, neuf, focus) { holdBar(b.id); session.modifier(function () { b.champs = neuf; }); caseFocus(b, focus, 'qcol', 'qchamp'); }
// déplacement d'une ligne de la liste li (colonnes ou champs des cartes) au rang vers
function deplacerLigne(b, li, cle, vers) {
  if (li.parentNode.dataset.qliste === 'champs') ecrireChamps(b, qChampDeplacer(b, cle, vers), cle);
  else ecrireColonnes(b, function (dp) { return qColDeplacer(b, dp, cle, vers); }, cle);
}
// glisser par la poignée : la colonne se pose avant ou après la ligne visée, selon la moitié survolée (verticale si la liste est en colonne)
var colGlisse = null;
function colMarque(racine, li, apres) {
  $$('.q-drop-avant, .q-drop-apres', racine).forEach(function (x) { x.classList.remove('q-drop-avant', 'q-drop-apres'); });
  if (li) li.classList.add(apres ? 'q-drop-apres' : 'q-drop-avant');
}
function colCible(e) {
  var li = e.target.closest && e.target.closest('.q-col'); if (!li || !colGlisse || li.parentNode !== colGlisse.li.parentNode) return null;
  var r = li.getBoundingClientRect(), enColonne = getComputedStyle(li.parentNode).flexDirection === 'column';
  return { li: li, apres: enColonne ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2 };
}
function colFin(racine) { colMarque(racine, null); $$('.q-col[draggable]', racine).forEach(function (x) { x.removeAttribute('draggable'); x.classList.remove('dragging'); }); colGlisse = null; }
function brancherColonnes(racine) {
  racine.addEventListener('change', function (e) {
    var el = e.target, b; if (mode !== 'edit') return;
    if (el.matches('input[data-qcolnouv]') && (b = colonnesBloc(el))) ecrireColonnes(b, function (dp) { return qColMode(b, dp, el.checked ? 'sauf' : 'seulement'); });
    else if (el.matches('input[data-qcol]') && (b = colonnesBloc(el))) ecrireColonnes(b, function (dp) { return qColBasculer(b, dp, el.dataset.qcol); }, el.dataset.qcol);
    else if (el.matches('input[data-qchamp]') && (b = colonnesBloc(el))) ecrireChamps(b, qChampBasculer(b, el.dataset.qchamp), el.dataset.qchamp);
    else if (el.matches('input[data-qregy]') && (b = colonnesBloc(el))) {
      // vue regroupée : colonnes Y dont on veut les valeurs uniques (qRegBasculerY, 07-requetes.js)
      var cle = el.dataset.qregy, ys = qRegBasculerY(b, queryRecords(b, doc, doc.cur), cle);
      holdBar(b.id); session.modifier(function () { b.regY = ys; }, null, 'vue modifiée');
      caseFocus(b, cle, 'qregy');
    }
  });
  racine.addEventListener('keydown', function (e) {
    var el = e.target;
    if (mode !== 'edit' || !e.altKey || e.ctrlKey || e.metaKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || !el.matches || !el.matches('input[data-qcol], input[data-qchamp]')) return;
    e.preventDefault(); e.stopPropagation();
    var b = colonnesBloc(el), li = el.closest('.q-col'), at = $$('.q-col', li.parentNode).indexOf(li), cle = el.dataset.qcol || el.dataset.qchamp;
    if (b && at + (e.key === 'ArrowUp' ? -1 : 1) >= 0) deplacerLigne(b, li, cle, at + (e.key === 'ArrowUp' ? -1 : 1));
  });
  racine.addEventListener('mousedown', function (e) { var g = e.target.closest && e.target.closest('.q-grip'); if (g && mode === 'edit') g.closest('.q-col').setAttribute('draggable', 'true'); });
  racine.addEventListener('mouseup', function () { if (!colGlisse) $$('.q-col[draggable]', racine).forEach(function (x) { x.removeAttribute('draggable'); }); });
  racine.addEventListener('dragstart', function (e) {
    var li = e.target.closest && e.target.closest('.q-col[draggable]'); if (!li) return;
    colGlisse = { li: li, cle: li.dataset.qcolk }; li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', li.textContent.trim()); } catch (_) {}
  });
  racine.addEventListener('dragover', function (e) {
    if (!colGlisse) return;
    var t = colCible(e); colMarque(racine, t && t.li, t && t.apres);
    if (t) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
  });
  racine.addEventListener('drop', function (e) {
    if (!colGlisse) return;
    var t = colCible(e), g = colGlisse; e.preventDefault(); colFin(racine);
    if (!t || t.li === g.li) return;
    var lis = $$('.q-col', t.li.parentNode), de = lis.indexOf(g.li), vers = lis.indexOf(t.li) + (t.apres ? 1 : 0);
    if (vers > de) vers--;   // la colonne quitte sa place avant d'être posée
    var b = colonnesBloc(t.li); if (b) deplacerLigne(b, t.li, g.cle, vers);
  });
  racine.addEventListener('dragend', function () { if (colGlisse) colFin(racine); });
}
