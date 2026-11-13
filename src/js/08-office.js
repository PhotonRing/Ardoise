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
  'map-sea': '#d9e5ec', 'map-land': '#f8fafb', 'map-border': '#b4c2cc', 'map-label': '#566573'
};
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

/* Texte enrichi assaini → segments { texte, gras, italique, souligne, barre, code, lien, interne, couleur, pastille } ou { saut } */
var OFFICE_BALISE = /<(\/?)([a-z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/gi;
function officeSegments(html, d) {
  var s = String(html == null ? '' : html), out = [], pile = [], m;
  var etat = function (texte) { var e = { texte: texte }; pile.forEach(function (p) { for (var k in p.f) e[k] = p.f[k]; }); return e; };
  var pousser = function (seg) {
    var der = out[out.length - 1];
    if (der && !der.saut && !seg.saut && !der.pastille && !seg.pastille && memeForme(der, seg)) der.texte += seg.texte; else out.push(seg);
  };
  OFFICE_BALISE.lastIndex = 0;
  while ((m = OFFICE_BALISE.exec(s))) {
    if (m[4] != null) { var t = htmlText(m[4]); if (t) pousser(etat(t)); continue; }
    var tag = m[2].toLowerCase(), attrs = m[3] || '';
    if (tag === 'br') { pousser({ saut: true }); continue; }
    if (m[1]) { for (var i = pile.length - 1; i >= 0; i--) if (pile[i].tag === tag) { pile.splice(i, 1); break; } continue; }
    var cls = (attrs.match(/class="([^"]*)"/) || [])[1] || '';
    if (tag === 'span' && /(^|\s)pill(\s|$)/.test(cls)) {
      // pastille : tout son contenu en un segment, couleur de l'exception sinon du registre (lu sans inscrire)
      var fin = s.indexOf('</span>', OFFICE_BALISE.lastIndex); if (fin < 0) fin = s.length;
      var nom = htmlText(s.slice(OFFICE_BALISE.lastIndex, fin).replace(/<[^>]*>/g, '')), own = cls.match(/\bpc-(\d+)\b/);
      var c = own ? +own[1] : knownTagColor(d || {}, tagKey(nom)), p = etat(nom);
      p.pastille = c == null ? { fond: OFFICE_CLAIR.line, texte: OFFICE_CLAIR.fg } : officePastille(c);
      delete p.couleur; if (nom) pousser(p);
      OFFICE_BALISE.lastIndex = fin + 7; continue;
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
    } else if (tag === 'span' && /(^|\s)alert(\s|$)/.test(cls)) f.couleur = OFFICE_CLAIR.bad;
    pile.push({ tag: tag, f: f });
  }
  while (out.length && out[out.length - 1].saut) out.pop();
  return out;
}
var OFFICE_FORMES = ['gras', 'italique', 'souligne', 'barre', 'code', 'lien', 'interne', 'couleur'];
function memeForme(a, b) { return OFFICE_FORMES.every(function (k) { return (a[k] || null) === (b[k] || null); }); }
function officeTexteDe(segs) { return segs.map(function (g) { return g.saut ? '\n' : g.texte; }).join(''); }
function officeVide(segs) { return !officeTexteDe(segs).trim(); }

/* Bloc → éléments neutres. opts : { page, images: { idBloc: { src, mime, l, h } } } (images préparées par l'appelant) */
function officeBloc(b, d, opts) {
  opts = opts || {};
  var pi = Math.max(0, Math.min(d.pages.length - 1, +opts.page || 0)), images = opts.images || {}, out = [];
  var S = function (html) { return officeSegments(R(html), d); };
  var txt = function (texte, f) { var g = { texte: String(texte == null ? '' : texte) }; for (var k in f) g[k] = f[k]; return g; };
  var para = function (segs, o) { var e = { t: 'para', segs: segs }; for (var k in o) e[k] = o[k]; return e; };
  var gras = function (segs) { return segs.map(function (g) { if (!g.saut && !g.pastille) g.gras = true; return g; }); };
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
    case 'p': out.push(para(S(b.html), b.indent > 0 ? { retrait: Math.min(6, +b.indent) } : {})); break;
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
        var v = S(it.v); if (it.alert) v.forEach(function (g) { if (!g.saut && !g.pastille) g.couleur = OFFICE_CLAIR.bad; });
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
      // modèle diamant : tableau à deux colonnes, titre puis les sommets dans l'ordre de l'écran (DIA_SOMMETS : 07-rendu.js)
      var dl = function (nom, html) { var v = S(html); return [[para([txt(nom, { gras: true })])], [para(officeVide(v) ? [txt('—', { couleur: OFFICE_CLAIR.muted })] : v)]]; };
      out.push({ t: 'tableau', entete: false, lignes: (officeVide(S(b.title)) ? [] : [dl('Titre', b.title)]).concat(DIA_SOMMETS.map(function (s) { return dl(s[1], b[s[0]]); })) });
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
// cartes d'une colonne de kanban : titre en gras, puis échéance, responsable et priorité
function officeCartesKanban(cards, S, txt, para) {
  var out = [];
  cards.forEach(function (k) {
    out.push(para(S(k.title).map(function (g) { if (!g.saut && !g.pastille) g.gras = true; return g; })));
    if (!officeVide(S(k.html))) out.push(para(S(k.html)));
    var meta = [k.due ? 'Échéance : ' + kbDate(k.due, true) : '', k.who ? 'Responsable : ' + String(k.who).trim() : '', KB_PRIO[k.prio] ? 'Priorité ' + k.prio.toUpperCase() + ' (' + KB_PRIO[k.prio] + ')' : ''].filter(Boolean);
    if (meta.length) out.push(para([txt(meta.join(' · '), { couleur: OFFICE_CLAIR.muted })]));
  });
  return out;
}
// requête figée : ses résultats tels qu'affichés (lecture, tri enregistré), sans commande
function officeRequete(b, d, pi, S, txt, para) {
  var out = [], ctx = renderCtx(d, { page: pi, view: 'export' }), recs = queryRecords(b, d, pi), src = b.src || 'facts', view = b.view || 'table';
  var source = function (r) { var pg = d.pages[r.x.pi], st = r.x.sec ? textOf(r.x.sec.type === 'step' ? r.x.sec.title : r.x.sec.html) : ''; return txt(pageTitle(pg, r.x.pi) + (st ? ' › ' + st : ''), { interne: true, souligne: true }); };
  var valeur = function (c) { var v = S(c.v); if (c.alert) v.forEach(function (g) { if (!g.saut && !g.pastille) g.couleur = OFFICE_CLAIR.bad; }); return v; };
  var element = function (r) { return (r.par ? [txt(r.par + ' › ', { couleur: OFFICE_CLAIR.muted })] : []).concat(S(r.html)); };
  if (b.title) out.push(para([txt(b.title, { gras: true })]));
  if (view === 'count') {
    qCompteurs(b, d, pi, recs).forEach(function (c) { out.push(para([txt(c.label + ' : '), txt(c.num + (c.tot != null ? ' / ' + c.tot : ''), { gras: true })])); });
    return out;
  }
  if (!recs.length) { out.push(para([txt('Aucun résultat.', { couleur: OFFICE_CLAIR.muted })])); return out; }
  recs = qSorted(b, d, ctx, recs);
  if (view === 'kanban') {
    var groupes = qGroupes(b, d, pi, recs).groups, carte = function (r) {
      if (src === 'kanban') return officeCartesKanban([r.kb], S, txt, para);
      if (src === 'check') return [para([txt(r.done ? '☑ ' : '☐ ')].concat(element(r)))];
      return [para(r.cells.filter(function (c) { return !officeVide(S(c.v)); }).reduce(function (a, c) { return a.concat(a.length ? [txt(' · ')] : [], [txt(c.k + ' ', { couleur: OFFICE_CLAIR.muted })], valeur(c)); }, []))];
    };
    out.push({ t: 'tableau', entete: true, lignes: [groupes.map(function (g) { return [para([txt(g.name + ' (' + g.recs.length + ')')])]; }),
      groupes.map(function (g) { return g.recs.reduce(function (a, r) { return a.concat(carte(r)); }, []); })] });
    return out;
  }
  var total = recs.length, lim = Math.max(0, +b.limit || 0);
  if (lim && recs.length > lim) recs = recs.slice(0, lim);
  var plus = recs.length < total ? [para([txt(recs.length + ' premiers résultats sur ' + total, { couleur: OFFICE_CLAIR.muted })])] : [];
  if (src === 'check') {
    if (view === 'list') out.push({ t: 'liste', ordonnee: false, items: recs.map(function (r) { return { niveau: 0, coche: r.done, segs: element(r).concat([txt(' — ')], [source(r)]) }; }) });
    else out.push({ t: 'tableau', entete: true, lignes: [[[para([txt('✓')])], [para([txt('Élément')])], [para([txt('Source')])]]].concat(recs.map(function (r) {
      return [[para([txt(r.done ? '☑' : '☐')])], [para(element(r))], [para([source(r)])]];
    })) });
    return out.concat(plus);
  }
  var cc = qColonnes(recs);
  if (view === 'list') {
    out.push({ t: 'liste', ordonnee: false, items: recs.map(function (r) {
      var segs = [source(r)];
      cc.cellsOf(r).forEach(function (c, j) { if (c && !officeVide(S(c.v))) segs = segs.concat([txt(' · ' + cc.cols[j] + ' ', { couleur: OFFICE_CLAIR.muted })], valeur(c)); });
      return { niveau: 0, segs: segs };
    }) });
  } else {
    out.push({ t: 'tableau', entete: true, lignes: [cc.cols.concat(['Source']).map(function (c) { return [para([txt(c)])]; })].concat(recs.map(function (r) {
      var o = cc.cellsOf(r);
      return cc.cols.map(function (c, j) { return [para(o[j] ? valeur(o[j]) : [])]; }).concat([[para([source(r)])]]);
    })) });
  }
  return out.concat(plus);
}

/* Éléments neutres → HTML à styles en ligne (aucune classe), thème clair */
var OFFICE_POLICE = 'Arial,Helvetica,sans-serif', OFFICE_MONO = 'Consolas,\'Courier New\',monospace';
function officeHtml(elts, d) {
  var C = OFFICE_CLAIR, acc = officeAccent(d)[0];
  var segs = function (arr) {
    return arr.map(function (g) {
      if (g.saut) return '<br>';
      var h = esc(g.texte);
      if (g.pastille) return '<span style="background:' + g.pastille.fond + ';color:' + g.pastille.texte + ';border-radius:999px;padding:1px 6px;font-weight:bold;font-size:9pt">' + h + '</span>';
      if (g.code) h = '<code style="font-family:' + OFFICE_MONO + ';background:' + C['code-soft'] + '">' + h + '</code>';
      if (g.gras) h = '<b>' + h + '</b>';
      if (g.italique) h = '<i>' + h + '</i>';
      if (g.barre) h = '<s>' + h + '</s>';
      if (g.couleur) h = '<span style="color:' + g.couleur + '">' + h + '</span>';
      if (g.lien) return '<a href="' + esc(g.lien) + '" style="color:' + acc + '">' + h + '</a>';
      if (g.souligne) h = '<u>' + h + '</u>';
      return h;
    }).join('');
  };
  var P = 'margin:0 0 6pt;', PARA = {
    surtitre: 'font-size:9pt;letter-spacing:1px;text-transform:uppercase;color:' + acc + ';', chapeau: 'font-size:12pt;color:' + C.muted + ';',
    pied: 'font-size:9pt;color:' + C.muted + ';border-top:1px solid ' + C.line + ';padding-top:6pt;', legende: 'font-size:9pt;font-style:italic;color:' + C.muted + ';'
  };
  var TITRES = [['h1', '24pt'], ['h1', '16pt'], ['h2', '13pt'], ['h3', '11pt']];
  var cellule = 'border:1px solid ' + C.line + ';padding:4pt 6pt;vertical-align:top;text-align:left;';
  var liste = function (e) {
    var tg = e.ordonnee ? 'ol' : 'ul', cur = -1, h = '', st = e.items.some(function (it) { return it.coche != null; }) ? ' style="list-style:none;padding-left:0;margin:0 0 6pt"' : ' style="margin:0 0 6pt"';
    e.items.forEach(function (it) {
      var lv = Math.max(0, Math.min(it.niveau, cur + 1));
      if (cur < 0) { h += '<' + tg + st + '>'; cur = 0; }
      else if (lv > cur) { h += '<' + tg + st.replace(';padding-left:0', ';padding-left:18pt').replace('margin:0 0 6pt', 'margin:0') + '>'; cur = lv; }
      else { h += '</li>'; while (cur > lv) { h += '</' + tg + '></li>'; cur--; } }
      h += '<li>' + (it.coche != null ? (it.coche ? '☑ ' : '☐ ') : '') + segs(it.segs);
    });
    if (cur < 0) return '';
    h += '</li>'; while (cur > 0) { h += '</' + tg + '></li>'; cur--; }
    return h + '</' + tg + '>';
  };
  var un = function (e) {
    switch (e.t) {
      case 'titre': var tt = TITRES[e.niveau] || TITRES[3]; return '<' + tt[0] + ' style="font-family:' + OFFICE_POLICE + ';font-size:' + tt[1] + ';font-weight:bold;color:' + C.fg + ';margin:12pt 0 6pt">' + segs(e.segs) + '</' + tt[0] + '>';
      case 'para': return '<p style="' + P + (PARA[e.style] || '') + (e.retrait ? 'margin-left:' + 2 * e.retrait + 'em;' : '') + '">' + segs(e.segs) + '</p>';
      case 'liste': return liste(e);
      case 'tableau':
        return '<table style="border-collapse:collapse;width:100%;margin:0 0 6pt">' + e.lignes.map(function (l, i) {
          var th = e.entete && i === 0;
          return '<tr>' + l.map(function (c) { return th ? '<th style="' + cellule + 'font-weight:bold;background:' + C.bg + '">' + tous(c) + '</th>' : '<td style="' + cellule + '">' + tous(c) + '</td>'; }).join('') + '</tr>';
        }).join('') + '</table>';
      case 'cadre':
        return '<table style="border-collapse:collapse;width:100%;margin:0 0 6pt"><tr><td style="background:' + e.fond + ';padding:6pt 9pt;' +
          (e.barre ? 'border-left:4px solid ' + e.barre : 'border:1px solid ' + C.line) + '">' + tous(e.contenu) + '</td></tr></table>';
      case 'code':
        return (e.nom ? '<p style="' + P + 'font-family:' + OFFICE_MONO + ';font-size:8pt;color:' + C.muted + '">' + esc(e.nom) + '</p>' : '') +
          '<pre style="font-family:' + OFFICE_MONO + ';font-size:9.5pt;background:' + C['code-soft'] + ';color:' + C.fg + ';padding:6pt 8pt;margin:0 0 6pt;white-space:pre-wrap">' + esc(e.texte) + '</pre>';
      case 'image':
        var l = e.l, h = e.h; if (l > 680) { h = Math.round(h * 680 / l); l = 680; }
        return '<p style="' + P + '"><img src="' + esc(e.src) + '" alt="' + esc(e.alt) + '"' + (l && h ? ' width="' + l + '" height="' + h + '"' : '') + '></p>' +
          (officeVide(e.legende) ? '' : '<p style="' + P + PARA.legende + '">' + segs(e.legende) + '</p>');
      case 'ligne': return '<hr style="border:0;border-top:1px solid ' + C.line + ';margin:6pt 0">';
    }
    return '';
  };
  var tous = function (arr) { return arr.map(un).join(''); };
  return '<div style="font-family:' + OFFICE_POLICE + ';font-size:11pt;color:' + C.fg + '">' + tous(elts) + '</div>';
}
/* Éléments neutres → texte brut : pastilles en #nom (comme la copie d'une plage), cellules en tabulations */
function officeTexte(elts) {
  var lig = function (segs) { return segs.map(function (g) { return g.saut ? '\n' : g.pastille ? '#' + g.texte : g.texte; }).join(''); };
  var un = function (e) {
    switch (e.t) {
      case 'titre': case 'para': return (e.retrait ? new Array(e.retrait + 1).join('  ') : '') + lig(e.segs);
      case 'liste': var n = [];
        return e.items.map(function (it) {
          n[it.niveau] = (n[it.niveau] || 0) + 1; n.length = it.niveau + 1;
          return new Array(it.niveau + 1).join('  ') + (it.coche != null ? (it.coche ? '☑ ' : '☐ ') : e.ordonnee ? n[it.niveau] + '. ' : '- ') + lig(it.segs);
        }).join('\n');
      case 'tableau': return e.lignes.map(function (l) { return l.map(function (c) { return tous(c).replace(/[\t\n]+/g, ' '); }).join('\t'); }).join('\n');
      case 'cadre': return tous(e.contenu);
      case 'code': return (e.nom ? e.nom + '\n' : '') + e.texte;
      case 'image': return '[Image' + (officeVide(e.legende) ? (e.alt ? ' : ' + e.alt : '') : ' : ' + lig(e.legende)) + ']';
      case 'ligne': return '———';
    }
    return '';
  };
  var tous = function (arr) { return arr.map(un).filter(function (t) { return t !== ''; }).join('\n'); };
  return tous(elts);
}
