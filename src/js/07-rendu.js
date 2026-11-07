/* ---------- Rendu ---------- */
function hlLine(line) {
  var e = esc(line);
  return /^\s*(#(?!!)|\/\/|--\s|;|rem\s|%)/i.test(line) ? '<span class="c">' + e + '</span>' : e;
}
/* Le rendu est une fonction du document et d'un contexte, sans état de l'éditeur :
   ctx = { page: indice de la page, view: 'edit' | 'read' | 'export', folds: plis de lecture de la session (id → plié),
           sort: tris de lecture de la session (id → { by, dir }), navFolds: plis du sommaire latéral (id de page → ouvert),
           editor: { bar, map, panelMin, paste } (vue 'edit' seulement) } ; un champ absent prend la valeur neutre */
function rctx(ctx, d) {
  ctx = ctx || {};
  var view = ctx.view === 'edit' || ctx.view === 'export' ? ctx.view : 'read';
  var page = d ? Math.max(0, Math.min(d.pages.length - 1, +ctx.page || 0)) : +ctx.page || 0;   // indice borné aux pages du document
  return { page: page, view: view, folds: (view === 'read' && ctx.folds) || {}, sort: (view === 'read' && ctx.sort) || {},
    navFolds: ctx.navFolds || {}, editor: (view === 'edit' && ctx.editor) || {} };
}
// numéro affiché de chaque étape (id → numéro) : le numéro saisi, sinon un compteur qui repart du dernier nombre saisi ; étapes nonum exclues
function stepNums(blocks) {
  var out = {}, counter = 0;
  blocks.forEach(function (b) {
    if (b.type !== 'step' || b.nonum) return;
    var n = String(b.num || '').trim(), m = n.match(/(\d+)\D*$/);
    if (!n) n = String(++counter); else if (m) counter = +m[1];
    out[b.id] = n;
  });
  return out;
}
function renderPage(d, ctx) {
  ctx = rctx(ctx, d);
  var edit = ctx.view === 'edit', vf = ctx.folds, blocks = d.pages[ctx.page].blocks;
  // plis de lecture de la session ; sinon l'état enregistré
  var isF = function (b) { return vf[b.id] != null ? vf[b.id] : !!b.folded; };
  var out = [], open = false, nums = stepNums(blocks), fi = foldInfo(blocks, edit ? null : isF), reg = edit ? null : foldRegions(blocks);
  blocks.forEach(function (b) {
    if (edit && fi.hidden[b.id]) return;   // dans une section pliée (édition)
    if (b.type === 'step' || b.type === 'footer') { if (open) out.push('</section>'); open = false; }
    if (b.type === 'step') { out.push('<section class="step"' + (edit ? '' : ' data-fl="1"') + '>'); open = true; }
    var inner = renderBlock(b, d, ctx, nums[b.id] || null);
    if (!edit && inner) {
      // lecture : ancre des titres, niveau (data-fl) pour plier au clic, état plié, blocs masqués (data-fh)
      var lv = foldLevel(b), fold = lv > 0 && reg[b.id] > 0, folded = fold && isF(b), at = '';
      if (b.type === 'step' || b.type === 'h2' || b.type === 'h3') at += ' id="b-' + b.id + '"';
      if (lv >= 0) at += ' data-fl="' + lv + '"';
      if (folded) at += ' data-folded';
      if (fi.hidden[b.id]) at += ' data-fh';
      if (ctx.view === 'read') at += ' data-bid="' + b.id + '"';   // ancrage de la bascule vers l'édition (19-mode-lecture-edition.js)
      inner = inner.replace(/^<(\w+)/, '<$1' + at);
      if (fold) inner = inner.replace(/^(<\w+[^>]*>)/, '$1<button type="button" class="fold-v" data-vfold aria-expanded="' + !folded + '" title="Plier / déplier la section"></button>');
    }
    out.push(edit ? wrapEdit(b, inner, fi.count[b.id] || 0, ctx.editor) : inner);
  });
  if (open) out.push('</section>');
  if (edit) out.push('<button class="add-end" type="button" data-act="add-end">+ Ajouter un bloc</button>');
  return paintPills('<div class="wrap" style="--w:' + (+d.width || 820) + 'px">' + out.join('\n') + '</div>');
}
function renderBlock(b, d, ctx, num) {
  ctx = rctx(ctx);
  var e = ctx.view === 'edit', ued = ctx.editor;
  function f(tag, cls, k, val, o) {
    o = o || {};
    var rich = o.rich !== false, body = rich ? R(val) : esc(val);
    if (o.lines) body = linesHTML(body);   // paragraphe : retrait suspendu des lignes en retrait
    if (!e) return '<' + tag + (cls ? ' class="' + cls + '"' : '') + '>' + body + '</' + tag + '>';
    return '<' + tag + ' class="' + (cls ? cls + ' ' : '') + 'fld' + (o.soft ? ' soft' : '') + '" contenteditable="true" spellcheck="true" data-b="' + b.id + '" data-k="' + k + '"' +
      (rich ? ' data-rich' : '') + (o.li ? ' data-li' : '') + (o.cell ? ' data-cell' : '') + (o.ml ? ' data-ml' : '') + (o.nl ? ' data-nl' : '') +
      ' data-ph="' + esc(o.ph || '') + '">' + body + '</' + tag + '>';
  }
  function checks(base, arr) {
    if (!arr.length) return e ? '<button class="mini-add" type="button" data-act="item-add" data-k="' + base + '">+ case à cocher</button>' : '';
    // ordre d'affichage (liste à cocher) : l'ordre saisi reste celui du document ; les sous-éléments suivent leur parent
    var order = b.type === 'check' && (b.order === 'doneFirst' || b.order === 'doneLast') ? checkOrder(arr, b.order) : arr.map(function (x, k) { return k; });
    return '<ul class="check">' + order.map(function (i) {
      var it = arr[i], id = b.id + '-' + base.replace(/\./g, '-') + '-' + i;
      return '<li' + (it.lv > 0 ? ' class="lv-' + Math.min(6, +it.lv) + '"' : '') + '><input type="checkbox" id="' + id + '" data-b="' + b.id + '" data-k="' + base + '.' + i + '.done"' + (it.done ? ' checked' : '') + '>' +
        (e ? f('div', 'lbl', base + '.' + i + '.html', it.html, { li: 1, ph: 'Élément' }) : '<label for="' + id + '">' + R(it.html) + '</label>') + '</li>';
    }).join('') + '</ul>';
  }
  function ta(cls) {
    var lg = HL.resolve(b.lang, b.code, b.name);
    return '<div class="ta-wrap v-' + (cls || b.variant || 'dark') + '"><pre class="ta-hl" aria-hidden="true">' + HL.html(b.code, lg) + '\n</pre>' +
      '<textarea class="code-ta ' + (cls || '') + '" data-b="' + b.id + '" data-k="code" spellcheck="false" wrap="off" rows="1" placeholder="Coller ou écrire du code…">' + esc(b.code) + '</textarea></div>';
  }
  switch (b.type) {
    case 'header':
      return '<header class="b-header">' +
        (!b.noEyebrow && (e || b.eyebrow) ? f('span', 'eyebrow', 'eyebrow', b.eyebrow, { ph: 'Surtitre', nl: 1 }) : '') +
        f('h1', '', 'title', b.title, { ph: 'Titre de la page', nl: 1 }) +
        (!b.noLede && (e || !isBlank(b.lede)) ? f('p', 'lede', 'lede', b.lede, { ph: 'Chapeau : une ou deux phrases qui résument la page', nl: 1 }) : '') + '</header>';
    case 'h2': return f('h2', '', 'html', b.html, { ph: 'Titre de section', nl: 1 });
    case 'h3': return f('h3', '', 'html', b.html, { ph: 'Sous-section', nl: 1 });
    case 'subtitle': return f('p', 'subtitle', 'html', b.html, { ph: 'Sous-titre', nl: 1 });
    case 'p': return f('p', b.indent > 0 ? 'ind-' + Math.min(6, +b.indent) : '', 'html', b.html, { ph: 'Écrire, ou taper / pour insérer un bloc', soft: 1, lines: 1 });
    case 'step':
      var badge = '';
      if (num !== null) badge = e ? '<span class="num fld" contenteditable="true" data-b="' + b.id + '" data-k="num" data-nl data-ph="' + esc(num) + '">' + esc(b.num) + '</span>' : '<span class="num">' + esc(num) + '</span>';
      return '<div class="step-head">' + badge + f('h2', '', 'title', b.title, { ph: 'Titre de l’étape', nl: 1 }) + '</div>';
    case 'summary':
      var sl = summaryList(b, d, ctx.page);
      if (!e && !sl) return '';
      return '<nav class="toc-blk">' + ((e || b.title) ? f('p', 'toc-blk-t', 'title', b.title, { rich: false, ph: 'Titre (facultatif)', nl: 1 }) : '') +
        '<div class="toc-blk-l">' + (sl || summaryEmpty(b)) + '</div></nav>';
    case 'kanban': return kanbanHTML(b, ctx, f);
    case 'query':
      return '<div class="q-blk" data-qid="' + b.id + '">' + ((e || b.title) ? f('p', 'toc-blk-t', 'title', b.title, { rich: false, ph: 'Titre (facultatif)', nl: 1 }) : '') +
        (e ? queryForm(b, d, ctx) : '') + '<div class="q-res">' + queryResult(b, d, ctx) + '</div></div>';
    case 'facts':
      return '<dl class="facts">' + b.items.map(function (it, i) {
        return '<div class="fact">' + f('dt', '', 'items.' + i + '.k', it.k, { rich: false, ph: 'Clé' }) + f('dd', it.alert ? 'alert' : '', 'items.' + i + '.v', it.v, { ph: 'Valeur' }) +
          (e ? '<span class="itools"><button type="button" data-act="fact-alert" data-i="' + i + '" class="' + (it.alert ? 'on' : '') + '" title="Valeur en rouge">!</button><button type="button" data-act="fact-del" data-i="' + i + '" title="Supprimer">×</button></span>' : '') + '</div>';
      }).join('') + (e ? '<button class="add-item" type="button" data-act="fact-add">+ Ajouter</button>' : '') + '</dl>';
    case 'cards':
      return '<div class="subs" style="--min:' + (+b.min || 340) + 'px">' + b.cards.map(function (c, i) {
        return '<div class="sub">' + ((e || !isBlank(c.title)) ? f('h3', '', 'cards.' + i + '.title', c.title, { ph: 'Titre de la carte' }) : '') +
          ((e || !isBlank(c.text)) ? f('p', 'sub-text', 'cards.' + i + '.text', c.text, { ph: 'Texte (optionnel)', ml: 1, soft: 1 }) : '') +
          checks('cards.' + i + '.checks', c.checks) +
          (e ? '<span class="itools"><button type="button" data-act="card-del" data-i="' + i + '" title="Supprimer la carte">×</button></span>' : '') + '</div>';
      }).join('') + (e ? '<button class="add-item" type="button" data-act="card-add">+ Carte</button>' : '') + '</div>';
    case 'check': return checks('items', b.items) || (e ? '' : '');
    case 'list':
      // éléments à plat avec un niveau (lv) : rendus en listes imbriquées
      var tg = b.ordered ? 'ol' : 'ul', cur = -1, lo = '';
      b.items.forEach(function (it, i) {
        var lv = Math.max(0, Math.min(+it.lv || 0, cur + 1));
        if (cur < 0) { lo += '<' + tg + ' class="list">'; cur = 0; }
        else if (lv > cur) { lo += '<' + tg + '>'; cur = lv; }
        else { lo += '</li>'; while (cur > lv) { lo += '</' + tg + '></li>'; cur--; } }
        lo += '<li>' + (e ? f('span', '', 'items.' + i + '.html', it.html, { li: 1, ph: 'Élément' }) : R(it.html));
      });
      if (cur < 0) return '<' + tg + ' class="list"></' + tg + '>';
      lo += '</li>'; while (cur > 0) { lo += '</' + tg + '></li>'; cur--; }
      return lo + '</' + tg + '>';
    case 'code':
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
    case 'table':
      var rows = b.rows;
      return '<div class="tablewrap"><table><thead><tr>' + rows[0].map(function (c, j) { return f('th', '', 'rows.0.' + j, c, { ph: 'En-tête', cell: 1 }); }).join('') +
        '</tr></thead><tbody>' + rows.slice(1).map(function (r, i) {
          return '<tr>' + r.map(function (c, j) { return f('td', '', 'rows.' + (i + 1) + '.' + j, c, { cell: 1 }); }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
    case 'note':
      return '<div class="note n-' + esc(b.variant || 'warn') + '">' + f('p', '', 'html', b.html, { ph: 'Texte de l’encadré', ml: 1 }) + '</div>';
    case 'details':
      if (e) return '<div class="fold fold-edit"><div class="sum">' + f('span', '', 'title', b.title, { ph: 'Titre cliquable', nl: 1 }) + '</div>' + f('div', 'fold-body', 'html', b.html, { ph: 'Contenu révélé au clic', ml: 1 }) + '</div>';
      return '<details class="fold"' + (b.open ? ' open' : '') + '><summary>' + R(b.title) + '</summary><div class="fold-body">' + R(b.html) + '</div></details>';
    case 'image':
      if (!b.src) return e ? '<div class="img-new"><div class="img-drop" data-act="img-pick" data-b="' + b.id + '">Cliquer, déposer ou coller une image</div>' +
        '<div class="img-url"><input class="menu-q img-url-in" data-b="' + b.id + '" placeholder="… ou l’adresse d’une image : https://…" spellcheck="false" autocomplete="off" inputmode="url">' +
        '<button type="button" class="ub" data-act="img-url" title="Télécharger l’image et l’intégrer au document">Intégrer</button></div></div>' : '';
      return '<figure class="fig"><img src="' + esc(b.src) + '" alt="' + esc(b.alt || textOf(b.caption)) + '">' +
        ((e || !isBlank(b.caption)) ? f('figcaption', '', 'caption', b.caption, { ph: 'Légende (optionnelle)', nl: 1 }) : '') + '</figure>';
    case 'map':
      var mh = +b.height || 420, mks = b.markers || [], zns = b.zones || [], rts = b.routes || [];
      var mll = function (m) { return (+m.lat).toFixed(4) + ', ' + (+m.lon).toFixed(4); };
      var rdist = function (r) { if (!MapKit) MapKit = ardoiseMapKit(); return MapKit.fmtDist(MapKit.pathLen(r.pts)); };
      var zdesc = function (z) { return z.shape === 'circle' ? 'cercle de ' + String(+(z.r / 1000).toFixed(2)).replace('.', ',') + ' km' : z.pts.length + ' sommets'; };
      var mapEl = '<div class="map" data-mapid="' + b.id + '"' + (e ? '' : ' data-state="' + esc(JSON.stringify({ view: b.view, bg: b.bg, markers: mks, zones: zns, routes: rts, choro: chView(b, d) || undefined, cities: b.cities !== false, countries: b.countries !== false, lock: !!b.lock, hideBg: !!b.hideBg, key: d.mapKey || undefined })) + '"') +
        ' tabindex="0" role="application" aria-label="Carte" style="height:' + mh + 'px"><div class="map-nojs">Carte interactive : JavaScript nécessaire pour l’afficher.</div></div>';
      if (!e) {
        var li = mks.map(function (m, i) { return '<li><button type="button" data-go="' + i + '"><span class="mdot c-' + esc(m.color || 'accent') + '"></span>' + esc(m.label || 'Point ' + (i + 1)) + '</button><span class="muted">' + mll(m) + '</span></li>'; })
          .concat(zns.map(function (z, i) { return '<li><button type="button" data-gz="' + i + '"><span class="zdot c-' + esc(z.color || 'accent') + (z.shape === 'circle' ? ' round' : '') + '"></span>' + esc(z.label || 'Zone ' + (i + 1)) + '</button>' + (z.shape === 'circle' ? '<span class="muted">' + zdesc(z) + '</span>' : '') + '</li>'; }))
          .concat(rts.map(function (r, i) {
            var nm = (r.names || []).filter(function (n) { return n; });
            return '<li><button type="button" data-gr="' + i + '"><span class="rdot c-' + esc(r.color || 'accent') + '"></span>' + esc(r.label || 'Itinéraire ' + (i + 1)) + '</button><span class="muted">' + [r.hideDist ? '' : rdist(r), nm.length ? esc(nm.join(' → ')) : ''].filter(Boolean).join(' · ') + '</span></li>';
          }));
        return '<div class="mapblk">' + mapEl + ((b.list && li.length) ? '<ol class="map-list">' + li.join('') + '</ol>' : '') + '</div>';
      }
      var colorSel = function (cls, attr, cur) { return '<select class="' + cls + '" data-b="' + b.id + '" ' + attr + ' title="Couleur">' + MK_COLORS.map(function (c) { return opt(c[0], cur || 'accent', c[1]); }).join('') + '</select>'; };
      var mu = ued.map || {}, dk = mu.draw === b.id ? mu.kind : null, ed = mu.editOf === b.id ? mu.edit : null;
      var tool = function (kind, label, title) { return '<button type="button" class="ub out" data-act="map-draw" data-kind="' + kind + '" aria-pressed="' + (dk === kind) + '" title="' + title + '">' + label + '</button>'; };
      var edBtn = function (kind, i) { return '<button type="button" class="mk-b" data-act="shape-edit" data-kind="' + kind + '" data-i="' + i + '" aria-pressed="' + (!!ed && ed.kind === kind && ed.i === i) + '" title="Modifier sur la carte">✎</button>'; };
      return '<div class="mapblk">' + mapEl +
        '<div class="map-tools"><div class="map-search"><input type="text" class="map-q" data-b="' + b.id + '" placeholder="Ajouter un point : ville, port, ou « 48.38, -4.47 »" autocomplete="off" spellcheck="false"><div class="map-res" hidden></div></div>' +
        '<button type="button" class="ub out" data-act="map-addmode" aria-pressed="' + (mu.add === b.id) + '" title="Placer des points en cliquant sur la carte (Échap pour terminer)">＋ Point</button>' +
        tool('poly', '▱ Zone', 'Dessiner une zone sommet par sommet') + tool('circle', '○ Cercle', 'Dessiner une zone circulaire : centre puis rayon') + tool('route', '⤳ Itinéraire', 'Tracer un itinéraire étape par étape') +
        '<button type="button" class="ub out" data-act="ch-on" aria-pressed="' + !!b.choro + '" title="Colorer les pays selon une valeur (carte choroplèthe)">▦ Pays</button></div>' +
        '<p class="muted map-sum">' + (mks.length + zns.length + rts.length ? [mks.length ? mks.length + ' point' + (mks.length > 1 ? 's' : '') : '', zns.length ? zns.length + ' zone' + (zns.length > 1 ? 's' : '') : '', rts.length ? rts.length + ' itinéraire' + (rts.length > 1 ? 's' : '') : ''].filter(Boolean).join(' · ') + ' — cliquez sur la carte pour afficher la liste à gauche.' : 'Rien sur la carte : cherchez une ville ou un port, placez un point, dessinez une zone, un cercle ou un itinéraire.') + '</p>' +
        '<div class="mk-panel' + (ued.panelMin ? ' min' : '') + '" data-b="' + b.id + '"><div class="mk-panel-h"><span class="cheat-dot"></span><b>Éléments de la carte</b><span class="mk-cnt">' + (mks.length + zns.length + rts.length) + '</span><button type="button" data-act="panel-min" title="Réduire / afficher">' + (ued.panelMin ? '▸' : '–') + '</button></div>' +
        '<div class="mk-list">' + ((mks.length || zns.length || rts.length || b.choro) ? '' : '<p class="muted">Aucun élément pour l’instant.</p>') + choroPanel(b, d, ued) +
          (mks.length ? '<div class="mk-h">Points</div>' : '') + mks.map(function (m, i) {
            return '<div class="mk-item' + (ed && ed.kind === 'marker' && ed.i === i ? ' on' : '') + '"><div class="mk-l1"><span class="mdot c-' + esc(m.color || 'accent') + '"></span>' +
              '<input class="mk-in" data-b="' + b.id + '" data-mk="' + i + '" data-p="label" value="' + esc(m.label) + '" placeholder="Libellé du point">' +
              edBtn('marker', i) + '<button type="button" class="mk-b" data-go="' + i + '" title="Centrer la carte sur ce point">⌖</button><button type="button" class="mk-b" data-act="mk-del" data-i="' + i + '" title="Supprimer le point">×</button></div>' +
              '<div class="mk-l2">' + colorSel('mk-color', 'data-mk="' + i + '"', m.color) +
              '<input class="mk-in mk-ll" data-b="' + b.id + '" data-mk="' + i + '" data-p="ll" value="' + mll(m) + '" title="Latitude, longitude (Entrée pour valider)"></div></div>';
          }).join('') +
          (zns.length ? '<div class="mk-h">Zones</div>' : '') + zns.map(function (z, i) {
            return '<div class="mk-item' + (ed && ed.kind === 'zone' && ed.i === i ? ' on' : '') + '"><div class="mk-l1"><span class="zdot c-' + esc(z.color || 'accent') + (z.shape === 'circle' ? ' round' : '') + '"></span>' +
              '<input class="mk-in zn-in" data-b="' + b.id + '" data-zn="' + i + '" value="' + esc(z.label) + '" placeholder="Nom de la zone">' +
              edBtn('zone', i) + '<button type="button" class="mk-b" data-gz="' + i + '" title="Cadrer la carte sur cette zone">⌖</button><button type="button" class="mk-b" data-act="zone-del" data-i="' + i + '" title="Supprimer la zone">×</button></div>' +
              '<div class="mk-l2">' + colorSel('zn-color', 'data-zn="' + i + '"', z.color) +
              (z.shape === 'circle' ? '<span class="rd-u">rayon</span><input class="mk-in rd-in" data-b="' + b.id + '" data-zn="' + i + '" value="' + String(+(z.r / 1000).toFixed(2)).replace('.', ',') + '" title="Rayon en kilomètres (Entrée pour valider)"><span class="rd-u">km</span>'
                : '<span class="mk-n">' + z.pts.length + ' sommets</span>') + '</div></div>';
          }).join('') +
          (rts.length ? '<div class="mk-h">Itinéraires</div>' : '') + rts.map(function (r, i) {
            return '<div class="mk-item' + (ed && ed.kind === 'route' && ed.i === i ? ' on' : '') + '"><div class="mk-l1"><span class="rdot c-' + esc(r.color || 'accent') + '"></span>' +
              '<input class="mk-in rt-in" data-b="' + b.id + '" data-rt="' + i + '" value="' + esc(r.label) + '" placeholder="Nom de l’itinéraire">' +
              edBtn('route', i) + '<button type="button" class="mk-b" data-gr="' + i + '" title="Cadrer la carte sur cet itinéraire">⌖</button><button type="button" class="mk-b" data-act="route-del" data-i="' + i + '" title="Supprimer l’itinéraire">×</button></div>' +
              '<div class="mk-l2">' + colorSel('rt-color', 'data-rt="' + i + '"', r.color) + '<span class="mk-n">' + r.pts.length + ' étapes · ' + rdist(r) + '</span>' +
              '<button type="button" class="mk-b mk-t" data-act="route-dist" data-i="' + i + '" aria-pressed="' + !r.hideDist + '" title="Afficher la distance sur la carte">km</button></div>' +
              ((ed && ed.kind === 'route' && ed.i === i) ? r.pts.map(function (pt, j) {
                return '<div class="mk-row st-row"><span class="st-n">' + (j + 1) + '</span><input class="mk-in st-in" data-b="' + b.id + '" data-rt="' + i + '" data-s="' + j + '" value="' + esc((r.names || [])[j] || '') + '" placeholder="' + (j === 0 ? 'Départ' : j === r.pts.length - 1 ? 'Arrivée' : 'Étape ' + (j + 1)) + ' (facultatif)">' +
                  '<span class="st-ll">' + (+pt[0]).toFixed(3) + ', ' + (+pt[1]).toFixed(3) + '</span></div>';
              }).join('') : '') + '</div>';
          }).join('') + '</div></div></div>';
    case 'timeline':
      var its = b.items || [];
      var SEGS = [['solid', 'Plein'], ['dashed', 'Tirets'], ['dotted', 'Pointillés'], ['gap', 'Plein coupé'], ['dgap', 'Tirets coupés'], ['none', 'Aucune']];
      var segOf = function (k) { var it = its[k] || {}; var st = it.segs || 'solid'; return { st: st, base: st === 'gap' ? 'solid' : st === 'dgap' ? 'dashed' : st, cut: st === 'gap' || st === 'dgap', label: it.segl || '' }; };
      var segRow = function (k) {
        // ligne entre l'événement k et le suivant (verticale)
        var sg = segOf(k);
        if (!e && !sg.label && !sg.cut) return '';
        var rail = sg.cut ? '<span class="rl ca s-' + sg.base + '"></span><span class="rl cb s-' + sg.base + '"></span>' : '<span class="rl full s-' + sg.base + '"></span>';
        var body = e ? '<select class="tl-seg-sel" data-b="' + b.id + '" data-i="' + k + '" title="Type de ligne vers l’événement suivant">' + SEGS.map(function (x) { return opt(x[0], sg.st, x[1]); }).join('') + '</select>' +
            f('span', 'tl-seg-lbl', 'items.' + k + '.segl', sg.label, { rich: false, ph: 'Libellé du lien (facultatif)', nl: 1 })
          : '';
        return '<li class="tl-v-seg' + (sg.label || e ? ' has-l' : '') + '"><div class="tl-v-slab">' + (!e && sg.label ? '<span class="tl-seg-txt">' + esc(sg.label) + '</span>' : '') + '</div>' +
          '<div class="tl-v-rail">' + rail + '</div><div class="tl-v-sbody">' + body + '</div></li>';
      };
      var tlv = '<ol class="tl-v">' + its.map(function (it, i) {
        var up = i > 0 ? '<span class="rl up s-' + segOf(i - 1).base + '"></span>' : '', dn = i < its.length - 1 ? '<span class="rl dn s-' + segOf(i).base + '"></span>' : '';
        return '<li class="tl-v-item c-' + esc(it.color || 'accent') + '">' +
          ((e || it.date) ? f('div', 'tl-v-date', 'items.' + i + '.date', it.date, { rich: false, ph: 'Date', nl: 1 }) : '<div class="tl-v-date"></div>') +
          '<div class="tl-v-rail">' + up + dn + (e ? '<button type="button" class="tl-dot" data-act="tl-color" data-i="' + i + '" title="Changer la couleur"></button>' : '<i class="tl-dot"></i>') + '</div>' +
          '<div class="tl-v-body">' + f('div', 'tl-v-title', 'items.' + i + '.title', it.title, { ph: 'Titre de l’événement', nl: 1 }) +
          ((e || !isBlank(it.text)) ? f('div', 'tl-v-text', 'items.' + i + '.text', it.text, { ph: 'Description (facultative)', ml: 1, soft: 1 }) : '') +
          (e ? '<span class="tl-tools"><button type="button" data-act="tl-up" data-i="' + i + '" title="Monter">↑</button><button type="button" data-act="tl-down" data-i="' + i + '" title="Descendre">↓</button><button type="button" data-act="tl-ins" data-i="' + i + '" title="Insérer un événement dessous">+</button><button type="button" data-act="tl-del" data-i="' + i + '" title="Supprimer">×</button></span>' : '') +
          '</div></li>' + (i < its.length - 1 ? segRow(i) : '');
      }).join('') + '</ol>' + (e ? '<button class="add-item tl-add" type="button" data-act="tl-add">+ Événement</button>' : '');
      if (b.orient !== 'h') return '<div class="tl">' + tlv + '</div>';
      var det = its.filter(function (it) { return !isBlank(it.text); }), cardsOn = det.length && !b.noCards, tips = !e && !cardsOn;
      var tlh = '<div class="tl-h' + (tips ? ' tl-tips' : '') + (b.segPos === 'below' ? ' lb-below' : ' lb-above') + '"><div class="tl-h-in" style="--n:' + Math.max(1, its.length) + '">' + its.map(function (it, i) {
        var tt = textOf(it.title) || 'Événement ' + (i + 1);
        return '<div class="tl-h-item c-' + esc(it.color || 'accent') + (i === 0 ? ' first' : '') + (i === its.length - 1 ? ' last' : '') + '"' + (tips ? ' tabindex="0" aria-label="' + esc(tt + (it.date ? ', ' + it.date : '')) + '"' : '') + '>' +
          (!tips ? '' : '<div class="tl-h-tip" hidden>' + (it.date ? '<span class="tb-d">' + esc(it.date) + '</span>' : '') + '<b>' + (isBlank(it.title) ? esc(tt) : R(it.title)) + '</b>' + (isBlank(it.text) ? '' : '<div class="tb-x">' + R(it.text) + '</div>') + '</div>') +
          (i > 0 ? '<span class="tl-sl s-' + segOf(i - 1).base + (segOf(i - 1).cut ? ' cut' : '') + '"></span>' : '') +
          (i < its.length - 1 ? '<span class="tl-sr s-' + segOf(i).base + (segOf(i).cut ? ' cut' : '') + '"></span>' + (segOf(i).label ? '<span class="tl-h-seg" title="' + esc(segOf(i).label) + '">' + esc(segOf(i).label) + '</span>' : '') : '') +
          '<span class="tl-h-title">' + (isBlank(it.title) ? esc(tt) : R(it.title)) + '</span><i class="tl-dot"></i><span class="tl-h-date">' + esc(it.date) + '</span></div>';
      }).join('') + '</div></div>';
      if (e) return '<div class="tl">' + tlh + '<div class="tl-edit-h"><div class="mk-h">Événements (à modifier ici)</div>' + tlv + '</div></div>';
      return '<div class="tl">' + tlh + (cardsOn ? '<div class="tl-det">' + det.map(function (it) {
        return '<div class="tl-card c-' + esc(it.color || 'accent') + '"><div class="tl-card-h"><i class="tl-dot"></i><span class="tl-h-date">' + esc(it.date) + '</span></div><div class="tl-card-t">' + R(it.title) + '</div><div class="tl-card-x">' + R(it.text) + '</div></div>';
      }).join('') + '</div>' : '') + '</div>';
    case 'divider': return '<hr class="sep">';
    case 'footer': return '<footer class="b-foot">' + f('div', '', 'html', b.html, { ph: 'Sources, auteur, date…', ml: 1 }) + '</footer>';
  }
  return '';
}
function checkOrder(arr, order) {
  // indices des éléments dans l'ordre d'affichage : à chaque niveau, cochés avant ou après les autres (tri stable)
  var root = { kids: [] }, stack = [{ lv: -1, n: root }];
  arr.forEach(function (it, i) {
    var lv = +it.lv || 0, n = { i: i, done: !!it.done, kids: [] };
    while (stack.length > 1 && stack[stack.length - 1].lv >= lv) stack.pop();
    stack[stack.length - 1].n.kids.push(n); stack.push({ lv: lv, n: n });
  });
  var out = [];
  (function walk(list) {
    list.map(function (n, k) { return { n: n, k: k }; }).sort(function (x, y) {
      var dx = x.n.done ? 1 : 0, dy = y.n.done ? 1 : 0; if (order === 'doneFirst') { dx = 1 - dx; dy = 1 - dy; }
      return dx - dy || x.k - y.k;
    }).forEach(function (x) { out.push(x.n.i); walk(x.n.kids); });
  })(root.kids);
  return out;
}
function summaryDepth(b) {
  // nombre de niveaux affichés (0 : tous) ; blocs plus anciens : « deep » (sous-niveaux oui / non)
  if (b.depth != null && b.depth !== '') return Math.max(0, +b.depth || 0);
  return b.deep === false ? 1 : 0;
}
function summaryItems(b, d, pi) {
  // entrées du bloc sommaire de la page pi : [{ t, n, href, kids }]
  var pages = d.pages, pg = pages[pi], cmp = function (x, y) { return x.t.localeCompare(y.t, 'fr', { numeric: true, sensitivity: 'base' }); }, out = [], dp = summaryDepth(b);
  if (b.src === 'pages') {
    var mkp = function (j, lv) { return { t: pageTitle(pages[j], j), href: '#pg-' + pages[j].id, kids: !dp || lv < dp ? pageKids(pages, j).map(function (k) { return mkp(k, lv + 1); }) : [] }; };
    out = pageKids(pages, pi).map(function (j) { return mkp(j, 1); });
  } else {
    sectionsOf(pg).forEach(function (x) {
      var it = { t: x.t, n: x.n, href: '#pg-' + pg.id + '/' + x.id, kids: [] };
      if (x.lv === 1 || !out.length) out.push(it); else if (dp !== 1) out[out.length - 1].kids.push(it);
    });
  }
  if (b.sort === 'alpha') (function srt(arr) { arr.sort(cmp); arr.forEach(function (it) { srt(it.kids); }); })(out);
  return out;
}
function summaryList(b, d, pi) {
  var items = summaryItems(b, d, pi);
  function ol(arr) { return '<ol>' + arr.map(function (it) { return '<li><a href="' + esc(it.href) + '">' + (it.n ? '<span class="toc-n">' + esc(it.n) + '</span>' : '') + '<span>' + esc(it.t) + '</span></a>' + (it.kids.length ? ol(it.kids) : '') + '</li>'; }).join('') + '</ol>'; }
  return items.length ? ol(items) : '';
}
function summaryEmpty(b) {
  return '<p class="muted toc-blk-e">' + (b.src === 'pages' ? 'Cette page n’a pas encore de sous-pages : « + » à côté de son nom dans le sommaire, ou glissez-y une page.'
    : 'Aucune section dans cette page : ajoutez des titres de section, des étapes ou des sous-sections.') + '</p>';
}
function opt(v, cur, label) { return '<option value="' + v + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + label + '</option>'; }
function tog(prop, on, label, title) { return '<button type="button" data-act="toggle" data-prop="' + prop + '" aria-pressed="' + (on ? 'true' : 'false') + '" title="' + (title || '') + '">' + label + '</button>'; }
function act(a, label, title, extra) { return '<button type="button" data-act="' + a + '" title="' + (title || '') + '"' + (extra || '') + '>' + label + '</button>'; }
function settings(b) {
  switch (b.type) {
    case 'header': return tog('noEyebrow', !b.noEyebrow, 'Surtitre', 'Afficher le surtitre (son texte est conservé quand il est masqué)') + tog('noLede', !b.noLede, 'Chapeau', 'Afficher le chapeau (son texte est conservé quand il est masqué)');
    case 'step': return tog('nonum', !b.nonum, '#', 'Afficher le numéro') ;
    case 'summary': return '<select data-act="set" data-prop="src" title="Contenu du sommaire">' + opt('sec', b.src, 'Sections') + opt('pages', b.src, 'Sous-pages') + '</select>' +
      '<select data-act="set" data-prop="sort" title="Ordre">' + opt('doc', b.sort, 'Ordre de la page') + opt('alpha', b.sort, 'Alphabétique') + '</select>' +
      '<select data-act="set" data-prop="depth" title="Nombre de niveaux affichés">' + (b.src === 'pages'
        ? opt(1, summaryDepth(b), '1 niveau') + opt(2, summaryDepth(b), '2 niveaux') + opt(3, summaryDepth(b), '3 niveaux') + opt(0, summaryDepth(b), 'Tous les niveaux')
        : opt(1, summaryDepth(b) === 1 ? 1 : 0, 'Sections seules') + opt(0, summaryDepth(b) === 1 ? 1 : 0, 'Sections et sous-sections')) + '</select>';
    case 'facts': return act('fact-add', '+ fait', 'Ajouter un fait');
    case 'cards': return act('card-add', '+ carte', 'Ajouter une carte') + '<select data-act="set" data-prop="min" title="Largeur des cartes">' + opt(340, b.min, 'Larges') + opt(220, b.min, 'Étroites') + opt(600, b.min, 'Pleine') + '</select>';
    case 'check': return act('item-add', '+ case', 'Ajouter une case', ' data-k="items"') + act('check-reset', '↺', 'Tout décocher') +
      '<select data-act="set" data-prop="order" title="Ordre d’affichage (l’ordre saisi est conservé)">' + opt('manual', b.order || 'manual', 'Ordre saisi') + opt('doneFirst', b.order, 'Cochées en premier') + opt('doneLast', b.order, 'Cochées à la fin') + '</select>';
    case 'list': return tog('ordered', b.ordered, '1.', 'Liste numérotée');
    case 'code': return '<select data-act="set" data-prop="variant" title="Style">' + opt('dark', b.variant, 'Sombre') + opt('box', b.variant, 'Boîte + fichier') + opt('cmd', b.variant, 'Commande') + '</select>' +
      '<select data-act="set" data-prop="lang" title="Langage pour la coloration">' + Object.keys(HL.names).map(function (k) {
        return opt(k, b.lang || 'auto', k === 'auto' ? 'Auto (' + HL.names[HL.detect(String(b.code || ''), b.name)] + ')' : HL.names[k]);
      }).join('') + '</select>' +
      (b.variant !== 'cmd' ? tog('tall', b.tall, '↕', 'Limiter la hauteur (défilement)') : '');
    case 'table': return act('row-add', '+L', 'Ajouter une ligne') + act('col-add', '+C', 'Ajouter une colonne') + act('row-del', '−L', 'Supprimer la ligne active') + act('col-del', '−C', 'Supprimer la colonne active');
    case 'note': return '<select data-act="set" data-prop="variant" title="Style">' + opt('warn', b.variant, 'Attention') + opt('info', b.variant, 'Info') + opt('bad', b.variant, 'Alerte') + opt('ok', b.variant, 'Succès') + opt('line', b.variant, 'Trait seul') + '</select>';
    case 'details': return tog('open', b.open, 'Ouvert', 'Ouvert par défaut en lecture');
    case 'timeline': return '<select data-act="set" data-prop="orient" title="Orientation">' + opt('v', b.orient || 'v', 'Verticale') + opt('h', b.orient || 'v', 'Horizontale (45°)') + '</select>' + (b.orient === 'h' ? '<select data-act="set" data-prop="segPos" title="Position des libellés de liens">' + opt('above', b.segPos || 'above', 'Libellés au-dessus') + opt('below', b.segPos || 'above', 'Libellés en dessous') + '</select>' + tog('noCards', !b.noCards, 'Fiches', 'Afficher les fiches de description sous la frise') : '') + act('tl-add', '+ événement', 'Ajouter un événement à la fin');
    case 'map': return '<select data-act="set" data-prop="height" title="Hauteur">' + opt(300, b.height, 'Petite') + opt(420, b.height, 'Moyenne') + opt(560, b.height, 'Grande') + '</select>' +
      '<select data-act="set" data-prop="bg" title="Fond affiché à l’ouverture">' + opt('vector', b.bg, 'Simplifié') + opt('plan', b.bg, 'Plan') + opt('sat', b.bg, 'Satellite') + '</select>' +
      tog('list', b.list, 'Liste', 'Afficher la liste des points et zones en lecture') + tog('countries', b.countries !== false, 'Pays', 'Afficher les noms des pays sur le fond simplifié (avec des données par pays, le réglage « Étiquettes » peut les afficher sur les pays colorés)') + tog('cities', b.cities !== false, 'Villes', 'Afficher les villes sur le fond simplifié') +
      tog('lock', b.lock, 'Figée', 'Lecture : empêcher de déplacer et de zoomer la carte') + tog('hideBg', b.hideBg, 'Fond fixe', 'Lecture : masquer le bouton de changement de fond');
    case 'image': return b.src ? act('img-pick', 'Remplacer', 'Remplacer l’image par un fichier') + act('img-url', 'Adresse…', 'Remplacer l’image par une image en ligne (téléchargée et intégrée au document)') + act('img-alt', 'Alt', 'Texte alternatif') : '';
  }
  return '';
}
function foldLevel(b) { return b.type === 'step' || b.type === 'h2' ? 1 : b.type === 'h3' ? 2 : b.type === 'header' || b.type === 'footer' ? 0 : -1; }
function foldRegions(blocks) {
  // nombre de blocs de chaque section (titre de section, étape, sous-section), pliée ou non
  var n = {}, levels = blocks.map(foldLevel);
  blocks.forEach(function (b, i) {
    if (levels[i] <= 0) return;
    // ce que ce titre masquerait s'il était seul plié (règle de Reader.foldHidden)
    n[b.id] = Reader.foldHidden(levels, levels.map(function (_, j) { return j === i; })).filter(function (h) { return h === i; }).length;
  });
  return n;
}
function foldInfo(blocks, isFolded) {
  // blocs masqués par une section pliée (règle de Reader.foldHidden, la même que la page exportée)
  // hidden : id du bloc → id du titre plié qui le masque ; count : nombre de blocs masqués par titre
  var hidden = {}, count = {};
  var r = Reader.foldHidden(blocks.map(foldLevel), blocks.map(function (b) { return isFolded ? isFolded(b) : b.folded; }));
  r.forEach(function (h, i) { if (h < 0) return; var hid = blocks[h].id; hidden[blocks[i].id] = hid; count[hid] = (count[hid] || 0) + 1; });
  return { hidden: hidden, count: count };
}
function revealBlock(id) {
  // déplie les sections qui masquent ce bloc
  for (var n = 0; n < 20; n++) { var h = foldInfo(doc.blocks).hidden[id], hb = h && byId(h); if (!hb) return; delete hb.folded; }
}
function wrapEdit(b, inner, nHidden, ued) {
  var s = settings(b), fl = foldLevel(b) > 0;
  return '<div class="blk' + (ued && ued.bar != null && b.id === ued.bar ? ' bar-on' : '') + (fl && b.folded ? ' folded' : '') + '" data-id="' + b.id + '" data-type="' + b.type + '"' + (fl ? ' data-fold' : '') + '>' +
    (fl ? '<button type="button" class="fold-t" data-act="fold" aria-expanded="' + !b.folded + '" title="' + (b.folded ? 'Déplier' : 'Plier') + ' la section (en édition seulement)">›</button>' : '') +
    '<div class="blk-gut"><button type="button" class="g-add" data-act="add-after" title="Insérer un bloc dessous">+</button><button type="button" class="g-drag" data-act="drag" title="Glisser pour déplacer">⋮⋮</button></div>' +
    '<div class="blk-bar"><span class="tname">' + T[b.type].label + '</span>' + (s ? '<span class="bsep"></span>' + s : '') + '<span class="bsep"></span>' +
    act('add-after', '+', 'Insérer un bloc dessous') + act('up', '↑', 'Monter (Alt+↑)') + act('down', '↓', 'Descendre (Alt+↓)') + act('dup', '⧉', 'Dupliquer') +
    '<button type="button" class="del" data-act="del" title="Supprimer">✕</button></div>' + inner +
    (fl && b.folded ? '<button type="button" class="fold-more" data-act="fold">' + (nHidden ? '⋯ ' + nHidden + ' bloc' + (nHidden > 1 ? 's' : '') + ' masqué' + (nHidden > 1 ? 's' : '') : 'Section pliée, sans contenu') + ' · déplier</button>' : '') + '</div>';
}

function pageHeader(pg) { return pg.blocks.filter(function (b) { return b.type === 'header'; })[0] || null; }
function pageTitle(pg, i) {
  // le nom d'une page est le grand titre de son en-tête ; à défaut, le nom saisi ; sinon « Page N »
  var h = pageHeader(pg), t = h ? textOf(h.title) : '';
  return t || (pg.title || '').trim() || 'Page ' + (i + 1);
}
function curTitle() { return pageTitle(doc.pages[doc.cur], doc.cur); }
function sectionsOf(pg) {
  var out = [], nums = stepNums(pg.blocks);
  pg.blocks.forEach(function (b) {
    if (b.type === 'step') out.push({ id: b.id, t: textOf(b.title) || 'Étape', n: nums[b.id] || null, lv: 1 });
    else if (b.type === 'h2') out.push({ id: b.id, t: textOf(b.html) || 'Section', lv: 1 });
    else if (b.type === 'h3') out.push({ id: b.id, t: textOf(b.html) || 'Sous-section', lv: 2 });
  });
  return out;
}
/* Arborescence des pages : liste à plat (ordre de lecture), chaque page a un niveau (lv, absent = 0) ;
   les sous-pages d'une page la suivent directement, avec un niveau de plus */
function pageLv(pages, i) { return +pages[i].lv || 0; }
function pageEnd(pages, i) { var lv = pageLv(pages, i), j = i + 1; while (j < pages.length && pageLv(pages, j) > lv) j++; return j; }   // fin de la page et de ses sous-pages (exclue)
function pageParent(pages, i) { var lv = pageLv(pages, i); for (var j = i - 1; j >= 0; j--) if (pageLv(pages, j) < lv) return j; return -1; }
function pageRoot(pages, i) { var p; while ((p = pageParent(pages, i)) >= 0) i = p; return i; }
function pageAncestors(pages, i) { var out = []; while ((i = pageParent(pages, i)) >= 0) out.push(i); return out; }
function pageKids(pages, i) { var out = [], lv = pageLv(pages, i), end = pageEnd(pages, i); for (var j = i + 1; j < end; j++) if (pageLv(pages, j) === lv + 1) out.push(j); return out; }
function prevSibling(pages, i) { var lv = pageLv(pages, i); for (var j = i - 1; j >= 0; j--) { var l = pageLv(pages, j); if (l === lv) return j; if (l < lv) return -1; } return -1; }
function nextSibling(pages, i) { var j = pageEnd(pages, i); return j < pages.length && pageLv(pages, j) === pageLv(pages, i) ? j : -1; }
var viewFold = {};   // sections pliées / dépliées en lecture (id → plié) : jamais enregistré
var navFold = {};   // pages dépliées (true) ou repliées (false) à la main dans le sommaire, mémorisé par document dans ce navigateur
function loadNavFold(d) { d = d || doc; try { navFold = JSON.parse(localStorage.getItem(LS + 'fold:' + d.id) || '{}') || {}; } catch (_) { navFold = {}; } }
function saveNavFold() { try { localStorage.setItem(LS + 'fold:' + doc.id, JSON.stringify(navFold)); } catch (_) {} }
function navHTML(d, ctx) {
  // vue 'export' : toutes les pages sont présentes et le script de la page exportée bascule de l'une à l'autre
  ctx = rctx(ctx, d);
  var edit = ctx.view === 'edit', all = ctx.view === 'export', nf = ctx.navFolds;
  var pages = d.pages, cur = ctx.page, w = +d.width || 820, curRoot = pageRoot(pages, cur), anc = pageAncestors(pages, cur);
  var roots = pages.map(function (pg, i) { return i; }).filter(function (i) { return pageLv(pages, i) === 0; });
  var menu = function (i, always) { return edit && (always || i === cur) ? '<button type="button" class="pnav-m" data-pgm="' + i + '" title="Options de la page" aria-label="Options de la page">⋯</button>' : ''; };
  var pgBtn = function (cls, i) { return '<button type="button" class="' + cls + '" data-pg="' + i + '" data-pgg="' + pageRoot(pages, i) + '"' + (i === cur ? ' aria-current="page"' : '') + '>' + esc(pageTitle(pages[i], i)) + '</button>'; };
  var tab = function (i) { var dl = pageLv(pages, i); return '<span class="ptab-w' + (i === cur || (i === curRoot && !all) ? ' on' : '') + (dl > 1 ? ' d' + Math.min(dl, 4) : '') + '">' + pgBtn('ptab', i) + menu(i) + '</span>'; };
  // onglets : pages de premier niveau, puis une seconde rangée avec toutes les sous-pages de la page affichée
  var tabs = '<nav class="pnav-tabs" aria-label="Pages"><div class="tabs-in" style="max-width:' + w + 'px">' + roots.map(tab).join('') +
    (edit ? '<button type="button" class="ptab-add" data-pgadd title="Ajouter une page">+ Page</button>' : '') + '</div>' +
    roots.map(function (g) {
      var end = pageEnd(pages, g); if (end === g + 1 || (!all && g !== curRoot)) return '';
      var desc = []; for (var j = g + 1; j < end; j++) desc.push(j);
      return '<div class="tabs-sub" data-grp="' + g + '" style="max-width:' + w + 'px"' + (g === curRoot ? '' : ' hidden') + '>' + desc.map(tab).join('') + '</div>';
    }).join('') + '</nav>';
  // sommaire : arborescence repliable (la page affichée et ses parents sont dépliés, sauf choix contraire)
  var entry = function (i) {
    var kids = pageKids(pages, i), secs = (all || i === cur) ? sectionsOf(pages[i]) : [];
    var open = !!kids.length && (nf[pages[i].id] != null ? nf[pages[i].id] : anc.indexOf(i) >= 0 || i === cur);
    var fold = kids.length ? '<button type="button" class="toc-f" data-pgfold aria-expanded="' + open + '" title="Afficher / masquer les sous-pages">›</button>' : '<span class="toc-f"></span>';
    return '<li class="toc-p' + (i === cur ? ' on' : '') + (kids.length ? ' has-kids' + (open ? ' open' : '') : '') + '" data-pgi="' + i + '">' +
      '<div class="toc-pr"' + (edit ? ' draggable="true"' : '') + '>' + fold + pgBtn('toc-pb', i) +
      (edit ? '<button type="button" class="toc-a" data-pgsub="' + i + '" title="Nouvelle sous-page" aria-label="Nouvelle sous-page">+</button>' + menu(i, true) : '') + '</div>' +
      (secs.length ? '<ol class="toc-s">' + secs.map(function (x) {
        return '<li class="lv' + x.lv + '"><a href="#b-' + x.id + '" data-sec="' + x.id + '">' + (x.n ? '<span class="toc-n">' + esc(x.n) + '</span>' : '') + '<span>' + esc(x.t) + '</span></a></li>';
      }).join('') + '</ol>' : '') +
      (kids.length ? '<ol class="toc-c">' + kids.map(entry).join('') + '</ol>' : '') + '</li>';
  };
  var side = '<aside class="pnav-side" aria-label="Sommaire"><ol class="toc">' + roots.map(entry).join('') + '</ol>' +
    (edit ? '<button type="button" class="toc-add" data-pgadd>+ Page</button>' : '') + '</aside>';
  return tabs + side;
}
function navReveal(keep) {
  // garde visible la page affichée dans le sommaire (qui défile) et dans les onglets
  var side = $('.pnav-side', app), tabs = $('.pnav-tabs .tabs-in', app), sub = $('.pnav-tabs .tabs-sub:not([hidden])', app);
  if (keep) { if (side) side.scrollTop = keep.side; if (tabs) tabs.scrollLeft = keep.tabs; }
  [[side, '.toc-p.on > .toc-pr', 'y'], [tabs, '.ptab-w.on', 'x'], [sub, '.ptab-w.on', 'x']].forEach(function (z) {
    var box = z[0], el = box && $(z[1], box); if (!el || box.offsetParent === null) return;
    var r = el.getBoundingClientRect(), br = box.getBoundingClientRect();
    if (z[2] === 'y' && (r.top < br.top || r.bottom > br.bottom)) box.scrollTop += r.top - br.top - br.height / 3;
    if (z[2] === 'x' && (r.left < br.left || r.right > br.right)) box.scrollLeft += r.left - br.left - 24;
  });
}
function applyTheme() {
  var r = document.documentElement;
  r.setAttribute('data-palette', doc.palette);
  r.setAttribute('data-typo', doc.typo);
  var th = mode === 'view' && viewerTheme ? viewerTheme : doc.theme;   // en lecture, le thème choisi par le lecteur l'emporte
  if (th === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', th);
  r.classList.toggle('is-edit', mode === 'edit');
  r.setAttribute('data-npages', doc.pages.length); r.setAttribute('data-nav', doc.nav || 'auto'); r.setAttribute('data-w', +doc.width || 820);
  Reader.navLayout(); paintFavicon();
  document.title = curTitle();
}
var navSpyFn = null, lastNav = '', derivedT = 0;
var pointerBusy = false, navPending = false;
function refreshDerived() {
  // après une saisie : met à jour ce qui découle du contenu sans tout redessiner (le curseur et le clic en cours sont préservés)
  clearTimeout(derivedT); derivedT = 0;
  if (!doc) return;
  var vc = viewCtx(), nh = navHTML(doc, vc);
  if (nh !== lastNav && !$('.pnav-in', app)) {
    var tmp = document.createElement('div'); tmp.innerHTML = nh;
    var side = $('.pnav-side', app), ns = tmp.querySelector('.pnav-side'), ot = $('.pnav-tabs', app), nt = tmp.querySelector('.pnav-tabs');
    var shape = function (root) { return root ? $$('[data-pg],a[data-sec]', root).map(function (x) { return x.getAttribute('data-pg') || x.getAttribute('data-sec'); }).join('|') : ''; };
    if (side && ns && ot && nt && shape(side) === shape(ns) && shape(ot) === shape(nt)) {
      // même structure : mise à jour du texte en place (un clic en cours sur le sommaire n'est pas perdu)
      [[ot, nt], [side, ns]].forEach(function (pr) {
        var oldE = $$('[data-pg],a[data-sec]', pr[0]), newE = $$('[data-pg],a[data-sec]', pr[1]);
        oldE.forEach(function (o, k) { if (o.innerHTML !== newE[k].innerHTML) o.innerHTML = newE[k].innerHTML; });
      });
      lastNav = nh;
    } else if (pointerBusy) {
      navPending = true;   // structure changée pendant un clic : reconstruction juste après le clic
    } else {
      var st = side ? side.scrollTop : 0;
      if (ot && nt) ot.replaceWith(nt);
      if (side && ns) { side.replaceWith(ns); ns.scrollTop = st; }
      lastNav = nh;
      if (navSpyFn) navSpyFn();
    }
  }
  // blocs requête de la page : résultats recalculés après la saisie
  doc.blocks.forEach(function (b) {
    if (b.type !== 'query') return;
    // en édition le bloc est dans .blk[data-id], en lecture dans .q-blk[data-qid]
    var box = $('.blk[data-id="' + b.id + '"] .q-res, .q-blk[data-qid="' + b.id + '"] > .q-res', app); if (!box || box.contains(document.activeElement)) return;   // pas pendant la saisie d'un texte de carte
    var h = paintPills(queryResult(b, doc, vc)); if (box.innerHTML !== h) box.innerHTML = h;
  });
  // blocs sommaire de la page : la liste suit les titres saisis
  doc.blocks.forEach(function (b) {
    if (b.type !== 'summary') return;
    var box = $('.blk[data-id="' + b.id + '"] .toc-blk-l', app); if (!box) return;
    var h = summaryList(b, doc, vc.page) || summaryEmpty(b); if (box.innerHTML !== h) box.innerHTML = h;
  });
  // numérotation automatique des étapes (pastilles vides qui affichent le numéro calculé)
  var nums = stepNums(doc.blocks);
  Object.keys(nums).forEach(function (id) {
    var badge = $('.blk[data-id="' + id + '"] .num', app); if (badge && badge.getAttribute('data-ph') !== nums[id]) badge.setAttribute('data-ph', nums[id]);
  });
  chRefreshLinked();   // cartes dont les valeurs viennent d'un tableau
  var ct = curTitle(); if (document.title !== ct) document.title = ct;
  var dn = $('#ui .doc-name'); if (dn && dn.textContent !== ct) dn.textContent = ct;
}
function refreshDerivedSoon() { clearTimeout(derivedT); derivedT = setTimeout(refreshDerived, 250); }
function fileAppHTML(d, page) {
  // aperçu de la page enregistré dans le fichier (#app) : vue de lecture sans plis ni tris de session, quel que soit le mode
  var ctx = { page: page, view: 'read' };
  return navHTML(d, ctx) + renderPage(d, ctx);
}
function viewCtx() {
  // contexte du rendu à l'écran : page affichée, mode, plis et tris de la session, état d'interface de l'édition
  var ed = mode === 'edit';
  return { page: doc.cur, view: ed ? 'edit' : 'read', folds: viewFold, sort: viewSort, navFolds: navFold,
    editor: ed ? { bar: barHold, map: mapUi, panelMin: panelMin, paste: chPaste } : null };
}
function render(focus) {
  var os = $('.pnav-side', app), ot = $('.pnav-tabs .tabs-in', app), keep = { side: os ? os.scrollTop : 0, tabs: ot ? ot.scrollLeft : 0 };
  var vc = viewCtx();
  lastNav = navHTML(doc, vc);
  app.innerHTML = lastNav + renderPage(doc, vc);
  applyTheme();
  if (navSpyFn) navSpyFn();
  if (mode === 'edit') $$('textarea.code-ta', app).forEach(function (t) { autosize(t); syncCodeLayer(t); });
  mountMaps();
  Reader.tlFit(app);
  renderChrome();
  updateCheat();
  synPaintPeers();
  navReveal(keep);
  if (focus) focusField(focus.b, focus.k, focus.end !== false);
}
// Données par pays (choroplèthe) : réglages et valeurs, dans le panneau « Éléments de la carte »
var chPaste = null;   // bloc dont la zone « Coller un tableau » est ouverte
var CH_LABELS = [['value', 'Valeurs'], ['both', 'Noms + valeurs'], ['name', 'Noms'], ['none', 'Sans étiquette']];
var CH_DEC = [['auto', 'Décimales auto'], ['0', '0 décimale'], ['1', '1 décimale'], ['2', '2 décimales'], ['k', 'Abrégé (k, M)']];
function chRaw(v) {
  // valeur saisie, telle quelle (sans arrondi), avec séparateur de milliers et virgule décimale
  if (v == null) return '';
  var t = String(v); if (/e/i.test(t)) return t.replace('.', ',');
  var neg = t.charAt(0) === '-', p = t.replace('-', '').split('.');
  return (neg ? '-' : '') + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f') + (p[1] ? ',' + p[1] : '');
}
// Source « tableau » : les valeurs sont lues dans un bloc tableau du document (colonne des pays, colonne des valeurs)
function chTables(d) {
  var out = [];
  d.pages.forEach(function (pg, pi) { pg.blocks.forEach(function (x) { if (x.type === 'table' && x.rows && x.rows.length) out.push({ b: x, pg: pg, pi: pi }); }); });
  return out;
}
function chTableLabel(d, t) {
  var hd = t.b.rows[0].map(function (c) { return textOf(c); }).filter(Boolean).join(' · ') || 'sans en-tête';
  if (hd.length > 42) hd = hd.slice(0, 41) + '…';
  return 'Tableau « ' + hd + ' »' + (d.pages.length > 1 ? ' · ' + (pageTitle(t.pg, t.pi)) : '');
}
function chGuessCols(tb) {
  // colonne des pays : celle où le plus de cellules sont des pays ; des valeurs : une autre, la plus numérique
  var K = MapKit.choro, rows = tb.rows.slice(1), n = (tb.rows[0] || []).length, best = [-1, -1], bk = 0, bv = 1;
  for (var j = 0; j < n; j++) { var c = rows.filter(function (r) { return K.match(textOf(r[j])); }).length; if (c > best[0]) { best[0] = c; bk = j; } }
  for (var j2 = 0; j2 < n; j2++) { if (j2 === bk) continue; var c2 = rows.filter(function (r) { return K.num(textOf(r[j2])) != null; }).length; if (c2 > best[1]) { best[1] = c2; bv = j2; } }
  return { k: bk, v: Math.min(bv, Math.max(0, n - 1)) };
}
function chView(b, d) {
  // réglages tels que la carte les affiche : avec une source tableau, les valeurs viennent du tableau
  var ch = b.choro; if (!ch || !ch.src) return ch;
  var out = {}; for (var k in ch) out[k] = ch[k];
  var info = { n: 0, bad: [], dup: [], missing: false }, data = {}, t = null;
  d.pages.forEach(function (pg) { pg.blocks.forEach(function (x) { if (x.id === ch.src.b && x.type === 'table') t = x; }); });
  if (!t) info.missing = true;
  else {
    if (!MapKit) MapKit = ardoiseMapKit();
    var K = MapKit.choro, ck = +ch.src.k || 0, cv = +ch.src.v || 0;
    t.rows.slice(1).forEach(function (r) {
      var name = textOf(r[ck] || ''), raw = textOf(r[cv] || ''); if (!name && !raw) return;
      var id = K.match(name);
      if (!id) { if (name) info.bad.push(name); return; }
      if (id in data) info.dup.push(name);
      data[id] = raw ? K.num(raw) : null; info.n++;
    });
  }
  out.data = data; Object.defineProperty(out, 'info', { value: info, enumerable: false });
  return out;
}
function choroPanel(b, d, ued) {
  if (!b.choro) return '';
  if (!MapKit) MapKit = ardoiseMapKit();
  var K = MapKit.choro, vw = chView(b, d), c = K.clean(vw), S = K.scale(c), I = K.index(), id = b.id, src = b.choro.src, info = vw.info;
  var sel = function (p, cur, list, title) { return '<select class="ch-set" data-b="' + id + '" data-p="' + p + '" title="' + title + '">' + list.map(function (x) { return opt(x[0], cur, esc(x[1])); }).join('') + '</select>'; };
  var txt = function (p, val, ph, cls, title) { return '<input class="mk-in ch-txt' + (cls ? ' ' + cls : '') + '" data-b="' + id + '" data-p="' + p + '" value="' + esc(val) + '" placeholder="' + ph + '" title="' + (title || ph) + '">'; };
  var tg = function (a, on, label, title) { return '<button type="button" class="mk-b mk-t" data-act="' + a + '" aria-pressed="' + !!on + '" title="' + title + '">' + label + '</button>'; };
  var rows = Object.keys(c.data).filter(function (k) { return I.by[k]; }).sort(function (x, y) { return I.by[x].name.localeCompare(I.by[y].name, 'fr'); });
  var classed = c.scale === 'quant' || c.scale === 'eq', perso = c.pal === 'perso' || c.pal === 'perso3';
  var defCols = c.pal === 'perso3' ? ['#2166ac', '#f3efec', '#b2182b'] : ['#eef5fb', '#0c3b72'];
  var tabs = chTables(d), srcSel = '<select class="ch-src" data-b="' + id + '" title="D’où viennent les valeurs">' + opt('', src ? src.b : '', 'Valeurs saisies ici') +
    tabs.map(function (t) { return opt(t.b.id, src ? src.b : '', esc(chTableLabel(d, t))); }).join('') + (src && info.missing ? opt(src.b, src.b, 'Tableau supprimé') : '') + '</select>';
  var srcCols = '';
  if (src && !info.missing) {
    var tb = null; tabs.forEach(function (t) { if (t.b.id === src.b) tb = t.b; });
    var heads = tb.rows[0].map(function (h, j) { return [j, textOf(h) || 'Colonne ' + (j + 1)]; });
    srcCols = '<div class="ch-r"><span class="rd-u">Pays</span>' + sel('src.k', src.k, heads, 'Colonne des noms ou codes de pays') + '<span class="rd-u">Valeurs</span>' + sel('src.v', src.v, heads, 'Colonne des valeurs') + '</div>' +
      '<p class="muted ch-info">' + info.n + ' pays lu' + (info.n > 1 ? 's' : '') + ' dans le tableau' +
      (info.bad.length ? ' · non reconnu' + (info.bad.length > 1 ? 's' : '') + ' : ' + esc(info.bad.slice(0, 5).join(', ')) + (info.bad.length > 5 ? '…' : '') : '') +
      (info.dup.length ? ' · en double : ' + esc(info.dup.slice(0, 3).join(', ')) : '') + '. Modifiez les valeurs dans le tableau.</p>';
  } else if (src) srcCols = '<p class="muted ch-info">Le tableau lié n’existe plus : choisissez une autre source.</p>';
  return '<div class="ch-wrap" data-b="' + id + '"><div class="mk-h">Données par pays</div><div class="ch-box">' +
    '<div class="ch-r">' + srcSel + '</div>' + srcCols +
    '<div class="ch-r">' + txt('title', c.title, 'Titre de la légende') + txt('unit', c.unit, 'Unité', 'ch-unit', 'Unité, ajoutée après chaque valeur (ex. %, hab., €)') + '</div>' +
    '<div class="ch-r">' + sel('scale', c.scale, K.scales, 'Échelle des couleurs : linéaire ou logarithmique (dégradé continu), quantiles ou intervalles égaux (classes)') + (classed ? sel('classes', c.classes, [3, 4, 5, 6, 7, 8, 9].map(function (n) { return [n, n + ' classes']; }), 'Nombre de classes') : '') + '</div>' +
    '<div class="ch-r">' + sel('pal', c.pal, K.pals, 'Palette') + '<button type="button" class="mk-b" data-act="ch-rev" aria-pressed="' + c.rev + '" title="Inverser la palette">⇄</button></div>' +
    (perso ? '<div class="ch-r ch-cols">' + defCols.map(function (d, k) { return '<input type="color" class="ch-col" data-b="' + id + '" data-k="' + k + '" value="' + (c.cols[k] || d) + '" title="' + (k === 0 ? 'Valeurs basses' : k === defCols.length - 1 ? 'Valeurs hautes' : 'Milieu') + '">'; }).join('<span class="ch-arr">→</span>') + '</div>' : '') +
    (c.scale === 'lin' ? '<div class="ch-r"><span class="rd-u">Centre</span>' + txt('mid', chRaw(c.mid), 'facultatif', 'ch-mid', 'Valeur placée au milieu de la palette (utile avec une palette divergente)') + '</div>' : '') +
    '<div class="ch-r">' + sel('labels', c.labels, CH_LABELS, 'Étiquettes sur la carte') + sel('dec', c.dec, CH_DEC, 'Format des nombres (k = milliers, M = millions, Md = milliards)') + '</div>' +
    '<div class="ch-r">' + tg('ch-parts', c.parts, 'Territoires détachés', 'Répéter l’étiquette sur les territoires détachés du pays (Guyane, Réunion, Canaries, Alaska…) et sur les territoires rattachés') +
      tg('ch-sov', c.sov, 'Territoires rattachés', 'Colorer les territoires sans valeur propre (Nouvelle-Calédonie, Groenland, Porto Rico…) comme leur pays souverain') + '</div>' +
    '<div class="ch-r">' + tg('ch-legend', c.legend, 'Légende', 'Afficher la légende sur la carte') +
      tg('ch-unitlab', c.unitLab, 'Unité sur la carte', 'Ajouter l’unité après chaque valeur affichée sur les pays (elle reste dans la légende et l’infobulle)') +
      (src ? '' : tg('ch-paste', ued.paste === id, 'Coller un tableau…', 'Importer deux colonnes copiées d’un tableur')) +
      '<button type="button" class="mk-b mk-t ch-off" data-act="ch-off" title="Retirer les couleurs et toutes les données par pays">Retirer</button></div>' +
    (!src && ued.paste === id ? '<div class="ch-paste"><textarea class="ch-ta" data-b="' + id + '" rows="5" spellcheck="false" placeholder="Une ligne par pays : nom (ou code ISO) puis valeur, séparés par une tabulation ou un point-virgule. Copiez deux colonnes d’un tableur."></textarea>' +
      '<div class="ch-r"><button type="button" class="ub" data-act="ch-import">Importer</button><label class="ch-repl"><input type="checkbox"> Remplacer les données existantes</label></div></div>' : '') +
    (src ? '' : '<div class="map-search ch-search"><input type="text" class="ch-q" data-b="' + id + '" placeholder="Ajouter un pays…" autocomplete="off" spellcheck="false"><div class="map-res" hidden></div></div>') +
    (rows.length ? '' : '<p class="muted">' + (src ? 'Aucun pays reconnu dans le tableau.' : 'Aucun pays : ajoutez-en un, cliquez sur un pays de la carte ou collez un tableau.') + '</p>') +
    rows.map(function (k) {
      var v = c.data[k], col = S.color(v);
      return '<div class="ch-row" data-b="' + id + '" data-id="' + k + '"><span class="ch-sw"' + (col ? ' style="background:' + col + '"' : '') + '></span><span class="ch-n" title="' + esc(I.by[k].name) + ' (' + k + ')">' + esc(I.by[k].name) + '</span>' +
        (src ? '<span class="ch-ro">' + (v == null ? '—' : chRaw(v)) + '</span>'
          : '<input class="mk-in ch-v" data-b="' + id + '" data-id="' + k + '" value="' + chRaw(v) + '" placeholder="—" inputmode="decimal" title="Valeur (vide : sans donnée)">' +
            '<button type="button" class="mk-b" data-act="ch-del" data-id="' + k + '" title="Retirer ce pays">×</button>') + '</div>';
    }).join('') + '</div></div>';
}
function chRefresh(b) {
  // valeur ou texte modifié sans redessiner le bloc : couleurs de la liste et carte mises à jour
  var vw = chView(b, doc), K = MapKit.choro, S = K.scale(K.clean(vw)), m = mapOf(b.id);
  $$('.ch-row[data-b="' + b.id + '"]', app).forEach(function (r) { var col = S.color(vw.data[r.dataset.id]); r.querySelector('.ch-sw').style.background = col || ''; });
  if (m) m.setChoro(vw);
}
function chLinked(tableId) { return doc.blocks.some(function (x) { return x.type === 'map' && x.choro && x.choro.src && x.choro.src.b === tableId; }); }
function chRefreshLinked() {
  // tableau source modifié : cartes et listes des données mises à jour (sauf pendant une saisie dans la liste)
  doc.blocks.forEach(function (b) {
    if (b.type !== 'map' || !b.choro || !b.choro.src) return;
    var m = mapOf(b.id); if (m) m.setChoro(chView(b, doc));
    var w = $('.ch-wrap[data-b="' + b.id + '"]', app); if (w && !w.contains(document.activeElement)) { var h = choroPanel(b, doc, viewCtx().editor); if (w.outerHTML !== h) w.outerHTML = h; }
  });
}
function chSearch(inp) {
  var res = inp.parentNode.querySelector('.map-res'), q = MapKit.choro.norm(inp.value), b = byId(inp.dataset.b), items = [];
  if (!q) { res.hidden = true; res.innerHTML = ''; res._items = []; return; }
  var I = MapKit.choro.index(), first = [], other = [], seen = {};
  MapKit.data().countries.forEach(function (c) {
    var keys = [c.name, c.id].concat(c.aka).map(MapKit.choro.norm), pre = keys.some(function (k) { return k.indexOf(q) === 0; });
    if (pre) first.push(c); else if (q.length >= 3 && keys.some(function (k) { return k.indexOf(q) > 0; })) other.push(c);
  });
  first.sort(function (x, y) { return x.name.localeCompare(y.name, 'fr'); });
  first.concat(other).forEach(function (c) { if (!seen[c.id] && items.length < 10) { seen[c.id] = 1; items.push(c); } });
  res._items = items; res._cur = 0;
  res.innerHTML = items.length ? items.map(function (c, i) { var has = b.choro && c.id in b.choro.data; return '<button type="button" class="mi' + (i ? '' : ' act') + '" data-r="' + i + '"><span><b>' + esc(c.name) + '</b><small>' + c.id + (has ? ' · déjà dans la liste' : '') + '</small></span></button>'; }).join('')
    : '<div class="menu-empty">Aucun pays trouvé.</div>';
  res.hidden = false;
}
function chFocus(b, id) {
  var v = $('.ch-v[data-b="' + b.id + '"][data-id="' + id + '"]', app);
  if (!v) { var row = $('.ch-row[data-b="' + b.id + '"][data-id="' + id + '"]', app); if (row) { cheatBlock = b.id; updateCheat(); row.scrollIntoView({ block: 'nearest' }); row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); } return; }
  cheatBlock = b.id; updateCheat(); v.focus({ preventScroll: true }); v.select(); var r = v.closest('.ch-row'); r.scrollIntoView({ block: 'nearest' });
}
function chPick(inp, i) {
  var res = inp.parentNode.querySelector('.map-res'), c = (res._items || [])[i]; if (!c) return;
  var b = byId(inp.dataset.b); inp.value = ''; res.hidden = true;
  if (!(c.id in b.choro.data)) { keepView(b); session.modifier(function () { b.choro.data[c.id] = null; }); }
  chFocus(b, c.id);
}
function chImport(b, text, replace) {
  // deux colonnes collées (tableur, CSV) : nom ou code du pays, puis valeur ; renvoie le compte rendu
  var K = MapKit.choro, ok = {}, bad = [], n = 0;
  String(text || '').split(/\r?\n/).forEach(function (line, li) {
    line = line.trim(); if (!line) return;
    var m = line.match(/^(.+?)\s*[\t;|]\s*(.*)$/) || line.match(/^(.+?)\s*,\s*(-?[\d\s\u00a0\u202f.]+(?:,\d+)?\s*%?)$/) || line.match(/^(.+?)\s+([-−]?[\d\u00a0\u202f.,]+\s*%?)$/);
    if (!m) { if (li) bad.push(line); return; }
    var name = m[1].replace(/^["']|["']$/g, ''), raw = m[2].split(/[\t;|]/)[0].replace(/^["']|["']$/g, ''), v = K.num(raw), id = K.match(name);
    if (!id) { if (li || v != null) bad.push(name); return; }
    if (v == null && raw.trim()) { bad.push(name + ' (valeur « ' + raw.trim() + ' »)'); return; }
    ok[id] = v; n++;
  });
  if (n) { keepView(b); session.modifier(function () { if (replace) { b.choro.data = {}; b.choro.lp = {}; } for (var k in ok) b.choro.data[k] = ok[k]; }); }
  return { n: n, bad: bad };
}
var panelMin = false;   // panneau « Éléments de la carte » réduit (préférence de ce navigateur, lue au démarrage)
var MapKit = null, maps = [], mapUi = { draw: null, kind: null, editOf: null, edit: null, add: null }, cheatBlock = null;
var MK_COLORS = [['accent', 'Accent'], ['ok', 'Vert'], ['bad', 'Rouge'], ['warn', 'Orange'], ['info', 'Bleu']];
function mapOf(id) { for (var i = 0; i < maps.length; i++) if (maps[i].blockId === id) return maps[i]; return null; }
function keepView(b) { var m = b && mapOf(b.id); if (m && mode === 'edit') b.view = m.getView(); }
function mountMaps() {
  maps.forEach(function (m) { m.destroy(); }); maps = [];
  if (mode !== 'edit') { mapUi = { draw: null, kind: null, editOf: null, edit: null, add: null }; cheatBlock = null; }
  $$('.map[data-mapid]', app).forEach(function (el) {
    var b = byId(el.dataset.mapid); if (!b) return;
    if (!MapKit) MapKit = ardoiseMapKit();
    if (!b.routes) b.routes = [];
    var ed = mode === 'edit';
    var focusIn = function (sel) { cheatBlock = b.id; updateCheat(); var inp = $(sel, app); if (inp) { inp.focus({ preventScroll: true }); var it = inp.closest('.mk-item'); if (it) it.scrollIntoView({ block: 'nearest' }); } };
    var inst = MapKit.mount(el, { view: b.view, bg: b.bg, markers: b.markers, zones: b.zones, routes: b.routes, choro: chView(b, doc), cities: b.cities !== false, countries: b.countries !== false, key: doc.mapKey }, {
      edit: ed, locked: !ed && !!b.lock, hideBg: !ed && !!b.hideBg,
      onView: function (v) { if (ed) { b.view = v; marquerModifie(); } },
      onBg: function (bg) { if (!ed) return; b.bg = bg; marquerModifie(); var s = $('.blk[data-id="' + b.id + '"] select[data-prop=bg]', app); if (s) s.value = bg; },
      onAdd: function (lat, lon) { addMarker(b, lat, lon, ''); },
      onMove: function (i, lat, lon) { keepView(b); session.modifier(function () { b.markers[i].lat = lat; b.markers[i].lon = lon; }); },
      onPin: function (i) { focusIn('.mk-in[data-b="' + b.id + '"][data-mk="' + i + '"][data-p=label]'); },
      onZone: function (z) {
        keepView(b); mapUi.draw = null;
        var nz = { label: '', color: 'accent', shape: z.shape }; if (z.shape === 'circle') { nz.c = z.c; nz.r = z.r; } else nz.pts = z.pts;
        session.modifier(function () { b.zones.push(nz); });
        focusIn('.zn-in[data-b="' + b.id + '"][data-zn="' + (b.zones.length - 1) + '"]');
      },
      onRoute: function (pts) {
        keepView(b); mapUi.draw = null;
        session.modifier(function () { b.routes.push({ label: '', color: 'accent', pts: pts, names: pts.map(function () { return ''; }) }); });
        focusIn('.rt-in[data-b="' + b.id + '"][data-rt="' + (b.routes.length - 1) + '"]');
      },
      onDrawEnd: function () { mapUi.draw = null; setTimeout(updateCheat); $$('.blk[data-id="' + b.id + '"] [data-act=map-draw]', app).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); },
      onZoneEdit: function (i, z) {
        keepView(b);
        session.modifier(function () { var t = b.zones[i]; t.shape = z.shape; if (z.shape === 'circle') { t.c = z.c; t.r = z.r; delete t.pts; } else { t.pts = z.pts; delete t.c; delete t.r; } });
      },
      onRouteEdit: function (i, pts, names, np) { keepView(b); session.modifier(function () { var r = b.routes[i]; r.pts = pts; r.names = names; r.np = np; delete r.no; }); },
      onLabelMove: function (kind, i, j, ll) {
        keepView(b);
        session.modifier(function () {
          if (kind === 'marker') { var mk = b.markers[i]; if (ll) mk.lp = ll; else delete mk.lp; return; }
          if (kind === 'zone') { var z = b.zones[i]; delete z.lo; if (ll) z.lp = ll; else delete z.lp; return; }
          var r = b.routes[i]; delete r.no;
          if (kind === 'route') { if (ll) r.lp = ll; else delete r.lp; return; }
          if (!r.np) r.np = r.pts.map(function () { return null; });
          while (r.np.length < r.pts.length) r.np.push(null);
          r.np[j] = ll;
        });
      },
      onChoroLabel: function (id, ll) { keepView(b); session.modifier(function () { if (!b.choro.lp) b.choro.lp = {}; if (ll) b.choro.lp[id] = ll; else delete b.choro.lp[id]; }); },
      onCountryPick: function (id) {
        cheatBlock = b.id; updateCheat();
        var vw = chView(b, doc);
        if (vw && id in vw.data) { chFocus(b, id); return; }
        if (b.choro && b.choro.src) { var cn = MapKit.choro.index().by[id]; toast((cn ? cn.name : id) + ' ne figure pas dans le tableau source'); return; }
        var q = $('.ch-q[data-b="' + b.id + '"]', app), c = MapKit.choro.index().by[id]; if (!q || !c) return;
        q.value = c.name; q.focus({ preventScroll: true }); chSearch(q);
      },
      onStepPick: function (i, j) { focusIn('.st-in[data-b="' + b.id + '"][data-rt="' + i + '"][data-s="' + j + '"]'); },
      onPick: function (kind, i) { focusIn(kind === 'zone' ? '.zn-in[data-b="' + b.id + '"][data-zn="' + i + '"]' : '.rt-in[data-b="' + b.id + '"][data-rt="' + i + '"]'); }
    });
    inst.blockId = b.id; maps.push(inst);
    if (ed && mapUi.editOf === b.id && mapUi.edit) {
      var list = mapUi.edit.kind === 'zone' ? b.zones : b.routes;
      if (list[mapUi.edit.i]) inst.setEdit(mapUi.edit.kind, mapUi.edit.i); else { mapUi.editOf = null; mapUi.edit = null; }
    }
    if (ed && mapUi.draw === b.id) inst.setDrawMode(mapUi.kind);
    if (ed && mapUi.add === b.id) inst.setAddMode(true);
  });
}
function addMarker(b, lat, lon, label) {
  keepView(b);
  session.modifier(function () { b.markers.push({ lat: lat, lon: lon, label: label || '', color: 'accent' }); });
  if (!label) { var inp = $('.mk-in[data-b="' + b.id + '"][data-mk="' + (b.markers.length - 1) + '"][data-p=label]', app); if (inp) inp.focus({ preventScroll: true }); }
}
function parseLL(s) {
  var m = String(s).trim().match(/^(-?\d+(?:[.,]\d+)?)\s*°?\s*([NS])?\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)\s*°?\s*([EWO])?$/i);
  if (!m) return null;
  var lat = parseFloat(m[1].replace(',', '.')), lon = parseFloat(m[3].replace(',', '.'));
  if (m[2] && /s/i.test(m[2])) lat = -Math.abs(lat);
  if (m[4] && /[wo]/i.test(m[4])) lon = -Math.abs(lon);
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return null;
  return { lat: +lat.toFixed(5), lon: +lon.toFixed(5) };
}
var placeIdx = null;
function places() {
  if (placeIdx) return placeIdx;
  if (!MapKit) MapKit = ardoiseMapKit();
  var D = MapKit.data(), cn = D.cn || [];
  placeIdx = D.cities.map(function (c) {
    var shown = c[1] || c[0];
    return { n: norm(shown), n2: c[1] ? norm(c[0]) : '', label: shown, lat: c[3], lon: c[2],
      sub: (cn[c[4]] || '') + ' · ' + (c[7] ? 'capitale' : 'ville') + (c[5] >= 1 ? ' · ' + (c[5] >= 1000 ? (c[5] / 1000).toFixed(1).replace('.0', '').replace('.', ',') + ' M' : c[5] + ' k') + ' hab.' : '') };
  }).concat(D.ports.map(function (p) {
    return { n: norm(p[0]), n2: '', label: p[0], lat: p[2], lon: p[1], sub: (p[3] >= 0 && cn[p[3]] ? cn[p[3]] + ' · ' : '') + 'port' };
  }));
  return placeIdx;
}
function mapSearch(inp) {
  var res = inp.parentNode.querySelector('.map-res'), q = inp.value.trim(), items = [];
  if (!q) { res.hidden = true; res.innerHTML = ''; res._items = []; return; }
  var c = parseLL(q);
  if (c) items.push({ label: '', lat: c.lat, lon: c.lon, t: 'Point ' + c.lat + ', ' + c.lon, sub: 'Coordonnées' });
  var nq = norm(q), first = [], other = [];
  places().forEach(function (pl) {
    if (pl.n.indexOf(nq) === 0 || (pl.n2 && pl.n2.indexOf(nq) === 0)) first.push(pl);
    else if (nq.length >= 3 && (pl.n.indexOf(nq) > 0 || (pl.n2 && pl.n2.indexOf(nq) > 0))) other.push(pl);
  });
  first.concat(other).slice(0, 10).forEach(function (pl) { items.push({ label: pl.label, lat: pl.lat, lon: pl.lon, t: pl.label, sub: pl.sub }); });
  res._items = items; res._cur = 0;
  res.innerHTML = items.length ? items.map(function (it, i) { return '<button type="button" class="mi' + (i ? '' : ' act') + '" data-r="' + i + '"><span><b>' + esc(it.t) + '</b><small>' + esc(it.sub) + '</small></span></button>'; }).join('')
    : '<div class="menu-empty">Aucune ville ni aucun port trouvé. Vous pouvez entrer des coordonnées « latitude, longitude ».</div>';
  res.hidden = false;
}
function pickResult(inp, i) {
  var res = inp.parentNode.querySelector('.map-res'), it = (res._items || [])[i]; if (!it) return;
  var b = byId(inp.dataset.b), m = mapOf(b.id);
  if (m) { m.center(+it.lat, +it.lon, 6); }
  inp.value = ''; res.hidden = true;
  addMarker(b, +it.lat, +it.lon, it.label);
}
function paintCode(t, b) {
  var pre = t.previousElementSibling; if (!pre || !pre.classList.contains('ta-hl')) return;
  pre.innerHTML = HL.html(t.value, HL.resolve(b.lang, t.value, b.name)) + '\n';
}
function syncCodeLayer(t) {
  // le calque coloré reprend exactement les marges et la police de la zone de saisie
  var pre = t.previousElementSibling; if (!pre || !pre.classList.contains('ta-hl')) return;
  var cs = getComputedStyle(t);
  pre.style.padding = cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft;
  pre.style.font = cs.font; pre.style.tabSize = cs.tabSize; pre.style.letterSpacing = cs.letterSpacing;
  pre.scrollLeft = t.scrollLeft;
}
function autosize(t) { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; }

