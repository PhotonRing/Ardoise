/* ---------- Copier pour Office : famille Listes (socle et point d'entrée : 08-office.js) ----------
   Listes à puces et numérotées, listes à cocher, sommaire, d'après page.css (.list, ul.check, .toc-blk ; tailles en points). */
// puce de chaque profondeur (ul.list ul, ol.list ol… dans page.css), la dernière valant pour les suivantes : [attribut type, list-style-type]
var OFFICE_LISTE_PUCES = {
  ul: [['disc', 'disc'], ['circle', 'circle'], ['square', 'square']],
  ol: [['1', 'decimal'], ['a', 'lower-alpha'], ['i', 'lower-roman'], ['1', 'decimal']]
};
// balise ouvrante d'une liste : attribut type (Writer, Word) et list-style-type (Google Docs) ; .list ul : 6 px au-dessus
function officeListeOuvre(tag, profondeur) {
  var p = OFFICE_LISTE_PUCES[tag], s = p[Math.min(profondeur, p.length - 1)];
  return '<' + tag + ' type="' + s[0] + '" style="' + (profondeur ? 'margin-top:' + officePt(6) + ';margin-bottom:0pt' : 'margin:0pt 0pt 6pt') + ';list-style-type:' + s[1] + '">';
}
// éléments à plat avec un niveau, en listes imbriquées comme à l'écran (07-rendu.js) : un niveau ne descend que d'un cran à la fois
OFFICE_RENDUS.list = function (b, x) {
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
};
// cases à cocher (liste à cocher, cartes) : un paragraphe par case, jamais de <li> (Writer remet des puces à partir de la 2e ligne) ;
// case cochée en accent, libellé coché en gris (ul.check input:checked+label), retrait de 26 px par niveau (ul.check li.lv-N), 6 px entre les cases
function officeListeCases(arr, ordre, x) {
  return ordre.map(function (i) {
    var it = arr[i], lv = Math.min(6, Math.max(0, +it.lv || 0)), libelle = x.segs(x.S(it.html));
    return '<p style="margin-top:0pt;margin-bottom:' + officePt(6) + (lv ? ';margin-left:' + officePt(26 * lv) : '') + '">' +
      (it.done ? '<span style="color:' + x.acc + '">☑</span> <span style="color:' + x.C.muted + '">' + libelle + '</span>' : '<span style="color:' + x.C.muted + '">☐</span> ' + libelle) + '</p>';
  }).join('');
}
OFFICE_RENDUS.check = function (b, x) {
  return officeListeCases(b.items, b.order === 'doneFirst' || b.order === 'doneLast' ? checkOrder(b.items, b.order) : b.items.map(function (it, k) { return k; }), x);
};
// sommaire (.toc-blk) : cadre d'une cellule sur fond blanc, bordure line et trait accent de 3 px à gauche ; titre en étiquette ;
// entrées en paragraphes (une liste sans puce redeviendrait une liste à puces dans Writer), numéro Consolas accent (.toc-n),
// sous-niveaux en retrait de 22 px, à 14 px ; texte noir sans soulignement, comme à l'écran. Sans entrée : la phrase grise de l'édition
OFFICE_RENDUS.summary = function (b, x) {
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
};
