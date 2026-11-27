/* ---------- Export Office (module pur : sans DOM hors R et textOf, testé dans le banc du rendu) ----------
   Bloc du document → éléments neutres (titres, paragraphes en segments, listes, tableaux, cadres, code, images, ligne),
   en couleurs du thème clair ; deux rendus en sortent : HTML à styles en ligne (Copier pour Office) et texte brut. */
// variables du :root clair de page.css (vérifiées par le banc du rendu) ; l'accent dépend de la palette du document
var OFFICE_CLAIR = {
  bg: '#f5f7f8', surface: '#ffffff', fg: '#17212b', muted: '#566573', line: '#d9e0e5', 'code-bg': '#14202b', 'code-fg': '#e4ebf0', 'code-soft': '#eef2f4',
  ok: '#1f7a4d', 'ok-soft': '#e3f3ea', bad: '#b42318', 'bad-soft': '#fdecea', warn: '#8a5a00', 'warn-soft': '#fdf3d8', info: '#1f5f99', 'info-soft': '#e4eef8',
  t4f: '#52257e', t4b: '#ede1fa', t5f: '#832152', t5b: '#fbe0ed', t6f: '#1d877e', t6b: '#dffbf9', t7f: '#252c7e', t7b: '#e1e3fa', t8f: '#617e25', t8b: '#f1fae1',
  t9f: '#186e8b', t9b: '#def5fc', t10f: '#7e4a25', t10b: '#faebe1', t11f: '#762d76', t11b: '#f8e2f8', t12f: '#297a52', t12b: '#e2f9ed', t13f: '#405264', t13b: '#e7edf4',
  t14f: '#937910', t14b: '#fdf7dd', t15f: '#8b2818', t15b: '#fce2de',
  // couleurs du texte (Rouge = bad) et surlignages de la barre de mise en forme : même nom que leur classe
  'c-orange': '#b54708', 'c-vert': '#18794e', 'c-bleu': '#1d5fb4', 'c-violet': '#6d3fc0', 'c-gris': '#5f6b76',
  's-jaune': '#fff0a6', 's-vert': '#d4f2dd', 's-bleu': '#d7e8fa', 's-rose': '#fadbe8', 's-gris': '#e3e8ec',
  'map-sea': '#d9e5ec', 'map-land': '#f8fafb', 'map-border': '#b4c2cc', 'map-label': '#566573'
};
var OFFICE_LARGEUR = 680;   // largeur utile d'une page A4 imprimée en px, comme PRINT_W du moteur de carte (images, .docx)
var OFFICE_PALETTES = { ambre: ['#b4540a', '#fbeee2'], petrole: ['#0b6e8a', '#e2f0f4'], indigo: ['#4848c0', '#ececfb'], rubis: ['#b4233c', '#fbe8ec'], foret: ['#2f6f3e', '#e6f2e8'], graphite: ['#3d5466', '#e8eef2'] };
// couleur N d'une pastille (pa-N, pc-N) : { fond, texte }
function officePastille(n) {
  var C = OFFICE_CLAIR, base = ['ok', 'bad', 'warn', 'info'][n];
  if (base) return { fond: C[base + '-soft'], texte: C[base] };
  return C['t' + n + 'b'] ? { fond: C['t' + n + 'b'], texte: C['t' + n + 'f'] } : { fond: C.line, texte: C.fg };
}
function officeAccent(d) { return OFFICE_PALETTES[d && d.palette] || OFFICE_PALETTES.ambre; }
// variables CSS du thème clair (nom → valeur) : posées sur le conteneur où se dessinent les images de cartes et de chronologies
function officeVariables(d) {
  var v = {}, k, acc = officeAccent(d);
  for (k in OFFICE_CLAIR) v['--' + k] = OFFICE_CLAIR[k];
  v['--accent'] = acc[0]; v['--accent-soft'] = acc[1]; v['--on-accent'] = '#ffffff';
  return v;
}

// image d'une formule préparée par imagesFormules (22-copier-office.js) : formules[mode][source], ou null (texte $source$)
function officeImageFormule(formules, mode, source) { return (formules && formules[mode] && formules[mode][source]) || null; }
/* Texte enrichi assaini → segments { texte, gras, italique, souligne, barre, code, lien, interne, couleur, surlignage, pastille,
   formule (source), image (de la formule, prise dans formules.ligne) } ou { saut } */
var OFFICE_BALISE = /<(\/?)([a-z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/gi;
function officeSegments(html, d, formules) {
  var s = String(html == null ? '' : html), out = [], pile = [], m;
  var etat = function (texte) { var e = { texte: texte }; pile.forEach(function (p) { for (var k in p.f) e[k] = p.f[k]; }); return e; };
  OFFICE_BALISE.lastIndex = 0;
  while ((m = OFFICE_BALISE.exec(s))) {
    if (m[4] != null) { var t = htmlText(m[4]); if (t) out.push(etat(t)); continue; }
    var tag = m[2].toLowerCase(), attrs = m[3] || '';
    if (tag === 'br') { out.push({ saut: true }); continue; }
    if (m[1]) { for (var i = pile.length - 1; i >= 0; i--) if (pile[i].tag === tag) { pile.splice(i, 1); break; } continue; }
    var cls = (attrs.match(/class="([^"]*)"/) || [])[1] || '';
    if (tag === 'span' && /(^|\s)pill(\s|$)/.test(cls)) {
      // pastille : tout son contenu en un segment, couleur de l'exception sinon du registre (lu sans inscrire)
      var fin = s.indexOf('</span>', OFFICE_BALISE.lastIndex); if (fin < 0) fin = s.length;
      var nom = htmlText(s.slice(OFFICE_BALISE.lastIndex, fin).replace(/<[^>]*>/g, '')), own = cls.match(/\bpc-(\d+)\b/);
      var c = own ? +own[1] : knownTagColor(d || {}, tagKey(nom)), p = etat(nom);
      p.pastille = c == null ? { fond: OFFICE_CLAIR.line, texte: OFFICE_CLAIR.fg } : officePastille(c);
      delete p.couleur; delete p.surlignage; if (nom) out.push(p);
      OFFICE_BALISE.lastIndex = fin + 7; continue;
    }
    if (tag === 'span' && /(^|\s)formule(\s|$)/.test(cls)) {
      // formule (forme stockée, après R) : un segment à part, `$source$` en texte, la source dans formule, son image dans image
      var ff = s.indexOf('</span>', OFFICE_BALISE.lastIndex); if (ff < 0) ff = s.length;
      var src = htmlText(s.slice(OFFICE_BALISE.lastIndex, ff).replace(/<[^>]*>/g, ''));
      if (src.trim()) { var g = etat('$' + src + '$'); g.formule = src; var im = officeImageFormule(formules, 'ligne', src); if (im) g.image = im; out.push(g); }
      OFFICE_BALISE.lastIndex = ff + 7; continue;
    }
    var f = {};
    if (tag === 'b' || tag === 'strong') f.gras = true;
    else if (tag === 'i' || tag === 'em') f.italique = true;
    else if (tag === 'u') f.souligne = true;
    else if (tag === 's' || tag === 'del' || tag === 'strike') f.barre = true;
    else if (tag === 'code') f.code = true;
    else if (tag === 'a') {
      var href = htmlText((attrs.match(/href="([^"]*)"/) || [])[1] || '');
      if (/^(https?:|mailto:)/i.test(href)) f.lien = href; else if (href.charAt(0) === '#') { f.interne = true; f.souligne = true; }
    } else if (tag === 'span') cls.split(/\s+/).forEach(function (c) {
      // classes de la palette (COULEURS_TEXTE, SURLIGNAGES) : Rouge = alert, les autres portent le nom de leur teinte claire
      if (c === 'alert') f.couleur = OFFICE_CLAIR.bad;
      else if (/^c-/.test(c) && OFFICE_CLAIR[c]) f.couleur = OFFICE_CLAIR[c];
      else if (/^s-/.test(c) && OFFICE_CLAIR[c]) f.surlignage = OFFICE_CLAIR[c];
    });
    pile.push({ tag: tag, f: f });
  }
  while (out.length && out[out.length - 1].saut) out.pop();
  return officeFusion(out);
}
// segments voisins de même forme réunis (ni saut, ni pastille, ni formule), en copies : les segments reçus ne changent pas
function officeFusion(segs) {
  var out = [];
  segs.forEach(function (g) {
    var der = out[out.length - 1], c = {}, k;
    if (der && !der.saut && !g.saut && !der.pastille && !g.pastille && !der.formule && !g.formule && memeForme(der, g)) { der.texte += g.texte; return; }
    for (k in g) c[k] = g[k];
    out.push(c);
  });
  return out;
}
var OFFICE_FORMES = ['gras', 'italique', 'souligne', 'barre', 'code', 'lien', 'interne', 'couleur', 'surlignage'];
function memeForme(a, b) { return OFFICE_FORMES.every(function (k) { return (a[k] || null) === (b[k] || null); }); }
function officeTexteDe(segs) { return segs.map(function (g) { return g.saut ? '\n' : g.texte; }).join(''); }
function officeVide(segs) { return !officeTexteDe(segs).trim(); }
// forme k (gras, couleur) posée sur les segments de texte, ni saut ni pastille ; rend les segments
function officeMettreForme(segs, k, v) { segs.forEach(function (g) { if (!g.saut && !g.pastille) g[k] = v; }); return segs; }

/* Bloc → éléments neutres. opts : { page, images: { idBloc: { src, mime, l, h } }, formules: { ligne|bloc: { source: { src, l, h } } } }
   (images préparées par l'appelant : 22-copier-office.js) */
function officeBloc(b, d, opts) {
  opts = opts || {};
  var pi = Math.max(0, Math.min(d.pages.length - 1, +opts.page || 0)), images = opts.images || {};
  var S = function (html) { return officeSegments(R(html), d, opts.formules); };
  var txt = function (texte, f) { var g = { texte: String(texte == null ? '' : texte) }; for (var k in f) g[k] = f[k]; return g; };
  var para = function (segs, o) { var e = { t: 'para', segs: segs }; for (var k in o) e[k] = o[k]; return e; };
  var gras = function (segs) { return officeMettreForme(segs, 'gras', true); };
  var cases = function (arr, ordre) { return { t: 'liste', ordonnee: false, items: ordre.map(function (i) { var it = arr[i]; return { niveau: Math.max(0, +it.lv || 0), segs: S(it.html), coche: !!it.done }; }) }; };
  var image = function (img, alt, legende) { return { t: 'image', src: img.src, mime: img.mime || '', l: img.l || 0, h: img.h || 0, alt: alt || '', legende: legende || [] }; };
  // contexte x des éléments neutres ; la facette elements du type est le seul aiguillage (type inconnu : aucun élément)
  var el = facette(b.type, 'elements');
  return el ? el(b, { d: d, opts: opts, pi: pi, images: images, S: S, txt: txt, para: para, gras: gras, cases: cases, image: image }) : [];
}
// blocs d'une page (ou un seul bloc) → éléments neutres, dans l'ordre ; les enfants d'un groupe suivent par le groupe
function officeBlocs(blocs, d, opts) { return (blocs || []).reduce(function (a, b) { return a.concat(officeBloc(b, d, opts)); }, []); }
// sources des formules d'éléments neutres (segments et blocs formule, à toute profondeur), une fois chacune : { ligne: [], bloc: [] }
function officeFormulesDe(elts) {
  var r = { ligne: [], bloc: [] }, vu = { ligne: {}, bloc: {} };
  var mettre = function (mode, s) { if (!vu[mode][s]) { vu[mode][s] = true; r[mode].push(s); } };
  var parcours = function (x) {
    if (Array.isArray(x)) { x.forEach(parcours); return; }
    if (!x || typeof x !== 'object') return;
    if (x.t === 'formule') mettre('bloc', x.tex);
    else if (typeof x.formule === 'string') mettre('ligne', x.formule);
    for (var k in x) if (k !== 'image' && x[k] && typeof x[k] === 'object') parcours(x[k]);
  };
  parcours(elts);
  return r;
}

/* Socle du style d'Ardoise dans le HTML collé : polices de Windows avec remplaçant, tailles de page.css en points, couleurs du thème clair et accent ;
   formes en fonds de cellules et bordures de tableaux pleine largeur (Writer : attribut width). Pièges de Writer : marges avec unité (0pt),
   raccourci margin à 0 en tête, pas de valeur en .N, valign en attribut, letter-spacing en dernier, un paragraphe entre deux tableaux. */
var OFFICE_POLICES = { texte: "'Segoe UI',sans-serif", titre: "'Segoe UI Semibold','Segoe UI',sans-serif", mono: 'Consolas,monospace' };
var OFFICE_P = 'margin:0pt 0pt 6pt;';   // paragraphe du corps
function officePt(px) { return Math.round(px * 75) / 100 + 'pt'; }   // 1 px = 0,75 pt
// capitales écrites dans le texte (Writer ignore text-transform), sauf la source d'une formule ; copies : les segments reçus ne changent pas
function officeMajuscules(segs) { return segs.map(function (g) { var c = {}, k; for (k in g) c[k] = g[k]; if (c.texte && !c.formule) c.texte = c.texte.toUpperCase(); return c; }); }
// étiquette (clés, en-têtes, sommets, titres de sommaire et de requête, surtitre) : capitales écrites en police mono d'Ardoise, grise, espacement large
// en dernier (Writer ignore ce qui suit letter-spacing) ; o : { px (11), couleur, espace, marges : style du paragraphe qui l'entoure, sans : en ligne }
function officeEtiquette(segs, x, o) {
  o = o || {};
  var t = officePt(o.px || 11), h = '<span style="font-family:' + OFFICE_POLICES.mono + ';font-size:' + t + ';color:' + (o.couleur || x.C.muted) + ';letter-spacing:' + (o.espace || '0.5pt') + '">' + x.segs(officeMajuscules(segs), o.px || 11) + '</span>';
  return o.marges ? '<p style="' + o.marges + ';font-size:' + t + '">' + h + '</p>' : h;
}
// segments d'un texte simple (libellé, nom) pour officeEtiquette
function officeTexteSegs(texte) { return [{ texte: String(texte == null ? '' : texte) }]; }
// image ramenée à une largeur : [largeur, hauteur]
function officeEchelle(l, h, max) { return l > max && h ? [max, Math.round(h * max / l)] : [l, h]; }
function officeTable(lignes, style) { return '<table width="100%" style="border-collapse:collapse;width:100%;' + (style || '') + '">' + lignes + '</table>'; }
// cellule : police du texte posée sur elle (Writer ne la fait pas hériter dans un tableau), calée en haut sauf valign reçu (attribut : Writer ignore le style)
function officeCellule(contenu, style, largeur, valign) {
  var v = valign || 'top';
  return '<td valign="' + v + '"' + (largeur ? ' width="' + largeur + '"' : '') + ' style="font-family:' + OFFICE_POLICES.texte + ';font-size:' + officePt(15) + ';vertical-align:' + v + ';' + (style || '') + '">' + contenu + '</td>';
}
// filet fin (étape, séparateur) : paragraphe vide bordé en haut (Writer dessine un <hr> en trait sombre, sans sa couleur)
function officeTxtFilet(x, avant, apres) { return '<p style="margin-top:' + avant + ';margin-bottom:' + apres + ';border-top:1px solid ' + x.C.line + ';font-size:1pt;line-height:1pt">&nbsp;</p>'; }
// cases à cocher (liste à cocher, cartes) : un paragraphe par case, jamais de <li> (Writer remet des puces à partir de la 2e ligne) ;
// case cochée en accent, libellé coché en gris (ul.check input:checked+label), retrait de 26 px par niveau (ul.check li.lv-N), 6 px entre les cases
function officeListeCases(arr, ordre, x) {
  return ordre.map(function (i) {
    var it = arr[i], lv = Math.min(6, Math.max(0, +it.lv || 0)), libelle = x.segs(x.S(it.html));
    return '<p style="margin-top:0pt;margin-bottom:' + officePt(6) + (lv ? ';margin-left:' + officePt(26 * lv) : '') + '">' +
      (it.done ? '<span style="color:' + x.acc + '">☑</span> <span style="color:' + x.C.muted + '">' + libelle + '</span>' : '<span style="color:' + x.C.muted + '">☐</span> ' + libelle) + '</p>';
  }).join('');
}
/* Tableau d'Ardoise (aussi vues en tableau du Bloc requête) : entetes en segments (null : sans), lignes en HTML rendu ; bordures sur les cellules,
   en-tête en <td> (Writer centre et graisse un <th>) ; o : { taille (px, 15 ; 14 pour .q-table), attenues: [lignes en gris], fonds: [[teinte|null]] } */
function officeTabTableau(entetes, lignes, x, o) {
  o = o || {};
  var trait = '1px solid ' + x.C.line, toutes = (entetes ? [null] : []).concat(lignes), n = toutes.length;
  if (!n) return '';
  var taille = officePt(o.taille || 15), attenues = o.attenues || [], fonds = o.fonds || [];
  var bords = function (i, j, nc) {
    return (i === 0 ? 'border-top:' + trait + ';' : '') + (j === 0 ? 'border-left:' + trait + ';' : '') + (j === nc - 1 ? 'border-right:' + trait + ';' : '') + 'border-bottom:' + trait + ';';
  };
  var html = toutes.map(function (l, i) {
    if (entetes && i === 0) return '<tr>' + entetes.map(function (segs, j) {
      // taille de l'étiquette aussi sur la cellule : la ligne d'en-tête garde sa hauteur
      return officeCellule(officeEtiquette(segs, x), 'font-size:' + officePt(11) + ';background:' + x.C.surface + ';padding:6.75pt 9pt;text-align:left;' + bords(0, j, entetes.length));
    }).join('') + '</tr>';
    var k = i - (entetes ? 1 : 0), fd = fonds[k] || [];
    return '<tr>' + l.map(function (c, j) {
      return officeCellule(c, 'font-size:' + taille + ';background:' + (fd[j] || x.C.surface) + ';padding:6.75pt 9pt;text-align:left;' +
        (attenues.indexOf(k) >= 0 ? 'color:' + x.C.muted + ';' : '') + bords(i, j, l.length));
    }).join('') + '</tr>';
  }).join('');
  return officeTable(html, 'margin:0 0 6pt');
}
// segments → HTML : formes, couleur et surlignage, code en ligne sur accent-soft (page.css), liens accent, lien interne souligné sans adresse, pastilles en texte ;
// formule en image à la taille du texte qui l'entoure (px, 15 par défaut)
function officeSegmentsHtml(arr, d, px) {
  var C = OFFICE_CLAIR, acc = officeAccent(d);
  return arr.map(function (g) {
    if (g.saut) return '<br>';
    if (g.image) {
      // image dessinée pour 15 px, ligne de base en son milieu : align="middle" pose le milieu de l'image sur la ligne de base (Writer,
      // Chromium) ; Writer ignore vertical-align sur une image, et absmiddle l'y pose plus haut, à côté d'une formule plus grande ;
      // Google Docs ignore align : vertical-align d'une demi-hauteur affichée y descend le milieu sur la ligne de base (même place dans Chromium)
      var k = (px || 15) / 15, hi = Math.round(g.image.h * k), im = '<img src="' + esc(g.image.src) + '" alt="' + esc(g.formule) + '" width="' + Math.round(g.image.l * k) + '" height="' + hi + '" align="middle" style="vertical-align:-' + hi / 2 + 'px">';
      if (g.gras) im = '<b>' + im + '</b>';
      return im;
    }
    var h = esc(g.texte);
    if (g.pastille) return '<span style="background:' + g.pastille.fond + ';color:' + g.pastille.texte + ';font-family:' + OFFICE_POLICES.titre + ';font-weight:600;font-size:' + officePt(12) + ';padding:1px 6px">' + h + '</span>';
    if (g.code) h = '<code style="font-family:' + OFFICE_POLICES.mono + ';font-size:' + officePt(13) + ';background:' + acc[1] + ';color:' + C.fg + '">' + h + '</code>';
    if (g.gras) h = '<b>' + h + '</b>';
    if (g.italique) h = '<i>' + h + '</i>';
    if (g.barre) h = '<s>' + h + '</s>';
    // couleur du texte et surlignage dans un même span (fond en ligne, comme une pastille)
    if (g.couleur || g.surlignage) h = '<span style="' + [g.couleur && 'color:' + g.couleur, g.surlignage && 'background:' + g.surlignage].filter(Boolean).join(';') + '">' + h + '</span>';
    if (g.lien) return '<a href="' + esc(g.lien) + '" style="color:' + acc[0] + '">' + h + '</a>';
    if (g.souligne) h = '<u>' + h + '</u>';
    return h;
  }).join('');
}
function officeEnveloppe(h) { return '<div style="font-family:' + OFFICE_POLICES.texte + ';font-size:' + officePt(15) + ';line-height:1.6;color:' + OFFICE_CLAIR.fg + ';max-width:' + OFFICE_LARGEUR + 'px">' + h + '</div>'; }
// point d'entrée du HTML de Copier pour Office ; carte et chronologie (office déclarée absente) passent par leurs éléments neutres
function officeHtmlBloc(b, d, opts) { return officeEnveloppe(officeHtmlContenu(b, d, opts)); }
// contexte x du HTML stylé : document, options, page, images préparées, couleurs claires, accent, segments
function officeContexteHtml(d, opts) {
  var acc = officeAccent(d);
  return { d: d, opts: opts, pi: Math.max(0, Math.min(d.pages.length - 1, +opts.page || 0)), images: opts.images || {}, C: OFFICE_CLAIR, acc: acc[0], accSoft: acc[1],
    S: function (html) { return officeSegments(R(html), d, opts.formules); }, segs: function (arr, px) { return officeSegmentsHtml(arr, d, px); } };
}
function officeHtmlContenu(b, d, opts) {
  opts = opts || {};
  // rendu stylé du type, function (b, x) → HTML sans enveloppe : facette office de l'inscription (T) ; sans elle (carte et
  // chronologie, office déclarée absente ; type inconnu) : ses éléments neutres
  var rendu = facette(b.type, 'office');
  if (!rendu) return officeHtmlElements(officeBloc(b, d, opts), d);
  return rendu(b, officeContexteHtml(d, opts));
}
// éléments neutres de la carte et de la chronologie → HTML : paragraphe, liste à puces, image fournie
function officeHtmlElements(elts, d) {
  var segs = function (arr) { return officeSegmentsHtml(arr, d); };
  return elts.map(function (e) {
    if (e.t === 'para') return '<p style="' + OFFICE_P + '">' + segs(e.segs) + '</p>';
    if (e.t === 'liste') return '<ul style="' + OFFICE_P + '">' + e.items.map(function (it) { return '<li>' + segs(it.segs) + '</li>'; }).join('') + '</ul>';
    if (e.t === 'image') {
      var t = officeEchelle(e.l, e.h, OFFICE_LARGEUR);
      return '<p style="' + OFFICE_P + '"><img src="' + esc(e.src) + '" alt="' + esc(e.alt) + '"' + (t[0] && t[1] ? ' width="' + t[0] + '" height="' + t[1] + '"' : '') + '></p>';
    }
    return '';
  }).join('');
}
/* Éléments neutres → texte brut : formules en $source$, bloc formule en $$source$$ sur sa ligne, pastilles en #nom (comme la copie d'une plage), cellules en tabulations */
function officeTexte(elts) {
  var lig = function (segs) { return segs.map(function (g) { return g.saut ? '\n' : g.pastille ? '#' + g.texte : g.texte; }).join(''); };
  var un = function (e) {
    switch (e.t) {
      case 'titre': case 'para': return (e.retrait ? new Array(e.retrait + 1).join('  ') : '') + lig(e.segs);
      case 'liste': var n = [];
        return e.items.map(function (it) {
          n[it.niveau] = (n[it.niveau] || 0) + 1; n.length = it.niveau + 1;
          // numéro d'un item de bloc texte (n) : celui d'Ardoise ; sinon compté dans la liste
          var g = it.coche != null ? { genre: 'case', done: it.coche } : { genre: it.n != null || e.ordonnee ? 'numero' : 'puce' };
          return new Array(it.niveau + 1).join('  ') + marqueDeLigne(g, it.n != null ? it.n : n[it.niveau]) + lig(it.segs);
        }).join('\n');
      case 'tableau': return e.lignes.map(function (l) { return l.map(function (c) { return tous(c).replace(/[\t\n]+/g, ' '); }).join('\t'); }).join('\n');
      case 'cadre': return tous(e.contenu);
      case 'code': return (e.nom ? e.nom + '\n' : '') + e.texte;
      case 'image': return '[Image' + (officeVide(e.legende) ? (e.alt ? ' : ' + e.alt : '') : ' : ' + lig(e.legende)) + ']';
      case 'formule': return '$$' + e.tex + '$$';
      case 'ligne': return '———';
    }
    return '';
  };
  var tous = function (arr) { return arr.filter(function (e) { return e.ligne || un(e) !== ''; }).map(un).join('\n'); };
  return tous(elts);
}
