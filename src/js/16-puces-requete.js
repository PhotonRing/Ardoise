/* ---------- Ligne de puces du bloc requête : fenêtres ----------
   Une puce (qLignePuces, 07-requetes.js) ouvre son réglage dans un menu surgissant (pop, placePop) accroché dessous, de la largeur
   du bloc sous 480 px ; la fenêtre reste ouverte et se regarnit à chaque rendu (annulation, synchro). Tous ses changements forment
   une seule étape d'annulation nommée (session.ouvrirEtape) ; second clic, clic ailleurs ou Échap la ferment. */
var fen = null;   // fenêtre ouverte : { b : id du bloc, cle : contenu (cle de qPuces, ou n:<prop>:<mode>[:<colonne>] pour un filtre en
                  // attente de sa première valeur), ancre : cle de la puce d'accroche, p : élément ; prop, mode, colonne : dernier filtre visé ;
                  // carte : { id : clé de la carte de nombre (qCleCarte), cle : 'filtres' ou 'tfiltres' }, null pour les filtres de la requête }
var FEN_NATURES = { src: 'source modifiée', scope: 'portée modifiée', plus: 'filtres modifiés', filtre: 'filtres modifiés', view: 'vue modifiée', cols: 'colonnes modifiées', sort: 'tri modifié' };
function fenNature(b, cle) {
  if (cle === 'cols' && qVue(b) === 'kanban' && b.src === 'kanban') return 'champs des cartes modifiés';
  return FEN_NATURES[/^[fn]:/.test(cle) ? 'filtre' : cle.indexOf('plus:') === 0 ? 'plus' : cle];
}
// liste visée par la fenêtre : { hote, cle } (requête : le bloc et 'filtres' ; carte de nombre : la carte, retrouvée par sa clé à chaque
// geste, et 'filtres' ou 'tfiltres') ; null si la carte a disparu. creer (dans une modification) : un bloc sans carte enregistrée reçoit
// sa carte par défaut, une carte sans id en reçoit un, et la fenêtre suit cet id
function fenHote(b, creer) {
  var k = fen.carte; if (!k) return { hote: b, cle: 'filtres' };
  if (creer && !(b.cards && b.cards.length)) { b.cards = [qDefCard(b)]; k.id = b.cards[0].id; }
  var c = qCarteDeCle(b, k.id); if (!c) return null;
  if (creer && !c.id) { c.id = uid(); k.id = c.id; }
  return { hote: c, cle: k.cle };
}
// puce « + Filtre » de la ligne visée (requête ou carte) : accroche d'un filtre en attente
function fenAncrePlus() { return fen.carte ? 'plus:' + fen.carte.id + ':' + fen.carte.cle : 'plus'; }
// carte de nombre d'une clé de puce : plus:<carte>:<cle>, ou f:<id> d'un filtre de carte ; null pour la ligne de la requête
function fenCarteDe(b, cle) {
  var m = cle.match(/^plus:(.+):(t?filtres)$/); if (m) return { id: m[1], cle: m[2] };
  var t = cle.indexOf('f:') === 0 && qTrouverFiltre(b, cle.slice(2)); if (!t || t.hote === b) return null;
  return { id: qCleCarte(t.hote, b.cards.indexOf(t.hote)), cle: t.cle };
}
// filtre visé par la fenêtre : { id, prop, mode, colonne } (posé) ou { prop, mode, colonne } (en attente) ; null si ce n'est pas
// une fenêtre de filtre ; colonne : « Valeur d'une colonne » seulement
function fenFiltre(b) {
  var c = fen.cle, m = c.match(Q_CLE_ATTENTE); if (m) return m[1] === 'valeur' ? { prop: m[1], mode: m[2], colonne: m[3] || '' } : { prop: m[1], mode: m[2] };
  var h = c.indexOf('f:') === 0 && fenHote(b), f = h && qFiltreParId(h.hote[h.cle], c.slice(2));
  return f ? (f.prop === 'valeur' ? { id: f.id, prop: f.prop, mode: f.mode || 'un', colonne: f.colonne } : { id: f.id, prop: f.prop, mode: f.mode || 'un' }) : null;
}
// clé d'un filtre en attente (Q_CLE_ATTENTE, 07-requetes.js) : propriété, mode et, pour « Valeur d'une colonne », sa colonne
function fenCleAttente(ref, mode) { return 'n:' + ref.prop + ':' + (mode || ref.mode || 'un') + (ref.prop === 'valeur' ? ':' + (ref.colonne || '') : ''); }
// après un geste sur un filtre : la fenêtre suit le filtre créé (sous sa puce) ou retiré (en attente sous « + Filtre », même mode)
function fenSuivre(f, ref) {
  fen.cle = f ? 'f:' + f.id : fenCleAttente(ref); fen.ancre = f ? fen.cle : fenAncrePlus();
  fenGarnir(); fenPlacer();
}
// une modification de la liste visée : fn(hote, cle) ; rend ce que rend fn
function fenModifier(b, fn) { var r = null; holdBar(b.id); session.modifier(function () { var h = fenHote(b, true); if (h) r = fn(h.hote, h.cle); }); return r; }
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
  ['qset', 'fid', 'qval', 'qmode', 'qcolonne', 'v', 'qfiltre', 'qcol', 'qchamp', 'qregy', 'prop', 'qcolnouv', 'qsub'].forEach(function (k) {
    if (el.dataset[k] != null) s += '[data-' + k + (el.dataset[k] ? '="' + CSS.escape(el.dataset[k]) + '"' : '') + ']';
  });
  return s;
}
function fenFiltrer() {
  var q = fen && $('.q-fen-q', fen.p), s = q ? norm(q.value.trim()) : '';
  $$('.q-fen-cases .q-case', fen.p).forEach(function (c) { c.hidden = !!s && norm(c.textContent).indexOf(s) < 0; });
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
  pop = p; fen = { b: bid, cle: cle, ancre: cle, p: p, carte: fenCarteDe(b, cle) };
  var fo = cle.indexOf('f:') === 0 && qTrouverFiltre(b, cle.slice(2)); fo = fo && fo.f; if (fo) { fen.prop = fo.prop; fen.mode = fo.mode || 'un'; fen.colonne = fo.colonne; }   // si le filtre disparaît : en attente
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
  if (/^[fn]:/.test(fen.cle)) {
    // filtre retiré ailleurs (Ctrl+Z, autre copie) : la fenêtre passe en attente sous « + Filtre », avec le dernier mode connu
    // carte de nombre disparue (supprimée ici ou ailleurs) : fermée ; ses filtres comptent tous, ceux de la requête selon sa source
    var h = fenHote(b); if (!h) { closePop(); return; }
    var f = fen.cle.indexOf('f:') === 0 && qFiltreParId(fen.carte ? h.hote[h.cle] : qFiltresSource(b, b.filtres), fen.cle.slice(2));
    if (f) { fen.prop = f.prop; fen.mode = f.mode || 'un'; fen.colonne = f.colonne; fen.ancre = fen.cle; }
    else if (fen.cle.indexOf('n:') === 0) fen.ancre = fenAncrePlus();
    else if (fen.prop) { fen.cle = fenCleAttente({ prop: fen.prop, mode: fen.mode, colonne: fen.colonne }); fen.ancre = fenAncrePlus(); }
    else { closePop(); return; }
    // propriété que la source ne propose plus : fermée, sauf un filtre posé sur une carte (il compte quand même, comme qFenetreFiltre)
    var prop = f ? f.prop : fen.cle.split(':')[1];
    if (!(fen.carte && f) && !qFiltresProposes(b).some(function (x) { return x.prop === prop; })) { closePop(); return; }
  }
  fenGarnir(); fenPlacer();
}
function fenBrancher(p) {
  var bloc = function () { return byId(fen.b); };
  p.addEventListener('click', function (e) {
    var x = e.target.closest('[data-qset], [data-qfiltre], [data-qmode]'); if (!x || !fen || mode !== 'edit') return;
    var b = bloc(); if (!b) return;
    var ref = fenFiltre(b), f;
    if (x.dataset.qmode) {
      // en attente : le mode est gardé pour la première valeur cochée
      if (ref && !ref.id) { fen.cle = fenCleAttente(ref, x.dataset.qmode); fenGarnir(); }
      else if (ref) fenModifier(b, function (hote, cle) { qModeFiltre(hote, cle, ref, x.dataset.qmode); });
      return;
    }
    if (x.dataset.qset && x.dataset.fid != null && ref) {
      var v = x.dataset.v;
      if (x.dataset.qset === 'kbDueU') { fenModifier(b, function (hote, cle) { var fu = qFiltreParId(hote[cle], ref.id); if (fu) fu.u = v; }); return; }
      f = fenModifier(b, function (hote, cle) { return qReglerFiltre(b, hote, cle, ref, v); });
      fenSuivre(f, ref); return;
    }
    if (x.dataset.qset) { reglerBloc(b, x.dataset.qset, x.dataset.v, true); return; }
    // « + Filtre » : un nouveau filtre, posé à sa première valeur ; « Bloquées » se pose aussitôt (réglable en « Non bloquées »)
    var prop = x.dataset.qfiltre;
    if (prop === 'bloquees') fenSuivre(fenModifier(b, function (hote, cle) { return qReglerFiltre(b, hote, cle, { prop: 'bloquees' }, 'oui'); }), { prop: prop });
    else {
      // « Valeur d'une colonne » : en attente sur la première colonne de la portée
      var c0 = prop === 'valeur' && qColonnesFiltre(qRecsPortee(b, doc, doc.cur))[0];
      fen.cle = fenCleAttente({ prop: prop, colonne: c0 ? c0.key : '' }, 'un'); fen.ancre = fenAncrePlus(); fenGarnir(); fenPlacer();
    }
    var premier = $('input, select, button', p); if (premier && e.detail === 0) premier.focus({ preventScroll: true });
  });
  p.addEventListener('change', function (e) {
    var el = e.target, b = fen && bloc(); if (!b || mode !== 'edit') return;
    if (el.matches('input[data-qval]')) {
      var ref = fenFiltre(b), v = el.dataset.v; if (!ref) return;
      fenSuivre(fenModifier(b, function (hote, cle) { return qBasculerValeur(b, hote, cle, ref, v); }), ref);
    }
    else if (el.matches('select[data-qcolonne]')) {
      // changer de colonne efface les valeurs cochées : un filtre posé est retiré (une étape avec le reste de la fenêtre) ;
      // la fenêtre reste ouverte sous « + Filtre », en attente sur la nouvelle colonne, même mode
      var rc = fenFiltre(b); if (!rc) return;
      var go = function (hote, cle) { return qChangerColonne(b, doc, doc.cur, cle || 'filtres', rc, el.value, hote); };
      fen.cle = rc.id ? fenModifier(b, go) : go(); fen.ancre = fenAncrePlus(); fen.colonne = el.value;
      fenGarnir(); fenPlacer();
    }
    else if (el.matches('select[data-act=set]')) reglerBloc(b, el.dataset.prop, el.value, true);
    else if (el.matches('input.q-num[data-prop]')) reglerNombre(b, el.dataset.prop, el.value, el.dataset.fid);
    else if (el.matches('input[data-qsub]')) reglerSousPages(b, el.checked);
  });
  p.addEventListener('input', function (e) { if (e.target.matches('.q-fen-q')) fenFiltrer(); });
  // le focus part dans la page (Tab) : la fenêtre se ferme, comme au clic ailleurs
  p.addEventListener('focusout', function (e) { var t = e.relatedTarget; if (fen && t && !p.contains(t) && !(t.closest && t.closest('[data-qpuce]'))) closePop(); });
}
// puces : un clic ouvre la fenêtre, un second clic sur la même puce la ferme ; × retire ce filtre-là (data-qretirer : son id ; une étape)
app.addEventListener('click', function (e) {
  if (mode !== 'edit' || !e.target.closest) return;
  var x = e.target.closest('[data-qretirer]'), pc = !x && e.target.closest('[data-qpuce]'), blk = (x || pc) && (x || pc).closest('.blk'), b = blk && byId(blk.dataset.id);
  if (!b) return;
  if (x) {
    // filtre de la requête ou d'une carte de nombre (ids uniques dans le bloc) ; au clavier, le focus va au « + Filtre » de sa ligne
    var prop = x.dataset.qretirer, clavier = e.detail === 0, t = qTrouverFiltre(b, prop);
    var ligne = !t || t.hote === b ? 'plus' : 'plus:' + qCleCarte(t.hote, b.cards.indexOf(t.hote)) + ':' + t.cle;
    closePop(); holdBar(b.id);
    session.modifier(function () { var r = qTrouverFiltre(b, prop); if (r) qRetirerFiltre(r.hote, r.cle, r.f); }, null, 'filtres modifiés');
    var plus = clavier && fenPuce(b.id, ligne); if (plus) plus.focus({ preventScroll: true });
    return;
  }
  if (fen && fen.b === b.id && fen.ancre === pc.dataset.qpuce) { closePop(); return; }
  fenOuvrir(b.id, pc.dataset.qpuce, e.detail === 0);
});
// un geste qui commence hors de la fenêtre (glisser d'une ligne, d'une carte, au doigt) la ferme d'abord : il fait sa propre étape ;
// pointerdown, car un glisser empêche souvent mousedown ; puces et barre d'outils (annuler) gardent la fenêtre
function fenDehors(t) { return fen && t && t.closest && !fen.p.contains(t) && !t.closest('[data-qpuce], [data-ui]'); }
document.addEventListener('pointerdown', function (e) { if (fenDehors(e.target)) closePop(); }, true);
// de même, une frappe hors de la fenêtre (touches de modification seules mises à part) clôt son étape
document.addEventListener('keydown', function (e) { if (fenDehors(e.target) && ['Escape', 'Shift', 'Control', 'Alt', 'Meta', 'AltGraph'].indexOf(e.key) < 0) closePop(); }, true);
// Échap, où que soit le focus : la fenêtre se ferme et la puce reprend le focus (avant le raccourci global, 24-raccourcis-globaux.js)
document.addEventListener('keydown', function (e) { if (fen && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fenFermer(); } }, true);
window.addEventListener('scroll', function (e) { if (fen && !(e.target.nodeType === 1 && fen.p.contains(e.target))) fenPlacer(); }, true);
window.addEventListener('resize', function () { if (fen) fenPlacer(); });
