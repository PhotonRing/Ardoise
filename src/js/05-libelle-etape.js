/* ---------- Libellé d'une étape de l'historique ----------
   Fonction pure : décrit ce qui change entre deux documents (l'état d'avant une étape et celui d'après), pour
   l'infobulle d'Annuler et de Rétablir. Du plus large au plus précis : page, bloc (type et premiers mots), puis la
   nature. Au chargement, ce fichier ne touche ni au DOM ni au stockage. */
var LIBELLE_MOTS = 40;   // longueur des premiers mots d'un bloc, en caractères
// réglages du document, dans l'ordre du libellé ; pages et pastilles ont leurs propres natures
var LIBELLE_REGLAGES = [['title', 'Titre du document'], ['palette', 'Palette'], ['typo', 'Typographie'], ['width', 'Largeur'],
  ['theme', 'Thème'], ['nav', 'Navigation'], ['mapKey', 'Clé de carte']];
// premiers mots d'un bloc : ses textes dans l'ordre (champs de texte, cellules), sans balise, tronqués
function libelleMots(b) {
  var t = [];
  function lire(x, k) {
    if (t.join(' ').length > LIBELLE_MOTS) return;
    if (typeof x === 'string') { if (k === 'rows' || SYN_TEXT[k]) t.push(htmlText(x)); return; }   // SYN_TEXT : 05-synchro-moteur.js
    if (Array.isArray(x)) { x.forEach(function (e) { lire(e, k); }); return; }
    if (x && typeof x === 'object') Object.keys(x).forEach(function (c) { if (c !== 'id' && c !== 'type') lire(x[c], k === 'rows' ? k : c); });
  }
  lire(b, '');
  var m = t.join(' ').replace(/\s+/g, ' ').trim();
  return m.length > LIBELLE_MOTS ? m.slice(0, LIBELLE_MOTS).trim() + '…' : m;
}
function libelleBloc(pg, b) {
  var mots = libelleMots(b), ty = T[b.type] ? T[b.type].label : 'Bloc';
  return (pg.title || 'Sans titre') + ' · ' + ty + (mots ? ' « ' + mots + ' »' : '');
}
// identifiants communs à deux listes d'objets à identifiant, et ceux qui restent dans l'ordre (plus longue sous-suite commune)
function libelleOrdre(la, lb) {
  var enA = {}, enB = {}; la.forEach(function (x) { enA['$' + x.id] = x; }); lb.forEach(function (x) { enB['$' + x.id] = x; });
  var ca = la.filter(function (x) { return enB['$' + x.id]; }).map(function (x) { return x.id; });
  var cb = lb.filter(function (x) { return enA['$' + x.id]; }).map(function (x) { return x.id; });
  return { enA: enA, enB: enB, garde: synCommuns(ca, cb) };   // synCommuns : 05-synchro-adaptateur.js, appelé à l'exécution
}
// feuilles qui diffèrent entre deux valeurs : { k : dernière clé, rows : sous les cellules, v : nouvelle valeur } ;
// une liste qui change de longueur ou de forme compte comme une feuille sans clé de texte
function libelleFeuilles(a, b, k, rows, out) {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) { a.forEach(function (x, i) { libelleFeuilles(x, b[i], k, rows, out); }); return; }
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    var cles = {}; Object.keys(a).concat(Object.keys(b)).forEach(function (c) { cles[c] = 1; });
    Object.keys(cles).forEach(function (c) { libelleFeuilles(a[c], b[c], c, rows || c === 'rows', out); });
    return;
  }
  out.push({ k: typeof a === typeof b && typeof b !== 'object' ? k : '', rows: rows && typeof b === 'string', v: b });
}
// bloc sans une clé, à toute profondeur (dépendances des cartes, état réduit des colonnes) : une liste qui change de longueur perd sa clé dans libelleFeuilles
function libelleSans(b, cle) { return JSON.stringify(b, function (k, v) { return k === cle ? undefined : v; }); }
// tableau : une ligne ou une colonne ajoutée vide, ou retirée, et rien d'autre ; tout autre changement de taille, ou
// plusieurs cellules changées sans simple déplacement d'une ligne ou d'une colonne, est un collage de plage (ou une plage
// vidée si toutes sont vides après) ; sinon null
function libelleGrille(ra, rb) {
  var J = JSON.stringify, i;
  var vide = function (l) { return l.every(function (v) { return !v; }); };
  var sansLigne = function (g, k) { return J(g.slice(0, k).concat(g.slice(k + 1))); };
  var sansCol = function (g, k) { return J(g.map(function (l) { return l.slice(0, k).concat(l.slice(k + 1)); })); };
  var colonne = function (g, k) { return g.map(function (l) { return l[k]; }); };
  var tri = function (ls) { return J(ls.map(J).sort()); };
  var la = ra.length, lb = rb.length, ca = ra[0].length, cb = rb[0].length;
  if (la !== lb || ca !== cb) {
    if (ca === cb && lb === la + 1) for (i = 1; i < lb; i++) if (vide(rb[i]) && sansLigne(rb, i) === J(ra)) return 'ligne ajoutée';
    if (ca === cb && la === lb + 1) for (i = 1; i < la; i++) if (sansLigne(ra, i) === J(rb)) return 'ligne supprimée';
    if (la === lb && cb === ca + 1) for (i = 0; i < cb; i++) if (vide(colonne(rb, i).slice(1)) && sansCol(rb, i) === J(ra)) return 'colonne ajoutée';
    if (la === lb && ca === cb + 1) for (i = 0; i < ca; i++) if (sansCol(ra, i) === J(rb)) return 'colonne supprimée';
    return 'cellules collées';
  }
  var n = 0, vides = 0; ra.forEach(function (l, r) { l.forEach(function (v, c) { if (v !== rb[r][c]) { n++; if (!rb[r][c]) vides++; } }); });
  if (n < 2) return null;
  if (vides === n) return 'cellules vidées';   // plage coupée (Ctrl+X) ou effacée (Suppr)
  var cols = function (g) { return g[0].map(function (x, k) { return colonne(g, k); }); };
  if (tri(ra) === tri(rb) || tri(cols(ra)) === tri(cols(rb))) return null;   // ligne ou colonne déplacée (glisser)
  return 'cellules collées';
}
// nature de la modification d'un bloc resté du même identifiant
function libelleNature(ba, b) {
  if (ba.type !== b.type) return 'bloc modifié';
  if (b.type === 'kanban' && libelleSans(ba, 'collapsed') === libelleSans(b, 'collapsed')) {
    // une seule colonne bascule par étape : réduite si l'une l'est devenue
    var reduite = (b.cols || []).some(function (c, ci) { return c.collapsed && !(ba.cols[ci] || {}).collapsed; });
    return reduite ? 'colonne réduite' : 'colonne affichée';
  }
  if (b.type === 'kanban' && libelleSans(ba, 'dep') === libelleSans(b, 'dep')) return 'dépendance modifiée';
  if (b.type === 'table' && Array.isArray(ba.rows) && Array.isArray(b.rows) && ba.rows.length && b.rows.length) {
    var nt = libelleGrille(ba.rows, b.rows); if (nt) return nt;
  }
  var f = []; libelleFeuilles(ba, b, '', false, f);
  if (f.every(function (x) { return x.rows; })) return 'cellule modifiée';
  if (f.length === 1 && f[0].k === 'done') return f[0].v ? 'case cochée' : 'case décochée';
  if (f.every(function (x) { return SYN_TEXT[x.k]; })) return 'texte modifié';   // SYN_TEXT : champs de texte (05-synchro-moteur.js)
  return 'bloc modifié';
}
// modifications des blocs d'une page présente avant et après
function libellesBlocs(pa, pg, out) {
  var o = libelleOrdre(pa.blocks, pg.blocks);
  pa.blocks.forEach(function (b) { if (!o.enB['$' + b.id]) out.push(libelleBloc(pa, b) + ' : bloc supprimé'); });
  pg.blocks.forEach(function (b) {
    var ba = o.enA['$' + b.id];
    if (!ba) { out.push(libelleBloc(pg, b) + ' : bloc ajouté'); return; }
    if (!o.garde['$' + b.id]) out.push(libelleBloc(pg, b) + ' : bloc déplacé');
    if (JSON.stringify(ba) !== JSON.stringify(b)) out.push(libelleBloc(pg, b) + ' : ' + libelleNature(ba, b));
  });
}
function libellePage(pg) { return pg.title ? 'page « ' + pg.title + ' »' : 'page sans titre'; }
// libellés des modifications entre deux documents JSON, dans l'ordre du document : pages, réglages, pastilles
function libellesDifferences(avant, apres) {
  var out = [], o = libelleOrdre(avant.pages, apres.pages);
  avant.pages.forEach(function (pg) { if (!o.enB['$' + pg.id]) out.push(libellePage(pg) + ' supprimée'); });
  apres.pages.forEach(function (pg) {
    var pa = o.enA['$' + pg.id];
    if (!pa) { out.push(libellePage(pg) + ' ajoutée'); return; }
    if (!o.garde['$' + pg.id]) out.push(libellePage(pg) + ' déplacée');
    if ((pa.title || '') !== (pg.title || '')) out.push(libellePage(pa) + (pg.title ? ' renommée en « ' + pg.title + ' »' : ' renommée sans titre'));
    if ((+pa.lv || 0) !== (+pg.lv || 0)) out.push(libellePage(pg) + ' : niveau modifié');
    if (JSON.stringify(pa.blocks) !== JSON.stringify(pg.blocks)) libellesBlocs(pa, pg, out);
  });
  LIBELLE_REGLAGES.forEach(function (r) { if (JSON.stringify(avant[r[0]]) !== JSON.stringify(apres[r[0]])) out.push(r[1] + ' : réglage modifié'); });
  // pastilles : une nouvelle s'inscrit avec le texte qui la cite, déjà compté
  // nom d'une pastille : tel qu'écrit dans le texte (après l'étape, sinon avant), sinon vu au rendu pendant la session, sinon sa clé
  // (docTags : 07-requetes.js, seenTagName : 05-migrations.js, appelés à l'exécution)
  var ta = avant.tags || {}, tb = apres.tags || {}, noms = null;
  var nom = function (k) {
    if (!noms) { noms = {}; docTags(avant).concat(docTags(apres)).forEach(function (t) { noms['$' + t.key] = t.name; }); }   // seulement si une pastille change
    return noms['$' + k] || seenTagName(k);
  };
  Object.keys(ta).forEach(function (k) {
    if (!tb[k]) out.push('pastille « ' + nom(k) + ' » supprimée');
    else if (ta[k].c !== tb[k].c) out.push('pastille « ' + nom(k) + ' » : couleur modifiée');
  });
  return out;
}
// libellé d'une étape : la première modification, puis le nombre des autres ; un champ qu'aucune nature ne décrit
// (mot de passe, champ d'une version future) donne un libellé de repli, jamais un bouton au libellé nu
function libelleEtape(avant, apres) {
  var l = libellesDifferences(avant, apres);
  if (!l.length) return JSON.stringify(avant) === JSON.stringify(apres) ? '' : 'document modifié';
  if (l.length < 2) return l[0];
  return l[0] + ' et ' + (l.length - 1) + (l.length === 2 ? ' autre modification' : ' autres modifications');
}
