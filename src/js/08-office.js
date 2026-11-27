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
      // formule (forme stockée, après R) : un segment à part, `$source$` en texte, la source dans formule (image : ticket 08)
      var ff = s.indexOf('</span>', OFFICE_BALISE.lastIndex); if (ff < 0) ff = s.length;
      var src = htmlText(s.slice(OFFICE_BALISE.lastIndex, ff).replace(/<[^>]*>/g, ''));
      if (src.trim()) { var g = etat('$' + src + '$'); g.formule = src; if (formules && formules.ligne && formules.ligne[src]) g.image = formules.ligne[src]; out.push(g); }
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
// teinte d'un palier de la carte de chaleur en thème clair : accent du document mêlé au blanc selon Q_CH_PALIERS (comme color-mix de page.css)
function officeChaleurTeinte(d, palier) {
  var a = officeAccent(d)[0], p = Q_CH_PALIERS[palier] / 100;
  return '#' + [1, 3, 5].map(function (i) { var v = Math.round(parseInt(a.slice(i, i + 2), 16) * p + 255 * (1 - p)); return (v < 16 ? '0' : '') + v.toString(16); }).join('');
}
function officeMettreForme(segs, k, v) { segs.forEach(function (g) { if (!g.saut && !g.pastille) g[k] = v; }); return segs; }

/* Bloc → éléments neutres. opts : { page, images: { idBloc: { src, mime, l, h } }, formules: { ligne|bloc: { source: { src, l, h } } } }
   (images préparées par l'appelant : 22-copier-office.js) */
function officeBloc(b, d, opts) {
  opts = opts || {};
  var pi = Math.max(0, Math.min(d.pages.length - 1, +opts.page || 0)), images = opts.images || {}, out = [];
  var S = function (html) { return officeSegments(R(html), d, opts.formules); };
  var txt = function (texte, f) { var g = { texte: String(texte == null ? '' : texte) }; for (var k in f) g[k] = f[k]; return g; };
  var para = function (segs, o) { var e = { t: 'para', segs: segs }; for (var k in o) e[k] = o[k]; return e; };
  var gras = function (segs) { return officeMettreForme(segs, 'gras', true); };
  var cases = function (arr, ordre) { return { t: 'liste', ordonnee: false, items: ordre.map(function (i) { var it = arr[i]; return { niveau: Math.max(0, +it.lv || 0), segs: S(it.html), coche: !!it.done }; }) }; };
  var image = function (img, alt, legende) { return { t: 'image', src: img.src, mime: img.mime || '', l: img.l || 0, h: img.h || 0, alt: alt || '', legende: legende || [] }; };
  switch (b.type) {
    case 'header':
      if (!b.noEyebrow && !officeVide(S(b.eyebrow))) out.push(para(S(b.eyebrow), { style: 'surtitre' }));
      out.push({ t: 'titre', niveau: 0, segs: S(b.title) });
      if (!b.noLede && !officeVide(S(b.lede))) out.push(para(S(b.lede), { style: 'chapeau' }));
      break;
    case 'h2': out.push({ t: 'titre', niveau: 1, segs: S(b.html) }); break;
    case 'h3': out.push({ t: 'titre', niveau: 2, segs: S(b.html) }); break;
    case 'subtitle': out.push({ t: 'titre', niveau: 3, segs: S(b.html) }); break;
    case 'step':
      var num = stepNums(d.pages[pi].blocks)[b.id];
      out.push({ t: 'titre', niveau: 1, segs: (num ? [txt(num + ' ')] : []).concat(S(b.title)) }); break;
    case 'texte':
      // texte → paragraphe à son retrait ; sous-titre → titre de niveau 3 ; suite de puces, numéros et cases → un élément liste
      // (items à genre et numéro affiché). serre : pas d'espace après (sauf la dernière ligne, comme .texte .lg) ; ligne : gardée
      // vide dans le texte brut ; alignement et taille : réglages de la ligne
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
      break;
    case 'summary':
      if (b.title) out.push(para([txt(b.title, { gras: true })]));
      var entrees = [], parcours = function (arr, lv) { arr.forEach(function (it) { entrees.push({ niveau: lv, segs: [txt((it.n ? it.n + ' ' : '') + it.t, { interne: true, souligne: true })] }); parcours(it.kids, lv + 1); }); };
      parcours(summaryItems(b, d, pi), 0);
      if (entrees.length) out.push({ t: 'liste', ordonnee: false, items: entrees });
      break;
    case 'list':
      out.push({ t: 'liste', ordonnee: !!b.ordered, items: b.items.map(function (it) { return { niveau: Math.max(0, +it.lv || 0), segs: S(it.html) }; }) }); break;
    case 'check':
      if (b.items.length) out.push(cases(b.items, b.order === 'doneFirst' || b.order === 'doneLast' ? checkOrder(b.items, b.order) : b.items.map(function (x, k) { return k; })));
      break;
    case 'table':
      out.push({ t: 'tableau', entete: true, lignes: b.rows.map(function (r) { return r.map(function (c) { return [para(S(c))]; }); }) }); break;
    case 'facts':
      out.push({ t: 'tableau', entete: false, lignes: b.items.map(function (it) {
        var v = S(it.v); if (it.alert) officeMettreForme(v, 'couleur', OFFICE_CLAIR.bad);
        return [[para([txt(it.k, { gras: true })])], [para(v)]];
      }) });
      break;
    case 'note':
      var nv = ['warn', 'info', 'bad', 'ok'].indexOf(b.variant) >= 0 ? b.variant : 'warn';
      out.push({ t: 'cadre', fond: OFFICE_CLAIR[nv + '-soft'], barre: OFFICE_CLAIR[nv], contenu: [para(S(b.html))] }); break;
    case 'code': out.push({ t: 'code', texte: String(b.code || '').replace(/\n$/, ''), nom: String(b.name || '') }); break;
    case 'kanban':
      var cols = b.cols || [];
      out.push({ t: 'tableau', entete: true, lignes: [cols.map(function (c, ci) { return [para([txt(c.title || 'Colonne ' + (ci + 1))])]; }),
        cols.map(function (c) { return officeCartesKanban(c.cards || [], S, txt, para); })] });
      break;
    case 'query': out = out.concat(officeRequete(b, d, pi, S, txt, para)); break;
    case 'details':
      out.push(para(gras(S(b.title))));
      if (!officeVide(S(b.html))) out.push(para(S(b.html)));
      break;
    case 'image':
      if (b.src) out.push(image(images[b.id] || { src: b.src }, b.alt || htmlText(b.caption), S(b.caption))); break;
    case 'cards':
      b.cards.forEach(function (c) {
        var ct = [];
        if (!officeVide(S(c.title))) ct.push(para(gras(S(c.title))));
        if (!officeVide(S(c.text))) ct.push(para(S(c.text)));
        if ((c.checks || []).length) ct.push(cases(c.checks, c.checks.map(function (x, k) { return k; })));
        out.push({ t: 'cadre', fond: OFFICE_CLAIR.surface, barre: null, contenu: ct });
      });
      break;
    case 'group':
      // groupe : toujours ouvert (comme à l'impression), titre en gras puis ses blocs
      if (!officeVide(S(b.title))) out.push(para(gras(S(b.title))));
      (b.blocks || []).forEach(function (c) { out = out.concat(officeBloc(c, d, opts)); });
      break;
    case 'diamond':
      // modèle diamant : tableau à deux colonnes, titre puis les sommets dans l'ordre de l'écran (DIA_SOMMETS : 03-types-de-blocs.js)
      var dl = function (nom, html) { var v = S(html); return [[para([txt(nom, { gras: true })])], [para(officeVide(v) ? [txt('—', { couleur: OFFICE_CLAIR.muted })] : v)]]; };
      out.push({ t: 'tableau', entete: false, lignes: (officeVide(S(b.title)) ? [] : [dl('Titre', b.title)]).concat(DIA_SOMMETS.map(function (s) { return dl(s.nom, b[s.cle]); })) });
      break;
    case 'formule':
      var tex = String(b.tex || '').trim(), fi = opts.formules && opts.formules.bloc && opts.formules.bloc[tex];
      if (tex) out.push(fi ? { t: 'formule', tex: tex, image: fi } : { t: 'formule', tex: tex });
      break;
    case 'divider': out.push({ t: 'ligne' }); break;
    case 'footer': out.push(para(S(b.html), { style: 'pied' })); break;
    case 'map':
      if (images[b.id]) { out.push(image(images[b.id], 'Carte')); break; }
      var pts = (b.markers || []).map(function (m, i) { return { niveau: 0, segs: [txt(m.label || 'Point ' + (i + 1)), txt(' (' + (+m.lat).toFixed(4) + ', ' + (+m.lon).toFixed(4) + ')', { couleur: OFFICE_CLAIR.muted })] }; })
        .concat((b.zones || []).map(function (z, i) { return { niveau: 0, segs: [txt(z.label || 'Zone ' + (i + 1))] }; }))
        .concat((b.routes || []).map(function (r, i) { return { niveau: 0, segs: [txt(r.label || 'Itinéraire ' + (i + 1))] }; }));
      out.push(para([txt('Carte', { gras: true })]));
      if (pts.length) out.push({ t: 'liste', ordonnee: false, items: pts });
      break;
    case 'timeline':
      if (images[b.id]) { out.push(image(images[b.id], 'Chronologie')); break; }
      var evs = (b.items || []).map(function (it) {
        var segs = (it.date ? [txt(it.date + ' — ', { couleur: OFFICE_CLAIR.muted })] : []).concat(gras(S(it.title)));
        if (!officeVide(S(it.text))) segs = segs.concat([txt(' : ')], S(it.text));
        return { niveau: 0, segs: segs };
      });
      if (evs.length) out.push({ t: 'liste', ordonnee: false, items: evs });
      break;
  }
  return out;
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
// cartes d'une colonne de kanban : titre en gras, puis échéance, responsable et priorité
function officeCartesKanban(cards, S, txt, para) {
  var out = [];
  cards.forEach(function (k) {
    out.push(para(officeMettreForme(S(k.title), 'gras', true)));
    if (!officeVide(S(k.html))) out.push(para(S(k.html)));
    var meta = [k.due ? 'Échéance : ' + kbDate(k.due, true) : '', k.who ? 'Responsable : ' + String(k.who).trim() : '', KB_PRIO[k.prio] ? 'Priorité ' + k.prio.toUpperCase() + ' (' + KB_PRIO[k.prio] + ')' : ''].filter(Boolean);
    if (meta.length) out.push(para([txt(meta.join(' · '), { couleur: OFFICE_CLAIR.muted })]));
  });
  return out;
}
// carte d'une requête en vue kanban : titre en gras, puis les champs choisis dans leur ordre (07-requetes.js) ; priorité,
// échéance et responsable voisins partagent un paragraphe gris ; « Attend » en rouge si la carte est bloquée
function officeCarteRequete(b, r, S, txt, para, source) {
  var k = r.kb, out = [para(officeMettreForme(S(k.title), 'gras', true))], meta = [];
  var fin = function () { if (meta.length) out.push(para([txt(meta.join(' · '), { couleur: OFFICE_CLAIR.muted })])); meta = []; };
  qChampsAffiches(b).forEach(function (c) {
    if (c.cle === 'priorite') { if (KB_PRIO[k.prio]) meta.push('Priorité ' + k.prio.toUpperCase() + ' (' + KB_PRIO[k.prio] + ')'); }
    else if (c.cle === 'echeance') { if (k.due) meta.push('Échéance : ' + kbDate(k.due, true)); }
    else if (c.cle === 'responsable') { if (String(k.who || '').trim()) meta.push('Responsable : ' + String(k.who).trim()); }
    else {
      fin();
      if (c.cle === 'texte' && !officeVide(S(k.html))) out.push(para(S(k.html)));
      else if (c.cle === 'attend' && r.attend.length) out.push(para([txt('Attend : ' + qAttendTexte(r), { couleur: r.bloquee ? OFFICE_CLAIR.bad : OFFICE_CLAIR.muted })]));
      else if (c.cle === 'source') out.push(para([source(r)]));
    }
  });
  fin();
  return out;
}
// requête figée : ses résultats tels qu'affichés (lecture, tri enregistré), sans commande
function officeRequete(b, d, pi, S, txt, para) {
  var out = [], ctx = renderCtx(d, { page: pi, view: 'export' }), recs = queryRecords(b, d, pi), src = b.src || 'facts', view = b.view || 'table';
  var source = function (r) { var pg = d.pages[r.x.pi], st = r.x.sec ? textOf(r.x.sec.type === 'step' ? r.x.sec.title : r.x.sec.html) : ''; return txt(pageTitle(pg, r.x.pi) + (st ? ' › ' + st : ''), { interne: true, souligne: true }); };
  var valeur = function (c) { var v = S(c.v); return c.alert ? officeMettreForme(v, 'couleur', OFFICE_CLAIR.bad) : v; };
  var element = function (r) { return (r.par ? [txt(r.par + ' › ', { couleur: OFFICE_CLAIR.muted })] : []).concat(S(r.html)); };
  if (b.title) out.push(para([txt(b.title, { gras: true })]));
  if (view === 'count') {
    qCompteurs(b, d, pi, recs).forEach(function (c) { out.push(para([txt(c.label + ' : '), txt(c.num + (c.tot != null ? ' / ' + c.tot : ''), { gras: true })])); });
    return out;
  }
  if (!recs.length && !qColonnesRetenues(b, d, pi, view)) { out.push(para([txt('Aucun résultat.', { couleur: OFFICE_CLAIR.muted })])); return out; }
  if (view === 'regroupee' && src === 'table') {
    // vue regroupée (07-requetes.js) : fiches (titre gras avec le nombre, tableau clé / valeurs uniques) ou tableau (X, Y…, Lignes)
    var rg = qRegReglage(b, recs), sp = qRegTri(b, ctx, rg), gr = qGroupesTries(qRegrouper(recs, rg.x, rg.ys), sp.by, sp.dir), glim = Math.max(0, +b.limit || 0), gtot = gr.length;
    if (glim && gr.length > glim) gr = gr.slice(0, glim);
    var uniques = function (g, y) { return g.uniques[y].reduce(function (a, v, i) { return a.concat(i ? [txt(', ')] : [], S(v)); }, []); };
    var nomX = function (g) { return g.vide ? [txt('(vide)', { couleur: OFFICE_CLAIR.muted })] : S(g.valeur); };
    if (b.regForme === 'tableau') out.push({ t: 'tableau', entete: true, lignes: [[rg.nom(rg.x)].concat(rg.ys.map(rg.nom), ['Lignes']).map(function (c) { return [para([txt(c)])]; })].concat(gr.map(function (g) {
      return [[para(nomX(g))]].concat(rg.ys.map(function (y) { return [para(uniques(g, y))]; }), [[para([txt(String(g.n))])]]);
    })) });
    else gr.forEach(function (g) {
      out.push(para([txt((g.vide ? '(vide)' : htmlText(g.valeur).replace(/\s+/g, ' ').trim()) + ' (' + g.n + ')', { gras: true })]));
      if (rg.ys.length) out.push({ t: 'tableau', entete: false, lignes: rg.ys.map(function (y) { return [[para([txt(rg.nom(y), { gras: true })])], [para(uniques(g, y))]]; }) });
    });
    if (gr.length < gtot) out.push(para([txt(gr.length + ' premiers groupes sur ' + gtot, { couleur: OFFICE_CLAIR.muted })]));
    return out;
  }
  if (view === 'chaleur' && src === 'table') {
    // carte de chaleur (07-requetes.js) : une colonne par X, ses cases puis leurs sous-cases (« › ») alignées par rang ; cases teintées
    var ch = qChReglage(b, recs), m = qChaleur(recs, ch.x, ch.y, ch.z, ch.n);
    var nomC = function (g) { return g.vide ? [txt('(vide)')] : S(g.valeur); };
    var pile = m.colonnes.map(function (col) { return col.cases.reduce(function (a, c) { return a.concat([{ g: c }], c.sous.map(function (x) { return { g: x, sous: true }; })); }, []); });
    var rangs = pile.reduce(function (n, p) { return Math.max(n, p.length); }, 0), lignes = [m.colonnes.map(function (col) { return [para([txt(htmlText(col.vide ? '(vide)' : col.valeur).replace(/\s+/g, ' ').trim() + ' (' + qNombreAffiche(col.total) + ')')])]; })], fonds = [m.colonnes.map(function () { return null; })];
    for (var ri = 0; ri < rangs; ri++) {
      lignes.push(pile.map(function (p) {
        var x = p[ri]; if (!x) return [];
        var pal = qChPalier(x.g.total, m.min, m.max), segs = (x.sous ? [txt('› ')] : []).concat(nomC(x.g), [txt('  ' + qNombreAffiche(x.g.total))]);
        return [para(officeMettreForme(segs, 'couleur', pal === 4 ? '#ffffff' : OFFICE_CLAIR.fg))];
      }));
      fonds.push(pile.map(function (p) { return p[ri] ? officeChaleurTeinte(d, qChPalier(p[ri].g.total, m.min, m.max)) : null; }));
    }
    out.push({ t: 'tableau', entete: true, lignes: lignes, fonds: fonds });
    out.push(para([txt('Échelle : de ' + qNombreAffiche(m.min) + ' (clair) à ' + qNombreAffiche(m.max) + ' (foncé), ' + (ch.n ? 'somme de ' + ch.nom(ch.n) : 'nombre de lignes'), { couleur: OFFICE_CLAIR.muted })]));
    return out;
  }
  recs = qSorted(b, d, ctx, recs);
  if (view === 'kanban') {
    var qg = qRegroupements(b, d, pi, recs), groupes = qg.groups, carte = function (r) {
      if (src === 'kanban') return officeCarteRequete(b, r, S, txt, para, source);
      // comme à l'écran (qKanban) : colonnes choisies dans leur ordre, sans celle du regroupement ; Source, à sa place, coupe la carte
      var o = kc.cellsOf(r), sep = src === 'check' ? ' ' : ' · ', segs = [], out = [];
      var fin = function () { if (segs.length) out.push(para(segs)); segs = []; };
      var mettre = function (x) { segs = segs.concat(segs.length ? [txt(sep)] : [], x); };
      kc.cols.forEach(function (c) {
        if (c.source) { fin(); out.push(para([source(r)])); }
        else if (c.coche) mettre([txt(r.done ? '☑' : '☐')]);
        else if (c.element) mettre(element(r));
        else if (o[c.j] && 'c:' + c.nom.toLowerCase() !== qg.gb && !officeVide(S(o[c.j].v))) mettre([txt(c.nom + ' ', { couleur: OFFICE_CLAIR.muted })].concat(valeur(o[c.j])));
      });
      fin();
      return out;
    }, kc = src === 'kanban' ? null : qColonnesAffichees(b, recs);
    out.push({ t: 'tableau', entete: true, lignes: [groupes.map(function (g) { return [para([txt(g.name + ' (' + g.recs.length + ')')])]; }),
      groupes.map(function (g) { return g.recs.reduce(function (a, r) { return a.concat(carte(r)); }, []); })] });
    return out;
  }
  var total = recs.length, lim = Math.max(0, +b.limit || 0);
  if (lim && recs.length > lim) recs = recs.slice(0, lim);
  var plus = recs.length < total ? [para([txt(recs.length + ' premiers résultats sur ' + total, { couleur: OFFICE_CLAIR.muted })])] : [];
  // colonnes choisies, dans l'ordre choisi (07-requetes.js) ; Source et, pour les cases, ✓ et Élément en sont
  var cc = qColonnesAffichees(b, recs, view === 'list');
  var cellule = function (c, r, o) { return c.source ? [source(r)] : c.coche ? [txt(r.done ? '☑' : '☐')] : c.element ? element(r) : c.attend ? [txt(qAttendTexte(r))] : o[c.j] ? valeur(o[c.j]) : []; };
  if (view === 'list') {
    out.push({ t: 'liste', ordonnee: false, items: recs.map(function (r) {
      var o = cc.cellsOf(r), segs = [];
      if (src === 'check') {
        // case : cochée par la liste ; élément et source à la suite, séparés par un tiret
        cc.cols.forEach(function (c) { if (!c.coche) segs = segs.concat(segs.length ? [txt(' — ')] : [], cellule(c, r, o)); });
        return { niveau: 0, coche: cc.cols.some(function (c) { return c.coche; }) ? r.done : undefined, segs: segs };
      }
      cc.cols.forEach(function (c) {
        if (c.source) segs = segs.concat(segs.length ? [txt(' · ')] : [], [source(r)]);
        else if (c.attend) { if (qAttendTexte(r)) segs = segs.concat(segs.length ? [txt(' · ')] : [], [txt('Attend ', { couleur: OFFICE_CLAIR.muted }), txt(qAttendTexte(r))]); }
        else if (o[c.j] && !officeVide(S(o[c.j].v))) segs = segs.concat(segs.length ? [txt(' · ')] : [], [txt(c.nom + ' ', { couleur: OFFICE_CLAIR.muted })], valeur(o[c.j]));
      });
      return { niveau: 0, segs: segs };
    }) });
  } else {
    out.push({ t: 'tableau', entete: true, lignes: [cc.cols.map(function (c) { return [para([txt(c.nom)])]; })].concat(recs.map(function (r) {
      var o = cc.cellsOf(r);
      return cc.cols.map(function (c) { return [para(cellule(c, r, o))]; });
    })) });
  }
  return out.concat(plus);
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
// rendu stylé par type de bloc : chaque famille (09-office-*.js) inscrit ses types, function (b, x) → HTML sans enveloppe
var OFFICE_RENDUS = {};
// point d'entrée du HTML de Copier pour Office ; carte et chronologie (sans rendu inscrit) passent par leurs éléments neutres
function officeHtmlBloc(b, d, opts) { return officeEnveloppe(officeHtmlContenu(b, d, opts)); }
function officeHtmlContenu(b, d, opts) {
  opts = opts || {};
  var rendu = OFFICE_RENDUS[b.type];
  if (!rendu) return officeHtmlElements(officeBloc(b, d, opts), d);
  var acc = officeAccent(d);
  return rendu(b, { d: d, opts: opts, pi: Math.max(0, Math.min(d.pages.length - 1, +opts.page || 0)), images: opts.images || {}, C: OFFICE_CLAIR, acc: acc[0], accSoft: acc[1],
    S: function (html) { return officeSegments(R(html), d, opts.formules); }, segs: function (arr, px) { return officeSegmentsHtml(arr, d, px); } });
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
