/* ---------- Ligne de puces du bloc requête : fenêtres ----------
   Une puce (qLignePuces, 07-requetes.js) ouvre son réglage dans un menu surgissant (pop, placePop) accroché dessous, de la largeur
   du bloc sous 480 px ; la fenêtre reste ouverte et se regarnit à chaque rendu (annulation, synchro). Tous ses changements forment
   une seule étape d'annulation nommée (session.ouvrirEtape) ; second clic, clic ailleurs ou Échap la ferment. */
var fen = null;   // fenêtre ouverte : { b : id du bloc, cle : contenu (cle de qPuces), ancre : cle de la puce d'accroche, p : élément }
var FEN_NATURES = { src: 'source modifiée', scope: 'portée modifiée', plus: 'filtres modifiés', filtre: 'filtres modifiés', view: 'vue modifiée', cols: 'colonnes modifiées', sort: 'tri modifié' };
function fenNature(b, cle) {
  if (cle === 'cols' && qVue(b) === 'kanban' && b.src === 'kanban') return 'champs des cartes modifiés';
  return FEN_NATURES[cle.indexOf('f:') === 0 ? 'filtre' : cle];
}
function fenPuce(bid, cle) { return $('.blk[data-id="' + bid + '"] .q-puce[data-qpuce="' + cle + '"]', app); }
// sous la puce d'accroche (filtre pas encore posé : « + Filtre ») ; sous 480 px, de la largeur du bloc
function fenPlacer() {
  if (!fen) return;
  var a = fenPuce(fen.b, fen.ancre), q = $('.blk[data-id="' + fen.b + '"] .q-blk', app), p = fen.p;
  if (!a || !q) { closePop(); return; }
  var etroit = innerWidth <= 480, r = q.getBoundingClientRect();
  p.style.width = etroit ? Math.min(r.width, innerWidth - 16) + 'px' : '';
  placePop(p, a);
  if (etroit) p.style.left = Math.max(8, Math.min(r.left, innerWidth - p.offsetWidth - 8)) + 'px';
  $$('.q-puce[aria-expanded="true"]', app).forEach(function (x) { if (x !== a) x.setAttribute('aria-expanded', 'false'); });
  a.setAttribute('aria-expanded', 'true');
}
// repère d'un contrôle de la fenêtre (balise et attributs data-), pour lui rendre le focus après un garnissage
function fenRepere(el) {
  var s = el.tagName.toLowerCase() + (el.classList.contains('q-fen-q') ? '.q-fen-q' : '');
  ['qset', 'v', 'qfiltre', 'qcol', 'qchamp', 'qregy', 'tag', 'prop', 'qcolmode', 'qsub'].forEach(function (k) {
    if (el.dataset[k] != null) s += '[data-' + k + (el.dataset[k] ? '="' + CSS.escape(el.dataset[k]) + '"' : '') + ']';
  });
  return s;
}
function fenFiltrer() {
  var q = fen && $('.q-fen-q', fen.p), s = q ? norm(q.value.trim()) : '';
  $$('.q-fen-pills .q-chip', fen.p).forEach(function (c) { c.hidden = !!s && norm(c.textContent).indexOf(s) < 0; });
}
function fenGarnir() {
  var b = byId(fen.b), p = fen.p, a = document.activeElement, garde = a && a !== p && p.contains(a) ? fenRepere(a) : null;
  var q = $('.q-fen-q', p), recherche = q ? q.value : '', sel = q && garde && q === a ? [q.selectionStart, q.selectionEnd] : null, haut = p.scrollTop;
  p.innerHTML = qFenetre(b, doc, doc.cur, fen.cle);
  var q2 = $('.q-fen-q', p); if (q2 && recherche) { q2.value = recherche; fenFiltrer(); }
  var c = garde && $(garde, p); if (c) { c.focus({ preventScroll: true }); if (sel && c === q2) c.setSelectionRange(sel[0], sel[1]); }
  p.scrollTop = haut;
}
function fenOuvrir(bid, cle, clavier) {
  closePop();
  var b = byId(bid), a = fenPuce(bid, cle); if (!b || !a) return;
  var p = document.createElement('div'); p.className = 'pop q-fen'; p.dataset.id = bid;
  p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', a.title);
  pop = p; fen = { b: bid, cle: cle, ancre: cle, p: p };
  brancherColonnes(p); fenBrancher(p);
  session.ouvrirEtape({ etape: libelleBloc(doc.pages[doc.cur], b) + ' : ' + fenNature(b, cle) });
  fenGarnir(); fenPlacer();
  popClose = function () {
    var f = fen; fen = null; session.fermerEtape();
    var x = f && fenPuce(f.b, f.ancre); if (x) x.setAttribute('aria-expanded', 'false');
  };
  // au clavier, le focus entre dans la fenêtre (au doigt, pas de clavier virtuel ouvert d'office)
  var premier = clavier && $('input, select, button:not([disabled])', p); if (premier) premier.focus({ preventScroll: true });
}
// Échap : la fenêtre se ferme et la puce reprend le focus
function fenFermer() {
  var f = fen; closePop();
  var a = f && (fenPuce(f.b, f.ancre) || fenPuce(f.b, 'plus')); if (a) a.focus({ preventScroll: true });
}
// après chaque rendu : la fenêtre suit le bloc (disparu, mode lecture, source changée : fermée), puis se regarnit sous sa puce
function fenApresRendu() {
  if (!fen) return;
  var b = byId(fen.b);
  if (mode !== 'edit' || !b || b.type !== 'query') { closePop(); return; }
  if (fen.cle.indexOf('f:') === 0) {
    var prop = fen.cle.slice(2);
    if (!qFiltresProposes(b).some(function (f) { return f.prop === prop; })) { closePop(); return; }
    fen.ancre = qFiltrePose(b, prop) ? fen.cle : 'plus';   // filtre posé : sa puce ; retiré (dernière pastille décochée) : « + Filtre »
  }
  fenGarnir(); fenPlacer();
}
function fenBrancher(p) {
  var bloc = function () { return byId(fen.b); };
  p.addEventListener('click', function (e) {
    var x = e.target.closest('[data-qset], [data-qfiltre], [data-act=q-tag]'); if (!x || !fen || mode !== 'edit') return;
    var b = bloc(); if (!b) return;
    if (x.dataset.qset) { reglerBloc(b, x.dataset.qset, x.dataset.v, true); return; }
    if (x.dataset.act === 'q-tag') { var tk = x.dataset.tag; holdBar(b.id); session.modifier(function () { var w = b.tags || (b.tags = []), at = w.indexOf(tk); if (at >= 0) w.splice(at, 1); else w.push(tk); }); return; }
    var prop = x.dataset.qfiltre;
    if (prop === 'bloquees') { holdBar(b.id); session.modifier(function () { b.bloquees = true; }); fenFermer(); return; }
    fen.cle = 'f:' + prop; fen.ancre = qFiltrePose(b, prop) ? fen.cle : 'plus';
    fenGarnir(); fenPlacer();
    var premier = $('input, select, button', p); if (premier && e.detail === 0) premier.focus({ preventScroll: true });
  });
  p.addEventListener('change', function (e) {
    var el = e.target, b = fen && bloc(); if (!b || mode !== 'edit') return;
    if (el.matches('select[data-act=set]')) reglerBloc(b, el.dataset.prop, el.value, true);
    else if (el.matches('input.q-num[data-prop]')) reglerNombre(b, el.dataset.prop, el.value);
    else if (el.matches('input[data-qsub]')) reglerSousPages(b, el.checked);
  });
  p.addEventListener('input', function (e) { if (e.target.matches('.q-fen-q')) fenFiltrer(); });
  // le focus part dans la page (Tab) : la fenêtre se ferme, comme au clic ailleurs
  p.addEventListener('focusout', function (e) { var t = e.relatedTarget; if (fen && t && !p.contains(t) && !(t.closest && t.closest('[data-qpuce]'))) closePop(); });
}
// puces : un clic ouvre la fenêtre, un second clic sur la même puce la ferme ; × retire le filtre (une étape « filtres modifiés »)
app.addEventListener('click', function (e) {
  if (mode !== 'edit' || !e.target.closest) return;
  var x = e.target.closest('[data-qretirer]'), pc = !x && e.target.closest('[data-qpuce]'), blk = (x || pc) && (x || pc).closest('.blk'), b = blk && byId(blk.dataset.id);
  if (!b) return;
  if (x) {
    var prop = x.dataset.qretirer, clavier = e.detail === 0;
    closePop(); holdBar(b.id);
    session.modifier(function () { delete b[prop]; if (prop === 'tags') delete b.match; if (prop === 'kbDue') { delete b.kbDueN; delete b.kbDueU; } }, null, 'filtres modifiés');
    var plus = clavier && fenPuce(b.id, 'plus'); if (plus) plus.focus({ preventScroll: true });
    return;
  }
  if (fen && fen.b === b.id && fen.ancre === pc.dataset.qpuce) { closePop(); return; }
  fenOuvrir(b.id, pc.dataset.qpuce, e.detail === 0);
});
// Échap, où que soit le focus : la fenêtre se ferme et la puce reprend le focus (avant le raccourci global, 24-raccourcis-globaux.js)
document.addEventListener('keydown', function (e) { if (fen && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fenFermer(); } }, true);
window.addEventListener('scroll', function (e) { if (fen && !(e.target.nodeType === 1 && fen.p.contains(e.target))) fenPlacer(); }, true);
window.addEventListener('resize', function () { if (fen) fenPlacer(); });
