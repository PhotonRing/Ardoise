/* ---------- Copier pour Office : famille Kanban et requêtes (socle et point d'entrée : 08-office.js) ----------
   Kanban (.kb-*) et Bloc requête dans chacune de ses vues (.q-*), d'après page.css. Les résultats et les comptes viennent des
   fonctions de l'écran (07-requetes.js, queryResult) : le collage montre ce qu'Ardoise affiche. */
var OFFICE_REQ_PRIO = { p1: 'bad', p2: 'warn', p3: 'info' };
// paragraphe sous un autre dans une carte (Writer : raccourci margin à 0 en tête)
function officeReqLigne(contenu, style) { return '<p style="margin-top:4.5pt;margin-bottom:0pt;' + (style || '') + '">' + contenu + '</p>'; }
function officeReqGris(contenu, x) { return '<span style="color:' + x.C.muted + '">' + contenu + '</span>'; }
// pastille de compte (.kb-n) : Consolas grise sur fond --line
function officeReqCompte(n, x) { return '<span style="font-family:' + OFFICE_POLICES.mono + ';font-size:' + officePt(11) + ';font-weight:600;color:' + x.C.muted + ';background:' + x.C.line + '">&nbsp;' + esc(String(n)) + '&nbsp;</span>'; }
// méta d'une carte : priorité en pastille, échéance (rouge si dépassée), responsable
function officeReqPrio(p, x) {
  var c = OFFICE_REQ_PRIO[p];
  return c ? '<span style="background:' + x.C[c + '-soft'] + ';color:' + x.C[c] + ';font-family:' + OFFICE_POLICES.mono + ';font-weight:bold;font-size:' + officePt(10.5) + '">&nbsp;' + p.toUpperCase() + '&nbsp;</span>' : '';
}
function officeReqEcheance(iso, late, x) { return iso ? '<span style="' + (late ? 'color:' + x.C.bad + ';background:' + x.C['bad-soft'] : 'color:' + x.C.muted) + '">' + esc(kbDate(iso, true)) + '</span>' : ''; }
function officeReqQui(qui, x) { var n = String(qui || '').trim(); return n ? officeReqGris(esc(n), x) : ''; }
function officeReqMeta(parts) { parts = parts.filter(Boolean); return parts.length ? officeReqLigne(parts.join(' &nbsp; '), 'font-size:' + officePt(12)) : ''; }
// carte (.kb-card) : table à une cellule blanche bordée ; priorité en trait de 3 px à gauche, carte bloquée en tirets rouges
function officeReqCarte(contenu, x, o) {
  o = o || {};
  var pc = OFFICE_REQ_PRIO[o.prio] ? x.C[OFFICE_REQ_PRIO[o.prio]] : null, bord = '1px ' + (o.bloquee ? 'dashed ' + x.C.bad : 'solid ' + (pc || x.C.line));
  return officeTable('<tr>' + officeCellule(contenu, 'background:' + x.C.surface + ';padding:7.5pt 9pt;border-top:' + bord + ';border-right:' + bord + ';border-bottom:' + bord +
    ';border-left:' + (pc ? '3px solid ' + pc : bord), '100%') + '</tr>', 'margin:0pt');
}
// lignes d'une carte : texte gris, « Attend » (rouge si la carte est bloquée)
function officeReqTexteCarte(segs, x) { return officeVide(segs) ? '' : officeReqLigne(x.segs(segs), 'font-size:' + officePt(13) + ';color:' + x.C.muted); }
function officeReqAttend(noms, bloquee, x) { return officeReqLigne('Attend : ' + noms, 'font-size:' + officePt(12) + ';color:' + (bloquee ? x.C.bad : x.C.muted)); }
// paragraphe d'écart entre deux tableaux (Writer et Word fusionnent deux tableaux qui se suivent)
function officeReqEspace(pt) { return '<p style="margin:0pt;font-size:1pt;line-height:' + pt + '">&nbsp;</p>'; }
function officeReqTitreCarte(contenu) { return '<p style="margin:0pt;font-weight:600;font-size:' + officePt(14) + ';line-height:1.35">' + contenu + '</p>'; }
// colonnes côte à côte (.kb-col) : [{ titre (HTML), n, cartes: [HTML] }] ; cartes séparées par un paragraphe (Word fusionne deux tables qui se suivent)
function officeReqColonnes(cols, x) {
  if (!cols.length) return '';
  var l = Math.floor(100 / cols.length) + '%', espace = officeReqEspace('4.5pt');
  return officeTable('<tr>' + cols.map(function (c) {
    var tete = '<p style="margin:0pt 0pt 6pt"><span style="font-weight:600;font-size:' + officePt(13) + '">' + c.titre + '</span> ' + officeReqCompte(c.n, x) + '</p>';
    var corps = c.cartes.length ? c.cartes.join(espace) : '<p style="margin:0pt;text-align:center;font-size:' + officePt(12) + ';color:' + x.C.muted + '">—</p>';
    return officeCellule(tete + corps, 'background:' + x.C.bg + ';border:1px solid ' + x.C.line + ';padding:6pt', l);
  }).join('') + '</tr>', 'margin:0 0 6pt');
}

OFFICE_RENDUS.kanban = function (b, x) {
  var cols = b.cols || [], index = kbCards(b), dernier = cols.length - 1;
  var noms = function (l) { return esc(l.map(kbCardTitle).join(', ')); };
  return officeReqColonnes(cols.map(function (c, ci) {
    return { titre: esc(c.title || 'Colonne ' + (ci + 1)), n: (c.cards || []).length, cartes: (c.cards || []).map(function (k) {
      var dp = kbDeps(b, k.id, index), h = officeReqTitreCarte(x.segs(x.S(k.title)));
      h += officeReqTexteCarte(x.S(k.html), x);
      h += officeReqMeta([officeReqPrio(k.prio, x), officeReqEcheance(k.due, kbLate(k.due, ci === dernier), x), officeReqQui(k.who, x)]);
      if (dp.waits.length) h += officeReqAttend(noms(dp.waits), dp.blocked, x);
      if (dp.blocks.length) h += officeReqLigne('Bloque : ' + noms(dp.blocks), 'font-size:' + officePt(12) + ';color:' + x.C.muted);
      return officeReqCarte(h, x, { prio: k.prio, bloquee: dp.blocked });
    }) };
  }), x);
};

/* Bloc requête : titre en étiquette (.toc-blk-t), puis la vue, calculée comme queryResult (vue figée : lecture, tri enregistré) */
function officeReqCle(nom, x) { return officeEtiquette(officeTexteSegs(nom), x); }   // .q-k
function officeReqNote(texte, x) { return '<p style="margin:0pt 0pt 6pt;font-size:' + officePt(12.5) + ';color:' + x.C.muted + '">' + esc(texte) + '</p>'; }
// source d'un résultat (.q-src) : page › section, en gris, sans lien (une ancre interne n'a pas de sens hors d'Ardoise)
function officeReqSource(r, x) {
  var pg = x.d.pages[r.x.pi], st = r.x.sec ? textOf(r.x.sec.type === 'step' ? r.x.sec.title : r.x.sec.html) : '';
  return '<span style="color:' + x.C.muted + ';font-size:' + officePt(12.5) + '">' + esc(pageTitle(pg, r.x.pi) + (st ? ' › ' + st : '')) + '</span>';
}
function officeReqCase(r, x) { return '<span style="color:' + x.acc + '">' + (r.done ? '☑' : '☐') + '</span>'; }
function officeReqElement(r, x) { return (r.par ? officeReqGris(esc(r.par + ' › '), x) : '') + x.segs(x.S(r.html)); }
function officeReqValeur(c, x) { var h = x.segs(x.S(c.v)); return c.alert ? '<span style="color:' + x.C.bad + '">' + h + '</span>' : h; }
// grille de cellules côte à côte (cartes de nombre, fiches regroupées) : k par ligne, séparées par une cellule vide ;
// une table par ligne, séparées par un paragraphe (Writer et Word fusionnent deux tables qui se suivent)
function officeReqGrille(items, k, x) {
  var l = Math.floor((100 - 2 * (k - 1)) / k) + '%', h = '';
  for (var i = 0; i < items.length; i += k) {
    var ligne = items.slice(i, i + k), cells = [];
    for (var j = 0; j < k; j++) {
      if (j) cells.push('<td width="2%"></td>');
      cells.push(ligne[j] ? officeCellule(ligne[j].html, ligne[j].style, l) : '<td width="' + l + '"></td>');
    }
    if (i) h += officeReqEspace('6pt');
    h += officeTable('<tr>' + cells.join('') + '</tr>', 'margin:0 0 6pt');
  }
  return h;
}
// vue « Nombre » (.q-count) : grand chiffre, « / total » gris, libellé en étiquette, trait accent ; barre de proportion en deux cellules
function officeReqNombre(cpt, x) {
  return officeReqGrille(cpt.map(function (c) {
    var pc = c.tot ? Math.min(100, Math.round(c.num * 100 / c.tot)) : 0;
    var barre = c.tot == null ? '' : officeTable('<tr>' + [[pc, x.acc], [100 - pc, x.C.line]].filter(function (p) { return p[0] > 0 || pc === 0 && p[1] === x.C.line; }).map(function (p) {
      return officeCellule('&nbsp;', 'background:' + p[1] + ';font-size:1pt;line-height:4.5pt', p[0] + '%');
    }).join('') + '</tr>', 'margin-top:6pt;margin-bottom:0pt');
    return { style: 'background:' + x.C.surface + ';border-top:1px solid ' + x.C.line + ';border-right:1px solid ' + x.C.line + ';border-bottom:1px solid ' + x.C.line + ';border-left:3px solid ' + x.acc + ';padding:12pt 15pt',
      html: '<p style="margin:0pt;line-height:1.1"><span style="font-size:' + officePt(34) + ';font-weight:bold;color:' + x.C.fg + '">' + c.num + '</span>' +
        (c.tot != null ? '<span style="font-size:' + officePt(18) + ';font-weight:600;color:' + x.C.muted + '"> / ' + c.tot + '</span>' : '') + '</p>' +
        officeEtiquette(officeTexteSegs(c.label), x, { px: 12, espace: '0.45pt', marges: 'margin-top:3pt;margin-bottom:0pt' }) + barre };
  }), Math.min(3, cpt.length), x);
}
// carte d'une requête « En colonnes » sur un kanban : titre, puis les champs choisis ; priorité, échéance et responsable voisins sur une ligne
function officeReqCarteKanban(b, r, x) {
  var k = r.kb, h = officeReqTitreCarte(x.segs(x.S(k.title))), meta = [];
  var fin = function () { h += officeReqMeta(meta); meta = []; };
  qChampsAffiches(b).forEach(function (c) {
    if (c.cle === 'priorite') meta.push(officeReqPrio(r.prio, x));
    else if (c.cle === 'echeance') meta.push(officeReqEcheance(k.due, r.late, x));
    else if (c.cle === 'responsable') meta.push(officeReqQui(k.who, x));
    else {
      fin();
      if (c.cle === 'texte') h += officeReqTexteCarte(x.S(k.html), x);
      else if (c.cle === 'attend' && r.attend.length) h += officeReqAttend(esc(qAttendTexte(r)), r.bloquee, x);
      else if (c.cle === 'source') h += officeReqLigne(officeReqSource(r, x));
    }
  });
  fin();
  return officeReqCarte(h, x, { prio: r.prio, bloquee: r.bloquee });
}
// vue « En colonnes » (qKanban) : une colonne par groupe ; cartes des autres sources : colonnes choisies sans celle du regroupement, Source à sa place
function officeReqEnColonnes(b, recs, x) {
  var src = b.src || 'facts', qg = qRegroupements(b, x.d, x.pi, recs), cc = src === 'kanban' ? null : qColonnesAffichees(b, recs);
  var carte = function (r) {
    if (src === 'kanban') return officeReqCarteKanban(b, r, x);
    var o = cc.cellsOf(r), kvs = [], h = '';
    var fin = function () { if (kvs.length) h += '<p style="margin:0pt">' + kvs.join(src === 'check' ? ' ' : ' &nbsp; ') + '</p>'; kvs = []; };
    cc.cols.forEach(function (c) {
      if (c.source) { fin(); h += '<p style="margin:0pt">' + officeReqSource(r, x) + '</p>'; }
      else if (c.coche) kvs.push(officeReqCase(r, x));
      else if (c.element) kvs.push(r.done ? officeReqGris(officeReqElement(r, x), x) : officeReqElement(r, x));
      else if (o[c.j] && 'c:' + c.nom.toLowerCase() !== qg.gb && !officeVide(x.S(o[c.j].v))) kvs.push(officeReqCle(c.nom, x) + ' ' + x.segs(x.S(o[c.j].v)));
    });
    fin();
    return officeReqCarte(h || '&nbsp;', x);
  };
  return officeReqColonnes(qg.groups.map(function (g) { return { titre: esc(g.name), n: g.recs.length, cartes: g.recs.map(carte) }; }), x);
}
// vue « Regroupée » (qRegroupee) : fiches (titre et compte, clés et valeurs uniques, nombre de lignes) ou tableau d'Ardoise
function officeReqRegroupee(b, recs, x) {
  var rg = qRegReglage(b, recs), sp = qRegTri(b, renderCtx(x.d, { page: x.pi, view: 'export' }), rg), gr = qGroupesTries(qRegrouper(recs, rg.x, rg.ys), sp.by, sp.dir), lim = Math.max(0, +b.limit || 0), tot = gr.length;
  if (lim && gr.length > lim) gr = gr.slice(0, lim);
  var titre = function (g) { return g.vide ? officeReqGris('(vide)', x) : x.segs(x.S(g.valeur)); };
  var uniques = function (g, y) { return g.uniques[y].map(function (v) { return x.segs(x.S(v)); }).join(', '); };
  var lignes = function (g) { return officeReqGris(g.n + (g.n > 1 ? ' lignes' : ' ligne'), x); };
  var h = b.regForme === 'tableau'
    ? officeTabTableau([[{ texte: rg.nom(rg.x) }]].concat(rg.ys.map(function (y) { return [{ texte: rg.nom(y) }]; }), [[{ texte: 'Lignes' }]]),
      gr.map(function (g) { return [titre(g)].concat(rg.ys.map(function (y) { return uniques(g, y); }), [lignes(g)]); }), x, { taille: 14 })
    : officeReqGrille(gr.map(function (g) {
      // fiche (.q-reg-f) : titre et compte, puis la fiche de faits bordée (clés en étiquette, valeurs en semi-gras)
      var faits = rg.ys.map(function (y, i) { return '<p style="margin-top:' + (i ? '9pt' : '0pt') + ';margin-bottom:0pt">' + officeReqCle(rg.nom(y), x) + '</p><p style="margin:0pt;font-weight:600">' + uniques(g, y) + '</p>'; }).join('');
      return { style: '', html: '<p style="margin:0pt 0pt 6pt;font-weight:600">' + titre(g) + ' ' + officeReqCompte(g.n, x) + '</p>' +
        (faits ? officeTable('<tr>' + officeCellule(faits, 'background:' + x.C.surface + ';border:1px solid ' + x.C.line + ';padding:9pt 10.5pt', '100%') + '</tr>', 'margin:0 0 6pt') : '') +
        '<p style="margin:0pt;font-size:' + officePt(12.5) + '">' + lignes(g) + '</p>' };
    }), 2, x);
  return h + (gr.length < tot ? officeReqNote(gr.length + ' premiers groupes sur ' + tot, x) : '');
}
// vue « Carte de chaleur » (qChaleurVue) : une colonne par X (titre et total), ses cases puis leurs sous-cases (« › ») alignées par rang,
// teintées par palier (officeChaleurTeinte), texte blanc au palier le plus foncé ; légende : minimum, cinq teintes, maximum, mesure
function officeReqChaleur(b, recs, x) {
  var ch = qChReglage(b, recs), m = qChaleur(recs, ch.x, ch.y, ch.z, ch.n);
  var nom = function (g) { return g.vide ? '(vide)' : x.segs(x.S(g.valeur)); };
  var pile = m.colonnes.map(function (col) { return col.cases.reduce(function (a, c) { return a.concat([{ g: c }], c.sous.map(function (s) { return { g: s, sous: true }; })); }, []); });
  var rangs = pile.reduce(function (n, p) { return Math.max(n, p.length); }, 0), lignes = [], fonds = [];
  lignes.push(m.colonnes.map(function (col) { return '<span style="font-weight:600;font-size:' + officePt(13.5) + '">' + (col.vide ? officeReqGris('(vide)', x) : x.segs(x.S(col.valeur))) + '</span> ' + officeReqCompte(qNombreAffiche(col.total), x); }));
  fonds.push([]);
  for (var ri = 0; ri < rangs; ri++) {
    lignes.push(pile.map(function (p) {
      var c = p[ri]; if (!c) return '';
      var pal = qChPalier(c.g.total, m.min, m.max), coul = pal === 4 ? '#ffffff' : x.C.fg;
      return '<span style="color:' + coul + (c.sous ? ';font-size:' + officePt(12) : '') + '">' + (c.sous ? '› ' : '') + nom(c.g) + '&nbsp; <span style="font-family:' + OFFICE_POLICES.mono + ';font-weight:600;font-size:' + officePt(12) + '">' + qNombreAffiche(c.g.total) + '</span></span>';
    }));
    fonds.push(pile.map(function (p) { return p[ri] ? officeChaleurTeinte(x.d, qChPalier(p[ri].g.total, m.min, m.max)) : null; }));
  }
  var cell = function (h, st, l) { return officeCellule(h, 'font-size:' + officePt(12.5) + ';' + (st || ''), l, 'middle'); };
  var legende = officeTable('<tr>' + cell(qNombreAffiche(m.min), 'text-align:right;font-family:' + OFFICE_POLICES.mono, '8%') +
    Q_CH_PALIERS.map(function (p, i) { return cell('&nbsp;', 'background:' + officeChaleurTeinte(x.d, i) + ';border:1px solid ' + x.C.line, '4%'); }).join('') +
    cell(qNombreAffiche(m.max), 'font-family:' + OFFICE_POLICES.mono, '8%') + cell(esc(ch.n ? 'somme de ' + ch.nom(ch.n) : 'nombre de lignes'), 'color:' + x.C.muted, '64%') + '</tr>', 'margin:0 0 6pt');
  return officeTabTableau(null, lignes, x, { taille: 13, fonds: fonds }) + officeReqEspace('6pt') + legende;
}
OFFICE_RENDUS.query = function (b, x) {
  var d = x.d, ctx = renderCtx(d, { page: x.pi, view: 'export' }), recs = queryRecords(b, d, x.pi), src = b.src || 'facts', view = b.view || 'table';
  var h = b.title ? officeEtiquette(officeTexteSegs(b.title), x, { marges: 'margin:0pt 0pt 6pt' }) : '';
  if (view === 'count') return h + officeReqNombre(qCompteurs(b, d, x.pi, recs), x);
  if (!recs.length && !qColonnesRetenues(b, d, x.pi, view)) return h + '<p style="margin:0pt 0pt 6pt;font-size:' + officePt(14) + ';color:' + x.C.muted + '">Aucun résultat.</p>';
  if (view === 'regroupee' && src === 'table') return h + officeReqRegroupee(b, recs, x);
  if (view === 'chaleur' && src === 'table') return h + officeReqChaleur(b, recs, x);
  recs = qSorted(b, d, ctx, recs);
  if (view === 'kanban') return h + officeReqEnColonnes(b, recs, x);
  var total = recs.length, lim = Math.max(0, +b.limit || 0);
  if (lim && recs.length > lim) recs = recs.slice(0, lim);
  var plus = recs.length < total ? officeReqNote(recs.length + ' premiers résultats sur ' + total, x) : '';
  var cc = qColonnesAffichees(b, recs, view === 'list');
  if (view === 'list') {
    // lignes encadrées (.q-list li) : valeurs voisines à la suite, Source là où elle est rangée ; cases : case, élément (coché : gris barré), source
    return h + officeTable(recs.map(function (r) {
      var o = cc.cellsOf(r), parts = [];
      if (src === 'check') cc.cols.forEach(function (c) { parts.push(c.coche ? officeReqCase(r, x) : c.element ? (r.done ? '<span style="color:' + x.C.muted + ';text-decoration:line-through">' + officeReqElement(r, x) + '</span>' : officeReqElement(r, x)) : officeReqSource(r, x)); });
      else cc.cols.forEach(function (c) {
        if (c.source) parts.push(officeReqSource(r, x));
        else if (c.attend) { if (qAttendTexte(r)) parts.push(officeReqCle('Attend', x) + ' ' + esc(qAttendTexte(r))); }
        else if (o[c.j] && !officeVide(x.S(o[c.j].v))) parts.push(officeReqCle(c.nom, x) + ' ' + officeReqValeur(o[c.j], x));
      });
      return '<tr>' + officeCellule(parts.join(src === 'check' ? ' ' : ' &nbsp; ') || officeReqGris('—', x), 'background:' + x.C.surface + ';border:1px solid ' + x.C.line + ';padding:6pt 9pt', '100%') + '</tr>';
    }).join(''), 'margin:0 0 6pt') + plus;
  }
  // vue tableau (.q-table) : tableau d'Ardoise à 14 px, lignes cochées en gris
  var cellule = function (c, r, o) { return c.source ? officeReqSource(r, x) : c.coche ? officeReqCase(r, x) : c.element ? officeReqElement(r, x) : c.attend ? esc(qAttendTexte(r)) : o[c.j] ? officeReqValeur(o[c.j], x) : ''; };
  var attenues = []; recs.forEach(function (r, i) { if (r.done) attenues.push(i); });
  return h + officeTabTableau(cc.cols.map(function (c) { return [{ texte: c.nom }]; }), recs.map(function (r) { var o = cc.cellsOf(r); return cc.cols.map(function (c) { return cellule(c, r, o); }); }), x, { taille: 14, attenues: attenues }) + plus;
};
