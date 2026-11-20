/* ---------- Copier pour Office : famille Texte (socle et point d'entrée : 08-office.js) ----------
   En-tête, titres, étape numérotée, paragraphe, pied de page, séparateur, image, d'après page.css (tailles en points). */
// titre : balise de l'export neutre (Titre 1 à 3 dans Word), pile Segoe UI Semibold, taille et graisse de page.css ; marges : 12 pt au-dessus, 6 pt dessous
function officeTxtTitre(tag, px, contenu, x, marges) {
  return '<' + tag + ' style="' + (marges || 'margin-top:12pt;margin-bottom:6pt') + ';font-family:' + OFFICE_POLICES.titre + ';font-size:' + officePt(px) + ';font-weight:600;line-height:1.25;color:' + x.C.fg + '">' + contenu + '</' + tag + '>';
}
// filet fin : paragraphe vide bordé en haut (Writer dessine un <hr> en trait sombre, sans sa couleur)
function officeTxtFilet(x, avant, apres) { return '<p style="margin-top:' + avant + ';margin-bottom:' + apres + ';border-top:1px solid ' + x.C.line + ';font-size:1pt;line-height:1pt">&nbsp;</p>'; }
OFFICE_RENDUS.header = function (b, x) {
  var h = '';
  if (!b.noEyebrow && !officeVide(x.S(b.eyebrow))) h += officeEtiquette(x.S(b.eyebrow), x, { px: 12, couleur: x.acc, espace: '0.72pt', marges: 'margin:0pt 0pt 6pt' });
  // h1 d'Ardoise : 800, 40 px au bureau
  h += '<h1 style="margin:0pt 0pt 6pt;font-family:' + OFFICE_POLICES.texte + ';font-size:' + officePt(40) + ';font-weight:bold;line-height:1.1;color:' + x.C.fg + '">' + x.segs(x.S(b.title)) + '</h1>';
  if (!b.noLede && !officeVide(x.S(b.lede))) h += '<p style="' + OFFICE_P + 'font-size:' + officePt(15) + ';color:' + x.C.muted + '">' + x.segs(x.S(b.lede)) + '</p>';
  return h;
};
OFFICE_RENDUS.h2 = function (b, x) { return officeTxtTitre('h1', 21, x.segs(x.S(b.html)), x); };
OFFICE_RENDUS.h3 = function (b, x) { return officeTxtTitre('h2', 15, x.segs(x.S(b.html)), x); };
OFFICE_RENDUS.subtitle = function (b, x) { return officeTxtTitre('h3', 15, x.segs(x.S(b.html)), x); };
OFFICE_RENDUS.step = function (b, x) {
  // filet de section.step, puis numéro teinté à côté du titre (deux cellules ; Writer ignore le padding : la largeur de 6 % fait la pastille)
  var num = stepNums(x.d.pages[x.pi].blocks)[b.id], filet = officeTxtFilet(x, '12pt', '9pt');
  var titre = officeTxtTitre('h1', 21, x.segs(x.S(b.title)), x, 'margin:0pt');
  if (!num) return filet + titre;
  return filet + officeTable('<tr>' +
    officeCellule(esc(num), 'background:' + x.accSoft + ';color:' + x.acc + ';font-weight:bold;padding:4.5pt 6.75pt;text-align:center;white-space:nowrap', '6%', 'middle') +
    // retrait du titre : Writer ne l'applique qu'à une cellule bordée (bordure de la couleur du fond)
    officeCellule(titre, 'border:1px solid ' + x.C.surface + ';padding:0pt 0pt 0pt 9pt', '94%', 'middle') + '</tr>', 'margin:0 0 6pt');
};
// bloc texte : listes par lignesEnListes (<ol start> = numéro d'Ardoise, puces •◦▪ selon le niveau), cases en <p> ☐/☑ (Writer
// remet des puces à un <li>) ; 30 px de retrait par niveau, 6 pt après la dernière ligne ; text-align lu par Writer sur <p>, <h3>
// et <li> ; ligne vide en &nbsp; (Writer réduit un <p> vide)
var OFFICE_TEXTE_PUCES = ['disc', 'circle', 'square'];
OFFICE_RENDUS.texte = function (b, x) {
  var ls = normLignes(b.lignes), der = ls.length - 1;
  var apres = function (i) { return i === der ? '6pt' : '0pt'; };
  // morceaux de style terminés par « ; »
  var retrait = function (l) { return niveauDe(l) ? 'margin-left:' + officePt(30 * niveauDe(l)) + ';' : ''; };   // niveau borné par normLignes
  var reglages = function (l) { return (l.align ? 'text-align:' + LIGNE_ALIGNEMENTS[l.align].css + ';' : '') + (l.taille ? 'font-size:' + officePt(LIGNE_TAILLES_PX[l.taille]) + ';' : ''); };
  var contenu = function (l) { return x.segs(x.S(l.html)); };
  return lignesEnListes(ls, numerosDesLignes(ls), {
    liste: function (tag, n, haut, num) {
      var type = tag === 'ul' ? OFFICE_TEXTE_PUCES[n % 3] : '1';
      return '<' + tag + ' type="' + type + '"' + (tag === 'ol' && num && num !== 1 ? ' start="' + num + '"' : '') + ' style="' +
        (haut ? 'margin-top:0pt;margin-bottom:0pt' : 'margin:0pt 0pt 0pt' + (n ? ';margin-left:' + officePt(30 * n) : '')) + ';list-style-type:' + (tag === 'ul' ? type : 'decimal') + '">';
    },
    li: function (l, i) { return '<li style="margin-top:0pt;margin-bottom:' + apres(i) + ';' + reglages(l) + '">' + (contenu(l) || '&nbsp;'); },
    ligne: function (l, i) {
      var h = contenu(l);
      if (l.genre === 'soustitre') return officeTxtTitre('h3', 15, h || '&nbsp;', x, ('margin-top:' + officePt(8) + ';margin-bottom:' + apres(i) + ';' + retrait(l) + reglages(l)).replace(/;$/, ''));
      var marges = 'margin:0pt 0pt ' + apres(i) + ';' + retrait(l) + reglages(l);
      var m = marqueDeLigne(l).trim();
      if (l.genre === 'case') return '<p style="' + marges + '">' + (l.done ? '<span style="color:' + x.acc + '">' + m + '</span> <span style="color:' + x.C.muted + '">' + h + '</span>' : '<span style="color:' + x.C.muted + '">' + m + '</span> ' + h) + '</p>';
      return '<p style="' + marges + '">' + (h || '&nbsp;') + '</p>';
    }
  });
};
OFFICE_RENDUS.footer = function (b, x) { return '<p style="margin-top:12pt;margin-bottom:6pt;padding-top:12pt;border-top:1px solid ' + x.C.line + ';font-size:' + officePt(13) + ';color:' + x.C.muted + '">' + x.segs(x.S(b.html)) + '</p>'; };
OFFICE_RENDUS.divider = function (b, x) { return officeTxtFilet(x, '6pt', '6pt'); };
OFFICE_RENDUS.image = function (b, x) {
  if (!b.src) return '';
  var img = x.images[b.id] || { src: b.src }, l = img.l || 0, h = img.h || 0, leg = x.S(b.caption);
  var t = officeEchelle(l, h, OFFICE_LARGEUR); l = t[0]; h = t[1];
  return '<p align="center" style="' + OFFICE_P + 'text-align:center"><img src="' + esc(img.src) + '" alt="' + esc(b.alt || htmlText(b.caption)) + '"' + (l && h ? ' width="' + l + '" height="' + h + '"' : '') + ' style="border:1px solid ' + x.C.line + '"></p>' +
    (officeVide(leg) ? '' : '<p style="' + OFFICE_P + 'text-align:center;font-size:' + officePt(13) + ';color:' + x.C.muted + '">' + x.segs(leg) + '</p>');
};
