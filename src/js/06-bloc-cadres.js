/* ---------- Famille cadres : encadré, fiche de faits, cartes, bloc dépliable, groupe repliable, modèle diamant ----------
   Inscriptions (T) et leurs facettes : rendu, reglages, elements (éléments neutres), office (Copier pour Office), libelle.
   Le groupe rend ses blocs par les points d'entrée communs (renderBlock, wrapEdit, officeBloc, officeHtmlContenu), sans connaître
   les autres types ; sa normalisation (blocs refusés remis dans la page) reste dans normBlocks (05-document.js). */

/* Copier pour Office : d'après page.css (.note, .facts, .subs, .fold, .grp, .dia), reconstruits en tableaux. Writer n'applique le
   retrait intérieur qu'à une cellule bordée : bordure de la couleur du fond au besoin. */
// cellule pleine largeur dans un tableau d'une cellule
function officeCadreUne(contenu, style) { return officeTable('<tr>' + officeCellule(contenu, style, '100%') + '</tr>', 'margin:0 0 6pt'); }
/* Grilles (.facts, .subs) : colonnes d'une grille CSS repeat(auto-fit, minmax(min, 1fr)) à une largeur donnée ; auto-fit replie les pistes vides,
   donc jamais plus de colonnes que d'éléments. Dimensions de page.css, à la largeur du collage (OFFICE_LARGEUR). */
function officeCadreColonnes(largeur, min, ecart, n) { return Math.max(1, Math.min(n, Math.floor((largeur + ecart) / (min + ecart)))); }
// cellules (HTML) rangées en lignes de cols ; dernière ligne complétée de cellules vides ; style(i, j, lignes, cols) de chaque cellule
function officeCadreGrille(cellules, cols, style) {
  var nl = Math.ceil(cellules.length / cols), h = '', largeur = Math.floor(100 / cols) + '%';
  for (var i = 0; i < nl; i++) {
    h += '<tr>';
    for (var j = 0; j < cols; j++) h += officeCellule(cellules[i * cols + j] || '', style(i, j, nl, cols), largeur);
    h += '</tr>';
  }
  return h;
}
// pourtour d'une grille : trait line au bord, trait de la couleur du fond dedans (Writer n'applique le retrait qu'à une cellule bordée)
function officeCadrePourtour(i, j, nl, cols, C) {
  var t = function (bord) { return '1px solid ' + (bord ? C.line : C.surface); };
  return 'border-top:' + t(i === 0) + ';border-bottom:' + t(i === nl - 1) + ';border-left:' + t(j === 0) + ';border-right:' + t(j === cols - 1) + ';';
}
// étiquette (clé de fait, nom de sommet) : paragraphe d'un texte simple
function officeCadreEtiquette(texte, x) { return officeEtiquette(officeTexteSegs(texte), x, { marges: 'margin-top:0pt;margin-bottom:0pt' }); }
// titre d'un dépliable ou d'un groupe ouvert : marque ▾ en accent (▸ ou › tourné à l'écran), titre semi-gras
function officeCadreTitre(segs, x) { return '<p style="margin-top:0pt;margin-bottom:0pt;font-family:' + OFFICE_POLICES.titre + ';font-weight:600"><span style="color:' + x.acc + '">▾</span>&nbsp;' + x.segs(segs) + '</p>'; }

/* ---------- Encadré ---------- */
T.note = { label: 'Encadré', ic: '!', desc: 'Attention, info, alerte, succès', kw: 'note encadre callout alerte', make: function () { return { variant: 'warn', html: '' }; }, sans: ['normaliser', 'libelle'],
  rendu: function (b, x) {
    var f = x.f;
    return '<div class="note n-' + esc(b.variant || 'warn') + '">' + f('p', '', 'html', b.html, { ph: 'Texte de l’encadré', ml: 1 }) + '</div>';
  },
  reglages: function (b) { return '<select data-act="set" data-prop="variant" title="Style">' + opt('warn', b.variant, 'Attention') + opt('info', b.variant, 'Info') + opt('bad', b.variant, 'Alerte') + opt('ok', b.variant, 'Succès') + opt('line', b.variant, 'Trait seul') + '</select>'; },
  elements: function (b, x) {
    var S = x.S, para = x.para, out = [];
    var nv = ['warn', 'info', 'bad', 'ok'].indexOf(b.variant) >= 0 ? b.variant : 'warn';
    out.push({ t: 'cadre', fond: OFFICE_CLAIR[nv + '-soft'], barre: OFFICE_CLAIR[nv], contenu: [para(S(b.html))] });
    return out;
  },
  // encadré (.note) : fond *-soft et trait de 3 px à gauche ; « Trait seul » (.n-line) sans fond, trait Attention, gras en couleur du trait
  office: function (b, x) {
    var v = b.variant, C = x.C, segs = x.S(b.html);
    if (v === 'line') {
      segs = segs.map(function (g) { var c = {}, k; for (k in g) c[k] = g[k]; if (c.gras && !c.saut && !c.pastille) c.couleur = C.warn; return c; });
      return officeCadreUne('<p style="margin-top:0pt;margin-bottom:0pt">' + x.segs(segs) + '</p>', 'border:1px solid ' + C.surface + ';border-left:3px solid ' + C.warn + ';padding:3pt 0 3pt 9pt');
    }
    if (['warn', 'info', 'bad', 'ok'].indexOf(v) < 0) v = 'warn';
    return officeCadreUne('<p style="margin-top:0pt;margin-bottom:0pt">' + x.segs(segs) + '</p>', 'background:' + C[v + '-soft'] + ';border:1px solid ' + C[v + '-soft'] + ';border-left:3px solid ' + C[v] + ';padding:7.5pt 10.5pt');
  }
};

/* ---------- Fiche de faits ---------- */
T.facts = { label: 'Fiche de faits', ic: '▤', desc: 'Grille clé / valeur en carte', kw: 'faits cle valeur facts resume', make: function () { return { items: [{ k: 'Clé', v: '', alert: false }, { k: 'Clé', v: '', alert: false }, { k: 'Clé', v: '', alert: false }] }; }, sans: ['normaliser', 'libelle'],
  rendu: function (b, x) {
    var e = x.edit, f = x.f;
    return '<dl class="facts">' + b.items.map(function (it, i) {
      return '<div class="fact">' + f('dt', '', 'items.' + i + '.k', it.k, { rich: false, ph: 'Clé' }) + f('dd', it.alert ? 'alert' : '', 'items.' + i + '.v', it.v, { ph: 'Valeur' }) +
        (e ? '<span class="itools"><button type="button" data-act="fact-alert" data-i="' + i + '" class="' + (it.alert ? 'on' : '') + '" title="Valeur en rouge">!</button><button type="button" data-act="fact-del" data-i="' + i + '" title="Supprimer">×</button></span>' : '') + '</div>';
    }).join('') + (e ? '<button class="add-item" type="button" data-act="fact-add">+ Ajouter</button>' : '') + '</dl>';
  },
  reglages: function (b) { return act('fact-add', '+ fait', 'Ajouter un fait'); },
  elements: function (b, x) {
    var S = x.S, txt = x.txt, para = x.para, out = [];
    out.push({ t: 'tableau', entete: false, lignes: b.items.map(function (it) {
      var v = S(it.v); if (it.alert) officeMettreForme(v, 'couleur', OFFICE_CLAIR.bad);
      return [[para([txt(it.k, { gras: true })])], [para(v)]];
    }) });
    return out;
  },
  // fiche de faits (.facts) : cadre blanc bordé, faits en grille (minmax(170px,1fr), écart de 20 px, 18 px de marge et 1 px de cadre de chaque côté),
  // clé en étiquette au-dessus de la valeur semi-grasse (dd : 600), valeur en rouge si le fait est en alerte
  office: function (b, x) {
    var its = b.items || [];
    if (!its.length) return '';
    var cols = officeCadreColonnes(OFFICE_LARGEUR - 38, 170, 20, its.length);
    return officeTable(officeCadreGrille(its.map(function (it) {
      return officeCadreEtiquette(it.k, x) + '<p style="margin-top:1.5pt;margin-bottom:0pt;font-family:' + OFFICE_POLICES.titre + ';font-weight:600' + (it.alert ? ';color:' + x.C.bad : '') + '">' + x.segs(x.S(it.v)) + '</p>';
    }), cols, function (i, j, nl, nc) {
      return 'background:' + x.C.surface + ';' + officeCadrePourtour(i, j, nl, nc, x.C) + 'padding:' + (i === 0 ? '9pt' : '4.5pt') + ' 7.5pt ' + (i === nl - 1 ? '9pt' : '4.5pt');
    }), 'margin:0 0 6pt');
  }
};

/* ---------- Cartes ---------- */
T.cards = { label: 'Cartes', ic: '▦', desc: 'Grille de cartes avec texte et cases', kw: 'cartes grille cards', make: function () { return { min: 340, cards: [{ title: '', text: '', checks: [{ html: '', done: false }] }, { title: '', text: '', checks: [{ html: '', done: false }] }] }; }, sans: ['normaliser', 'libelle'],
  rendu: function (b, x) {
    var e = x.edit, f = x.f, checks = x.checks;
    return '<div class="subs" style="--min:' + (+b.min || 340) + 'px">' + b.cards.map(function (c, i) {
      return '<div class="sub">' + ((e || !isBlank(c.title)) ? f('h3', '', 'cards.' + i + '.title', c.title, { ph: 'Titre de la carte' }) : '') +
        ((e || !isBlank(c.text)) ? f('p', 'sub-text', 'cards.' + i + '.text', c.text, { ph: 'Texte (optionnel)', ml: 1, soft: 1 }) : '') +
        checks('cards.' + i + '.checks', c.checks) +
        (e ? '<span class="itools"><button type="button" data-act="card-del" data-i="' + i + '" title="Supprimer la carte">×</button></span>' : '') + '</div>';
    }).join('') + (e ? '<button class="add-item" type="button" data-act="card-add">+ Carte</button>' : '') + '</div>';
  },
  reglages: function (b) { return act('card-add', '+ carte', 'Ajouter une carte') + '<select data-act="set" data-prop="min" title="Largeur des cartes">' + opt(340, b.min, 'Larges') + opt(220, b.min, 'Étroites') + opt(600, b.min, 'Pleine') + '</select>'; },
  elements: function (b, x) {
    var S = x.S, para = x.para, gras = x.gras, cases = x.cases, out = [];
    b.cards.forEach(function (c) {
      var ct = [];
      if (!officeVide(S(c.title))) ct.push(para(gras(S(c.title))));
      if (!officeVide(S(c.text))) ct.push(para(S(c.text)));
      if ((c.checks || []).length) ct.push(cases(c.checks, c.checks.map(function (x, k) { return k; })));
      out.push({ t: 'cadre', fond: OFFICE_CLAIR.surface, barre: null, contenu: ct });
    });
    return out;
  },
  // cartes (.subs, .sub) : cellules bordées sur fond blanc, autant par ligne que la grille à 680 px (minmax(min(100%,--min),1fr), écart de 12 px) ;
  // écarts en cellules et lignes vides (Writer ignore border-spacing) ; titre semi-gras (h3 : 600, 15 px), texte, cases de la liste à cocher (officeListeCases)
  office: function (b, x) {
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
        h += c ? officeCellule(carte(c), 'background:' + x.C.surface + ';border:1px solid ' + x.C.line + ';padding:10.5pt 12pt', largeur) : '<td width="' + largeur + '" style="font-size:1pt">&nbsp;</td>';
      }
      h += '</tr>';
    }
    return officeTable(h, 'margin:0 0 6pt');
  }
};

/* ---------- Bloc dépliable ---------- */
T.details = { label: 'Bloc dépliable', ic: '▸', desc: 'Titre cliquable qui révèle un texte', kw: 'details depliable accordeon', make: function () { return { title: '', html: '', open: false }; }, sans: ['normaliser', 'libelle'],
  rendu: function (b, x) {
    var e = x.edit, f = x.f;
    if (e) return '<div class="fold fold-edit"><div class="sum">' + f('span', '', 'title', b.title, { ph: 'Titre cliquable', nl: 1 }) + '</div>' + f('div', 'fold-body', 'html', b.html, { ph: 'Contenu révélé au clic', ml: 1 }) + '</div>';
    return '<details class="fold"' + (b.open ? ' open' : '') + '><summary>' + R(b.title) + '</summary><div class="fold-body">' + R(b.html) + '</div></details>';
  },
  reglages: function (b) { return tog('open', b.open, 'Ouvert', 'Ouvert par défaut en lecture'); },
  elements: function (b, x) {
    var S = x.S, para = x.para, gras = x.gras, out = [];
    out.push(para(gras(S(b.title))));
    if (!officeVide(S(b.html))) out.push(para(S(b.html)));
    return out;
  },
  // bloc dépliable (.fold) : toujours ouvert, cadre blanc bordé, titre marqué, contenu en retrait sous le titre (36 px à l'écran)
  office: function (b, x) {
    var corps = x.S(b.html);
    return officeCadreUne(officeCadreTitre(x.S(b.title), x) + (officeVide(corps) ? '' : '<p style="margin-top:6pt;margin-bottom:0pt;margin-left:' + officePt(20) + '">' + x.segs(corps) + '</p>'),
      'background:' + x.C.surface + ';border:1px solid ' + x.C.line + ';padding:9pt 12pt');
  }
};

/* ---------- Groupe repliable ---------- */
T.group = { label: 'Groupe repliable', ic: '⊟', desc: 'Titre cliquable qui plie quelques blocs, hors du sommaire', kw: 'groupe repliable plier replier accordeon conteneur blocs', make: function () { return { title: '', folded: false, blocks: [] }; }, sans: ['reglages', 'normaliser'],
  rendu: function (b, x) {
    var e = x.edit, f = x.f, d = x.d, ctx = x.ctx, editorUi = x.editor;
    // groupe repliable : son pli d'édition est enregistré (folded) ; en lecture, un <details> que chacun plie pour soi
    var gk = b.blocks || [], gn = gk.length, gplie = e ? !!b.folded : ((ctx.folds || {})[b.id] != null ? !!ctx.folds[b.id] : !!b.folded);
    if (e) return '<div class="grp grp-edit' + (gplie ? ' grp-plie' : '') + '"><div class="grp-head"><button type="button" class="grp-v" data-act="fold" aria-expanded="' + !gplie + '" title="' + (gplie ? 'Déplier' : 'Plier') + ' le groupe">›</button>' +
      f('span', 'grp-t', 'title', b.title, { ph: 'Titre du groupe', nl: 1 }) +
      (gplie ? '<button type="button" class="grp-n" data-act="fold" title="Déplier le groupe">' + (gn ? gn + ' bloc' + (gn > 1 ? 's' : '') : 'vide') + '</button>' : '') + '</div>' +
      (gplie ? '' : '<div class="grp-body">' + gk.map(function (c) { return wrapEdit(c, renderBlock(c, d, ctx, null), 0, editorUi, d.pages.length); }).join('') +
        (gn ? '' : '<div class="grp-vide">Glissez des blocs ici ou ajoutez-en un</div>') +
        '<button class="grp-add" type="button" data-act="grp-add">+ Ajouter dans le groupe</button></div>') + '</div>';
    return '<details class="grp"' + (gplie ? '' : ' open') + '><summary>' + R(b.title) + '</summary><div class="grp-body">' + gk.map(function (c) {
      var ci = renderBlock(c, d, ctx, null);
      // ancrage de la bascule (19-mode-lecture-edition.js) ; un bloc ancré garde sa cible de lien
      var at = (blocAncre(c) ? ' id="b-' + c.id + '"' : '') + (ctx.static ? '' : ' data-bid="' + c.id + '"');
      return ci && at ? ci.replace(/^<(\w+)/, '<$1' + at) : ci;
    }).join('') + '</div></details>';
  },
  elements: function (b, x) {
    var S = x.S, para = x.para, gras = x.gras, out = [];
    // groupe : toujours ouvert (comme à l'impression), titre en gras puis ses blocs
    if (!officeVide(S(b.title))) out.push(para(gras(S(b.title))));
    (b.blocks || []).forEach(function (c) { out = out.concat(officeBloc(c, x.d, x.opts)); });
    return out;
  },
  // groupe repliable (.grp) : toujours ouvert, trait gris de 2 px à gauche, titre puis ses blocs chacun dans son style (officeHtmlContenu) ;
  // un paragraphe sépare deux blocs (Word fusionne deux tableaux qui se suivent) ; images (cartes et chronologies) ramenées à la largeur du groupe (650 px)
  office: function (b, x) {
    var OFFICE_CADRE_GROUPE = 650, opts = {}, images = {}, k;
    for (k in x.opts) opts[k] = x.opts[k];
    for (k in x.images) {
      var im = x.images[k], c = {}, j;
      for (j in im) c[j] = im[j];
      var t = officeEchelle(c.l, c.h, OFFICE_CADRE_GROUPE);
      c.l = t[0]; c.h = t[1];
      images[k] = c;
    }
    opts.images = images;
    var t = x.S(b.title), enfants = (b.blocks || []).map(function (c) { return officeHtmlContenu(c, x.d, opts); }).filter(Boolean);
    var h = (officeVide(t) ? '' : officeCadreTitre(t, x) + '<p style="margin-top:0pt;margin-bottom:0pt;font-size:4pt;line-height:4pt">&nbsp;</p>') +
      enfants.join('<p style="margin-top:0pt;margin-bottom:0pt;font-size:6pt;line-height:6pt">&nbsp;</p>');
    return officeCadreUne(h, 'border:1px solid ' + x.C.surface + ';border-left:2px solid ' + x.C.line + ';padding:0pt 0pt 0pt 10.5pt');
  },
  // pli seul changé : « groupe plié » ou « groupe déplié » (05-libelle-etape.js) ; sinon le libellé générique
  libelle: function (ba, b) { return libelleSans(ba, 'folded') === libelleSans(b, 'folded') ? (b.folded ? 'groupe plié' : 'groupe déplié') : null; }
};

/* ---------- Modèle diamant ---------- */
T.diamond = { label: 'Modèle diamant', ic: '◇', desc: 'Adversaire, capacité, infrastructure et victime en losange', kw: 'diamant diamond modele intrusion adversaire capacite infrastructure victime cti menace evenement',
  make: function () { var o = { title: '' }; DIA_SOMMETS.forEach(function (s) { o[s.cle] = ''; }); return o; }, sans: ['reglages', 'normaliser', 'libelle'],
  rendu: function (b, x) {
    var e = x.edit, f = x.f;
    // losange : traits derrière les sommets (centres des cases d'une grille 3 × 3) ; ordre des sommets = celui de la pile sur écran étroit
    var dl = function (cls, a, z) { return '<line class="' + cls + '" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + z[0] + '" y2="' + z[1] + '" vector-effect="non-scaling-stroke"/>'; };
    var hA = [50, 16.7], hI = [16.7, 50], hC = [83.3, 50], hV = [50, 83.3];
    return '<div class="dia">' + ((e || !isBlank(b.title)) ? f('p', 'dia-t', 'title', b.title, { ph: 'Titre (facultatif)', nl: 1 }) : '') +
      '<div class="dia-g"><svg class="dia-traits" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
      dl('dia-cote', hA, hC) + dl('dia-cote', hC, hV) + dl('dia-cote', hV, hI) + dl('dia-cote', hI, hA) + dl('dia-axe', hA, hV) + dl('dia-axe', hI, hC) + '</svg>' +
      DIA_SOMMETS.map(function (s) {
        var v = b[s.cle];
        return '<div class="dia-s dia-' + s.cle + '"><span class="dia-n">' + s.nom + '</span>' +
          (e || !isBlank(v) ? f('div', 'dia-v', s.cle, v, { ph: s.nom, ml: 1 }) : '<div class="dia-v"><span class="dia-vide">—</span></div>') + '</div>';
      }).join('') + '</div></div>';
  },
  elements: function (b, x) {
    var S = x.S, txt = x.txt, para = x.para, out = [];
    // modèle diamant : tableau à deux colonnes, titre puis les sommets dans l'ordre de l'écran (DIA_SOMMETS : 03-types-de-blocs.js)
    var dl = function (nom, html) { var v = S(html); return [[para([txt(nom, { gras: true })])], [para(officeVide(v) ? [txt('—', { couleur: OFFICE_CLAIR.muted })] : v)]]; };
    out.push({ t: 'tableau', entete: false, lignes: (officeVide(S(b.title)) ? [] : [dl('Titre', b.title)]).concat(DIA_SOMMETS.map(function (s) { return dl(s.nom, b[s.cle]); })) });
    return out;
  },
  // modèle diamant (.dia) : titre semi-gras centré, puis grille 3 × 3 en losange (Adversaire en haut, Infrastructure à gauche, Capacité à droite,
  // Victime en bas : grid-template-areas de .dia-g) ; sommets bordés sur fond blanc, nom en étiquette, sommet vide « — » gris ; sans les traits du losange
  office: function (b, x) {
    var OFFICE_CADRE_LOSANGE = [[null, 'adversaire', null], ['infrastructure', null, 'capacite'], [null, 'victime', null]];
    var noms = {}, t = x.S(b.title);
    DIA_SOMMETS.forEach(function (s) { noms[s.cle] = s.nom; });
    var h = OFFICE_CADRE_LOSANGE.map(function (ligne, i) {
      return (i ? '<tr><td colspan="3" style="font-size:1pt;line-height:1pt;height:10pt">&nbsp;</td></tr>' : '') + '<tr>' + ligne.map(function (cle) {
        if (!cle) return '<td width="33%" style="font-size:1pt">&nbsp;</td>';
        var v = x.S(b[cle]);
        return officeCellule(officeCadreEtiquette(noms[cle], x) + '<p style="margin-top:1.5pt;margin-bottom:0pt">' + (officeVide(v) ? '<span style="color:' + x.C.muted + '">—</span>' : x.segs(v)) + '</p>',
          'background:' + x.C.surface + ';border:1px solid ' + x.C.line + ';padding:7.5pt 9pt', '33%');
      }).join('') + '</tr>';
    }).join('');
    return (officeVide(t) ? '' : '<p align="center" style="margin:0 0 6pt;text-align:center;font-family:' + OFFICE_POLICES.titre + ';font-weight:600">' + x.segs(t) + '</p>') + officeTable(h, 'margin:0 0 6pt');
  }
};
