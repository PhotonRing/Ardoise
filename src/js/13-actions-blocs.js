/* ---------- Clics sur les actions des blocs ---------- */
// zone de collage ouverte ou fermée hors historique : nouveau rendu à la même vue de la carte b, fiche de raccourcis sur b
function redrawMapBlock(b) { keepView(b); render(); cheatBlock = b.id; updateCheat(); }
app.addEventListener('click', function (e) {
  var cp = e.target.closest('[data-copy]');
  if (cp && mode === 'view') { copyCode(cp); return; }
  var a = e.target.closest('[data-act]'); if (!a || mode !== 'edit') return;
  var blkEl = a.closest('.blk'), b = blkEl ? byId(blkEl.dataset.id) : null, i = +a.dataset.i;
  if (b && a.closest('.blk-bar') && ['del', 'add-after'].indexOf(a.dataset.act) < 0) holdBar(b.id);
  switch (a.dataset.act) {
    case 'add-after': openBlockMenu(a, function (t) { var nb = insertAfter(b, t); if (t === 'image') pickImage(nb); }); break;
    case 'add-end': openBlockMenu(a, function (t) { var nb = insertAt(doc.blocks.length, t); if (t === 'image') pickImage(nb); }); break;
    case 'kb-card-add': var n0 = (b.cols[i].cards || []).length; session.modifier(function () { (b.cols[i].cards = b.cols[i].cards || []).push(kbNewCard()); }, { b: b.id, k: 'cols.' + i + '.cards.' + n0 + '.title' }); break;
    case 'kb-card-del': session.modifier(function () { b.cols[+a.dataset.ci].cards.splice(+a.dataset.ki, 1); }); break;
    case 'kb-col-add': session.modifier(function () { b.cols.push({ id: uid(), title: '', cards: [] }); }, { b: b.id, k: 'cols.' + b.cols.length + '.title' }); break;
    case 'kb-col-del':
      var kc = b.cols[i], nk = (kc.cards || []).length;
      if (nk && !confirm('Supprimer la colonne « ' + (kc.title || 'sans titre') + ' » et ses ' + nk + ' carte' + (nk > 1 ? 's' : '') + ' ? (Ctrl+Z pour annuler)')) break;
      session.modifier(function () { b.cols.splice(i, 1); }); break;
    case 'kb-col-left': case 'kb-col-right':
      var j2 = i + (a.dataset.act === 'kb-col-left' ? -1 : 1); if (j2 < 0 || j2 >= b.cols.length) break;
      session.modifier(function () { var t = b.cols[i]; b.cols[i] = b.cols[j2]; b.cols[j2] = t; }); break;
    case 'q-card-add': session.modifier(function () { if (!b.cards || !b.cards.length) b.cards = [qDefCard(b)]; b.cards.push(qDefCard(b)); }, { b: b.id, k: 'cards.' + ((b.cards && b.cards.length) || 1) + '.label' }); break;
    case 'q-card-del': if (b.cards && b.cards.length > 1) session.modifier(function () { b.cards.splice(i, 1); }); break;
    case 'q-ctag': case 'q-ttag':
      var ct = a.dataset.tag, cp = a.dataset.act === 'q-ctag' ? 'tags' : 'ttags';
      session.modifier(function () { if (!b.cards || !b.cards.length) b.cards = [qDefCard(b)]; var c = b.cards[i], w = c[cp] || (c[cp] = []), at = w.indexOf(ct); if (at >= 0) w.splice(at, 1); else w.push(ct); }); break;
    case 'q-tag': var tk = a.dataset.tag; session.modifier(function () { var w = b.tags || (b.tags = []), at = w.indexOf(tk); if (at >= 0) w.splice(at, 1); else w.push(tk); }); break;
    case 'fold': delete viewFold[b.id]; session.modifier(function () { if (b.folded) delete b.folded; else b.folded = true; }); break;
    case 'up': moveBlock(b, -1); break;
    case 'down': moveBlock(b, 1); break;
    case 'dup': dupBlock(b); break;
    case 'del': deleteBlock(b, false); break;
    case 'toggle': keepView(b); session.modifier(function () { var pr = a.dataset.prop; b[pr] = pr === 'cities' || pr === 'countries' || pr === 'deep' ? b[pr] === false : !b[pr]; }); break;
    case 'tl-add': session.modifier(function () { b.items.push({ date: '', title: '', text: '', color: 'accent' }); }, { b: b.id, k: 'items.' + b.items.length + '.date' }); break;
    case 'tl-ins': session.modifier(function () { b.items.splice(i + 1, 0, { date: '', title: '', text: '', color: (b.items[i] || {}).color || 'accent' }); }, { b: b.id, k: 'items.' + (i + 1) + '.date' }); break;
    case 'tl-del': session.modifier(function () { b.items.splice(i, 1); }); break;
    case 'tl-up': if (i > 0) session.modifier(function () { var t = b.items[i]; b.items[i] = b.items[i - 1]; b.items[i - 1] = t; }); break;
    case 'tl-down': if (i < b.items.length - 1) session.modifier(function () { var t = b.items[i]; b.items[i] = b.items[i + 1]; b.items[i + 1] = t; }); break;
    case 'tl-color': var TLC = ['accent', 'info', 'ok', 'warn', 'bad']; session.modifier(function () { var it = b.items[i]; it.color = TLC[(TLC.indexOf(it.color || 'accent') + 1) % TLC.length]; }); break;
    case 'fact-add': session.modifier(function () { b.items.push({ k: 'Clé', v: '', alert: false }); }, { b: b.id, k: 'items.' + b.items.length + '.v' }); break;
    case 'fact-del': session.modifier(function () { b.items.splice(i, 1); }); break;
    case 'fact-alert': session.modifier(function () { b.items[i].alert = !b.items[i].alert; }); break;
    case 'card-add': session.modifier(function () { b.cards.push({ title: '', text: '', checks: [] }); }, { b: b.id, k: 'cards.' + b.cards.length + '.title' }); break;
    case 'card-del': session.modifier(function () { b.cards.splice(i, 1); }); break;
    case 'item-add':
      var base = a.dataset.k, arr = getPath(b, base);
      session.modifier(function () { arr.push({ html: '', done: false }); }, { b: b.id, k: base + '.' + arr.length + '.html' }); break;
    case 'check-reset': session.modifier(function () { b.items.forEach(function (it) { it.done = false; }); }); break;
    case 'row-add': tableOp(b, 'row-add'); break;
    case 'col-add': tableOp(b, 'col-add'); break;
    case 'row-del': tableOp(b, 'row-del'); break;
    case 'col-del': tableOp(b, 'col-del'); break;
    case 'img-pick': pickImage(b); break;
    case 'img-url': imageUrlAction(b, a); break;
    case 'map-addmode': var ma = mapOf(b.id), on = a.getAttribute('aria-pressed') !== 'true'; a.setAttribute('aria-pressed', on ? 'true' : 'false'); mapUi.add = on ? b.id : null; mapUi.draw = null; cheatBlock = b.id; setTimeout(updateCheat); $$('.blk[data-id="' + b.id + '"] [data-act=map-draw]', app).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); if (ma) { ma.setDrawMode(null); ma.setAddMode(on); } break;
    case 'mk-del': keepView(b); session.modifier(function () { b.markers.splice(i, 1); }); break;
    case 'map-draw':
      var md = mapOf(b.id), kind = a.dataset.kind, dOn = a.getAttribute('aria-pressed') !== 'true';
      mapUi.draw = dOn ? b.id : null; mapUi.kind = dOn ? kind : null; mapUi.add = null; cheatBlock = b.id; setTimeout(updateCheat);
      $$('.blk[data-id="' + b.id + '"] [data-act=map-draw]', app).forEach(function (x) { x.setAttribute('aria-pressed', String(dOn && x.dataset.kind === kind)); });
      var am = $('.blk[data-id="' + b.id + '"] [data-act=map-addmode]', app); if (am) am.setAttribute('aria-pressed', 'false');
      if (md) { md.setAddMode(false); md.setDrawMode(dOn ? kind : null); }
      break;
    case 'shape-edit':
      var sk = a.dataset.kind, on2 = !(mapUi.editOf === b.id && mapUi.edit && mapUi.edit.kind === sk && mapUi.edit.i === i);
      mapUi.editOf = on2 ? b.id : null; mapUi.edit = on2 ? { kind: sk, i: i } : null; mapUi.add = null; mapUi.draw = null; cheatBlock = b.id; setTimeout(updateCheat);
      $$('.blk[data-id="' + b.id + '"] [data-act=shape-edit]', app).forEach(function (x) { x.setAttribute('aria-pressed', String(on2 && x.dataset.kind === sk && +x.dataset.i === i)); });
      var mze = mapOf(b.id);
      if (mze) mze.setEdit(on2 ? sk : null, i);
      $$('.mk-panel[data-b="' + b.id + '"] .mk-item', app).forEach(function (it) { it.classList.remove('on'); }); if (on2) { var bt2 = a.closest('.mk-item'); if (bt2) bt2.classList.add('on'); }
      if (sk === 'route') { keepView(b); render(); }
      if (on2) {
        var circ = sk === 'zone' && b.zones[i] && b.zones[i].shape === 'circle';
        if (sk === 'marker') toast('Glissez le point pour le déplacer, son étiquette pour la déplacer ; double-clic sur l’étiquette pour la remettre ; Échap pour terminer.', 5000); else
        toast(circ ? 'Glissez le carré pour déplacer le cercle, le rond pour changer le rayon (Alt : sans aimantation)' : 'Glissez les carrés pour déplacer, les ronds pour ajouter ; double-clic sur un carré pour supprimer ; Alt : sans aimantation. Les autres éléments sont figés ; Échap pour terminer.', 5500);
      }
      break;
    case 'ch-on':
      cheatBlock = b.id;
      if (!b.choro) { keepView(b); session.modifier(function () { b.choro = { data: {}, pal: 'bleus', scale: 'lin', labels: 'value' }; }); }
      updateCheat();
      var chq = $('.ch-q[data-b="' + b.id + '"]', app); if (chq) { chq.focus({ preventScroll: true }); chq.scrollIntoView({ block: 'nearest' }); }
      break;
    case 'ch-off':
      var nch = b.choro ? Object.keys(b.choro.data || {}).length : 0;
      if (nch && !confirm('Retirer les couleurs et les données de ' + nch + ' pays ? (Ctrl+Z pour annuler)')) break;
      keepView(b); chPaste = null; session.modifier(function () { delete b.choro; }); break;
    case 'ch-del': keepView(b); session.modifier(function () { delete b.choro.data[a.dataset.id]; if (b.choro.lp) delete b.choro.lp[a.dataset.id]; }); break;
    case 'ch-rev': keepView(b); session.modifier(function () { b.choro.rev = !b.choro.rev; }); break;
    case 'ch-parts': keepView(b); session.modifier(function () { if (b.choro.parts) delete b.choro.parts; else b.choro.parts = true; }); break;
    case 'ch-sov': keepView(b); session.modifier(function () { if (b.choro.sov) delete b.choro.sov; else b.choro.sov = true; }); break;
    case 'ch-unitlab': keepView(b); session.modifier(function () { if (b.choro.unitLab) delete b.choro.unitLab; else b.choro.unitLab = true; }); break;
    case 'ch-legend': keepView(b); session.modifier(function () { b.choro.legend = b.choro.legend === false; }); break;
    case 'ch-paste':
      chPaste = chPaste === b.id ? null : b.id; redrawMapBlock(b);
      var ta = $('.ch-ta[data-b="' + b.id + '"]', app); if (ta) ta.focus({ preventScroll: true });
      break;
    case 'ch-import':
      var box = a.closest('.ch-paste'), rep = chImport(b, box.querySelector('.ch-ta').value, box.querySelector('.ch-repl input').checked);
      if (rep.n) { chPaste = null; redrawMapBlock(b); }
      toast(rep.n || rep.bad.length ? (rep.n ? rep.n + ' pays importé' + (rep.n > 1 ? 's' : '') : 'Aucun pays importé') + (rep.bad.length ? '. Non reconnu' + (rep.bad.length > 1 ? 's' : '') + ' : ' + rep.bad.slice(0, 6).join(', ') + (rep.bad.length > 6 ? '… (+' + (rep.bad.length - 6) + ')' : '') : '') : 'Rien à importer : collez deux colonnes (pays, valeur).', rep.bad.length ? 9000 : 3500);
      break;
    case 'rt-paste':
      var ri = +a.dataset.i; rtPaste = rtPaste && rtPaste.b === b.id && rtPaste.i === ri ? null : { b: b.id, i: ri }; redrawMapBlock(b);
      var rta = $('.rt-ta[data-b="' + b.id + '"]', app); if (rta) rta.focus({ preventScroll: true });
      break;
    case 'rt-import':
      // la zone a pu disparaître avec un nouveau rendu (annulation, modification reçue) entre l'affichage et le clic
      var rbox = a.closest('.rt-paste'), rta2 = rbox && rbox.querySelector('.rt-ta'); if (!b || !rta2) break;
      var rr = applyRoutePaste(b, rta2.value, +a.dataset.i);
      if (rr.gone) { rtPaste = null; redrawMapBlock(b); toast('Rien d’importé : cet itinéraire n’existe plus', 6000); break; }
      if (rr.ok) { rtPaste = null; redrawMapBlock(b); }
      var rbad = rr.bad.length ? ' · lignes ignorées : ' + rr.bad.slice(0, 12).join(', ') + (rr.bad.length > 12 ? '… (+' + (rr.bad.length - 12) + ')' : '') : '';
      toast((rr.ok ? rr.n + ' points importés' : 'Rien d’importé : il faut au moins deux points valides (latitude, longitude)') + rbad, rr.bad.length || !rr.ok ? 9000 : 3500);
      break;
    case 'route-dist': keepView(b); session.modifier(function () { b.routes[i].hideDist = !b.routes[i].hideDist; }); break;
    case 'panel-min':
      panelMin = !panelMin; try { localStorage.setItem(LS + 'panelmin', panelMin ? '1' : '0'); } catch (_) {}
      $$('.mk-panel', app).forEach(function (pn) { pn.classList.toggle('min', panelMin); var bt = pn.querySelector('[data-act=panel-min]'); if (bt) bt.textContent = panelMin ? '▸' : '–'; });
      break;
    case 'route-del': keepView(b); if (mapUi.editOf === b.id) { mapUi.editOf = null; mapUi.edit = null; } if (rtPaste && rtPaste.b === b.id) rtPaste = null; session.modifier(function () { b.routes.splice(i, 1); }); break;
    case 'zone-del': keepView(b); if (mapUi.editOf === b.id) { mapUi.editOf = null; mapUi.edit = null; } session.modifier(function () { b.zones.splice(i, 1); }); break;
    case 'img-alt': var v = prompt('Texte alternatif de l’image :', b.alt || ''); if (v !== null) session.modifier(function () { b.alt = v; }); break;
  }
});
function imageUrlAction(b, btn) {
  var inp = btn.parentNode.querySelector('.img-url-in'), v = inp ? inp.value : prompt('Adresse de l’image (elle sera téléchargée et intégrée au document) :', '');
  if (!v || !v.trim()) { if (inp) inp.focus(); return; }
  imageFromUrl(v, function (src) { if (byId(b.id)) session.modifier(function () { b.src = src; }); });
}
var barHold = null;
function holdBar(id) {
  // le bloc est redessiné après l'action : sa barre reste affichée (wrapEdit) tant que la souris ne quitte
  // pas le bloc et qu'on ne clique pas ailleurs, pour enchaîner plusieurs ajouts, déplacements ou réglages
  barHold = id;
}
function releaseBar() { barHold = null; $$('.blk.bar-on', app).forEach(function (x) { x.classList.remove('bar-on'); }); }
app.addEventListener('mouseout', function (e) {
  if (!barHold) return;
  var el = e.target.closest && e.target.closest('.blk.bar-on');
  if (el && !(e.relatedTarget && el.contains(e.relatedTarget))) releaseBar();
});
document.addEventListener('mousedown', function (e) { if (barHold && !(e.target.closest && e.target.closest('.blk.bar-on'))) releaseBar(); }, true);
function tableOp(b, op) {
  var rows = b.rows, cols = rows[0].length;
  var cur = lastCell && lastCell.b === b.id ? lastCell : { r: rows.length - 1, c: cols - 1 };
  session.modifier(function () {
    if (op === 'row-add') rows.splice(cur.r + 1, 0, rows[0].map(function () { return ''; }));
    if (op === 'col-add') rows.forEach(function (r, j) { r.splice(cur.c + 1, 0, j === 0 ? 'Colonne' : ''); });
    if (op === 'row-del' && rows.length > 2 && cur.r > 0) rows.splice(cur.r, 1);
    if (op === 'col-del' && cols > 1) rows.forEach(function (r) { r.splice(cur.c, 1); });
  });
  var nr = rows.length, nc = rows[0].length;
  lastCell = { b: b.id, r: Math.min(nr - 1, op === 'row-add' ? cur.r + 1 : cur.r), c: Math.min(nc - 1, op === 'col-add' ? cur.c + 1 : cur.c) };
}
function copyCode(btn) {
  var box = btn.closest('.code, .codebox'), pre = box && box.querySelector('pre'); if (!pre) return;
  var t = pre.classList.contains('src') ? $$('span.l', pre).map(function (l) { return l.textContent; }).join('\n') : pre.textContent;
  var old = btn.textContent;
  function done(m) { btn.textContent = m; setTimeout(function () { btn.textContent = old; }, 1600); }
  function sel() { var r = document.createRange(); r.selectNodeContents(pre); var s = getSelection(); s.removeAllRanges(); s.addRange(r); done('Sélectionné : Ctrl+C'); }
  try { navigator.clipboard.writeText(t).then(function () { done('Copié ✓'); }, sel); } catch (_) { sel(); }
}

