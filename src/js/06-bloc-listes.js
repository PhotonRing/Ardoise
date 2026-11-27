/* ---------- Famille listes et tableaux : liste (héritée), liste à cocher (héritée), sommaire, tableau ----------
   Les six facettes y figurent (exemple à copier). Office d'après page.css (.list, ul.check, .toc-blk, .tablewrap), tailles en points.
   Restent au socle, partagées avec les cartes et le Bloc requête : l'aide checks, officeListeCases, officeTabTableau. */

/* ---------- Liste (héritée : le bloc texte la remplace, « Convertir en texte ») ---------- */
// balise ouvrante d'une liste : attribut type (Writer, Word) et list-style-type (Google Docs) ; .list ul : 6 px au-dessus ;
// puce de chaque profondeur (ul.list ul, ol.list ol… dans page.css), la dernière valant pour les suivantes : [attribut type, list-style-type]
function officeListeOuvre(tag, profondeur) {
  var puces = {
    ul: [['disc', 'disc'], ['circle', 'circle'], ['square', 'square']],
    ol: [['1', 'decimal'], ['a', 'lower-alpha'], ['i', 'lower-roman'], ['1', 'decimal']]
  };
  var p = puces[tag], s = p[Math.min(profondeur, p.length - 1)];
  return '<' + tag + ' type="' + s[0] + '" style="' + (profondeur ? 'margin-top:' + officePt(6) + ';margin-bottom:0pt' : 'margin:0pt 0pt 6pt') + ';list-style-type:' + s[1] + '">';
}
T.list = { label: 'Liste', ic: '•', desc: 'Liste à puces ou numérotée', kw: 'liste puces numerotee', make: function () { return { ordered: false, items: [{ html: '' }] }; }, sans: ['libelle'],
  rendu: function (b, x) {
    var e = x.edit, f = x.f;
    // éléments à plat avec un niveau (lv) : rendus en listes imbriquées
    var tg = b.ordered ? 'ol' : 'ul', cur = -1, lo = '';
    b.items.forEach(function (it, i) {
      var lv = Math.max(0, Math.min(+it.lv || 0, cur + 1));
      if (cur < 0) { lo += '<' + tg + ' class="list">'; cur = 0; }
      else if (lv > cur) { lo += '<' + tg + '>'; cur = lv; }
      else { lo += '</li>'; while (cur > lv) { lo += '</' + tg + '></li>'; cur--; } }
      lo += '<li>' + (e ? f('span', '', 'items.' + i + '.html', it.html, { li: 1, ph: 'Élément' }) : R(it.html));
    });
    if (cur < 0) return '<' + tg + ' class="list"></' + tg + '>';
    lo += '</li>'; while (cur > 0) { lo += '</' + tg + '></li>'; cur--; }
    return lo + '</' + tg + '>';
  },
  reglages: function (b) { return tog('ordered', b.ordered, '1.', 'Liste numérotée'); },
  elements: function (b, x) {
    var S = x.S;
    return [{ t: 'liste', ordonnee: !!b.ordered, items: b.items.map(function (it) { return { niveau: Math.max(0, +it.lv || 0), segs: S(it.html) }; }) }];
  },
  // éléments à plat avec un niveau, en listes imbriquées comme à l'écran : un niveau ne descend que d'un cran à la fois
  office: function (b, x) {
    var tg = b.ordered ? 'ol' : 'ul', cur = -1, h = '';
    b.items.forEach(function (it) {
      var lv = Math.max(0, Math.min(+it.lv || 0, cur + 1));
      if (cur < 0) { h += officeListeOuvre(tg, 0); cur = 0; }
      else if (lv > cur) { h += officeListeOuvre(tg, lv); cur = lv; }
      else { h += '</li>'; while (cur > lv) { h += '</' + tg + '></li>'; cur--; } }
      // écart entre éléments : 8 px au premier niveau, 6 px dessous (.list, .list ul)
      h += '<li style="margin-top:0pt;margin-bottom:' + officePt(lv ? 6 : 8) + '">' + x.segs(x.S(it.html));
    });
    if (cur < 0) return '';
    h += '</li>'; while (cur > 0) { h += '</' + tg + '></li>'; cur--; }
    return h + '</' + tg + '>';
  },
  normaliser: function (nb) {
    if (Array.isArray(nb.items)) nb.items = nb.items.map(function (h) { return h && typeof h === 'object' ? h : { html: String(h == null ? '' : h) }; });   // JSON écrit à la main
  }
};

/* ---------- Liste à cocher (héritée : le bloc texte la remplace, « Convertir en texte ») ---------- */
function checkOrder(arr, order) {
  // indices des éléments dans l'ordre d'affichage : à chaque niveau, cochés avant ou après les autres (tri stable)
  var root = { kids: [] }, stack = [{ lv: -1, n: root }];
  arr.forEach(function (it, i) {
    var lv = +it.lv || 0, n = { i: i, done: !!it.done, kids: [] };
    while (stack.length > 1 && stack[stack.length - 1].lv >= lv) stack.pop();
    stack[stack.length - 1].n.kids.push(n); stack.push({ lv: lv, n: n });
  });
  var out = [];
  (function walk(list) {
    list.map(function (n, k) { return { n: n, k: k }; }).sort(function (x, y) {
      var dx = x.n.done ? 1 : 0, dy = y.n.done ? 1 : 0; if (order === 'doneFirst') { dx = 1 - dx; dy = 1 - dy; }
      return dx - dy || x.k - y.k;
    }).forEach(function (x) { out.push(x.n.i); walk(x.n.kids); });
  })(root.kids);
  return out;
}
// indices des cases dans l'ordre d'affichage choisi (order) : l'ordre saisi reste celui du document, les sous-cases suivent leur parent
function ordreCases(arr, order) { return order === 'doneFirst' || order === 'doneLast' ? checkOrder(arr, order) : arr.map(function (it, k) { return k; }); }
T.check = { label: 'Liste à cocher', ic: '☑', desc: 'Cases enregistrées dans le fichier', kw: 'checklist cases cocher todo', make: function () { return { items: [{ html: '', done: false }] }; }, sans: ['normaliser', 'libelle'],
  rendu: function (b, x) { return x.checks('items', b.items, ordreCases(b.items, b.order)); },
  reglages: function (b) {
    return act('item-add', '+ case', 'Ajouter une case', ' data-k="items"') + act('check-reset', '↺', 'Tout décocher') +
      '<select data-act="set" data-prop="order" title="Ordre d’affichage (l’ordre saisi est conservé)">' + opt('manual', b.order || 'manual', 'Ordre saisi') + opt('doneFirst', b.order, 'Cochées en premier') + opt('doneLast', b.order, 'Cochées à la fin') + '</select>';
  },
  elements: function (b, x) {
    var out = [];
    if (b.items.length) out.push(x.cases(b.items, ordreCases(b.items, b.order)));
    return out;
  },
  office: function (b, x) {
    return officeListeCases(b.items, ordreCases(b.items, b.order), x);
  }
};

/* ---------- Sommaire ---------- */
function summaryDepth(b) {
  // nombre de niveaux affichés (0 : tous) ; blocs plus anciens : « deep » (sous-niveaux oui / non)
  if (b.depth != null && b.depth !== '') return Math.max(0, +b.depth || 0);
  return b.deep === false ? 1 : 0;
}
function summaryItems(b, d, pi) {
  // entrées du bloc sommaire de la page pi : [{ t, h (HTML assaini du titre, formules rendues par l'appelant), n, href, kids }]
  var pages = d.pages, pg = pages[pi], cmp = function (x, y) { return x.t.localeCompare(y.t, 'fr', { numeric: true, sensitivity: 'base' }); }, out = [], dp = summaryDepth(b);
  if (b.src === 'pages') {
    var mkp = function (j, lv) { return { t: pageTitle(pages[j], j), h: titrePageHTML(pages[j], j), href: '#pg-' + pages[j].id, kids: !dp || lv < dp ? pageKids(pages, j).map(function (k) { return mkp(k, lv + 1); }) : [] }; };
    out = pageKids(pages, pi).map(function (j) { return mkp(j, 1); });
  } else {
    sectionsOf(pg).forEach(function (x) {
      var it = { t: x.t, h: x.h, n: x.n, href: '#pg-' + pg.id + '/' + x.id, kids: [] };
      if (x.lv === 1 || !out.length) out.push(it); else if (dp !== 1) out[out.length - 1].kids.push(it);
    });
  }
  if (b.sort === 'alpha') (function srt(arr) { arr.sort(cmp); arr.forEach(function (it) { srt(it.kids); }); })(out);
  return out;
}
// liste rendue (aussi tenue à jour pendant la saisie, 07-rendu.js) ; '' sans entrée
function summaryList(b, d, pi) {
  var items = summaryItems(b, d, pi);
  function ol(arr) { return '<ol>' + arr.map(function (it) { return '<li><a href="' + esc(it.href) + '">' + (it.n ? '<span class="toc-n">' + esc(it.n) + '</span>' : '') + '<span>' + (it.h != null ? it.h : esc(it.t)) + '</span></a>' + (it.kids.length ? ol(it.kids) : '') + '</li>'; }).join('') + '</ol>'; }
  return items.length ? ol(items) : '';
}
function summaryEmpty(b) {
  return '<p class="muted toc-blk-e">' + (b.src === 'pages' ? 'Cette page n’a pas encore de sous-pages : « + » à côté de son nom dans le sommaire, ou glissez-y une page.'
    : 'Aucune section dans cette page : ajoutez des titres de section, des étapes ou des sous-sections.') + '</p>';
}
T.summary = { label: 'Sommaire', ic: '☰', desc: 'Sections ou sous-pages de la page, tenu à jour', kw: 'sommaire table des matieres toc index sections sous-pages plan', make: function () { return { title: 'Sommaire', src: 'sec', sort: 'doc' }; }, sans: ['normaliser', 'libelle'],
  rendu: function (b, x) {
    var e = x.edit, f = x.f;
    var sl = summaryList(b, x.d, x.ctx.page);
    if (!e && !sl) return '';
    return '<nav class="toc-blk">' + ((e || b.title) ? f('p', 'toc-blk-t', 'title', b.title, { rich: false, ph: 'Titre (facultatif)', nl: 1 }) : '') +
      '<div class="toc-blk-l">' + (sl || summaryEmpty(b)) + '</div></nav>';
  },
  reglages: function (b) {
    return '<select data-act="set" data-prop="src" title="Contenu du sommaire">' + opt('sec', b.src, 'Sections') + opt('pages', b.src, 'Sous-pages') + '</select>' +
      '<select data-act="set" data-prop="sort" title="Ordre">' + opt('doc', b.sort, 'Ordre de la page') + opt('alpha', b.sort, 'Alphabétique') + '</select>' +
      '<select data-act="set" data-prop="depth" title="Nombre de niveaux affichés">' + (b.src === 'pages'
        ? opt(1, summaryDepth(b), '1 niveau') + opt(2, summaryDepth(b), '2 niveaux') + opt(3, summaryDepth(b), '3 niveaux') + opt(0, summaryDepth(b), 'Tous les niveaux')
        : opt(1, summaryDepth(b) === 1 ? 1 : 0, 'Sections seules') + opt(0, summaryDepth(b) === 1 ? 1 : 0, 'Sections et sous-sections')) + '</select>';
  },
  elements: function (b, x) {
    var txt = x.txt, para = x.para, out = [];
    if (b.title) out.push(para([txt(b.title, { gras: true })]));
    var entrees = [], parcours = function (arr, lv) { arr.forEach(function (it) { entrees.push({ niveau: lv, segs: [txt((it.n ? it.n + ' ' : '') + it.t, { interne: true, souligne: true })] }); parcours(it.kids, lv + 1); }); };
    parcours(summaryItems(b, x.d, x.pi), 0);
    if (entrees.length) out.push({ t: 'liste', ordonnee: false, items: entrees });
    return out;
  },
  // sommaire (.toc-blk) : cadre d'une cellule sur fond blanc, bordure line et trait accent de 3 px à gauche ; titre en étiquette ;
  // entrées en paragraphes (une liste sans puce redeviendrait une liste à puces dans Writer), numéro Consolas accent (.toc-n),
  // sous-niveaux en retrait de 22 px, à 14 px ; texte noir sans soulignement, comme à l'écran. Sans entrée : la phrase grise de l'édition
  office: function (b, x) {
    var h = b.title ? officeEtiquette(officeTexteSegs(b.title), x, { marges: 'margin:0pt 0pt 6pt' }) : '', entrees = [];
    (function parcours(arr, lv) {
      arr.forEach(function (it) {
        entrees.push('<p style="margin-top:0pt;margin-bottom:' + officePt(2) + (lv ? ';margin-left:' + officePt(22 * lv) + ';font-size:' + officePt(14) : '') + '">' +
          (it.n ? '<span style="font-family:' + OFFICE_POLICES.mono + ';font-size:' + officePt(12) + ';font-weight:600;color:' + x.acc + '">' + esc(it.n) + '</span>&nbsp;&nbsp;' : '') + esc(it.t) + '</p>');
        parcours(it.kids, lv + 1);
      });
    })(summaryItems(b, x.d, x.pi), 0);
    if (!entrees.length) h += '<p style="margin:0pt;font-size:' + officePt(13) + ';color:' + x.C.muted + '">' + esc(htmlText(summaryEmpty(b).replace(/<[^>]*>/g, ''))) + '</p>';
    return officeTable('<tr>' + officeCellule(h + entrees.join(''), 'background:' + x.C.surface + ';border:1px solid ' + x.C.line + ';border-left:3px solid ' + x.acc + ';padding:10.5pt 13.5pt', '100%') + '</tr>', 'margin:0 0 6pt');
  }
};

/* ---------- Tableau ---------- */
// une ligne ou une colonne ajoutée vide, ou retirée, et rien d'autre ; sinon null (collage et vidage d'une plage donnent leur nature)
function libelleGrille(ra, rb) {
  var J = JSON.stringify, i;
  var sansLigne = function (g, k) { return J(g.slice(0, k).concat(g.slice(k + 1))); };
  var sansCol = function (g, k) { return J(g.map(function (l) { return l.slice(0, k).concat(l.slice(k + 1)); })); };
  var colonne = function (g, k) { return g.map(function (l) { return l[k]; }); };
  var la = ra.length, lb = rb.length, ca = ra[0].length, cb = rb[0].length;
  if (ca === cb && lb === la + 1) for (i = 1; i < lb; i++) if (ligneVide(rb[i]) && sansLigne(rb, i) === J(ra)) return 'ligne ajoutée';
  if (ca === cb && la === lb + 1) for (i = 1; i < la; i++) if (sansLigne(ra, i) === J(rb)) return 'ligne supprimée';
  if (la === lb && cb === ca + 1) for (i = 0; i < cb; i++) if (ligneVide(colonne(rb, i).slice(1)) && sansCol(rb, i) === J(ra)) return 'colonne ajoutée';
  if (la === lb && ca === cb + 1) for (i = 0; i < ca; i++) if (sansCol(ra, i) === J(rb)) return 'colonne supprimée';
  return null;
}
T.table = { label: 'Tableau', ic: '▥', desc: 'Tableau avec ligne d’en-tête', kw: 'tableau table', make: function () { return { rows: [['Colonne', 'Colonne', 'Colonne'], ['', '', ''], ['', '', '']] }; }, sans: ['normaliser'],
  rendu: function (b, x) {
    var f = x.f, rows = b.rows;
    return '<div class="tablewrap"><table><thead><tr>' + rows[0].map(function (c, j) { return f('th', '', 'rows.0.' + j, c, { ph: 'En-tête', cell: 1 }); }).join('') +
      '</tr></thead><tbody>' + rows.slice(1).map(function (r, i) {
        return '<tr>' + r.map(function (c, j) { return f('td', '', 'rows.' + (i + 1) + '.' + j, c, { cell: 1 }); }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  },
  reglages: function (b) { return act('row-add', '+L', 'Ajouter une ligne') + act('col-add', '+C', 'Ajouter une colonne') + act('row-del', '−L', 'Supprimer la ligne active') + act('col-del', '−C', 'Supprimer la colonne active'); },
  elements: function (b, x) {
    var S = x.S, para = x.para;
    return [{ t: 'tableau', entete: true, lignes: b.rows.map(function (r) { return r.map(function (c) { return [para(S(c))]; }); }) }];
  },
  office: function (b, x) {
    var rows = b.rows || [];
    if (!rows.length) return '';
    return officeTabTableau(rows[0].map(function (c) { return x.S(c); }), rows.slice(1).map(function (r) { return r.map(function (c) { return x.segs(x.S(c)); }); }), x);
  },
  // ligne ou colonne ajoutée ou supprimée ; null : libellé générique (cellule modifiée…)
  libelle: function (ba, b) {
    if (Array.isArray(ba.rows) && Array.isArray(b.rows) && ba.rows.length && b.rows.length) return libelleGrille(ba.rows, b.rows);
    return null;
  }
};
