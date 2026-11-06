/* ---------- Synchronisation entre copies (relais aveugle, chiffrement de bout en bout) ---------- */
// Toute copie du fichier peut se synchroniser : la clé est créée à l'activation et rangée dans le fichier (chiffrée
// avec lui si le document est chiffré par mot de passe). Le relais (relais/relais.mjs, installable chez soi) ne
// reçoit que des messages chiffrés (AES-256-GCM) et un identifiant de salon dérivé de la clé ; il les range et les
// transmet aux autres copies, en direct ou à leur prochaine connexion. Les modifications sont fusionnées par le
// moteur de 05-synchro-moteur.js. La présence (nom et couleur de chaque personne, bloc en cours de modification)
// passe aussi chiffrée, sans être conservée.
//
// Dans le fichier : doc.sync = { relay, key, seq, state, pending } (propriété non énumérable : hors de
// l'historique d'annulation et des brouillons ; écrite à l'enregistrement par synSaved).
var syn = null;   // session en cours
var SYN_COLORS = ['#d9480f', '#1971c2', '#2f9e44', '#9c36b5', '#e8590c', '#0c8599', '#c2255c', '#5f3dc4'];
var SYN_ADJ = ['curieuse', 'joyeuse', 'discrète', 'rapide', 'patiente', 'rêveuse', 'agile', 'sereine', 'vive', 'attentive', 'audacieuse', 'paisible'];
var SYN_ANI = ['Loutre', 'Mésange', 'Hermine', 'Libellule', 'Chouette', 'Baleine', 'Gazelle', 'Panthère', 'Marmotte', 'Grue', 'Tortue', 'Abeille'];
function synKeep(from, to) { if (from && from.sync && to) Object.defineProperty(to, 'sync', { value: from.sync, writable: true, configurable: true, enumerable: false }); }
function synSetCfg(d, cfg) { Object.defineProperty(d, 'sync', { value: cfg, writable: true, configurable: true, enumerable: false }); }
var synNom = '';   // sans stockage du navigateur (plugin Obsidian), le nom reste le même pendant la session
function synName() {
  var n = ''; try { n = localStorage.getItem(LS + 'nom') || ''; } catch (_) {}
  if (!n) n = synNom;
  if (!n) { n = SYN_ANI[Math.floor(Math.random() * SYN_ANI.length)] + ' ' + SYN_ADJ[Math.floor(Math.random() * SYN_ADJ.length)]; try { localStorage.setItem(LS + 'nom', n); } catch (_) {} }
  synNom = n; return n;
}
function synColor(actor) { var h = 0; for (var i = 0; i < actor.length; i++) h = (h * 31 + actor.charCodeAt(i)) >>> 0; return SYN_COLORS[h % SYN_COLORS.length]; }
// contenu synchronisé : tout le document sauf ce qui est propre au fichier (identifiant, mot de passe, dates)
var SYN_KEYS = ['title', 'palette', 'typo', 'width', 'theme', 'nav', 'mapKey', 'tags', 'pages'];
function synSubset(d) { var o = {}; SYN_KEYS.forEach(function (k) { if (d[k] !== undefined && d[k] !== null) o[k] = d[k]; }); return JSON.parse(JSON.stringify(o)); }

// ---------- chiffrement ----------
function b64u(buf) { return b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64u(s) { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return unb64(s); }
function synDigest(s) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(b64u); }
function synCrypto(cfg) {
  // clé AES et identifiants dérivés de la clé du fichier : le relais ne voit que les empreintes
  return Promise.all([crypto.subtle.importKey('raw', unb64u(cfg.key), 'AES-GCM', false, ['encrypt', 'decrypt']), synDigest('ardoise-salon:' + cfg.key), synDigest('ardoise-auth:' + cfg.key)])
    .then(function (r) { return { key: r[0], room: r[1], auth: r[2] }; });
}
function synSeal(o) {
  var iv = crypto.getRandomValues(new Uint8Array(12));
  return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, syn.c.key, new TextEncoder().encode(JSON.stringify(o))).then(function (ct) {
    var out = new Uint8Array(12 + ct.byteLength); out.set(iv); out.set(new Uint8Array(ct), 12); return b64u(out);
  });
}
function synOpen(s) {
  var b = unb64u(s);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, syn.c.key, b.slice(12)).then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); });
}

// ---------- session ----------
function synStart() {
  synStop();
  if (!doc || !doc.sync || !doc.sync.key || !doc.sync.relay || doc.newer || !(window.crypto && crypto.subtle) || !window.WebSocket) { synPaint(); return; }
  var cfg = doc.sync, actor = uid() + uid();
  var st = cfg.state ? synLoad(cfg.state, actor) : synCreate(actor);
  syn = { cfg: cfg, st: st, base: synJSON(st.root), pending: Array.isArray(cfg.pending) ? cfg.pending.slice() : [], seq: +cfg.seq || 0, snapSeq: 0,
    ws: null, status: 'connexion', err: '', peers: {}, queue: [], tries: 0, timer: 0, sendT: 0, presT: 0, presLast: '', msgId: 0, inflight: {}, patches: [], patchBase: 0, alive: true, fresh: !cfg.state, adopt: false };
  // le fichier a pu changer sans passer par la synchronisation (ancien éditeur, JSON modifié à la main) : écart → modifications locales
  synLocal();
  // configuration seule dans le document ; l'état vit dans la session jusqu'au prochain enregistrement
  synSetCfg(doc, { relay: cfg.relay, key: cfg.key });
  synCrypto(cfg).then(function (c) { if (!syn || syn.cfg !== cfg) return; syn.c = c; synConnect(); }, function () { synFail('Chiffrement indisponible dans ce navigateur'); });
  synPaint();
}
function synStop() {
  if (!syn) return;
  syn.alive = false; clearTimeout(syn.timer); clearTimeout(syn.sendT); clearInterval(syn.presT);
  if (syn.ws) { try { syn.ws.onclose = null; syn.ws.close(); } catch (_) {} }
  syn = null; synPaint(); synPaintPeers();
}
function synFail(msg) { if (!syn) return; syn.status = 'erreur'; syn.err = msg; synPaint(); }
function synConnect() {
  if (!syn || !syn.alive) return;
  var s = syn, url = String(s.cfg.relay).trim();
  if (!/^wss?:\/\//i.test(url)) { synFail('Adresse du relais invalide (ws:// ou wss://)'); return; }
  var ws; try { ws = new WebSocket(url); } catch (e) { synFail('Adresse du relais invalide'); return; }
  s.ws = ws; s.status = 'connexion'; synPaint();
  ws.onopen = function () { if (syn !== s) return; s.tries = 0; ws.send(JSON.stringify({ t: 'rejoindre', salon: s.c.room, auth: s.c.auth, depuis: s.seq })); };
  ws.onmessage = function (e) { if (syn !== s) return; var m; try { m = JSON.parse(e.data); } catch (_) { return; } s.queue.push(m); synPump(); };
  ws.onclose = function () {
    if (syn !== s) return;
    s.ws = null; s.peers = {}; synPaintPeers();
    if (s.status !== 'erreur') s.status = 'hors-ligne';
    synPaint();
    var wait = [1, 2, 5, 10, 20, 30][Math.min(5, s.tries++)] * 1000;
    clearTimeout(s.timer); s.timer = setTimeout(synConnect, wait);
  };
}
window.addEventListener('online', function () { if (syn && !syn.ws) { clearTimeout(syn.timer); synConnect(); } });
document.addEventListener('visibilitychange', function () { if (syn && !syn.ws && document.visibilityState === 'visible') { clearTimeout(syn.timer); synConnect(); } });

// Messages du relais, traités un par un (le déchiffrement est asynchrone, l'ordre doit être gardé), et jamais
// pendant une saisie en cours de composition (clavier Android, IME) ni pendant un glisser
var synBusy = false, synComposing = false;
document.addEventListener('compositionstart', function () { synComposing = true; }, true);
document.addEventListener('compositionend', function () { synComposing = false; setTimeout(synPump, 50); }, true);
function synPump() {
  if (!syn || synBusy || !syn.queue.length) return;
  if (synComposing || (typeof pointerBusy !== 'undefined' && pointerBusy) || printing) { setTimeout(synPump, 300); return; }
  var s = syn, m = s.queue.shift(); synBusy = true;
  var done = function () { synBusy = false; if (syn === s) synPump(); };
  synHandle(s, m).then(done, function (e) { console.error('synchronisation', e); done(); });
}
function synHandle(s, m) {
  if (m.t === 'bienvenue') {
    s.status = 'ok'; s.err = ''; synPaint();
    if (s.fresh && (m.snap || (m.trames || []).length)) {
      // copie jamais synchronisée (sans état commun) face à un relais déjà rempli : elle adopte le document des
      // autres copies plutôt que d'imposer le sien en bloc
      s.st = synCreate(s.st.actor); s.pending = []; s.base = {}; s.seq = 0; s.adopt = true;
    }
    s.fresh = false;
    var frames = m.trames || [], chain = Promise.resolve(), remote = [];
    if (m.snap) chain = synOpen(m.snap.d).then(function (state) {
      if (synNewer(s, state.f)) return;
      // trop en retard : on repart de l'instantané, puis on rejoue ses propres modifications non confirmées
      synLocal();
      var lam = s.st.lamport; s.st = synLoad(state, s.st.actor); if (s.st.lamport < lam) s.st.lamport = lam;
      synApply(s.st, s.pending); s.seq = m.snap.s; s.snapSeq = m.snap.s; remote.push(1);
    });
    frames.forEach(function (f) { chain = chain.then(function () { if (s.newer) return; return synOpen(f.d).then(function (b) { if (synNewer(s, b.v)) return; remote.push(b.o); s.seq = f.s; }, function () { s.seq = f.s; }); }); });
    return chain.then(function () {
      if (s.newer) { synRemote(s, remote.filter(function (x) { return Array.isArray(x); }), false); synBlock(s); return; }
      synRemote(s, remote.filter(function (x) { return Array.isArray(x); }), remote.indexOf(1) >= 0);
      // relais vide ou plus en retard que ce fichier (nouvelle clé, relais neuf, réinstallé ou changé) : on lui
      // envoie tout l'état, qui contient aussi les modifications en attente
      if (!m.snap && (m.seq === 0 || m.seq < s.seq)) { s.seq = m.seq; synFull(s); }
      (m.presents || []).forEach(function (p) { synPeer(s, p.de, p.d); });
      s.inflight = {}; synFlush(true); synPresence(true);
      clearInterval(s.presT); s.presT = setInterval(function () { synPresence(false); synPrune(); }, 15000);
      synMaybeSnap(s);
    });
  }
  if (m.t === 'trame') return synOpen(m.d).then(function (b) { if (synNewer(s, b.v)) { synBlock(s); return; } s.seq = m.s; synRemote(s, [b.o], false); synMaybeSnap(s); }, function () { s.seq = m.s; });
  if (m.t === 'recu') {
    var sent = s.inflight[m.id]; delete s.inflight[m.id];
    if (sent) s.pending = s.pending.slice(sent);   // les envois partent dans l'ordre : les plus anciennes en attente
    Object.keys(s.inflight).forEach(function (k) { s.inflight[k] -= sent || 0; });
    s.seq = m.s; synMaybeSnap(s); return Promise.resolve();
  }
  if (m.t === 'presence') { synPeer(s, m.de, m.d); return Promise.resolve(); }
  if (m.t === 'depart') { delete s.peers[m.de]; synPaintPeers(); return Promise.resolve(); }
  if (m.t === 'erreur') {
    if (m.code === 'cle') synFail('Clé refusée par le relais : ce document y est déjà associé à une autre clé');
    else toast('Synchronisation : ' + (m.msg || m.code), 6000);
    return Promise.resolve();
  }
  return Promise.resolve();
}
// Versions : chaque envoi porte le format du document de la copie qui l'a fait (VERSION, 00-entete.js). Une copie
// dont l'éditeur est plus ancien que ce format ne l'applique pas : sa synchronisation s'arrête, sans rien perdre de
// ses propres modifications, jusqu'à ce qu'Ardoise y soit mis à jour (Fichier → Mettre à jour Ardoise)
function synNewer(s, v) { if (+v > VERSION) s.newer = +v; return !!s.newer; }
function synBlock(s) {
  if (syn !== s) return;
  s.alive = false; clearTimeout(s.timer); clearInterval(s.presT);
  if (s.ws) { try { s.ws.onclose = null; s.ws.close(); } catch (_) {} s.ws = null; }
  s.peers = {};
  synFail('Une autre copie utilise une version plus récente d’Ardoise : mettez à jour celle-ci (Fichier → Mettre à jour Ardoise) pour reprendre la synchronisation');
  toast('Synchronisation en pause : mettez à jour Ardoise (Fichier → Mettre à jour Ardoise)', 8000);
  synPaintPeers();
}
function synPeer(s, de, data) {
  return synOpen(data).then(function (p) { if (!p || p.a === s.st.actor) return; s.peers[de] = { a: p.a, n: String(p.n || '').slice(0, 40), pg: p.pg, b: p.b, m: p.m, ver: String(p.ver || '').slice(0, 20), t: Date.now() }; synPaintPeers(); }, function () {});
}
function synPrune() { if (!syn) return; var now = Date.now(), ch = false; Object.keys(syn.peers).forEach(function (k) { if (now - syn.peers[k].t > 70000) { delete syn.peers[k]; ch = true; } }); if (ch) synPaintPeers(); }

// ---------- envois ----------
// modifications locales : appelée après chaque changement enregistré dans l'historique (snapshot), après une
// annulation, et avant d'appliquer ce qui arrive des autres copies
function synLocal() {
  if (!syn || !doc || syn.adopt) return;
  var cur = synSubset(doc);
  var ops = synDiff(syn.st, syn.base, cur);
  syn.base = cur;
  if (!ops.length) return;
  syn.pending = syn.pending.concat(ops);
  clearTimeout(syn.sendT); syn.sendT = setTimeout(function () { synFlush(false); }, 120);
}
function synFlush(all) {
  // envoie ce qui n'est pas encore parti (tout, après une reconnexion), en une trame chiffrée
  var s = syn; if (!s || !s.ws || s.ws.readyState !== 1 || s.status !== 'ok') return;
  var out = 0; Object.keys(s.inflight).forEach(function (k) { out = Math.max(out, s.inflight[k]); });
  var ops = s.pending.slice(all ? 0 : out); if (!ops.length) return;
  var id = ++s.msgId, upto = (all ? 0 : out) + ops.length;
  s.inflight[id] = upto;
  synSeal({ a: s.st.actor, o: ops, v: VERSION, ver: myVersion() }).then(function (d) { if (syn === s && s.ws && s.ws.readyState === 1) s.ws.send(JSON.stringify({ t: 'envoi', id: id, d: d })); });
}
function synFull(s) {
  // tout l'état sous forme d'opérations (mêmes identifiants) : pour un relais vide ou une nouvelle clé
  var ops = []; Object.keys(s.st.root.f).forEach(function (k) { var sl = s.st.root.f[k]; var op = { o: 's', p: [], k: k, c: sl.c }; if (sl.v) op.v = synEnc(sl.v, synId); ops.push(op); });
  s.pending = ops;
}
function synMaybeSnap(s) {
  // tous les 200 envois, une copie à jour (rien en attente) dépose un instantané : le relais oublie les trames qu'il contient
  if (s.pending.length || s.seq - s.snapSeq < 200 || !s.ws) return;
  var upto = s.seq; s.snapSeq = upto;
  var dump = synDump(s.st); dump.f = VERSION;   // format du document, lu par les copies avant de repartir de l'instantané
  synSeal(dump).then(function (d) { if (syn === s && s.ws && s.ws.readyState === 1) s.ws.send(JSON.stringify({ t: 'instantane', jusqua: upto, d: d })); });
}
function synPresence(force) {
  var s = syn; if (!s || !s.ws || s.ws.readyState !== 1 || s.status !== 'ok') return;
  var a = document.activeElement, blk = a && a.closest && a.closest('[data-b], .blk[data-id]');
  var p = { a: s.st.actor, n: synName(), pg: doc.pages[doc.cur] && doc.pages[doc.cur].id, b: blk ? (blk.dataset.b || blk.dataset.id) : null, m: mode, ver: myVersion() };
  s.presLast = JSON.stringify(p);
  synSeal(p).then(function (d) { if (syn === s && s.ws && s.ws.readyState === 1) s.ws.send(JSON.stringify({ t: 'presence', d: d })); });
}
var synPresT = 0;
function synPresenceSoon() { if (!syn) return; clearTimeout(synPresT); synPresT = setTimeout(function () { synPresence(false); }, 250); }
document.addEventListener('focusin', synPresenceSoon);

// ---------- réception ----------
function synRemote(s, batches, reload) {
  if (!batches.length && !reload) return;
  // ce qui a été saisi ici et pas encore pris en compte part d'abord (sinon la comparaison effacerait l'arrivée)
  synLocal();
  var changed = reload;
  batches.forEach(function (ops) { if (synApply(s.st, ops)) changed = true; });
  if (!changed) return;
  var before = s.base, after = synJSON(s.st.root);
  if (s.adopt) { s.adopt = false; toast('Document mis à jour depuis les autres copies', 4000); }
  if (synEq(before, after)) return;
  s.base = after;
  // annulation : les retours en arrière gardent les modifications reçues entre-temps
  var pt = []; synPaths(before, after, [], pt); s.patches.push(pt);
  var focus = synGrabFocus(), sy = scrollY, pgId = doc.pages[doc.cur] && doc.pages[doc.cur].id;
  SYN_KEYS.forEach(function (k) { if (after[k] === undefined) delete doc[k]; else doc[k] = JSON.parse(JSON.stringify(after[k])); });
  if (!doc.pages || !doc.pages.length) doc.pages = [{ id: uid(), title: '', blocks: [] }];
  var pi = -1; doc.pages.forEach(function (pg, i) { if (pg.id === pgId) pi = i; });
  doc.cur = pi >= 0 ? pi : Math.min(doc.cur, doc.pages.length - 1);
  session.remplacerCourant();   // l'arrivée n'est pas une modification locale à annuler
  markDirty(true);
  render(); scrollTo(0, sy); synPutFocus(focus);
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
// curseur : gardé à la même place dans le texte, décalé si quelqu'un a écrit avant lui
function synGrabFocus() {
  var a = document.activeElement; if (!a || !app.contains(a) || a === document.body) return null;
  if (a.isContentEditable && a.dataset.b && a.dataset.k) {
    var sel = getSelection(), off = 0;
    if (sel.rangeCount && a.contains(sel.anchorNode)) { var r = document.createRange(); r.selectNodeContents(a); r.setEnd(sel.anchorNode, sel.anchorOffset); off = r.toString().length; }
    return { ce: 1, b: a.dataset.b, k: a.dataset.k, off: off, text: a.textContent };
  }
  if ((a.tagName === 'TEXTAREA' || a.tagName === 'INPUT') && a.dataset.b) {
    var selr = '[data-b="' + a.dataset.b + '"]' + ['k', 'p', 'mk', 'zn', 'rt', 's', 'id'].map(function (k) { return a.dataset[k] != null ? '[data-' + k + '="' + a.dataset[k] + '"]' : ''; }).join('') + '.' + a.className.split(' ')[0];
    return { sel: selr, s: a.selectionStart, e: a.selectionEnd, text: a.value };
  }
  return null;
}
function synShift(oldT, newT, off) {
  var p = 0; while (p < oldT.length && p < newT.length && oldT[p] === newT[p]) p++;
  return off <= p ? off : Math.max(p, off + newT.length - oldT.length);
}
function synPutFocus(f) {
  if (!f) return;
  if (f.ce) {
    var el = $('[data-b="' + f.b + '"][data-k="' + f.k + '"]', app); if (!el) return;
    el.focus({ preventScroll: true });
    var off = synShift(f.text, el.textContent, f.off), w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n, r = document.createRange(), placed = false;
    while ((n = w.nextNode())) { if (off <= n.length) { r.setStart(n, off); placed = true; break; } off -= n.length; }
    if (!placed) { r.selectNodeContents(el); r.collapse(false); } else r.collapse(true);
    var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    return;
  }
  var t = $(f.sel, app); if (!t) return;
  t.focus({ preventScroll: true });
  try { var v = t.value; t.setSelectionRange(synShift(f.text, v, f.s), synShift(f.text, v, f.e)); } catch (_) {}
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

// ---------- enregistrement ----------
function synSaved(d) {
  // objet à écrire dans le fichier : le document avec sa configuration et l'état de synchronisation
  if (!d.sync) return d;
  var o = {}; Object.keys(d).forEach(function (k) { o[k] = d[k]; });
  if (syn && syn.cfg.key === d.sync.key) { synLocal(); o.sync = { relay: d.sync.relay, key: d.sync.key, seq: syn.seq, state: synDump(syn.st), pending: syn.pending }; }
  else o.sync = d.sync;
  return o;
}

// ---------- affichage : présence et état ----------
function synPaint() {
  $$('.syn', ui).forEach(function (el) {
    if (!syn) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    var st = syn.status, peers = Object.keys(syn.peers).map(function (k) { return syn.peers[k]; });
    var lab = st === 'ok' ? 'Synchronisé' + (peers.length ? ' · ' + (peers.length + 1) + ' personnes' : '') : st === 'connexion' ? 'Connexion au relais…' : st === 'hors-ligne' ? 'Hors ligne · les modifications partiront à la reconnexion' : 'Synchronisation : ' + syn.err;
    var seen = {};
    el.innerHTML = '<button type="button" class="syn-b ' + st + '" data-ui="sync" title="' + esc(lab) + '"><i></i><span class="syn-l">' + esc(lab) + '</span>' +
      peers.filter(function (p) { if (seen[p.a]) return false; seen[p.a] = 1; return true; }).slice(0, 5).map(function (p) {
        return '<span class="syn-av" style="background:' + synColor(p.a) + '" title="' + esc(p.n) + '">' + esc((p.n || '?').charAt(0).toUpperCase()) + '</span>';
      }).join('') + '</button>';
  });
}
function synPaintPeers() {
  synPaint();
  $$('.syn-peer', app).forEach(function (x) { x.classList.remove('syn-peer'); x.style.removeProperty('--syn'); x.removeAttribute('data-syn'); });
  if (!syn || mode !== 'edit') return;
  var pg = doc.pages[doc.cur] && doc.pages[doc.cur].id;
  Object.keys(syn.peers).forEach(function (k) {
    var p = syn.peers[k]; if (!p.b || p.pg !== pg || p.m !== 'edit') return;
    var b = $('.blk[data-id="' + p.b + '"]', app); if (!b) return;
    b.classList.add('syn-peer'); b.style.setProperty('--syn', synColor(p.a)); b.setAttribute('data-syn', p.n);
  });
}

// ---------- réglages ----------
function synDialog() {
  var on = !!(doc.sync && doc.sync.key), relay = on ? doc.sync.relay : (function () { try { return localStorage.getItem(LS + 'relais') || ''; } catch (_) { return ''; } })();
  var peers = syn ? Object.keys(syn.peers).map(function (k) { return syn.peers[k]; }) : [];
  var st = !syn ? '' : syn.status === 'ok' ? 'Connecté au relais' : syn.status === 'connexion' ? 'Connexion au relais…' : syn.status === 'hors-ligne' ? 'Hors ligne : les modifications partiront à la reconnexion' : syn.err;
  var body = '<div class="syn-dlg">' +
    '<p class="muted">Les copies de ce fichier restent à jour entre elles, en direct, et se rattrapent après un passage hors ligne. Elles passent par un <b>relais</b> qui ne voit que des données chiffrées : le contenu, les noms et la clé ne quittent jamais vos copies. Vous pouvez installer votre propre relais (<code>relais/relais.mjs</code> dans le dépôt d’Ardoise).</p>' +
    '<label>Adresse du relais<input class="syn-url" type="text" spellcheck="false" placeholder="wss://relais.exemple.fr" value="' + esc(relay) + '"></label>' +
    '<label>Votre nom (vu par les autres copies)<input class="syn-nom" type="text" maxlength="40" value="' + esc(synName()) + '"></label>' +
    (on ? '<p class="syn-st"><b>État :</b> ' + esc(st) + '</p>' +
      '<div class="syn-who"><b>Présents</b>' + '<span class="syn-pill"><i style="background:' + (syn ? synColor(syn.st.actor) : '#888') + '"></i>' + esc(synName()) + ' (vous)</span>' +
        peers.map(function (p) { return '<span class="syn-pill"><i style="background:' + synColor(p.a) + '"></i>' + esc(p.n) + (p.m === 'edit' ? ' · modifie' : ' · lit') + (p.ver && p.ver !== myVersion() ? ' · Ardoise ' + esc(p.ver) : '') + '</span>'; }).join('') + '</div>' +
      '<p class="muted">Toute copie de ce fichier se synchronise : partagez-le comme d’habitude (après l’avoir enregistré). « Nouvelle clé » coupe les copies existantes ; seules celles faites ensuite se synchronisent.</p>'
      : '<p class="muted">Une clé est créée et rangée dans le fichier : enregistrez-le, puis partagez-en une copie. Si le document est chiffré par mot de passe, la clé l’est aussi.</p>') + '</div>';
  var getUrl = function (bg) { return $('.syn-url', bg).value.trim(); };
  var keepName = function (bg) { var n = $('.syn-nom', bg).value.trim().slice(0, 40); if (n) { synNom = n; try { localStorage.setItem(LS + 'nom', n); } catch (_) {} } synPresence(true); synPaintPeers(); };
  var okUrl = function (bg) { var u = getUrl(bg); if (!/^wss?:\/\/[^\s/]+/i.test(u)) { toast('Indiquez l’adresse du relais, en ws:// ou wss://'); return null; } try { localStorage.setItem(LS + 'relais', u); } catch (_) {} return u; };
  var ro = doc.lock && !unlocked;   // édition protégée : réglages en lecture seule
  if (ro) { modal('Synchronisation', body.replace(/<input /g, '<input disabled '), [{ label: 'Fermer', fn: function (bg) { } }]); return; }
  var buttons = on ? [
    { label: 'Enregistrer', primary: true, fn: function (bg) { var u = okUrl(bg); if (!u) return false; keepName(bg); if (u !== doc.sync.relay) { synSaveState(); doc.sync.relay = u; doc.sync.seq = 0; markDirty(true); synStart(); toast('Relais changé : le document y est envoyé'); } } },
    { label: 'Nouvelle clé', fn: function () { if (!confirm('Créer une nouvelle clé ? Les copies existantes de ce fichier ne se synchroniseront plus ; partagez ensuite une nouvelle copie.')) return false; synSaveState(); doc.sync.key = synNewKey(); doc.sync.seq = 0; markDirty(true); synStart(); toast('Nouvelle clé : enregistrez, puis partagez une nouvelle copie du fichier', 6000); } },
    { label: 'Désactiver', fn: function () { if (!confirm('Désactiver la synchronisation de ce fichier ? Il gardera son contenu actuel.')) return false; synStop(); delete doc.sync; markDirty(true); toast('Synchronisation désactivée'); } },
    { label: 'Fermer', fn: function (bg) { keepName(bg); } }
  ] : [
    { label: 'Activer', primary: true, fn: function (bg) { var u = okUrl(bg); if (!u) return false; keepName(bg); synSetCfg(doc, { relay: u, key: synNewKey() }); markDirty(true); synStart(); toast('Synchronisation activée : enregistrez, puis partagez une copie du fichier', 6000); } },
    { label: 'Annuler' }
  ];
  modal('Synchronisation', body, buttons);
}
function synNewKey() { return b64u(crypto.getRandomValues(new Uint8Array(32))); }
function synSaveState() {
  // avant de changer de relais ou de clé : l'état courant repart avec la nouvelle session (tout sera renvoyé)
  if (!syn) return;
  synLocal();
  doc.sync.state = synDump(syn.st); doc.sync.pending = syn.pending;
}
