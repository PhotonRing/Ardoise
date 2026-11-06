/* ---------- Synchronisation : adaptateur de la session du document ----------
   La session (05-session.js) ne connaît la synchronisation que par adaptateurSynchro() : la marque d'une nouvelle
   étape, l'envoi des modifications locales, le rebase d'un état restauré, l'oubli des modifications reçues trop
   anciennes et la reprise de la configuration. Ce fichier contient aussi l'intégration de ce qui arrive des autres
   copies, sans DOM ; le transport, le chiffrement, la présence et le curseur restent dans 24-synchronisation.js.
   Sans synchronisation active (syn nul), tout est sans effet. Au chargement, ce fichier ne touche ni au DOM ni au
   stockage. */
var syn = null;   // synchronisation en cours (24-synchronisation.js)
function adaptateurSynchro() { return { marque: synHistMark, envoyer: synLocal, rebaser: synRebase, oublier: synTrim, reprendre: synKeep }; }
function synKeep(from, to) { if (from && from.sync && to) synSetCfg(to, from.sync); }
function synSetCfg(d, cfg) { Object.defineProperty(d, 'sync', { value: cfg, writable: true, configurable: true, enumerable: false }); }
// contenu synchronisé : tout le document sauf ce qui est propre au fichier (identifiant, mot de passe, dates)
var SYN_KEYS = ['title', 'palette', 'typo', 'width', 'theme', 'nav', 'mapKey', 'tags', 'pages'];
function synSubset(d) { var o = {}; SYN_KEYS.forEach(function (k) { if (d[k] !== undefined && d[k] !== null) o[k] = d[k]; }); return synClone(o); }
// copie indépendante d'une valeur JSON ; undefined reste undefined
function synClone(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }

// modifications locales : appelée après chaque étape validée dans l'historique, après une annulation, et avant
// d'appliquer ce qui arrive des autres copies
function synLocal() {
  if (!syn || !doc || syn.adopt) return;
  var cur = synSubset(doc);
  var ops = synDiff(syn.st, syn.base, cur);
  syn.base = cur;
  if (!ops.length) return;
  syn.pending = syn.pending.concat(ops);
  clearTimeout(syn.sendT); syn.sendT = setTimeout(function () { synFlush(false); }, 120);
}

// réception : intègre les modifications reçues et les passe à la session ; vrai si le document a changé
function synIntegrer(s, batches, reload) {
  if (!batches.length && !reload) return false;
  // la frappe en attente devient une étape d'annulation, et ce qui a été saisi ici part d'abord (sinon la
  // comparaison effacerait l'arrivée) ; après l'arrivée, ce serait trop tard
  session.valider();
  synLocal();
  var changed = reload;
  batches.forEach(function (ops) { if (synApply(s.st, ops)) changed = true; });
  if (!changed) return false;
  var before = s.base, after = synJSON(s.st.root);
  if (s.adopt) { s.adopt = false; toast('Document mis à jour depuis les autres copies', 4000); }
  if (synEq(before, after)) return false;
  s.base = after;
  // annulation : les retours en arrière gardent les modifications reçues entre-temps
  var pt = []; synPaths(before, after, [], pt); s.patches.push(pt);
  session.recevoir(after, SYN_KEYS);
  return true;
}
// différences de chemin à chemin, pour l'annulation ; les tableaux d'objets à identifiant sont suivis par identifiant
function synPaths(a, b, path, out, pos) {
  // pos, sous un tableau sans identifiant : le plus extérieur (chemin, valeur reçue) et l'élément d'avant au pas k du chemin
  if (synEq(a, b)) return;
  if (synIsObj(a) && synIsObj(b)) { var ks = {}; Object.keys(a).concat(Object.keys(b)).forEach(function (k) { ks[k] = 1; }); Object.keys(ks).forEach(function (k) { synPaths(a[k], b[k], path.concat([k]), out, pos); }); return; }
  var ia = synIds(a), ib = synIds(b);
  if (ia && ib) {
    var avant = {}; a.forEach(function (e) { avant['$' + e.id] = e; });
    b.forEach(function (e) { if (avant['$' + e.id]) synPaths(avant['$' + e.id], e, path.concat([{ id: e.id }]), out, pos); });
    synOrdre(ia, ib, b, path, out);
    return;
  }
  // sans identifiant, même longueur : comparées position par position ; longueur différente : tout le tableau (limite connue)
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    var liste = pos ? pos.liste : { p: path, v: synClone(b) };
    b.forEach(function (e, k) { synPaths(a[k], e, path.concat([{ i: k, n: b.length }]), out, { liste: liste, avant: a[k], k: path.length }); });
    return;
  }
  var x = { p: path, v: synClone(b) };
  if (pos) x.pos = { liste: pos.liste, avant: synClone(pos.avant), k: pos.k };
  out.push(x);
}
// identifiants d'un tableau d'objets à identifiant texte, tous différents ; sinon null
function synIds(x) {
  if (!Array.isArray(x)) return null;
  var vus = {}, ids = [];
  for (var i = 0; i < x.length; i++) { var e = x[i]; if (!synIsObj(e) || typeof e.id !== 'string' || vus['$' + e.id]) return null; vus['$' + e.id] = 1; ids.push(e.id); }
  return ids;
}
// position de l'élément d'identifiant id dans le tableau t ; -1 s'il n'y est pas
function synChercher(t, id) { for (var k = 0; k < t.length; k++) if (t[k] && t[k].id === id) return k; return -1; }
// structure : seulement ce que l'autre copie a ajouté, déplacé (hors de la plus longue sous-suite commune) ou supprimé
function synOrdre(ia, ib, b, path, out) {
  var enA = {}, enB = {};
  ia.forEach(function (id) { enA['$' + id] = 1; }); ib.forEach(function (id) { enB['$' + id] = 1; });
  var garde = synCommuns(ia.filter(function (id) { return enB['$' + id]; }), ib.filter(function (id) { return enA['$' + id]; }));
  ia.forEach(function (id) { if (!enB['$' + id]) out.push({ p: path, suppr: id }); });
  // « X après » ses voisins précédents reçus, du plus proche au plus loin ; jamais l'ordre complet, qui garderait les déplacements locaux
  ib.forEach(function (id, k) {
    if (garde['$' + id]) return;
    var x = { p: path, place: id, apres: ib.slice(0, k).reverse() };
    if (!enA['$' + id]) x.v = synClone(b[k]);   // nouveau : son contenu voyage avec lui
    out.push(x);
  });
}
// identifiants de la plus longue sous-suite commune de ca et cb, en table « $id »
function synCommuns(ca, cb) {
  var L = synLongueurs(ca, cb), garde = {}, i = 0, j = 0;
  while (i < ca.length && j < cb.length) {
    if (ca[i] === cb[j]) { garde['$' + ca[i]] = 1; i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  return garde;
}
// L[i][j] : longueur de la plus longue sous-suite commune de ca à partir de i et de cb à partir de j
function synLongueurs(ca, cb) {
  var L = [], i, j;
  for (i = ca.length; i >= 0; i--) {
    L[i] = [];
    for (j = cb.length; j >= 0; j--) L[i][j] = synLongueur(L, ca, cb, i, j);
  }
  return L;
}
function synLongueur(L, ca, cb, i, j) {
  if (i === ca.length || j === cb.length) return 0;
  if (ca[i] === cb[j]) return L[i + 1][j + 1] + 1;
  return Math.max(L[i + 1][j], L[i][j + 1]);
}
// un pas de chemin : clé, { id }, ou { i, n } si le tableau a encore la longueur n ; undefined s'il ne mène nulle part
function synPas(o, st) {
  if (typeof st !== 'object') return o[st];
  if (!Array.isArray(o)) return undefined;
  if ('i' in st) return o.length === st.n ? o[st.i] : undefined;
  var j = synChercher(o, st.id);
  return j < 0 ? undefined : o[j];
}
// suit un chemin sur ses n premiers pas ; null s'il ne mène nulle part
function synSuivre(d, p, n) {
  var o = d;
  for (var i = 0; i < n && o; i++) o = synPas(o, p[i]);
  return o || null;
}
function synPatch(d, pt) {
  pt.forEach(function (x) {
    if ('suppr' in x || 'place' in x) { var t = synSuivre(d, x.p, x.p.length); if (Array.isArray(t)) synPlacer(t, x); return; }
    if (!x.pos) { synEcrire(d, x.p, x.v); return; }
    // position : sans la longueur reçue, l'annulation l'emporte
    var st = x.p[x.pos.k], t = synSuivre(d, x.p, x.pos.k);
    if (!Array.isArray(t) || t.length !== st.n) return;
    // élément d'avant plus à sa place (ordre changé ici) : toute la liste reçue plutôt que la mauvaise ligne (limite connue)
    if (synEq(t[st.i], x.pos.avant)) synEcrire(d, x.p, x.v); else synEcrire(d, x.pos.liste.p, x.pos.liste.v);
  });
}
// écrit v (undefined : retire) au bout du chemin p, si son parent existe encore
function synEcrire(d, p, v) {
  var o = synSuivre(d, p, p.length - 1), last = p[p.length - 1];
  if (!o || !p.length) return;
  if (typeof last !== 'object') { if (v === undefined) delete o[last]; else o[last] = synClone(v); return; }
  if (!Array.isArray(o)) return;
  if ('i' in last) { if (o.length === last.n) o[last.i] = synClone(v); return; }
  var j = synChercher(o, last.id);
  if (j < 0) return;
  if (v === undefined) o.splice(j, 1); else o[j] = synClone(v);
}
// rejeu de la structure : « X supprimé » retire X ; « X après » le remet après le plus proche voisin reçu encore là, sinon en tête
function synPlacer(t, x) {
  var j = synChercher(t, 'suppr' in x ? x.suppr : x.place), e, k = -1;
  if ('suppr' in x) { if (j >= 0) t.splice(j, 1); return; }
  // absent et pas nouveau (ajout local annulé) : rien, l'annulation l'emporte
  if (j >= 0) e = t.splice(j, 1)[0]; else if (x.v !== undefined) e = synClone(x.v); else return;
  for (var i = 0; i < x.apres.length && k < 0; i++) k = synChercher(t, x.apres[i]);
  t.splice(k + 1, 0, e);
}
// annulation pendant la synchronisation : l'état restauré reçoit les modifications arrivées depuis
function synHistMark() { return syn ? syn.patchBase + syn.patches.length : 0; }
function synTrim(mark) {
  // les modifications reçues plus anciennes que le plus ancien état de l'historique ne servent plus
  if (!syn || mark == null) return;
  var drop = mark - syn.patchBase; if (drop > 0) { syn.patches.splice(0, drop); syn.patchBase += drop; }
}
function synRebase(json, mark) {
  if (!syn || mark == null) return json;
  var from = mark - syn.patchBase; if (from >= syn.patches.length) return json;
  var d = JSON.parse(json);
  for (var i = Math.max(0, from); i < syn.patches.length; i++) synPatch(d, syn.patches[i]);
  return JSON.stringify(d);
}

// la session du document, une fois son adaptateur défini (sans DOM ni stockage)
var session = creerSession(adaptateurSynchro());
