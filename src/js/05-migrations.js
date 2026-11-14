/* ---------- Migrations du format du document ---------- */
// Le JSON d'un document porte le numéro de son format (« v »). Au chargement, les étapes ci-dessous
// l'amènent une à une jusqu'au format courant (VERSION, 00-entete.js), sur une copie : le fichier
// n'est réécrit qu'au prochain enregistrement. Un document d'un format plus récent que cet éditeur
// n'est jamais modifié : il s'ouvre en lecture seule, avec la proposition de mettre Ardoise à jour.
//
// Faire évoluer le format :
//   1. incrémenter VERSION dans 00-entete.js ;
//   2. ajouter ici l'étape { from: <ancienne VERSION>, desc: '…', run: function (d) { … } } ;
//   3. ajouter scripts/fixtures/format-<ancienne VERSION>.json (un document de ce format) et son
//      .attendu.json, et mettre à jour les .attendu.json existants : scripts/check.mjs vérifie que chaque
//      document de référence arrive exactement au résultat attendu, et qu'aucune étape ne manque.
// Un nouveau type de bloc demande aussi un nouveau format (étape vide) : un éditeur plus ancien ouvre alors
// le document en lecture seule au lieu d'écarter ce bloc qu'il ne connaît pas.
// Une étape reçoit le JSON brut (avant normalisation), toujours sous la forme { pages: [...] } : elle doit
// tolérer les champs absents.
var MIGRATIONS = [
  { from: 1, desc: 'Surtitre de l’en-tête en texte enrichi ; palette « ardoise » renommée « graphite »', run: function (d) {
    if (d.palette === 'ardoise') d.palette = 'graphite';
    migBlocks(d, function (b) { if (b.type === 'header' && typeof b.eyebrow === 'string' && b.eyebrow) b.eyebrow = esc(b.eyebrow); });
  } },
  { from: 2, desc: 'Listes à sous-niveaux ; pastilles nommées, une couleur par pastille ; pages sur plusieurs niveaux', run: function (d) {
    // pages : « sub » (sous-page de la page de premier niveau qui précède) devient un niveau « lv »
    (Array.isArray(d.pages) ? d.pages : []).forEach(function (pg, i) { if (!pg || typeof pg !== 'object') return; if (pg.sub && i > 0) pg.lv = 1; delete pg.sub; });
    // listes : chaque élément devient { html } (niveau « lv » facultatif)
    migBlocks(d, function (b) { if (b.type === 'list' && Array.isArray(b.items)) b.items = b.items.map(function (h) { return h && typeof h === 'object' ? h : { html: String(h == null ? '' : h) }; }); });
    // pastilles : la couleur n'est plus choisie à chaque fois mais portée par le nom (registre « tags ») ;
    // la première rencontrée fixe la couleur du nom, une autre couleur pour le même nom devient une exception (pc-N)
    var tags = {}, OLD = { ok: 0, bad: 1, warn: 2, info: 3 };
    migStrings(d, function (s) {
      return s.replace(/<span class="([^"]*\bpill\b[^"]*)">((?:(?!<\/?span\b)[\s\S])*?)<\/span>/g, function (m, cls, inner) {
        var old = (cls.match(/\bp-(ok|bad|warn|info)\b/) || [])[1], c = old ? OLD[old] : null, key = tagKey(htmlText(inner)), ex = '';
        if (key && c != null) { if (!(key in tags)) tags[key] = { c: c }; else if (tags[key].c !== c) ex = ' pc-' + c; }
        return '<span class="pill' + ex + '">' + inner + '</span>';
      });
    });
    if (Object.keys(tags).length) d.tags = tags;
  } },
  { from: 3, desc: 'Nouveau bloc « Requête » (aucune conversion)', run: function () {} },
  { from: 4, desc: 'Nouveau bloc « Kanban » ; retrait ligne par ligne des paragraphes (aucune conversion)', run: function () {} },
  { from: 5, desc: 'Nouveaux blocs « Groupe repliable » et « Modèle diamant » (aucune conversion)', run: function () {} },
  { from: 6, desc: 'Filtres des requêtes en liste (plusieurs valeurs, modes « l’une de », « toutes », « aucune de »)', run: function (d) {
    migBlocks(d, function (b) { if (b.type === 'query') migFiltresRequete(b); });
  } }
];
// --- format 7 : filtres des requêtes { id, prop, vals, mode } (filtres-logiques) ---
// Anciens champs, dans l'ordre figé de la migration (indépendant de Q_FILTRES, 07-requetes.js, qui évoluera)
var FILTRES_ORDRE_V7 = ['tags', 'state', 'col', 'kbWho', 'kbPrio', 'kbDue', 'bloquees'];
var Q_ANCIENS_CHAMPS = ['tags', 'match', 'state', 'col', 'kbWho', 'kbPrio', 'kbDue', 'kbDueN', 'kbDueU', 'bloquees'];
var Q_ANCIENS_CARTE = ['tags', 'match', 'state', 'col', 'ttags', 'tmatch', 'tstate', 'tcol'];
// filtres d'un objet aux anciens champs : bloc (pre ''), ou carte de nombre (carte : pastilles, état et colonne ; pre 't' : son total)
function migFiltres(o, pre, carte, id) {
  var out = [], f = function (prop, vals, plus) { var x = { id: id(), prop: prop, vals: vals }; for (var k in plus) x[k] = plus[k]; out.push(x); };
  FILTRES_ORDRE_V7.forEach(function (prop) {
    var v = o[pre + prop];
    if (prop === 'tags') { if (Array.isArray(v) && v.length) f('tags', v.map(String), o[pre + 'match'] === 'all' ? { mode: 'tous' } : {}); return; }
    if (prop === 'state') { if (v === 'done' || v === 'todo') f('state', [v]); return; }
    if (!v || (carte && prop !== 'col')) return;
    if (prop === 'kbPrio') f('kbPrio', v === 'p12' ? ['p1', 'p2'] : [String(v)]);
    else if (prop === 'kbDue') { var p = {}; if (o.kbDueN != null) p.n = o.kbDueN; if (o.kbDueU != null) p.u = o.kbDueU; f('kbDue', [String(v)], p); }
    else if (prop === 'bloquees') f('bloquees', ['oui']);
    else f(prop, [String(v)]);
  });
  return out;
}
// identifiants déterministes (f1, f2…, uniques dans le bloc) : deux copies qui migrent le même fichier donnent les mêmes
function migFiltresRequete(b) {
  var n = 0, id = function () { return 'f' + (++n); };
  var fb = migFiltres(b, '', false, id);
  var cartes = Array.isArray(b.cards) ? b.cards.map(function (c) { return c && typeof c === 'object' ? [migFiltres(c, '', true, id), migFiltres(c, 't', true, id)] : null; }) : [];
  oterAnciensFiltres(b);
  if (fb.length) b.filtres = fb;
  cartes.forEach(function (x, i) { if (!x) return; var c = b.cards[i]; if (x[0].length) c.filtres = x[0]; if (x[1].length) c.tfiltres = x[1]; });
}
// retire les anciens champs d'un bloc requête et de ses cartes de nombre (à la migration et à la normalisation : jamais lus ailleurs)
function oterAnciensFiltres(b) {
  Q_ANCIENS_CHAMPS.forEach(function (k) { delete b[k]; });
  if (Array.isArray(b.cards)) b.cards.forEach(function (c) { if (c && typeof c === 'object') Q_ANCIENS_CARTE.forEach(function (k) { delete c[k]; }); });
}
// Miroir des anciens champs, à l'écriture du fichier seulement (serializeFile, copyJSON) : une version 1.23 ou plus ancienne
// ouvre le document en lecture seule et filtre juste dans le cas courant. Rend une copie, l'original n'est pas touché.
function miroirFiltres(d) {
  var o = {}; for (var k in d) o[k] = d[k];
  if (!Array.isArray(d.pages)) return o;
  var bloc = function (b) {
    if (!b || typeof b !== 'object') return b;
    if (b.type === 'group' && Array.isArray(b.blocks)) { var g = {}; for (var gk in b) g[gk] = b[gk]; g.blocks = b.blocks.map(bloc); return g; }
    if (b.type !== 'query') return b;
    var q = {}; for (var qk in b) q[qk] = b[qk];
    oterAnciensFiltres(q); miroirChamps(q, q.filtres, '', false);
    if (Array.isArray(b.cards)) q.cards = b.cards.map(function (c) {
      if (!c || typeof c !== 'object') return c;
      var x = {}; for (var ck in c) x[ck] = c[ck];
      Q_ANCIENS_CARTE.forEach(function (ak) { delete x[ak]; });
      miroirChamps(x, c.filtres, '', true); miroirChamps(x, c.tfiltres, 't', true);
      return x;
    });
    return q;
  };
  o.pages = d.pages.map(function (pg) { if (!pg || !Array.isArray(pg.blocks)) return pg; var p = {}; for (var pk in pg) p[pk] = pg[pk]; p.blocks = pg.blocks.map(bloc); return p; });
  return o;
}
// premier filtre « l'une de » à une seule valeur de chaque propriété (P1 et P2 : « p12 ») ; pastilles : premier filtre « l'une de » ou « toutes »
function miroirChamps(o, filtres, pre, carte) {
  var faits = {};
  (Array.isArray(filtres) ? filtres : []).forEach(function (f) {
    if (!f || typeof f !== 'object' || faits[f.prop] || !Array.isArray(f.vals) || !f.vals.length) return;
    var mode = f.mode || 'un', vals = f.vals.filter(function (v, i) { return f.vals.indexOf(v) === i; });
    if (f.prop === 'tags') { if (mode === 'aucun') return; o[pre + 'tags'] = vals.slice(); o[pre + 'match'] = mode === 'tous' ? 'all' : 'any'; faits.tags = 1; return; }
    if (mode !== 'un' || (carte && f.prop !== 'state' && f.prop !== 'col')) return;
    var v = vals.length === 1 ? vals[0] : f.prop === 'kbPrio' && vals.length === 2 && vals.indexOf('p1') >= 0 && vals.indexOf('p2') >= 0 ? 'p12' : null;
    if (v == null) return;
    faits[f.prop] = 1;
    if (f.prop === 'bloquees') { if (v === 'oui') o.bloquees = true; return; }
    o[pre + f.prop] = v;
    if (f.prop === 'kbDue') { if (f.n != null) o.kbDueN = f.n; if (f.u != null) o.kbDueU = f.u; }
  });
}
// --- outils des migrations (sans DOM : vérifiés aussi par scripts/check.mjs dans Node) ---
var MIG_SKIP = { id: 1, type: 1, src: 1, code: 1, name: 1, lang: 1, variant: 1, alt: 1 };
function migStrings(d, fn) {
  // applique fn à chaque texte des blocs (texte enrichi compris), sauf identifiants, images et code
  function walk(o) {
    if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) { if (typeof o[i] === 'string') o[i] = fn(o[i]); else if (o[i] && typeof o[i] === 'object') walk(o[i]); } return; }
    for (var k in o) { if (MIG_SKIP[k]) continue; var v = o[k]; if (typeof v === 'string') { if (v.indexOf('<') >= 0) o[k] = fn(v); } else if (v && typeof v === 'object') walk(v); }
  }
  // walk descend déjà dans les blocs d'un groupe : chaque bloc du premier niveau, une seule fois
  (Array.isArray(d.pages) ? d.pages : []).forEach(function (pg) { if (pg && Array.isArray(pg.blocks)) pg.blocks.forEach(function (b) { if (b && typeof b === 'object') walk(b); }); });
}
function htmlText(html) {
  // texte d'un fragment HTML assaini (balises retirées, entités courantes décodées)
  return String(html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
function tagKey(text) { return String(text || '').replace(/[\s ​]+/g, ' ').trim().toLowerCase(); }   // nom d'une pastille, sans casse ni espaces superflus
// une pastille dans un texte enrichi : classes après « pill », autres attributs, contenu ; seule reconnaissance des
// pastilles, partagée par leur coloration au rendu (15-pastilles.js) et le registre (07-requetes.js)
var PILL_RE = /<span class="pill([^"]*)"((?:\s[^>]*)?)>((?:(?!<\/?span\b)[\s\S])*?)<\/span>/g;
function eachPill(html, fn) { String(html || '').replace(PILL_RE, function (m, cls, attrs, inner) { fn(inner); return m; }); }   // fn(contenu) par pastille
// noms des pastilles tels qu'écrits, notés à leur rendu pendant la session (clé → nom) : une pastille retirée de tous
// les textes garde son nom dans la fenêtre des pastilles et les libellés d'Annuler ; au rechargement, on retombe sur la clé
var tagNamesSeen = {};
function noteTagName(key, text) { if (key) tagNamesSeen['$' + key] = String(text).replace(/\s+/g, ' ').trim(); }
function seenTagName(key) { return tagNamesSeen['$' + key] || key; }
var TAG_COLORS = 16;
function nextTagColor(tags) {
  // couleur d'une nouvelle pastille : la moins utilisée (à égalité, la première)
  var n = []; for (var i = 0; i < TAG_COLORS; i++) n.push(0);
  for (var k in tags) { var c = tags[k] && tags[k].c; if (c >= 0 && c < TAG_COLORS) n[c]++; }
  var best = 0; for (var j = 1; j < TAG_COLORS; j++) if (n[j] < n[best]) best = j;
  return best;
}
// chaque bloc du JSON brut, blocs d'un groupe compris (un seul niveau)
function migBlocks(d, fn) {
  var un = function (b) { if (b && typeof b === 'object') { fn(b); if (b.type === 'group' && Array.isArray(b.blocks)) b.blocks.forEach(function (c) { if (c && typeof c === 'object') fn(c); }); } };
  (Array.isArray(d.pages) ? d.pages : []).forEach(function (pg) { if (pg && Array.isArray(pg.blocks)) pg.blocks.forEach(un); });
}
function docFormat(d) { return Math.max(1, Math.floor(+d.v) || 1); }   // sans numéro : format 1 (anciens fichiers, JSON écrit à la main)
function migrate(d) {
  // renvoie { doc, from, newer, steps } ; doc est une copie migrée (ou le document lui-même s'il est déjà au format courant)
  var from = docFormat(d);
  if (from >= VERSION) return { doc: d, from: from, newer: from > VERSION, steps: [] };
  var c = JSON.parse(JSON.stringify(d)), steps = [];
  for (var v = from; v < VERSION; v++) {
    var m = MIGRATIONS.filter(function (x) { return x.from === v; })[0];
    if (!m) throw new Error('migration manquante du format ' + v + ' au format ' + (v + 1));
    m.run(c); steps.push(m.desc);
  }
  c.v = VERSION;
  return { doc: c, from: from, newer: false, steps: steps };
}
