/* ---------- Copier pour Office : famille Cadres (socle et point d'entrée : 08-office.js) ----------
   Encadré, fiche de faits, cartes, bloc dépliable, groupe repliable, modèle diamant, d'après page.css (.note, .facts, .subs, .fold, .grp, .dia),
   reconstruits en tableaux. Writer n'applique le retrait intérieur qu'à une cellule bordée : bordure de la couleur du fond au besoin. */
// cellule calée en haut : attribut valign (Writer ignore vertical-align dans le style)
function officeCadreCellule(contenu, style, largeur) { return officeCellule(contenu, style + ';vertical-align:top', largeur).replace('<td', '<td valign="top"'); }
// cellule pleine largeur dans un tableau d'une cellule
function officeCadreUne(contenu, style) { return officeTable('<tr>' + officeCadreCellule(contenu, style, '100%') + '</tr>', 'margin:0 0 6pt'); }

// encadré (.note) : fond *-soft et trait de 3 px à gauche ; « Trait seul » (.n-line) sans fond, trait Attention, gras en couleur du trait
OFFICE_RENDUS.note = function (b, x) {
  var v = b.variant, C = x.C, segs = x.S(b.html);
  if (v === 'line') {
    segs = segs.map(function (g) { var c = {}, k; for (k in g) c[k] = g[k]; if (c.gras && !c.saut && !c.pastille) c.couleur = C.warn; return c; });
    return officeCadreUne('<p style="margin-top:0pt;margin-bottom:0pt">' + x.segs(segs) + '</p>', 'border:1px solid ' + C.surface + ';border-left:3px solid ' + C.warn + ';padding:3pt 0 3pt 9pt');
  }
  if (['warn', 'info', 'bad', 'ok'].indexOf(v) < 0) v = 'warn';
  return officeCadreUne('<p style="margin-top:0pt;margin-bottom:0pt">' + x.segs(segs) + '</p>', 'background:' + C[v + '-soft'] + ';border:1px solid ' + C[v + '-soft'] + ';border-left:3px solid ' + C[v] + ';padding:7.5pt 10.5pt');
};

/* Grilles (.facts, .subs) : colonnes d'une grille CSS repeat(auto-fit, minmax(min, 1fr)) à une largeur donnée ; auto-fit replie les pistes vides,
   donc jamais plus de colonnes que d'éléments. Dimensions de page.css, à la largeur du collage (OFFICE_LARGEUR). */
function officeCadreColonnes(largeur, min, ecart, n) { return Math.max(1, Math.min(n, Math.floor((largeur + ecart) / (min + ecart)))); }
// cellules (HTML) rangées en lignes de cols ; dernière ligne complétée de cellules vides ; style(i, j, lignes, cols) de chaque cellule
function officeCadreGrille(cellules, cols, style) {
  var nl = Math.ceil(cellules.length / cols), h = '', largeur = Math.floor(100 / cols) + '%';
  for (var i = 0; i < nl; i++) {
    h += '<tr>';
    for (var j = 0; j < cols; j++) h += officeCadreCellule(cellules[i * cols + j] || '', style(i, j, nl, cols), largeur);
    h += '</tr>';
  }
  return h;
}
// pourtour d'une grille : trait line au bord, trait de la couleur du fond dedans (Writer n'applique le retrait qu'à une cellule bordée)
function officeCadrePourtour(i, j, nl, cols, C) {
  var t = function (bord) { return '1px solid ' + (bord ? C.line : C.surface); };
  return 'border-top:' + t(i === 0) + ';border-bottom:' + t(i === nl - 1) + ';border-left:' + t(j === 0) + ';border-right:' + t(j === cols - 1) + ';';
}
// étiquette (clé de fait, nom de sommet) : texte simple en capitales écrites
function officeCadreEtiquette(texte) { return '<p style="margin-top:0pt;margin-bottom:0pt;' + OFFICE_ETIQUETTE + '">' + esc(String(texte == null ? '' : texte).toUpperCase()) + '</p>'; }

// fiche de faits (.facts) : cadre blanc bordé, faits en grille (minmax(170px,1fr), écart de 20 px, 18 px de marge et 1 px de cadre de chaque côté),
// clé en étiquette au-dessus de la valeur semi-grasse (dd : 600), valeur en rouge si le fait est en alerte
OFFICE_RENDUS.facts = function (b, x) {
  var its = b.items || [];
  if (!its.length) return '';
  var cols = officeCadreColonnes(OFFICE_LARGEUR - 38, 170, 20, its.length);
  return officeTable(officeCadreGrille(its.map(function (it) {
    return officeCadreEtiquette(it.k) + '<p style="margin-top:1.5pt;margin-bottom:0pt;font-family:' + OFFICE_POLICES.titre + ';font-weight:600' + (it.alert ? ';color:' + x.C.bad : '') + '">' + x.segs(x.S(it.v)) + '</p>';
  }), cols, function (i, j, nl, nc) {
    return 'background:' + x.C.surface + ';' + officeCadrePourtour(i, j, nl, nc, x.C) + 'padding:' + (i === 0 ? '9pt' : '4.5pt') + ' 7.5pt ' + (i === nl - 1 ? '9pt' : '4.5pt');
  }), 'margin:0 0 6pt');
};

// cartes (.subs, .sub) : cellules bordées sur fond blanc, autant par ligne que la grille à 680 px (minmax(min(100%,--min),1fr), écart de 12 px) ;
// écarts en cellules et lignes vides (Writer ignore border-spacing) ; titre semi-gras (h3 : 600, 15 px), texte, cases de la liste à cocher (09-office-listes.js)
OFFICE_RENDUS.cards = function (b, x) {
  var cs = b.cards || [];
  if (!cs.length) return '';
  var cols = officeCadreColonnes(OFFICE_LARGEUR, Math.min(OFFICE_LARGEUR, +b.min || 340), 12, cs.length), nl = Math.ceil(cs.length / cols);
  var largeur = Math.floor((100 - 2 * (cols - 1)) / cols) + '%', h = '';
  var carte = function (c) {
    var t = x.S(c.title), tx = x.S(c.text), checks = c.checks || [];
    return (officeVide(t) ? '' : '<p style="margin-top:0pt;margin-bottom:0pt;font-family:' + OFFICE_POLICES.titre + ';font-weight:600;line-height:1.3">' + x.segs(t) + '</p>') +
      (officeVide(tx) ? '' : '<p style="margin-top:' + (officeVide(t) ? '0pt' : '6pt') + ';margin-bottom:0pt">' + x.segs(tx) + '</p>') +
      (checks.length ? '<div style="margin-top:6pt">' + officeListeCases(checks, checks.map(function (it, k) { return k; }), x) + '</div>' : '');
  };
  for (var i = 0; i < nl; i++) {
    if (i) h += '<tr><td colspan="' + (2 * cols - 1) + '" style="font-size:1pt;line-height:1pt;height:9pt">&nbsp;</td></tr>';
    h += '<tr>';
    for (var j = 0; j < cols; j++) {
      var c = cs[i * cols + j];
      if (j) h += '<td width="2%" style="font-size:1pt">&nbsp;</td>';
      h += c ? officeCadreCellule(carte(c), 'background:' + x.C.surface + ';border:1px solid ' + x.C.line + ';padding:10.5pt 12pt', largeur) : '<td width="' + largeur + '" style="font-size:1pt">&nbsp;</td>';
    }
    h += '</tr>';
  }
  return officeTable(h, 'margin:0 0 6pt');
};

// titre d'un dépliable ou d'un groupe ouvert : marque ▾ en accent (▸ ou › tourné à l'écran), titre semi-gras
function officeCadreTitre(segs, x) { return '<p style="margin-top:0pt;margin-bottom:0pt;font-family:' + OFFICE_POLICES.titre + ';font-weight:600"><span style="color:' + x.acc + '">▾</span>&nbsp;' + x.segs(segs) + '</p>'; }
// bloc dépliable (.fold) : toujours ouvert, cadre blanc bordé, titre marqué, contenu en retrait sous le titre (36 px à l'écran)
OFFICE_RENDUS.details = function (b, x) {
  var corps = x.S(b.html);
  return officeCadreUne(officeCadreTitre(x.S(b.title), x) + (officeVide(corps) ? '' : '<p style="margin-top:6pt;margin-bottom:0pt;margin-left:' + officePt(20) + '">' + x.segs(corps) + '</p>'),
    'background:' + x.C.surface + ';border:1px solid ' + x.C.line + ';padding:9pt 12pt');
};
// groupe repliable (.grp) : toujours ouvert, trait gris de 2 px à gauche, titre puis ses blocs chacun dans son style (officeHtmlContenu) ;
// un paragraphe sépare deux blocs (Word fusionne deux tableaux qui se suivent) ; images (cartes et chronologies) ramenées à la largeur du groupe
var OFFICE_CADRE_GROUPE = 650;
OFFICE_RENDUS.group = function (b, x) {
  var opts = {}, images = {}, k;
  for (k in x.opts) opts[k] = x.opts[k];
  for (k in x.images) {
    var im = x.images[k], c = {}, j;
    for (j in im) c[j] = im[j];
    if (c.l > OFFICE_CADRE_GROUPE && c.h) { c.h = Math.round(c.h * OFFICE_CADRE_GROUPE / c.l); c.l = OFFICE_CADRE_GROUPE; }
    images[k] = c;
  }
  opts.images = images;
  var t = x.S(b.title), enfants = (b.blocks || []).map(function (c) { return officeHtmlContenu(c, x.d, opts); }).filter(Boolean);
  var h = (officeVide(t) ? '' : officeCadreTitre(t, x) + '<p style="margin-top:0pt;margin-bottom:0pt;font-size:4pt;line-height:4pt">&nbsp;</p>') +
    enfants.join('<p style="margin-top:0pt;margin-bottom:0pt;font-size:6pt;line-height:6pt">&nbsp;</p>');
  return officeCadreUne(h, 'border:1px solid ' + x.C.surface + ';border-left:2px solid ' + x.C.line + ';padding:0 0 0 10.5pt');
};

// modèle diamant (.dia) : titre semi-gras centré, puis grille 3 × 3 en losange (Adversaire en haut, Infrastructure à gauche, Capacité à droite,
// Victime en bas : grid-template-areas de .dia-g) ; sommets bordés sur fond blanc, nom en étiquette, sommet vide « — » gris ; sans les traits du losange
var OFFICE_CADRE_LOSANGE = [[null, 'adversaire', null], ['infrastructure', null, 'capacite'], [null, 'victime', null]];
OFFICE_RENDUS.diamond = function (b, x) {
  var noms = {}, t = x.S(b.title);
  DIA_SOMMETS.forEach(function (s) { noms[s.cle] = s.nom; });
  var h = OFFICE_CADRE_LOSANGE.map(function (ligne, i) {
    return (i ? '<tr><td colspan="3" style="font-size:1pt;line-height:1pt;height:10pt">&nbsp;</td></tr>' : '') + '<tr>' + ligne.map(function (cle) {
      if (!cle) return '<td width="33%" style="font-size:1pt">&nbsp;</td>';
      var v = x.S(b[cle]);
      return officeCadreCellule(officeCadreEtiquette(noms[cle]) + '<p style="margin-top:1.5pt;margin-bottom:0pt">' + (officeVide(v) ? '<span style="color:' + x.C.muted + '">—</span>' : x.segs(v)) + '</p>',
        'background:' + x.C.surface + ';border:1px solid ' + x.C.line + ';padding:7.5pt 9pt', '33%');
    }).join('') + '</tr>';
  }).join('');
  return (officeVide(t) ? '' : '<p align="center" style="margin:0 0 6pt;text-align:center;font-family:' + OFFICE_POLICES.titre + ';font-weight:600">' + x.segs(t) + '</p>') + officeTable(h, 'margin:0 0 6pt');
};
