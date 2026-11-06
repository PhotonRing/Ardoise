/* ---------- Synchronisation : adaptateur de la session du document ----------
   La session (05-session.js) ne connaît la synchronisation que par adaptateurSynchro() : la marque d'une nouvelle
   étape, l'envoi des modifications locales, le rebase d'un état restauré, l'oubli des modifications reçues trop
   anciennes et la reprise de la configuration. Ce fichier contient aussi l'intégration de ce qui arrive des autres
   copies, sans DOM ; le transport, le chiffrement, la présence et le curseur restent dans 24-synchronisation.js.
   Sans synchronisation active (syn nul), tout est sans effet. Au chargement, ce fichier ne touche ni au DOM ni au
   stockage. */
var syn = null;   // synchronisation en cours (24-synchronisation.js)
function adaptateurSynchro() { return { marque: synHistMark, envoyer: synLocal, rebaser: synRebase, oublier: synTrim, reprendre: synKeep }; }
function synKeep(from, to) { if (from && from.sync && to) Object.defineProperty(to, 'sync', { value: from.sync, writable: true, configurable: true, enumerable: false }); }
function synSetCfg(d, cfg) { Object.defineProperty(d, 'sync', { value: cfg, writable: true, configurable: true, enumerable: false }); }
// contenu synchronisé : tout le document sauf ce qui est propre au fichier (identifiant, mot de passe, dates)
var SYN_KEYS = ['title', 'palette', 'typo', 'width', 'theme', 'nav', 'mapKey', 'tags', 'pages'];
function synSubset(d) { var o = {}; SYN_KEYS.forEach(function (k) { if (d[k] !== undefined && d[k] !== null) o[k] = d[k]; }); return JSON.parse(JSON.stringify(o)); }

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
  session.recevoir(after);
  return true;
}
function synPaths(a, b, path, out) {
  // différences de chemin à chemin (tableaux d'objets à identifiant suivis par identifiant), pour l'annulation
  if (synEq(a, b)) return;
  if (synIsObj(a) && synIsObj(b)) { var ks = {}; Object.keys(a).concat(Object.keys(b)).forEach(function (k) { ks[k] = 1; }); Object.keys(ks).forEach(function (k) { synPaths(a[k], b[k], path.concat([k]), out); }); return; }
  var ids = function (x) { return Array.isArray(x) && x.every(function (e) { return synIsObj(e) && typeof e.id === 'string'; }) ? x.map(function (e) { return e.id; }).join('\u0001') : null; };
  if (Array.isArray(a) && Array.isArray(b) && ids(a) !== null && ids(a) === ids(b)) { b.forEach(function (e, i) { synPaths(a[i], e, path.concat([{ id: e.id }]), out); }); return; }
  out.push({ p: path, v: b === undefined ? undefined : JSON.parse(JSON.stringify(b)) });
}
function synPatch(d, pt) {
  pt.forEach(function (x) {
    var o = d;
    for (var i = 0; i < x.p.length - 1 && o; i++) { var st = x.p[i]; o = typeof st === 'object' ? (Array.isArray(o) ? o.filter(function (e) { return e && e.id === st.id; })[0] : null) : o[st]; }
    if (!o || !x.p.length) return;
    var last = x.p[x.p.length - 1];
    if (typeof last === 'object') { if (!Array.isArray(o)) return; var j = -1; o.forEach(function (e, k) { if (e && e.id === last.id) j = k; }); if (j < 0) return; if (x.v === undefined) o.splice(j, 1); else o[j] = JSON.parse(JSON.stringify(x.v)); }
    else if (x.v === undefined) delete o[last]; else o[last] = JSON.parse(JSON.stringify(x.v));
  });
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
