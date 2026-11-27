/* ---------- Famille texte et titres : en-tête, titre de section, sous-section, sous-titre, étape numérotée, texte, pied de page ----------
   Inscriptions (T) et leurs facettes : rendu (point d'entrée renderBlock, 07-rendu.js), elements et office (officeBloc
   et officeHtmlContenu, 08-office.js), reglages, normaliser et libelle selon le type. Le sous-titre est hérité : le bloc texte le
   remplace (« Convertir en texte »), il reste rendu, modifiable et exporté mais ne s'insère plus. */
T.header = {
  label: 'En-tête', ic: 'H1', desc: 'Surtitre, grand titre et chapeau', kw: 'titre entete header', make: function () { return { eyebrow: '', title: '', lede: '' }; }, sans: ['normaliser', 'libelle'],
  rendu: function (b, x) {
    var e = x.edit, f = x.f;
    return '<header class="b-header">' +
      (!b.noEyebrow && (e || b.eyebrow) ? f('span', 'eyebrow', 'eyebrow', b.eyebrow, { ph: 'Surtitre', nl: 1 }) : '') +
      f('h1', '', 'title', b.title, { ph: 'Titre de la page', nl: 1 }) +
      (!b.noLede && (e || !isBlank(b.lede)) ? f('p', 'lede', 'lede', b.lede, { ph: 'Chapeau : une ou deux phrases qui résument la page', nl: 1 }) : '') + '</header>';
  },
  reglages: function (b) { return tog('noEyebrow', !b.noEyebrow, 'Surtitre', 'Afficher le surtitre (son texte est conservé quand il est masqué)') + tog('noLede', !b.noLede, 'Chapeau', 'Afficher le chapeau (son texte est conservé quand il est masqué)'); },
  elements: function (b, x) {
    var S = x.S, para = x.para, out = [];
    if (!b.noEyebrow && !officeVide(S(b.eyebrow))) out.push(para(S(b.eyebrow), { style: 'surtitre' }));
    out.push({ t: 'titre', niveau: 0, segs: S(b.title) });
    if (!b.noLede && !officeVide(S(b.lede))) out.push(para(S(b.lede), { style: 'chapeau' }));
    return out;
  },
  office: function (b, x) {
    var h = '';
    if (!b.noEyebrow && !officeVide(x.S(b.eyebrow))) h += officeEtiquette(x.S(b.eyebrow), x, { px: 12, couleur: x.acc, espace: '0.72pt', marges: 'margin:0pt 0pt 6pt' });
    // h1 d'Ardoise : 800, 40 px au bureau
    h += '<h1 style="margin:0pt 0pt 6pt;font-family:' + OFFICE_POLICES.texte + ';font-size:' + officePt(40) + ';font-weight:bold;line-height:1.1;color:' + x.C.fg + '">' + x.segs(x.S(b.title), 40) + '</h1>';
    if (!b.noLede && !officeVide(x.S(b.lede))) h += '<p style="' + OFFICE_P + 'font-size:' + officePt(15) + ';color:' + x.C.muted + '">' + x.segs(x.S(b.lede)) + '</p>';
    return h;
  }
};
T.h2 = {
  label: 'Titre de section', ic: 'H2', desc: 'Titre intermédiaire', kw: 'titre heading', make: function () { return { html: '' }; }, sans: ['reglages', 'normaliser', 'libelle'],
  rendu: function (b, x) { return x.f('h2', '', 'html', b.html, { ph: 'Titre de section', nl: 1 }); },
  elements: function (b, x) { return [{ t: 'titre', niveau: 1, segs: x.S(b.html) }]; },
  office: function (b, x) { return officeTxtTitre('h1', 21, x.segs(x.S(b.html), 21), x); }
};
T.h3 = {
  label: 'Sous-section', ic: 'H3', desc: 'Niveau sous la section, repris dans le sommaire', kw: 'titre heading sous-section sous section', make: function () { return { html: '' }; }, sans: ['reglages', 'normaliser', 'libelle'],
  rendu: function (b, x) { return x.f('h3', '', 'html', b.html, { ph: 'Sous-section', nl: 1 }); },
  elements: function (b, x) { return [{ t: 'titre', niveau: 2, segs: x.S(b.html) }]; },
  office: function (b, x) { return officeTxtTitre('h2', 15, x.segs(x.S(b.html)), x); }
};
T.subtitle = {
  label: 'Sous-titre', ic: 'T', desc: 'Petit titre, hors du sommaire', kw: 'titre sous-titre intertitre', make: function () { return { html: '' }; }, sans: ['reglages', 'normaliser', 'libelle'],
  rendu: function (b, x) { return x.f('p', 'subtitle', 'html', b.html, { ph: 'Sous-titre', nl: 1 }); },
  elements: function (b, x) { return [{ t: 'titre', niveau: 3, segs: x.S(b.html) }]; },
  office: function (b, x) { return officeTxtTitre('h3', 15, x.segs(x.S(b.html)), x); }
};
T.step = {
  label: 'Étape numérotée', ic: '1.', desc: 'Ouvre une section avec pastille de numéro', kw: 'etape section numero step', make: function () { return { num: '', title: '', nonum: false }; }, sans: ['normaliser', 'libelle'],
  rendu: function (b, x) {
    var e = x.edit, num = x.num, badge = '';
    if (num !== null) badge = e ? '<span class="num fld" contenteditable="true" data-b="' + b.id + '" data-k="num" data-nl data-ph="' + esc(num) + '">' + esc(b.num) + '</span>' : '<span class="num">' + esc(num) + '</span>';
    return '<div class="step-head">' + badge + x.f('h2', '', 'title', b.title, { ph: 'Titre de l’étape', nl: 1 }) + '</div>';
  },
  reglages: function (b) { return tog('nonum', !b.nonum, '#', 'Afficher le numéro') ; },
  elements: function (b, x) {
    var num = stepNums(x.d.pages[x.pi].blocks)[b.id];
    return [{ t: 'titre', niveau: 1, segs: (num ? [x.txt(num + ' ')] : []).concat(x.S(b.title)) }];
  },
  office: function (b, x) {
    // filet de section.step, puis numéro teinté à côté du titre (deux cellules ; Writer ignore le padding : la largeur de 6 % fait la pastille)
    var num = stepNums(x.d.pages[x.pi].blocks)[b.id], filet = officeTxtFilet(x, '12pt', '9pt');
    var titre = officeTxtTitre('h1', 21, x.segs(x.S(b.title), 21), x, 'margin:0pt');
    if (!num) return filet + titre;
    return filet + officeTable('<tr>' +
      officeCellule(esc(num), 'background:' + x.accSoft + ';color:' + x.acc + ';font-weight:bold;padding:4.5pt 6.75pt;text-align:center;white-space:nowrap', '6%', 'middle') +
      // retrait du titre : Writer ne l'applique qu'à une cellule bordée (bordure de la couleur du fond)
      officeCellule(titre, 'border:1px solid ' + x.C.surface + ';padding:0pt 0pt 0pt 9pt', '94%', 'middle') + '</tr>', 'margin:0 0 6pt');
  }
};
T.texte = {
  label: 'Texte', ic: '≡', desc: 'Texte courant, ligne par ligne', kw: 'texte paragraphe ligne liste puces numerotee cases cocher sous-titre', make: function () { return { lignes: [{ html: '' }] }; }, sans: ['reglages'],
  rendu: function (b, x) { return texteHTML(b, x.edit); },
  normaliser: function (nb) { nb.lignes = normLignes(nb.lignes); },   // au moins une ligne (05-lignes.js)
  libelle: function (ba, b) {
    if (Array.isArray(ba.lignes) && Array.isArray(b.lignes) && libelleSans(ba, 'lignes') === libelleSans(b, 'lignes') &&
      ba.lignes.length === b.lignes.length && JSON.stringify(ba.lignes) !== JSON.stringify(b.lignes) &&
      libelleTri(ba.lignes) === libelleTri(b.lignes)) return 'lignes réordonnées';   // cochées à la fin
    return null;
  },
  elements: function (b, x) {
    // texte → paragraphe à son retrait ; sous-titre → titre de niveau 3 ; suite de puces, numéros et cases → un élément liste
    // (items à genre et numéro affiché). serre : pas d'espace après (sauf la dernière ligne, comme .texte .lg) ; ligne : gardée
    // vide dans le texte brut ; alignement et taille : réglages de la ligne
    var S = x.S, para = x.para, out = [];
    var ls = normLignes(b.lignes), nums = numerosDesLignes(ls), suite = null;
    ls.forEach(function (l, i) {
      var o = {}, lv = Math.min(LIGNE_LV_MAX, niveauDe(l)), dernier = i === ls.length - 1;
      if (l.align) o.alignement = l.align;
      if (l.taille) o.taille = l.taille;
      if (GENRES_LISTE.indexOf(l.genre) >= 0) {
        var it = { niveau: lv, segs: S(l.html), genre: l.genre }; for (var k in o) it[k] = o[k];
        if (l.genre === 'numero') it.n = nums[i];
        if (l.genre === 'case') it.coche = !!l.done;
        if (!suite) { suite = { t: 'liste', ordonnee: false, items: [] }; out.push(suite); }
        suite.items.push(it); suite.serre = !dernier;
        return;
      }
      suite = null;
      if (lv) o.retrait = lv;
      if (!dernier) o.serre = true;
      o.ligne = true;
      if (l.genre === 'soustitre') { o.t = 'titre'; o.niveau = 3; o.segs = S(l.html); out.push(o); return; }
      out.push(para(S(l.html), o));
    });
    return out;
  },
  // listes par lignesEnListes (<ol start> = numéro d'Ardoise, puces •◦▪ selon le niveau), cases en <p> ☐/☑ (Writer remet des puces
  // à un <li>) ; 30 px de retrait par niveau, 6 pt après la dernière ligne ; text-align lu par Writer sur <p>, <h3> et <li> ; ligne
  // vide en &nbsp; (Writer réduit un <p> vide)
  office: function (b, x) {
    var PUCES = ['disc', 'circle', 'square'];
    var ls = normLignes(b.lignes), der = ls.length - 1;
    var apres = function (i) { return i === der ? '6pt' : '0pt'; };
    // morceaux de style terminés par « ; »
    var retrait = function (l) { return niveauDe(l) ? 'margin-left:' + officePt(30 * niveauDe(l)) + ';' : ''; };   // niveau borné par normLignes
    var reglages = function (l) { return (l.align ? 'text-align:' + LIGNE_ALIGNEMENTS[l.align].css + ';' : '') + (l.taille ? 'font-size:' + officePt(LIGNE_TAILLES_PX[l.taille]) + ';' : ''); };
    var contenu = function (l) { return x.segs(x.S(l.html), l.taille ? LIGNE_TAILLES_PX[l.taille] : 15); };
    return lignesEnListes(ls, numerosDesLignes(ls), {
      liste: function (tag, n, haut, num) {
        var type = tag === 'ul' ? PUCES[n % 3] : '1';
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
  }
};
T.footer = {
  label: 'Pied de page', ic: '§', desc: 'Sources, auteur, date', kw: 'pied footer sources', make: function () { return { html: '' }; }, sans: ['reglages', 'normaliser', 'libelle'],
  rendu: function (b, x) { return '<footer class="b-foot">' + x.f('div', '', 'html', b.html, { ph: 'Sources, auteur, date…', ml: 1 }) + '</footer>'; },
  elements: function (b, x) { return [x.para(x.S(b.html), { style: 'pied' })]; },
  office: function (b, x) { return '<p style="margin-top:12pt;margin-bottom:6pt;padding-top:12pt;border-top:1px solid ' + x.C.line + ';font-size:' + officePt(13) + ';color:' + x.C.muted + '">' + x.segs(x.S(b.html), 13) + '</p>'; }
};
// bloc texte : un seul champ, un élément par ligne (une ligne vide garde sa hauteur par un <br>) ; genre, numéro calculé,
// coche, alignement et taille en attributs : puce, numéro et case sont dessinés par page.css (::before), hors du texte éditable
function lignesHTML(lignes) {
  var ls = normLignes(lignes), nums = numerosDesLignes(ls);   // niveau borné (LIGNE_LV_MAX), genre, coche, alignement et taille validés
  return ls.map(function (l, i) {
    var h = R(l.html);
    return '<div class="lg"' + (l.lv ? ' data-lv="' + l.lv + '"' : '') + (l.genre ? ' data-g="' + l.genre + '"' : '') +
      (nums[i] ? ' data-n="' + nums[i] + '"' : '') + (l.done ? ' data-done' : '') +
      (l.align ? ' data-align="' + l.align + '"' : '') + (l.taille ? ' data-taille="' + l.taille + '"' : '') + '>' + (h || '<br>') + '</div>';
  }).join('');
}
// bloc vide : une seule ligne de texte (sans genre), vide et sans retrait (lu aussi par la saisie, 12-bloc-texte.js et 12-saisie.js)
function texteVide(lignes) { return lignes.length === 1 && !(lignes[0].lv > 0) && !lignes[0].genre && isBlank(lignes[0].html); }
function texteHTML(b, e) {
  var ls = b.lignes && b.lignes.length ? b.lignes : [{ html: '' }];
  if (!e) return '<div data-tx="' + b.id + '" class="texte">' + lignesHTML(ls) + '</div>';   // data-tx : cases cochées de l'export statique (01-lecture.js)
  return '<div class="texte fld soft" contenteditable="true" spellcheck="true" data-b="' + b.id + '" data-k="lignes" data-rich data-texte' + (texteVide(ls) ? ' data-vide' : '') +
    ' data-ph="Écrire, ou taper / pour insérer un bloc">' + lignesHTML(ls) + '</div>';
}
// titre : balise de l'export neutre (Titre 1 à 3 dans Word), pile Segoe UI Semibold, taille et graisse de page.css ; marges : 12 pt au-dessus, 6 pt dessous
function officeTxtTitre(tag, px, contenu, x, marges) {
  return '<' + tag + ' style="' + (marges || 'margin-top:12pt;margin-bottom:6pt') + ';font-family:' + OFFICE_POLICES.titre + ';font-size:' + officePt(px) + ';font-weight:600;line-height:1.25;color:' + x.C.fg + '">' + contenu + '</' + tag + '>';
}
