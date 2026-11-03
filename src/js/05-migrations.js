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
// Une étape reçoit le JSON brut (avant normalisation), toujours sous la forme { pages: [...] } : elle doit
// tolérer les champs absents.
var MIGRATIONS = [
  { from: 1, desc: 'Surtitre de l’en-tête en texte enrichi ; palette « ardoise » renommée « graphite »', run: function (d) {
    if (d.palette === 'ardoise') d.palette = 'graphite';
    migBlocks(d, function (b) { if (b.type === 'header' && typeof b.eyebrow === 'string' && b.eyebrow) b.eyebrow = esc(b.eyebrow); });
  } }
];
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
