/* ---------- Copier pour Office : famille Texte (socle et point d'entrée : 08-office.js) ----------
   En-tête, titres, étape numérotée, paragraphe, pied de page, séparateur, image, d'après page.css (tailles en points). */
var OFFICE_TXT_P = 'margin:0 0 6pt;';
// titre : balise de l'export neutre (Titre 1 à 3 dans Word), pile Segoe UI Semibold, taille et graisse de page.css
function officeTxtTitre(tag, px, contenu, x) {
  return '<' + tag + ' style="margin-top:12pt;margin-bottom:6pt;font-family:' + OFFICE_POLICES.titre + ';font-size:' + officePt(px) + ';font-weight:600;line-height:1.25;color:' + x.C.fg + '">' + contenu + '</' + tag + '>';
}
// filet fin : paragraphe vide bordé en haut (Writer dessine un <hr> en trait sombre, sans sa couleur)
function officeTxtFilet(x, avant, apres) { return '<p style="margin-top:' + avant + ';margin-bottom:' + apres + ';border-top:1px solid ' + x.C.line + ';font-size:1pt;line-height:1pt">&nbsp;</p>'; }
OFFICE_RENDUS.header = function (b, x) {
  var h = '';
  if (!b.noEyebrow && !officeVide(x.S(b.eyebrow))) h += '<p style="' + OFFICE_TXT_P + 'font-family:' + OFFICE_POLICES.mono + ';font-size:' + officePt(12) + ';letter-spacing:.72pt;text-transform:uppercase;color:' + x.acc + '">' + x.segs(officeMajuscules(x.S(b.eyebrow))) + '</p>';
  // h1 d'Ardoise : 800, 40 px au bureau
  h += '<h1 style="margin:0 0 6pt;font-family:' + OFFICE_POLICES.texte + ';font-size:' + officePt(40) + ';font-weight:bold;line-height:1.1;color:' + x.C.fg + '">' + x.segs(x.S(b.title)) + '</h1>';
  if (!b.noLede && !officeVide(x.S(b.lede))) h += '<p style="' + OFFICE_TXT_P + 'font-size:' + officePt(15) + ';color:' + x.C.muted + '">' + x.segs(x.S(b.lede)) + '</p>';
  return h;
};
OFFICE_RENDUS.h2 = function (b, x) { return officeTxtTitre('h1', 21, x.segs(x.S(b.html)), x); };
OFFICE_RENDUS.h3 = function (b, x) { return officeTxtTitre('h2', 15, x.segs(x.S(b.html)), x); };
OFFICE_RENDUS.subtitle = function (b, x) { return officeTxtTitre('h3', 15, x.segs(x.S(b.html)), x); };
OFFICE_RENDUS.step = function (b, x) {
  // filet de section.step, puis numéro teinté à côté du titre (deux cellules ; Writer ignore le padding : la largeur de 6 % fait la pastille)
  var num = stepNums(x.d.pages[x.pi].blocks)[b.id], filet = officeTxtFilet(x, '12pt', '9pt');
  var titre = '<h1 style="margin:0;font-family:' + OFFICE_POLICES.titre + ';font-size:' + officePt(21) + ';font-weight:600;line-height:1.25;color:' + x.C.fg + '">' + x.segs(x.S(b.title)) + '</h1>';
  if (!num) return filet + titre;
  return filet + officeTable('<tr>' +
    officeCellule(esc(num), 'background:' + x.accSoft + ';color:' + x.acc + ';font-weight:bold;padding:4.5pt 6.75pt;text-align:center;vertical-align:middle;white-space:nowrap', '6%') +
    officeCellule(titre, 'padding:0 0 0 9pt;vertical-align:middle', '94%') + '</tr>', 'margin:0 0 6pt');
};
// retrait : 2em de 15 px par niveau (p.ind-N)
OFFICE_RENDUS.p = function (b, x) { return '<p style="' + OFFICE_TXT_P + (b.indent > 0 ? 'margin-left:' + officePt(30 * Math.min(6, +b.indent)) + ';' : '') + '">' + x.segs(x.S(b.html)) + '</p>'; };
OFFICE_RENDUS.footer = function (b, x) { return '<p style="margin-top:12pt;margin-bottom:6pt;padding-top:12pt;border-top:1px solid ' + x.C.line + ';font-size:' + officePt(13) + ';color:' + x.C.muted + '">' + x.segs(x.S(b.html)) + '</p>'; };
OFFICE_RENDUS.divider = function (b, x) { return officeTxtFilet(x, '6pt', '6pt'); };
OFFICE_RENDUS.image = function (b, x) {
  if (!b.src) return '';
  var img = x.images[b.id] || { src: b.src }, l = img.l || 0, h = img.h || 0, leg = x.S(b.caption);
  if (l > OFFICE_LARGEUR) { h = Math.round(h * OFFICE_LARGEUR / l); l = OFFICE_LARGEUR; }
  return '<p align="center" style="' + OFFICE_TXT_P + 'text-align:center"><img src="' + esc(img.src) + '" alt="' + esc(b.alt || htmlText(b.caption)) + '"' + (l && h ? ' width="' + l + '" height="' + h + '"' : '') + ' style="border:1px solid ' + x.C.line + '"></p>' +
    (officeVide(leg) ? '' : '<p style="' + OFFICE_TXT_P + 'text-align:center;font-size:' + officePt(13) + ';color:' + x.C.muted + '">' + x.segs(leg) + '</p>');
};
