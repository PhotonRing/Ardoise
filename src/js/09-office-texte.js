/* ---------- Copier pour Office : séparateur, image, formule (socle et point d'entrée : 08-office.js) ----------
   D'après page.css (tailles en points). Famille texte et titres : 06-bloc-texte.js ; filet fin (officeTxtFilet) : 08-office.js. */
OFFICE_RENDUS.divider = function (b, x) { return officeTxtFilet(x, '6pt', '6pt'); };
OFFICE_RENDUS.image = function (b, x) {
  if (!b.src) return '';
  var img = x.images[b.id] || { src: b.src }, l = img.l || 0, h = img.h || 0, leg = x.S(b.caption);
  var t = officeEchelle(l, h, OFFICE_LARGEUR); l = t[0]; h = t[1];
  return '<p align="center" style="' + OFFICE_P + 'text-align:center"><img src="' + esc(img.src) + '" alt="' + esc(b.alt || htmlText(b.caption)) + '"' + (l && h ? ' width="' + l + '" height="' + h + '"' : '') + ' style="border:1px solid ' + x.C.line + '"></p>' +
    (officeVide(leg) ? '' : '<p style="' + OFFICE_P + 'text-align:center;font-size:' + officePt(13) + ';color:' + x.C.muted + '">' + x.segs(leg, 13) + '</p>');
};
// bloc formule : image centrée, ramenée à la largeur de la page ; sans image, $$source$$ centré
OFFICE_RENDUS.formule = function (b, x) {
  var tex = String(b.tex || '').trim(), im = officeImageFormule(x.opts.formules, 'bloc', tex);
  if (!tex) return '';
  var p = '<p align="center" style="' + OFFICE_P + 'text-align:center">';
  if (!im) return p + esc('$$' + tex + '$$') + '</p>';
  var t = officeEchelle(im.l, im.h, OFFICE_LARGEUR);
  return p + '<img src="' + esc(im.src) + '" alt="' + esc(tex) + '" width="' + t[0] + '" height="' + t[1] + '"></p>';
};
