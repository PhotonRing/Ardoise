/* ---------- Document ---------- */
var doc, mode = 'view', freshDoc = false;
function attach(d) {
  // « doc.blocks » désigne les blocs de la page affichée ; « doc.cur » (page affichée) n'est pas enregistré
  if (!Object.getOwnPropertyDescriptor(d, 'cur')) Object.defineProperty(d, 'cur', { value: 0, writable: true, enumerable: false, configurable: true });
  Object.defineProperty(d, 'blocks', { get: function () { return d.pages[d.cur].blocks; }, set: function (v) { d.pages[d.cur].blocks = v; }, enumerable: false, configurable: true });
  return d;
}
function normBlocks(arr, newer) {
  var out = [];
  (arr || []).forEach(function (b) {
    if (!b || typeof b !== 'object') return;
    if (!T[b.type]) { if (newer) out.push(b); return; }   // bloc d'une version plus récente : gardé intact (lecture seule)
    var nb = T[b.type].make();
    for (var k in b) nb[k] = b[k];
    nb.id = b.id || uid(); out.push(nb);
  });
  return out;
}
function normalize(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  if (!Array.isArray(d.pages) && Array.isArray(d.blocks)) {
    // forme courte d'un document d'une seule page (JSON copié ou écrit à la main), acceptée quel que soit le format
    var one = {}; for (var k in d) if (k !== 'blocks' && k !== 'pageTitle') one[k] = d[k];
    one.pages = [{ title: d.pageTitle || '', blocks: d.blocks }]; d = one;
  }
  var mg = migrate(d); d = mg.doc;   // 05-migrations.js
  if (!Array.isArray(d.pages)) return null;
  var out = { v: mg.newer ? mg.from : VERSION, id: d.id || uid() + uid(), title: d.title || '', palette: d.palette || 'ambre', typo: d.typo || 'display',
    width: +d.width || 820, theme: d.theme || 'auto', savedAt: d.savedAt || null, nav: d.nav || 'auto', pages: [] };
  d.pages.forEach(function (pg) {
    if (!pg || !Array.isArray(pg.blocks)) return;
    var np = { id: pg.id || uid(), title: String(pg.title || ''), blocks: normBlocks(pg.blocks, mg.newer) };
    if (pg.sub && out.pages.length) np.sub = true;   // sous-page de la page de premier niveau qui la précède
    out.pages.push(np);
  });
  if (!out.pages.length) out.pages.push({ id: uid(), title: '', blocks: [] });
  attach(out);
  // format plus récent que cet éditeur : lecture seule (le fichier d'origine sert à la mise à jour, voir applyUpdate)
  if (mg.newer) Object.defineProperty(out, 'newer', { value: mg.from, enumerable: false, configurable: true });
  if (d.mapKey) out.mapKey = String(d.mapKey);
  if (d.lock && d.lock.hash && d.lock.salt) {
    out.lock = { salt: d.lock.salt, hash: d.lock.hash, iter: +d.lock.iter || 210000 };
    if (d.lock.enc && d.lock.encSalt) { out.lock.enc = true; out.lock.encSalt = d.lock.encSalt; out.lock.encIter = +d.lock.encIter || ENC_ITER; }
  }
  return out;
}
function template(kind) { var t = TEMPLATES[kind](); t.v = VERSION; return t; }   // les modèles sont écrits dans le format courant
var sealed = null, origStored = '';   // fichier chiffré en attente du mot de passe
function loadInitial() {
  var raw = $('#ardoise-doc').textContent.trim(), d = null, j = null; origStored = raw;
  try { j = JSON.parse(raw); } catch (e) { j = null; }
  if (j && j.enc && j.enc.ct) { sealed = j; return null; }
  try { d = normalize(j); } catch (e) { d = null; }
  if (!d) { d = normalize(template('tour')); d.id = uid() + uid(); freshDoc = true; }
  return d;
}
function byId(id) { for (var i = 0; i < doc.blocks.length; i++) if (doc.blocks[i].id === id) return doc.blocks[i]; return null; }
function idx(b) { return doc.blocks.indexOf(b); }
function getPath(o, k) { var p = k.split('.'); for (var i = 0; i < p.length; i++) { if (o == null) return undefined; o = o[p[i]]; } return o; }
function setPath(o, k, v) { var p = k.split('.'); for (var i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = v; }
function docTitle() {
  var h = doc.pages[0].blocks.filter(function (b) { return b.type === 'header'; })[0];
  return (h && textOf(h.title)) || doc.title || 'Sans titre';
}
function fileName() {
  var s = docTitle().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  if (!/\.html?$/i.test(s)) s = (s || 'page') + '.html';
  return s;
}

