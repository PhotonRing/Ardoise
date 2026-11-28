/* ---------- Famille médias : image, bloc de code, formule, séparateur ----------
   Office d'après page.css (.fig, .code, .codebox, pre.cmd, .formule-bloc, hr.sep), tailles en points. Restent au socle : l'aide ta,
   opt, tog, act (07-rendu.js), officeTxtFilet, officeEchelle, officeImageFormule, officeTable, officeCellule, officeEtiquette (08-office.js). */

T.image = { label: 'Image', ic: '▣', desc: 'Intégrée au fichier', kw: 'image photo capture', make: function () { return { src: '', caption: '', alt: '' }; }, sans: ['normaliser', 'libelle'],
  rendu: function (b, x) {
    var e = x.edit, f = x.f;
    if (!b.src) return e ? '<div class="img-new"><div class="img-drop" data-act="img-pick" data-b="' + b.id + '">Cliquer, déposer ou coller une image</div>' +
      '<div class="img-url"><input class="menu-q img-url-in" data-b="' + b.id + '" placeholder="… ou l’adresse d’une image : https://…" spellcheck="false" autocomplete="off" inputmode="url">' +
      '<button type="button" class="ub" data-act="img-url" title="Télécharger l’image et l’intégrer au document">Intégrer</button></div>' +
      (isBlank(b.caption) ? '' : f('figcaption', '', 'caption', b.caption, { ph: 'Légende (optionnelle)', nl: 1 })) + '</div>' : '';   // légende : l'image à remettre (import Markdown)
    return '<figure class="fig"><img src="' + esc(b.src) + '" alt="' + esc(b.alt || textOf(b.caption)) + '">' +
      ((e || !isBlank(b.caption)) ? f('figcaption', '', 'caption', b.caption, { ph: 'Légende (optionnelle)', nl: 1 }) : '') + '</figure>';
  },
  reglages: function (b) { return b.src ? act('img-pick', 'Remplacer', 'Remplacer l’image par un fichier') + act('img-url', 'Adresse…', 'Remplacer l’image par une image en ligne (téléchargée et intégrée au document)') + act('img-alt', 'Alt', 'Texte alternatif') : ''; },
  elements: function (b, x) {
    var out = [];
    if (b.src) out.push(x.image(x.images[b.id] || { src: b.src }, b.alt || htmlText(b.caption), x.S(b.caption)));
    return out;
  },
  office: function (b, x) {
    if (!b.src) return '';
    var img = x.images[b.id] || { src: b.src }, l = img.l || 0, h = img.h || 0, leg = x.S(b.caption);
    var t = officeEchelle(l, h, OFFICE_LARGEUR); l = t[0]; h = t[1];
    return '<p align="center" style="' + OFFICE_P + 'text-align:center"><img src="' + esc(img.src) + '" alt="' + esc(b.alt || htmlText(b.caption)) + '"' + (l && h ? ' width="' + l + '" height="' + h + '"' : '') + ' style="border:1px solid ' + x.C.line + '"></p>' +
      (officeVide(leg) ? '' : '<p style="' + OFFICE_P + 'text-align:center;font-size:' + officePt(13) + ';color:' + x.C.muted + '">' + x.segs(leg, 13) + '</p>');
  },
  // adresse d'une image : Entrée la charge (imageUrlAction, 13-actions-blocs.js) ; le champ garde toutes ses touches
  saisie: {
    keydown: function (el, b, e) {
      if (!el.matches('.img-url-in')) return false;
      if (e.key === 'Enter') { e.preventDefault(); imageUrlAction(b, el); }
      return true;
    }
  }
};
T.code = { label: 'Bloc de code', ic: '{}', desc: 'Sombre, boîte avec fichier, ou commande', kw: 'code script commande terminal', make: function () { return { variant: 'dark', name: '', code: '', tall: false }; }, sans: ['normaliser', 'libelle'],
  rendu: function (b, x) {
    var e = x.edit, f = x.f, ta = x.ta;
    var clang = HL.resolve(b.lang, b.code, b.name);
    if (b.variant === 'box') {
      var lines = HL.lines(String(b.code).replace(/\n$/, ''), clang);
      return '<div class="codebox"><div class="bar">' + f('span', 'meta', 'name', b.name, { rich: false, ph: 'nom_du_fichier', nl: 1 }) +
        '<button class="btn-copy" type="button" data-copy>Copier</button></div>' +
        (e ? ta() : '<pre class="src' + (b.tall ? ' tall' : '') + '">' + lines.map(function (l) { return '<span class="l">' + l + '</span>'; }).join('') + '</pre>') + '</div>';
    }
    if (b.variant === 'cmd') return e ? ta('cmd') : '<pre class="cmd">' + HL.html(b.code, clang) + '</pre>';
    return '<div class="code' + (b.tall ? ' tall' : '') + ((e || b.name) ? ' named' : '') + '">' +
      (e ? f('span', 'code-name', 'name', b.name, { rich: false, ph: 'Nom (optionnel)', nl: 1 }) : (b.name ? '<span class="code-name">' + esc(b.name) + '</span>' : '')) +
      '<button class="copy" type="button" data-copy>Copier</button>' +
      (e ? ta() : '<pre>' + HL.html(b.code, clang) + '</pre>') + '</div>';
  },
  reglages: function (b) {
    return '<select data-act="set" data-prop="variant" title="Style">' + opt('dark', b.variant, 'Sombre') + opt('box', b.variant, 'Boîte + fichier') + opt('cmd', b.variant, 'Commande') + '</select>' +
      '<select data-act="set" data-prop="lang" title="Langage pour la coloration">' + Object.keys(HL.names).map(function (k) {
        return opt(k, b.lang || 'auto', k === 'auto' ? 'Auto (' + HL.names[HL.detect(String(b.code || ''), b.name)] + ')' : HL.names[k]);
      }).join('') + '</select>' +
      (b.variant !== 'cmd' ? tog('tall', b.tall, '↕', 'Limiter la hauteur (défilement)') : '');
  },
  elements: function (b) { return [{ t: 'code', texte: String(b.code || '').replace(/\n$/, ''), nom: String(b.name || '') }]; },
  office: function (b, x) {
    var trait = '1px solid ' + x.C.line, nom = String(b.name || '').trim();
    if (b.variant === 'box') {
      // .codebox : barre du nom sur fond blanc, filet, puis le code sur code-soft (sans les numéros de ligne, qu'Ardoise ne copie pas)
      var barre = nom ? '<tr>' + officeCellule(esc(nom), 'font-family:' + OFFICE_POLICES.mono + ';font-size:' + officePt(12.5) + ';color:' + x.C.muted + ';background:' + x.C.surface +
        ';padding:7.5pt 10.5pt;border-top:' + trait + ';border-left:' + trait + ';border-right:' + trait, '100%') + '</tr>' : '';
      // le code porte le filet sous la barre : Writer ne garde le retrait intérieur que du côté d'une bordure
      return officeTable(barre + '<tr>' + officeCellule(officeTabPre(b, 12.5, x.C.fg, officeCodeJetons(false)), 'background:' + x.C['code-soft'] + ';padding:10.5pt 12pt;border:' + trait, '100%') + '</tr>', 'margin:0 0 6pt');
    }
    if (b.variant === 'cmd')   // pre.cmd : ligne de commande sur code-soft, bordée, sans nom
      return officeTable('<tr>' + officeCellule(officeTabPre(b, 13.5, x.C.fg, officeCodeJetons(false)), 'background:' + x.C['code-soft'] + ';padding:9pt 10.5pt;border:' + trait, '100%') + '</tr>', 'margin:0 0 6pt');
    // « Sombre » (.code) : nom en capitales mono grises (code-fg à 55 % d'opacité à l'écran : Writer ignore l'opacité), code clair coloré sur code-bg ;
    // bordure de la couleur du fond : sans bordure, Writer ignore le retrait intérieur de la cellule
    var titre = nom ? officeEtiquette(officeTexteSegs(nom), x, { couleur: officeCodeJetons(true).c, marges: 'margin:0pt 0pt 6pt' }) : '';
    return officeTable('<tr>' + officeCellule(titre + officeTabPre(b, 12.5, x.C['code-fg'], officeCodeJetons(true)), 'background:' + x.C['code-bg'] + ';padding:10.5pt 12pt;border:1px solid ' + x.C['code-bg'], '100%') + '</tr>', 'margin:0 0 6pt');
  },
  // zone du code : coloration pendant la frappe (paintCode, 07-rendu.js), Tab et Maj+Tab indentent, la coloration défile avec elle
  saisie: {
    input: function (el, b) { if (!el.matches('textarea.code-ta')) return false; b.code = el.value; autosize(el); paintCode(el, b); session.saisir(); return true; },
    keydown: function (el, b, e) {
      if (!el.matches('textarea.code-ta')) return false;
      if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        var s = el.selectionStart, en = el.selectionEnd, v = el.value;
        if (e.shiftKey) {
          var ls = v.lastIndexOf('\n', s - 1) + 1;
          if (v.substr(ls, 2) === '  ') { el.setRangeText('', ls, ls + 2, 'end'); }
        } else el.setRangeText('  ', s, en, 'end');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return true;
    },
    scroll: function (el) { if (!el.matches('textarea.code-ta')) return false; var pre = el.previousElementSibling; if (pre) { pre.scrollLeft = el.scrollLeft; pre.scrollTop = el.scrollTop; } return true; },
    // le nom peut changer le langage deviné : la coloration est repeinte
    champ: function (el, b) { if (el.dataset.k !== 'name') return; var t = $('.blk[data-id="' + b.id + '"] textarea.code-ta', app); if (t) paintCode(t, b); }
  }
};
T.formule = { label: 'Formule', ic: '∑', desc: 'Une formule LaTeX seule, centrée et en grand', kw: 'formule equation maths mathematiques latex tex', make: function () { return { tex: '' }; }, sans: ['reglages', 'normaliser', 'libelle'],
  rendu: function (b, x) {
    var e = x.edit;
    // bloc formule : en édition, la source au-dessus de l'aperçu ; en lecture, la formule seule, rien si la source est vide
    var fap = formuleBlocApercu(b.tex, e);
    if (!e) return fap ? '<div class="formule-bloc">' + fap + '</div>' : '';
    return '<div class="formule-bloc"><textarea class="formule-ta" data-b="' + b.id + '" data-k="tex" spellcheck="false" rows="1" placeholder="Source LaTeX">' + esc(b.tex) + '</textarea>' +
      '<div class="formule-apercu">' + fap + '</div></div>';
  },
  elements: function (b, x) {
    var out = [], tex = String(b.tex || '').trim(), fi = officeImageFormule(x.opts.formules, 'bloc', tex);
    if (tex) out.push(fi ? { t: 'formule', tex: tex, image: fi } : { t: 'formule', tex: tex });
    return out;
  },
  // bloc formule : image centrée, ramenée à la largeur de la page ; sans image, $$source$$ centré
  office: function (b, x) {
    var tex = String(b.tex || '').trim(), im = officeImageFormule(x.opts.formules, 'bloc', tex);
    if (!tex) return '';
    var p = '<p align="center" style="' + OFFICE_P + 'text-align:center">';
    if (!im) return p + esc('$$' + tex + '$$') + '</p>';
    var t = officeEchelle(im.l, im.h, OFFICE_LARGEUR);
    return p + '<img src="' + esc(im.src) + '" alt="' + esc(tex) + '" width="' + t[0] + '" height="' + t[1] + '"></p>';
  },
  // source : l'aperçu la suit sans rendre la page
  saisie: {
    input: function (el, b) {
      if (!el.matches('textarea.formule-ta')) return false;
      b.tex = el.value; autosize(el);
      var apercu = el.parentNode.querySelector('.formule-apercu'); if (apercu) apercu.innerHTML = formuleBlocApercu(b.tex, true);
      session.saisir(); return true;
    }
  }
};
// aperçu d'un bloc formule (rendu, et saisie de la source) ; source vide : une invite en édition, rien en lecture
function formuleBlocApercu(tex, edition) {
  return texEnMathML(tex, 'bloc') || (edition ? '<span class="formule-invite">Tapez une formule LaTeX, par exemple \\frac{a}{b}</span>' : '');
}
T.divider = { label: 'Séparateur', ic: '—', desc: 'Ligne horizontale', kw: 'separateur ligne hr', make: function () { return {}; }, sans: ['reglages', 'normaliser', 'libelle'],
  rendu: function () { return '<hr class="sep">'; },
  elements: function () { return [{ t: 'ligne' }]; },
  office: function (b, x) { return officeTxtFilet(x, '6pt', '6pt'); }
};
/* Bloc de code : le code reste du texte modifiable, en Consolas, espaces et retours gardés (<pre> à white-space:pre-wrap),
   dans une cellule teintée pleine largeur (Google Docs ne teinte un <pre> que sous le texte). */
// couleurs des jetons de page.css (vérifiées par le banc du rendu) : bloc sombre (règle .code) et thème clair (:root)
function officeCodeJetons(sombre) {
  return sombre ? { k: '#c792ea', s: '#c3e88d', c: '#7f93a3', n: '#f78c6c', f: '#82aaff', v: '#ffcb6b', t: '#89ddff', p: '#9fb3c3' }
    : { k: '#8a2bb5', s: '#2b7a1b', c: '#6b7c8a', n: '#b4450a', f: '#1d5fbf', v: '#9a5b00', t: '#0b7285', p: '#5d6b78' };
}
// code coloré en couleurs en ligne : un <span> par jeton et par ligne (comme HL.lines), commentaires en italique
function officeTabLignesCode(code, lang, tk) {
  return HL.tokens(String(code || ''), lang).map(function (t) {
    if (!t[0] || !tk[t[0]]) return esc(t[1]);
    var st = 'color:' + tk[t[0]] + (t[0] === 'c' ? ';font-style:italic' : '');
    return t[1].split('\n').map(function (p) { return p ? '<span style="' + st + '">' + esc(p) + '</span>' : ''; }).join('\n');
  }).join('');
}
function officeTabPre(b, px, couleur, tk) {
  var code = String(b.code || '').replace(/\n$/, ''), lignes = officeTabLignesCode(code, HL.resolve(b.lang, code, b.name), tk);
  return '<pre style="margin:0pt;font-family:' + OFFICE_POLICES.mono + ';font-size:' + officePt(px) + ';line-height:1.55;color:' + couleur + ';white-space:pre-wrap">' + (lignes || '&nbsp;') + '</pre>';
}
