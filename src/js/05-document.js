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
    // vue nombre d'Ardoise 1.7 (pas de cartes enregistrées) : carte équivalente à l'ancien affichage
    if (nb.type === 'query' && !(Array.isArray(b.cards) && b.cards.length)) nb.cards = [qDefCard(nb)];
    if (nb.type === 'kanban') nb.cols = (Array.isArray(nb.cols) ? nb.cols : []).filter(function (c) { return c && typeof c === 'object'; }).map(function (c) {
      var o = {}; for (var ck in c) o[ck] = c[ck]; o.id = c.id || uid(); o.title = String(c.title || '');
      o.cards = (Array.isArray(c.cards) ? c.cards : []).filter(function (k) { return k && typeof k === 'object'; }).map(function (k) { var q = kbNewCard(); for (var kk in k) q[kk] = k[kk]; return q; });
      return o;
    });
    if (nb.type === 'kanban') kbCleanDeps(nb);
    if (nb.type === 'list' && Array.isArray(nb.items)) nb.items = nb.items.map(function (h) { return h && typeof h === 'object' ? h : { html: String(h == null ? '' : h) }; });   // JSON écrit à la main
    nb.id = b.id || uid(); out.push(nb);
    if (nb.type === 'group') {
      // groupe : ses blocs, un seul niveau ; un bloc refusé dans un groupe est remis dans la page juste après lui
      var dedans = [], dehors = [];
      (Array.isArray(b.blocks) ? b.blocks : []).forEach(function (c) { (c && HORS_GROUPE[c.type] ? dehors : dedans).push(c); });
      nb.blocks = normBlocks(dedans, newer); nb.folded = !!nb.folded; nb.title = String(nb.title || '');
      Array.prototype.push.apply(out, normBlocks(dehors, newer));
    }
  });
  return out;
}
// dépendances d'une carte : une liste vide retire la clé, pour qu'un fichier sans dépendances reste inchangé
function kbSetDeps(k, list) { if (list.length) k.dep = list; else delete k.dep; }
// dépendances d'un kanban : identifiants uniques de cartes du même kanban, sans la carte elle-même ; liste vide retirée
function kbCleanDeps(b) {
  var ids = {}; b.cols.forEach(function (c) { c.cards.forEach(function (k) { ids['$' + k.id] = 1; }); });
  b.cols.forEach(function (c) { c.cards.forEach(function (k) {
    if (!('dep' in k)) return;
    var seen = {}, list = (Array.isArray(k.dep) ? k.dep : []).filter(function (d) { var ok = typeof d === 'string' && d !== k.id && ids['$' + d] && !seen['$' + d]; if (ok) seen['$' + d] = 1; return ok; });
    kbSetDeps(k, list);
  }); });
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
    // niveau dans l'arborescence : au plus un de plus que la page qui précède
    var lv = Math.min(Math.max(0, Math.floor(+pg.lv) || 0), out.pages.length ? (+out.pages[out.pages.length - 1].lv || 0) + 1 : 0, 8);
    if (lv) np.lv = lv;
    out.pages.push(np);
  });
  if (!out.pages.length) out.pages.push({ id: uid(), title: '', blocks: [] });
  attach(out);
  // format plus récent que cet éditeur : lecture seule (le fichier d'origine sert à la mise à jour, voir applyUpdate)
  if (mg.newer) Object.defineProperty(out, 'newer', { value: mg.from, enumerable: false, configurable: true });
  if (d.mapKey) out.mapKey = String(d.mapKey);
  // synchronisation entre copies : configuration et état, hors du contenu (voir 24-synchronisation.js)
  if (d.sync && typeof d.sync === 'object' && typeof d.sync.key === 'string' && typeof d.sync.relay === 'string') synSetCfg(out, { relay: d.sync.relay, key: d.sync.key, seq: +d.sync.seq || 0, state: d.sync.state || null, pending: Array.isArray(d.sync.pending) ? d.sync.pending : [] });
  if (d.tags && typeof d.tags === 'object') {
    // registre des pastilles : nom → couleur
    var tg = {}; for (var tk in d.tags) { var c = d.tags[tk] && Math.floor(+d.tags[tk].c); if (tagKey(tk) === tk && c >= 0 && c < TAG_COLORS) tg[tk] = { c: c }; }
    if (Object.keys(tg).length) out.tags = tg;
  }
  if (d.lock && d.lock.hash && d.lock.salt) {
    out.lock = { salt: d.lock.salt, hash: d.lock.hash, iter: +d.lock.iter || 210000 };
    if (d.lock.enc && d.lock.encSalt) { out.lock.enc = true; out.lock.encSalt = d.lock.encSalt; out.lock.encIter = +d.lock.encIter || ENC_ITER; }
  }
  return out;
}
var TEMPLATES_V = 5;   // format dans lequel les modèles (04-modeles.js) sont écrits : s'il change, ils passent par les migrations
function template(kind) { var t = TEMPLATES[kind](); t.v = TEMPLATES_V; return t; }
var sealed = null, origStored = '';   // fichier chiffré en attente du mot de passe
function loadInitial() {
  var raw = $('#ardoise-doc').textContent.trim(), d = null, j = null; origStored = raw;
  try { j = JSON.parse(raw); } catch (e) { j = null; }
  if (j && j.enc && j.enc.ct) { sealed = j; return null; }
  try { d = normalize(j); } catch (e) { d = null; }
  if (!d) { d = normalize(template('tour')); d.id = uid() + uid(); freshDoc = true; }
  return d;
}
/* Parcours des blocs d'une page, enfants des groupes compris (un seul niveau) : fn(bloc, liste qui le contient, position
   dans cette liste, groupe parent ou null), les enfants d'un groupe juste après lui. Pur : sert aussi aux bancs. */
function blocsDe(blocks, fn) {
  (blocks || []).forEach(function (b, i) {
    fn(b, blocks, i, null);
    if (b && b.type === 'group' && Array.isArray(b.blocks)) b.blocks.forEach(function (c, j) { fn(c, b.blocks, j, b); });
  });
}
// liste plate des blocs d'une page, enfants compris
function tousBlocs(blocks) { var out = []; blocsDe(blocks, function (b) { out.push(b); }); return out; }
// où est le bloc id parmi les blocs d'une page : { b, liste, i, parent } (parent : le groupe qui le contient, sinon null), ou null
function ouEst(blocks, id) {
  var r = null;
  blocsDe(blocks, function (b, liste, i, parent) { if (!r && b && b.id === id) r = { b: b, liste: liste, i: i, parent: parent }; });
  return r;
}
// page qui contient un bloc, enfants des groupes compris (-1 sinon)
function pageDuBloc(pages, bid) { for (var i = 0; i < pages.length; i++) if (ouEst(pages[i].blocks, bid)) return i; return -1; }
// copie profonde d'un bloc, identifiant neuf pour lui et pour chaque bloc qu'il contient
function copieBloc(b) {
  var c = JSON.parse(JSON.stringify(b)); c.id = uid();
  if (c.type === 'group' && Array.isArray(c.blocks)) c.blocks.forEach(function (x) { x.id = uid(); });
  return c;
}
function byId(id) { var o = ouEst(doc.blocks, id); return o ? o.b : null; }
// position d'un bloc de la page affichée : { liste, i, parent } (liste : la page ou le groupe qui le contient), ou null
function position(b) { var o = b ? ouEst(doc.blocks, b.id) : null; return o && o.b === b ? o : null; }
function idx(b) { return doc.blocks.indexOf(b); }   // position au premier niveau seulement (-1 pour un bloc d'un groupe)
function getPath(o, k) { var p = k.split('.'); for (var i = 0; i < p.length; i++) { if (o == null) return undefined; o = o[p[i]]; } return o; }
function ligneVide(l) { return l.every(function (v) { return !v; }); }   // ligne (ou colonne) de tableau sans texte
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
// nom du fichier local d'où la page est ouverte (dernier segment décodé de l'adresse) ; null hors d'un fichier local
function nomFichierOuvert(adresse) {
  var m = /^file:\/\/[^?#]*/i.exec(String(adresse || '')); if (!m) return null;
  var nom = m[0].slice(m[0].lastIndexOf('/') + 1);
  try { nom = decodeURIComponent(nom); } catch (_) {}
  return nom.normalize('NFC');
}
// nom proposé au sélecteur : la poignée gardée ; poignée écartée, le fichier ouvert (sinon son ancien nom) ; sinon le titre
function nomPropose(nomPoignee, nomEcarte, adresse, nomTitre) { return nomPoignee || (nomEcarte != null ? nomFichierOuvert(adresse) || nomEcarte : nomTitre); }
// la poignée porte-t-elle le nom du fichier ouvert ? Casse ignorée (Windows, macOS), accents comparés en NFC (macOS les décompose)
function memeNomQueFichierOuvert(nomPoignee, adresse) {
  var nom = nomFichierOuvert(adresse); if (nom === null) return true;
  return String(nomPoignee || '').normalize('NFC').toLowerCase() === nom.toLowerCase();
}

