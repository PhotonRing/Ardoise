/* ---------- Synchronisation : moteur de fusion (CRDT) ---------- */
// Sans DOM : vérifié aussi dans Node par scripts/test-synchro.mjs (convergence de copies qui s'échangent leurs
// modifications dans le désordre, en double, ou après un long moment hors ligne).
//
// Le contenu du document est un arbre JSON. Chaque copie en garde une version annotée :
//   - objet  : chaque clé est un registre « dernière écriture gagne », daté (horloge de Lamport, auteur) ;
//   - tableau : suite ordonnée d'éléments identifiés (RGA) ; un élément supprimé reste comme repère, sans contenu ;
//   - texte  : suite ordonnée de caractères identifiés (RGA), une balise HTML ou une entité comptant pour un
//              caractère : deux personnes qui écrivent dans le même paragraphe voient leurs saisies fusionnées.
// Une modification locale est retrouvée en comparant le document avant et après (synDiff) ; elle produit des
// opérations JSON, appliquées sur place puis envoyées aux autres copies, qui les appliquent dans n'importe quel
// ordre et autant de fois que nécessaire (synApply) : toutes les copies arrivent au même document.
var SYN_TEXT = { html: 1, title: 1, lede: 1, eyebrow: 1, text: 1, code: 1, name: 1, caption: 1, alt: 1, k: 1, v: 1, date: 1, label: 1, segl: 1, who: 1, num: 1, adversaire: 1, capacite: 1, infrastructure: 1, victime: 1 };
var SYN_RAW = { code: 1 };   // texte brut : découpé caractère par caractère, sans reconnaître de balises
function synCmp(a, b) { return a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0); }
function synTokens(s, raw) {
  // un « caractère » : balise, entité, paire de substitution (émoji) ou caractère simple
  return String(s).match(raw ? /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\s\S]/g : /<[^<>]*>|&#?\w+;|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\s\S]/g) || [];
}
function synIsObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
function synEq(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b || Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (!synEq(a[i], b[i])) return false; return true; }
  var ka = Object.keys(a), kb = Object.keys(b); if (ka.length !== kb.length) return false;
  for (var j = 0; j < ka.length; j++) { if (!Object.prototype.hasOwnProperty.call(b, ka[j]) || !synEq(a[ka[j]], b[ka[j]])) return false; }
  return true;
}
// --- état ---
function synCreate(actor) { return { actor: actor, lamport: 0, root: { t: 'm', f: {} } }; }
function synTick(st) { return [++st.lamport, st.actor]; }
function synSeen(st, l) { if (l > st.lamport) st.lamport = l; }
// valeur JSON → nœud (les identifiants des éléments imbriqués sont pris à l'horloge locale)
function synBuild(st, j, key, inArr) {
  if (typeof j === 'string' && (SYN_TEXT[key] || inArr === 2)) {
    var tk = synTokens(j, SYN_RAW[key]), l0 = st.lamport + 1; st.lamport += tk.length;
    return { t: 't', e: tk.map(function (k, i) { return { id: [l0 + i, st.actor], k: k }; }) };
  }
  if (Array.isArray(j)) return { t: 'l', e: j.map(function (x) { return { id: synTick(st), v: synBuild(st, x, key, Array.isArray(x) ? 1 : (inArr ? 2 : 0)) }; }) };
  if (synIsObj(j)) { var m = { t: 'm', f: {} }; Object.keys(j).forEach(function (k) { if (j[k] !== undefined) m.f[k] = { c: synTick(st), v: synBuild(st, j[k], k) }; }); return m; }
  return { t: 'v', v: j === undefined ? null : j };
}
// nœud → JSON
function synJSON(n) {
  if (!n) return undefined;
  if (n.t === 'v') return n.v;
  if (n.t === 't') { var s = ''; for (var i = 0; i < n.e.length; i++) if (!n.e[i].d) s += n.e[i].k; return s; }
  if (n.t === 'l') { var a = []; n.e.forEach(function (e) { if (!e.d) a.push(synJSON(e.v)); }); return a; }
  var o = {}; Object.keys(n.f).sort().forEach(function (k) { var s2 = n.f[k]; if (s2.v) o[k] = synJSON(s2.v); }); return o;
}
// --- encodage (opérations et état enregistré) : tableaux JSON compacts ---
// valeur : ['v', x] | ['m', {clé: [l, a, valeur] | [l, a]}] | ['l', [[l, a, valeur] | [l, a]]] | ['t', [[a, l0, 'texte' | [jetons] | n supprimés, 0|1]]]
// « a » est l'auteur, ou son numéro dans la table des auteurs (état enregistré) ; A : auteur → code, D : code → auteur
function synEnc(n, A) {
  if (n.t === 'v') return ['v', n.v];
  if (n.t === 'm') { var o = {}; Object.keys(n.f).forEach(function (k) { var s = n.f[k]; o[k] = s.v ? [s.c[0], A(s.c[1]), synEnc(s.v, A)] : [s.c[0], A(s.c[1])]; }); return ['m', o]; }
  if (n.t === 'l') return ['l', n.e.map(function (e) { return e.d ? [e.id[0], A(e.id[1])] : [e.id[0], A(e.id[1]), synEnc(e.v, A)]; })];
  // texte : suites de caractères consécutifs du même auteur (horloges qui se suivent), même état
  var runs = [], r = null;
  n.e.forEach(function (e) {
    if (r && r.a === e.id[1] && r.l + r.k.length === e.id[0] && r.d === !!e.d) r.k.push(e.k);
    else { r = { a: e.id[1], l: e.id[0], d: !!e.d, k: [e.k] }; runs.push(r); }
  });
  return ['t', runs.map(function (x) {
    var c = x.d ? x.k.length : x.k.every(function (k) { return k.length === 1; }) ? x.k.join('') : x.k;
    return [A(x.a), x.l, c, x.d ? 1 : 0];
  })];
}
function synDec(x, D, st) {
  var see = function (l) { if (st) synSeen(st, l); };
  if (!Array.isArray(x)) return { t: 'v', v: null };
  if (x[0] === 'v') return { t: 'v', v: x[1] === undefined ? null : x[1] };
  if (x[0] === 'm') { var m = { t: 'm', f: {} }; Object.keys(x[1] || {}).forEach(function (k) { var s = x[1][k]; see(s[0]); m.f[k] = { c: [s[0], D(s[1])], v: s.length > 2 ? synDec(s[2], D, st) : undefined }; }); return m; }
  if (x[0] === 'l') return { t: 'l', e: (x[1] || []).map(function (e) { see(e[0]); return e.length > 2 ? { id: [e[0], D(e[1])], v: synDec(e[2], D, st) } : { id: [e[0], D(e[1])], d: 1 }; }) };
  var t = { t: 't', e: [] };
  (x[1] || []).forEach(function (r) {
    var a = D(r[0]), del = !!r[3], ks = typeof r[2] === 'number' ? new Array(r[2]).fill('') : Array.isArray(r[2]) ? r[2] : synTokens(r[2], true);
    ks.forEach(function (k, i) { t.e.push(del ? { id: [r[1] + i, a], k: '', d: 1 } : { id: [r[1] + i, a], k: k }); });
    see(r[1] + ks.length - 1);
  });
  return t;
}
function synId(x) { return x; }
// état complet ↔ JSON enregistrable (table des auteurs pour la compacité)
function synDump(st) {
  var tab = [], ix = {};
  var A = function (a) { if (!(a in ix)) { ix[a] = tab.length; tab.push(a); } return ix[a]; };
  var r = synEnc(st.root, A);
  return { a: tab, r: r, l: st.lamport };
}
function synLoad(d, actor) {
  var st = synCreate(actor);
  if (!d || !Array.isArray(d.a) || !Array.isArray(d.r)) return st;
  st.root = synDec(d.r, function (i) { return d.a[i]; }, st);
  if (st.root.t !== 'm') st.root = { t: 'm', f: {} };
  synSeen(st, +d.l || 0);
  return st;
}
// --- chemins : clé (avec l'horloge du registre, pour ne pas viser une valeur remplacée entre-temps) ou élément ---
function synFind(n, id) { for (var i = 0; i < n.e.length; i++) { var e = n.e[i].id; if (e[0] === id[0] && e[1] === id[1]) return i; } return -1; }
function synAt(st, path) {
  var n = st.root;
  for (var i = 0; i < path.length && n; i++) {
    var p = path[i];
    if (n.t === 'm') { var s = n.f[p[0]]; n = s && s.v && s.c[0] === p[1] && s.c[1] === p[2] ? s.v : null; }
    else if (n.t === 'l') { var j = synFind(n, [p[1], p[2]]); n = j >= 0 && !n.e[j].d ? n.e[j].v : null; }
    else n = null;
  }
  return n;
}
// insertion RGA : juste après le repère, en passant les éléments plus récents insérés au même endroit
function synIntegrate(n, ref, el) {
  if (synFind(n, el.id) >= 0) return false;
  var pos = 0;
  if (ref) { var r = synFind(n, ref); if (r < 0) return false; pos = r + 1; }
  while (pos < n.e.length && synCmp(n.e[pos].id, el.id) > 0) pos++;
  n.e.splice(pos, 0, el);
  return true;
}
// --- application d'opérations (idempotente, quel que soit l'ordre d'arrivée) ---
// s : écrire une clé {o:'s', p, k, c:[l,a], v: valeur encodée | absent pour supprimer}
// i / d : insérer / supprimer un élément de tableau {o:'i', p, r: repère | null, c: id, v} {o:'d', p, c: id}
// ti / td : insérer des caractères {o:'ti', p, r, c: [l0, a], k: [jetons]} / en supprimer {o:'td', p, x: [[l, a, n]]}
function synApply(st, ops) {
  var changed = false;
  (ops || []).forEach(function (op) {
    if (!op || !Array.isArray(op.p)) return;
    if (op.c) synSeen(st, op.c[0] + (op.k && op.k.length ? op.k.length - 1 : 0));
    var n = synAt(st, op.p); if (!n) return;
    if (op.o === 's' && n.t === 'm') {
      var s = n.f[op.k];
      if (s && synCmp(op.c, s.c) <= 0) return;
      n.f[op.k] = { c: op.c, v: op.v ? synDec(op.v, synId, st) : undefined }; changed = true;
    } else if (op.o === 'i' && n.t === 'l') {
      if (synIntegrate(n, op.r, { id: op.c, v: synDec(op.v, synId, st) })) changed = true;
    } else if (op.o === 'd' && n.t === 'l') {
      var j = synFind(n, op.c); if (j >= 0 && !n.e[j].d) { n.e[j] = { id: n.e[j].id, d: 1 }; changed = true; }
    } else if (op.o === 'ti' && n.t === 't') {
      var ref = op.r;
      for (var q = 0; q < op.k.length; q++) {
        var id = [op.c[0] + q, op.c[1]];
        if (synIntegrate(n, ref, { id: id, k: op.k[q] })) changed = true;
        ref = id;
      }
    } else if (op.o === 'td' && n.t === 't') {
      (op.x || []).forEach(function (r) {
        for (var q2 = 0; q2 < r[2]; q2++) { var j2 = synFind(n, [r[0] + q2, r[1]]); if (j2 >= 0 && !n.e[j2].d) { n.e[j2] = { id: n.e[j2].id, k: '', d: 1 }; changed = true; } }
      });
    }
  });
  return changed;
}
// script d'édition minimal entre deux suites de jetons (Myers) : ['=', i, j] | ['-', i] | ['+', i, j]
// (au-delà de 4 000 différences, remplacement du passage différent, après le début et la fin communs)
function synScript(a, b) {
  var p = 0, q = 0, n = a.length, m = b.length, out = [];
  while (p < n && p < m && a[p] === b[p]) p++;
  while (q < n - p && q < m - p && a[n - 1 - q] === b[m - 1 - q]) q++;
  var A = a.slice(p, n - q), B = b.slice(p, m - q), N = A.length, M = B.length, max = N + M, mid = [];
  for (var i0 = 0; i0 < p; i0++) out.push(['=', i0, i0]);
  if (N && M && N + M <= 4000) {
    var V = new Int32Array(2 * max + 2), trace = [], off = max + 1, D, found = false;
    for (D = 0; D <= max && !found; D++) {
      trace.push(V.slice());
      for (var k = -D; k <= D; k += 2) {
        var x = (k === -D || (k !== D && V[off + k - 1] < V[off + k + 1])) ? V[off + k + 1] : V[off + k - 1] + 1, y = x - k;
        while (x < N && y < M && A[x] === B[y]) { x++; y++; }
        V[off + k] = x;
        if (x >= N && y >= M) { found = true; break; }
      }
    }
    var cx = N, cy = M;
    for (var d = trace.length - 1; d >= 0 && (cx > 0 || cy > 0); d--) {
      var T = trace[d], kk = cx - cy, pk = (kk === -d || (kk !== d && T[off + kk - 1] < T[off + kk + 1])) ? kk + 1 : kk - 1, px = T[off + pk], py = px - pk;
      while (cx > px && cy > py) { mid.push(['=', p + cx - 1, p + cy - 1]); cx--; cy--; }
      if (d > 0) { if (cx === px) { mid.push(['+', null, p + cy - 1]); cy--; } else { mid.push(['-', p + cx - 1]); cx--; } }
    }
    out = out.concat(mid.reverse());
  } else {
    for (var i1 = 0; i1 < N; i1++) out.push(['-', p + i1]);
    for (var j1 = 0; j1 < M; j1++) out.push(['+', null, p + j1]);
  }
  for (var i2 = 0; i2 < q; i2++) out.push(['=', n - q + i2, m - q + i2]);
  return out;
}
// --- modifications locales : comparaison de l'ancien et du nouveau JSON → opérations (déjà appliquées) ---
function synDiff(st, oldJ, newJ) {
  var ops = [];
  function emit(op) { ops.push(op); synApply(st, [op]); }
  function setKey(n, path, k, v) {
    var c = synTick(st), node = v === undefined ? undefined : synBuild(st, v, k);
    var op = { o: 's', p: path, k: k, c: c }; if (node) op.v = synEnc(node, synId);
    emit(op);
  }
  function diffMap(n, path, o, nv) {
    var keys = {}; Object.keys(o || {}).forEach(function (k) { keys[k] = 1; }); Object.keys(nv).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) {
      var a = o ? o[k] : undefined, b = nv[k], s = n.f[k];
      if (b === undefined) { if (s && s.v) setKey(n, path, k, undefined); return; }
      if (!s || !s.v) { setKey(n, path, k, b); return; }
      if (synEq(a, b)) return;
      diffVal(s.v, path.concat([[k, s.c[0], s.c[1]]]), a, b, function () { setKey(n, path, k, b); }, k, 0);
    });
  }
  function diffVal(n, path, a, b, replace, key, inArr) {
    if (n.t === 'm' && synIsObj(a) && synIsObj(b)) diffMap(n, path, a, b);
    else if (n.t === 'l' && Array.isArray(a) && Array.isArray(b)) diffList(n, path, a, b, key, inArr);
    else if (n.t === 't' && typeof b === 'string') diffText(n, path, b, key);
    else replace();
  }
  function keyOf(x) { return synIsObj(x) && typeof x.id === 'string' && x.id ? x.id : null; }
  function diffList(n, path, a, b, key, inArr) {
    var live = n.e.filter(function (e) { return !e.d; });
    if (live.length !== a.length) { a = live.map(function (e) { return synJSON(e.v); }); }
    // plus longue sous-suite commune : par identifiant (objets avec « id ») ou par égalité
    var na = a.length, nb = b.length, ka = a.map(keyOf), kb = b.map(keyOf);
    var same = function (i, j) { return ka[i] || kb[j] ? ka[i] === kb[j] : synEq(a[i], b[j]); };
    var prev = null, sub = inArr ? 2 : 1;
    var ins = function (v) { var c = synTick(st), node = synBuild(st, v, key, Array.isArray(v) ? 1 : (inArr ? 2 : 0)); emit({ o: 'i', p: path, r: prev, c: c, v: synEnc(node, synId) }); prev = c; };
    var del = function (e) { emit({ o: 'd', p: path, c: e.id }); };
    var keep = function (e, va, vb) {
      // élément conservé : ses changements de contenu sont comparés à l'intérieur
      if (!synEq(va, vb)) diffVal(e.v, path.concat([['#', e.id[0], e.id[1]]]), va, vb, function () { del(e); ins(vb); }, key, Array.isArray(vb) ? sub : 0);
      var j0 = synFind(n, e.id); if (j0 >= 0 && !n.e[j0].d) prev = e.id;
    };
    // script d'édition (garder / supprimer / insérer) : début et fin communs, plus longue sous-suite commune au milieu
    // (par identifiant pour les objets qui en ont un, par égalité sinon)
    var p0 = 0, q0 = 0, script = [];
    while (p0 < na && p0 < nb && same(p0, p0)) p0++;
    while (q0 < na - p0 && q0 < nb - p0 && same(na - 1 - q0, nb - 1 - q0)) q0++;
    for (var i0 = 0; i0 < p0; i0++) script.push(['=', i0, i0]);
    var ma = na - p0 - q0, mb = nb - p0 - q0, L = [];
    for (var i = 0; i <= ma; i++) L.push(new Int32Array(mb + 1));
    for (var i2 = ma - 1; i2 >= 0; i2--) for (var j2 = mb - 1; j2 >= 0; j2--) L[i2][j2] = same(p0 + i2, p0 + j2) ? L[i2 + 1][j2 + 1] + 1 : Math.max(L[i2 + 1][j2], L[i2][j2 + 1]);
    var x = 0, y = 0;
    while (x < ma || y < mb) {
      if (x < ma && y < mb && same(p0 + x, p0 + y) && L[x][y] === L[x + 1][y + 1] + 1) { script.push(['=', p0 + x++, p0 + y++]); }
      else if (y >= mb || (x < ma && L[x + 1][y] >= L[x][y + 1])) script.push(['-', p0 + x++]);
      else script.push(['+', p0 + y++]);
    }
    for (var i3 = 0; i3 < q0; i3++) script.push(['=', na - q0 + i3, nb - q0 + i3]);
    var gd = [], gi = [];
    var flush = function () {
      var k2 = 0;
      for (; k2 < gd.length && k2 < gi.length; k2++) {
        var va = a[gd[k2]], vb = b[gi[k2]];
        if (keyOf(va) || keyOf(vb) || typeof va !== typeof vb || Array.isArray(va) !== Array.isArray(vb) || (va === null) !== (vb === null)) break;
        keep(live[gd[k2]], va, vb);
      }
      for (var d1 = k2; d1 < gd.length; d1++) del(live[gd[d1]]);
      for (var d2 = k2; d2 < gi.length; d2++) ins(b[gi[d2]]);
      gd = []; gi = [];
    };
    script.forEach(function (sc) {
      if (sc[0] === '=') { flush(); keep(live[sc[1]], a[sc[1]], b[sc[2]]); }
      else if (sc[0] === '-') gd.push(sc[1]); else gi.push(sc[1]);
    });
    flush();
  }
  function diffText(n, path, s, key) {
    var live = n.e.filter(function (e) { return !e.d; }), tb = synTokens(s, SYN_RAW[key]);
    var sc = synScript(live.map(function (e) { return e.k; }), tb), dels = [], r = null, prev = null, pend = [];
    var flushIns = function () {
      if (!pend.length) return;
      var l0 = st.lamport + 1; st.lamport += pend.length;
      emit({ o: 'ti', p: path, r: prev, c: [l0, st.actor], k: pend });
      prev = [l0 + pend.length - 1, st.actor]; pend = [];
    };
    // suppressions d'abord (par suites d'identifiants), puis insertions, chacune après le caractère qui la précède
    sc.forEach(function (x) {
      if (x[0] !== '-') return;
      var e = live[x[1]];
      if (r && r[1] === e.id[1] && r[0] + r[2] === e.id[0]) r[2]++; else { r = [e.id[0], e.id[1], 1]; dels.push(r); }
    });
    if (dels.length) emit({ o: 'td', p: path, x: dels });
    sc.forEach(function (x) {
      if (x[0] === '=') { flushIns(); prev = live[x[1]].id; }
      else if (x[0] === '+') pend.push(tb[x[2]]);
      else { flushIns(); prev = live[x[1]].id; }   // un caractère supprimé reste un repère valable
    });
    flushIns();
  }
  diffMap(st.root, [], oldJ, newJ || {});
  return ops;
}
