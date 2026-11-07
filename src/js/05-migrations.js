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
  { from: 4, desc: 'Nouveau bloc « Kanban » ; retrait ligne par ligne des paragraphes (aucune conversion)', run: function () {} }
];
// --- outils des migrations (sans DOM : vérifiés aussi par scripts/check.mjs dans Node) ---
var MIG_SKIP = { id: 1, type: 1, src: 1, code: 1, name: 1, lang: 1, variant: 1, alt: 1 };
function migStrings(d, fn) {
  // applique fn à chaque texte des blocs (texte enrichi compris), sauf identifiants, images et code
  function walk(o) {
    if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) { if (typeof o[i] === 'string') o[i] = fn(o[i]); else if (o[i] && typeof o[i] === 'object') walk(o[i]); } return; }
    for (var k in o) { if (MIG_SKIP[k]) continue; var v = o[k]; if (typeof v === 'string') { if (v.indexOf('<') >= 0) o[k] = fn(v); } else if (v && typeof v === 'object') walk(v); }
  }
  migBlocks(d, walk);
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
function migBlocks(d, fn) { (Array.isArray(d.pages) ? d.pages : []).forEach(function (pg) { if (pg && Array.isArray(pg.blocks)) pg.blocks.forEach(function (b) { if (b && typeof b === 'object') fn(b); }); }); }
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
