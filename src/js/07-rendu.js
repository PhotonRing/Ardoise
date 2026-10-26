/* ---------- Rendu ---------- */
function hlLine(line) {
  var e = esc(line);
  return /^\s*(#(?!!)|\/\/|--\s|;|rem\s|%)/i.test(line) ? '<span class="c">' + e + '</span>' : e;
}
function renderPage(d, edit) {
  var out = [], open = false, counter = 0;
  d.blocks.forEach(function (b) {
    if (b.type === 'step' || b.type === 'footer') { if (open) out.push('</section>'); open = false; }
    if (b.type === 'step') { out.push('<section class="step">'); open = true; }
    var num = null;
    if (b.type === 'step' && !b.nonum) {
      var n = String(b.num || '').trim();
      if (n) { num = n; var m = n.match(/(\d+)\D*$/); if (m) counter = +m[1]; }
      else { counter++; num = String(counter); }
    }
    var inner = renderBlock(b, edit, num);
    if (!edit && (b.type === 'step' || b.type === 'h2' || b.type === 'h3')) inner = inner.replace(/^<(\w+)/, '<$1 id="b-' + b.id + '"');
    out.push(edit ? wrapEdit(b, inner) : inner);
  });
  if (open) out.push('</section>');
  if (edit) out.push('<button class="add-end" type="button" data-act="add-end">+ Ajouter un bloc</button>');
  return '<div class="wrap" style="--w:' + (+d.width || 820) + 'px">' + out.join('\n') + '</div>';
}
function renderBlock(b, e, num) {
  function f(tag, cls, k, val, o) {
    o = o || {};
    var rich = o.rich !== false;
    if (!e) return '<' + tag + (cls ? ' class="' + cls + '"' : '') + '>' + (rich ? R(val) : esc(val)) + '</' + tag + '>';
    return '<' + tag + ' class="' + (cls ? cls + ' ' : '') + 'fld' + (o.soft ? ' soft' : '') + '" contenteditable="true" spellcheck="true" data-b="' + b.id + '" data-k="' + k + '"' +
      (rich ? ' data-rich' : '') + (o.li ? ' data-li' : '') + (o.cell ? ' data-cell' : '') + (o.ml ? ' data-ml' : '') + (o.nl ? ' data-nl' : '') +
      ' data-ph="' + esc(o.ph || '') + '">' + (rich ? R(val) : esc(val)) + '</' + tag + '>';
  }
  function checks(base, arr) {
    if (!arr.length) return e ? '<button class="mini-add" type="button" data-act="item-add" data-k="' + base + '">+ case à cocher</button>' : '';
    return '<ul class="check">' + arr.map(function (it, i) {
      var id = b.id + '-' + base.replace(/\./g, '-') + '-' + i;
      return '<li><input type="checkbox" id="' + id + '" data-b="' + b.id + '" data-k="' + base + '.' + i + '.done"' + (it.done ? ' checked' : '') + '>' +
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
        ((e || b.eyebrow) ? f('span', 'eyebrow', 'eyebrow', b.eyebrow, { rich: false, ph: 'Surtitre', nl: 1 }) : '') +
        f('h1', '', 'title', b.title, { ph: 'Titre de la page', nl: 1 }) +
        ((e || !isBlank(b.lede)) ? f('p', 'lede', 'lede', b.lede, { ph: 'Chapeau : une ou deux phrases qui résument la page', nl: 1 }) : '') + '</header>';
    case 'h2': return f('h2', '', 'html', b.html, { ph: 'Titre de section', nl: 1 });
    case 'h3': return f('h3', '', 'html', b.html, { ph: 'Sous-titre', nl: 1 });
    case 'p': return f('p', '', 'html', b.html, { ph: 'Écrire, ou taper / pour insérer un bloc', soft: 1 });
    case 'step':
      var badge = '';
      if (num !== null) badge = e ? '<span class="num fld" contenteditable="true" data-b="' + b.id + '" data-k="num" data-nl data-ph="' + esc(num) + '">' + esc(b.num) + '</span>' : '<span class="num">' + esc(num) + '</span>';
      return '<div class="step-head">' + badge + f('h2', '', 'title', b.title, { ph: 'Titre de l’étape', nl: 1 }) + '</div>';
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
      var tg = b.ordered ? 'ol' : 'ul';
      return '<' + tg + ' class="list">' + b.items.map(function (h, i) {
        return '<li>' + (e ? f('span', '', 'items.' + i, h, { li: 1, ph: 'Élément' }) : R(h)) + '</li>';
      }).join('') + '</' + tg + '>';
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
      if (!b.src) return e ? '<div class="img-drop" data-act="img-pick" data-b="' + b.id + '">Cliquer, déposer ou coller une image</div>' : '';
      return '<figure class="fig"><img src="' + esc(b.src) + '" alt="' + esc(b.alt || textOf(b.caption)) + '">' +
        ((e || !isBlank(b.caption)) ? f('figcaption', '', 'caption', b.caption, { ph: 'Légende (optionnelle)', nl: 1 }) : '') + '</figure>';
    case 'map':
      var mh = +b.height || 420, mks = b.markers || [], zns = b.zones || [], rts = b.routes || [];
      var mll = function (m) { return (+m.lat).toFixed(4) + ', ' + (+m.lon).toFixed(4); };
      var rdist = function (r) { if (!MapKit) MapKit = ardoiseMapKit(); return MapKit.fmtDist(MapKit.pathLen(r.pts)); };
      var zdesc = function (z) { return z.shape === 'circle' ? 'cercle de ' + String(+(z.r / 1000).toFixed(2)).replace('.', ',') + ' km' : z.pts.length + ' sommets'; };
      var mapEl = '<div class="map" data-mapid="' + b.id + '"' + (e ? '' : ' data-state="' + esc(JSON.stringify({ view: b.view, bg: b.bg, markers: mks, zones: zns, routes: rts, cities: b.cities !== false, lock: !!b.lock, hideBg: !!b.hideBg, key: doc.mapKey || undefined })) + '"') +
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
      var dk = mapUi.draw === b.id ? mapUi.kind : null, ed = mapUi.editOf === b.id ? mapUi.edit : null;
      var tool = function (kind, label, title) { return '<button type="button" class="ub out" data-act="map-draw" data-kind="' + kind + '" aria-pressed="' + (dk === kind) + '" title="' + title + '">' + label + '</button>'; };
      var edBtn = function (kind, i) { return '<button type="button" class="mk-b" data-act="shape-edit" data-kind="' + kind + '" data-i="' + i + '" aria-pressed="' + (!!ed && ed.kind === kind && ed.i === i) + '" title="Modifier sur la carte">✎</button>'; };
      return '<div class="mapblk">' + mapEl +
        '<div class="map-tools"><div class="map-search"><input type="text" class="map-q" data-b="' + b.id + '" placeholder="Ajouter un point : ville, port, ou « 48.38, -4.47 »" autocomplete="off" spellcheck="false"><div class="map-res" hidden></div></div>' +
        '<button type="button" class="ub out" data-act="map-addmode" aria-pressed="' + (mapUi.add === b.id) + '" title="Placer des points en cliquant sur la carte (Échap pour terminer)">＋ Point</button>' +
        tool('poly', '▱ Zone', 'Dessiner une zone sommet par sommet') + tool('circle', '○ Cercle', 'Dessiner une zone circulaire : centre puis rayon') + tool('route', '⤳ Itinéraire', 'Tracer un itinéraire étape par étape') + '</div>' +
        '<p class="muted map-sum">' + (mks.length + zns.length + rts.length ? [mks.length ? mks.length + ' point' + (mks.length > 1 ? 's' : '') : '', zns.length ? zns.length + ' zone' + (zns.length > 1 ? 's' : '') : '', rts.length ? rts.length + ' itinéraire' + (rts.length > 1 ? 's' : '') : ''].filter(Boolean).join(' · ') + ' — cliquez sur la carte pour afficher la liste à gauche.' : 'Rien sur la carte : cherchez une ville ou un port, placez un point, dessinez une zone, un cercle ou un itinéraire.') + '</p>' +
        '<div class="mk-panel' + (panelMin ? ' min' : '') + '" data-b="' + b.id + '"><div class="mk-panel-h"><span class="cheat-dot"></span><b>Éléments de la carte</b><span class="mk-cnt">' + (mks.length + zns.length + rts.length) + '</span><button type="button" data-act="panel-min" title="Réduire / afficher">' + (panelMin ? '▸' : '–') + '</button></div>' +
        '<div class="mk-list">' + ((mks.length || zns.length || rts.length) ? '' : '<p class="muted">Aucun élément pour l’instant.</p>') +
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
function opt(v, cur, label) { return '<option value="' + v + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + label + '</option>'; }
function tog(prop, on, label, title) { return '<button type="button" data-act="toggle" data-prop="' + prop + '" aria-pressed="' + (on ? 'true' : 'false') + '" title="' + (title || '') + '">' + label + '</button>'; }
function act(a, label, title, extra) { return '<button type="button" data-act="' + a + '" title="' + (title || '') + '"' + (extra || '') + '>' + label + '</button>'; }
function settings(b) {
  switch (b.type) {
    case 'step': return tog('nonum', !b.nonum, '#', 'Afficher le numéro') ;
    case 'facts': return act('fact-add', '+ fait', 'Ajouter un fait');
    case 'cards': return act('card-add', '+ carte', 'Ajouter une carte') + '<select data-act="set" data-prop="min" title="Largeur des cartes">' + opt(340, b.min, 'Larges') + opt(220, b.min, 'Étroites') + opt(600, b.min, 'Pleine') + '</select>';
    case 'check': return act('item-add', '+ case', 'Ajouter une case', ' data-k="items"') + act('check-reset', '↺', 'Tout décocher');
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
      tog('list', b.list, 'Liste', 'Afficher la liste des points et zones en lecture') + tog('cities', b.cities !== false, 'Villes', 'Afficher les villes sur le fond simplifié') +
      tog('lock', b.lock, 'Figée', 'Lecture : empêcher de déplacer et de zoomer la carte') + tog('hideBg', b.hideBg, 'Fond fixe', 'Lecture : masquer le bouton de changement de fond');
    case 'image': return b.src ? act('img-pick', 'Remplacer', 'Remplacer l’image') + act('img-alt', 'Alt', 'Texte alternatif') : '';
  }
  return '';
}
function wrapEdit(b, inner) {
  var s = settings(b);
  return '<div class="blk" data-id="' + b.id + '" data-type="' + b.type + '">' +
    '<div class="blk-gut"><button type="button" class="g-add" data-act="add-after" title="Insérer un bloc dessous">+</button><button type="button" class="g-drag" data-act="drag" title="Glisser pour déplacer">⋮⋮</button></div>' +
    '<div class="blk-bar"><span class="tname">' + T[b.type].label + '</span>' + (s ? '<span class="bsep"></span>' + s : '') + '<span class="bsep"></span>' +
    act('add-after', '+', 'Insérer un bloc dessous') + act('up', '↑', 'Monter (Alt+↑)') + act('down', '↓', 'Descendre (Alt+↓)') + act('dup', '⧉', 'Dupliquer') +
    '<button type="button" class="del" data-act="del" title="Supprimer">✕</button></div>' + inner + '</div>';
}

function pageHeader(pg) { return pg.blocks.filter(function (b) { return b.type === 'header'; })[0] || null; }
function pageTitle(pg, i) {
  // le nom d'une page est le grand titre de son en-tête ; à défaut, le nom saisi ; sinon « Page N »
  var h = pageHeader(pg), t = h ? textOf(h.title) : '';
  return t || (pg.title || '').trim() || 'Page ' + (i + 1);
}
function curTitle() { return pageTitle(doc.pages[doc.cur], doc.cur); }
function sectionsOf(pg) {
  var out = [], counter = 0;
  pg.blocks.forEach(function (b) {
    if (b.type === 'step') {
      var num = null;
      if (!b.nonum) { var n = String(b.num || '').trim(); if (n) { num = n; var m = n.match(/(\d+)\D*$/); if (m) counter = +m[1]; } else { counter++; num = String(counter); } }
      out.push({ id: b.id, t: textOf(b.title) || 'Étape', n: num, lv: 1 });
    } else if (b.type === 'h2') out.push({ id: b.id, t: textOf(b.html) || 'Section', lv: 1 });
    else if (b.type === 'h3') out.push({ id: b.id, t: textOf(b.html) || 'Sous-section', lv: 2 });
  });
  return out;
}
function navHTML(d, edit, all) {
  // all : export statique, toutes les pages sont présentes et le script bascule de l'une à l'autre
  var pages = d.pages, cur = d.cur, w = +d.width || 820;
  var more = function (i) { return edit && i === cur ? '<button type="button" class="pnav-m" data-pgm="' + i + '" title="Options de la page" aria-label="Options de la page">⋯</button>' : ''; };
  var tabs = '<nav class="pnav-tabs" aria-label="Pages"><div class="tabs-in" style="max-width:' + w + 'px">' + pages.map(function (pg, i) {
    return '<span class="ptab-w' + (i === cur ? ' on' : '') + '"><button type="button" class="ptab" data-pg="' + i + '"' + (i === cur ? ' aria-current="page"' : '') + '>' + esc(pageTitle(pg, i)) + '</button>' + more(i) + '</span>';
  }).join('') + (edit ? '<button type="button" class="ptab-add" data-pgadd title="Ajouter une page">+ Page</button>' : '') + '</div></nav>';
  var side = '<aside class="pnav-side" aria-label="Sommaire"><ol class="toc">' + pages.map(function (pg, i) {
    var secs = (all || i === cur) ? sectionsOf(pg) : [];
    return '<li class="toc-p' + (i === cur ? ' on' : '') + '"><div class="toc-pr"><button type="button" class="toc-pb" data-pg="' + i + '"' + (i === cur ? ' aria-current="page"' : '') + '>' + esc(pageTitle(pg, i)) + '</button>' + more(i) + '</div>' +
      (secs.length ? '<ol class="toc-s">' + secs.map(function (x) {
        return '<li class="lv' + x.lv + '"><a href="#b-' + x.id + '" data-sec="' + x.id + '">' + (x.n ? '<span class="toc-n">' + esc(x.n) + '</span>' : '') + '<span>' + esc(x.t) + '</span></a></li>';
      }).join('') + '</ol>' : '') + '</li>';
  }).join('') + '</ol>' + (edit ? '<button type="button" class="toc-add" data-pgadd>+ Page</button>' : '') + '</aside>';
  return tabs + side;
}
function navLayout() {
  // sommaire à gauche s'il y a la place à côté de la colonne, sinon onglets ; réglage forcé dans Style
  var h = document.documentElement, n = +h.getAttribute('data-npages') || 1, pref = h.getAttribute('data-nav') || 'auto';
  var edit = h.classList.contains('is-edit'), w = +h.getAttribute('data-w') || 820, iw = window.innerWidth, room = (iw - w) / 2;
  var none = n < 2 && !edit, side = pref === 'tabs' ? false : pref === 'side' ? iw >= 760 : room >= 250;
  var push = !none && side && room < 250;
  h.classList.toggle('nav-none', none); h.classList.toggle('nav-side', !none && side); h.classList.toggle('nav-tabs', !none && !side); h.classList.toggle('nav-push', push);
  h.style.setProperty('--navw', (push ? 220 : Math.max(190, Math.min(260, room - 40))) + 'px');
}
function navSpy() {
  // section en cours surlignée dans le sommaire ; clic sur une section : défilement sans changer l'adresse
  function target(id) { return document.getElementById('b-' + id) || document.querySelector('.blk[data-id="' + id + '"]'); }
  var tick = 0;
  function spy() {
    tick = 0;
    var links = Array.prototype.slice.call(document.querySelectorAll('.pnav-side .toc-p.on a[data-sec]')), act = null;
    links.forEach(function (a) { var t = target(a.getAttribute('data-sec')); if (t && t.offsetParent !== null && t.getBoundingClientRect().top <= 140) act = a; });
    if (!act && links.length) act = links[0];
    links.forEach(function (a) { a.classList.toggle('on', a === act); });
  }
  window.addEventListener('scroll', function () { if (!tick) tick = requestAnimationFrame(spy); }, { passive: true });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-sec]'); if (!a) return;
    var t = target(a.getAttribute('data-sec')); if (!t) return;
    e.preventDefault(); t.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  window.addEventListener('resize', navLayout);
  return spy;
}
function applyTheme() {
  var r = document.documentElement;
  r.setAttribute('data-palette', doc.palette);
  r.setAttribute('data-typo', doc.typo);
  if (doc.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', doc.theme);
  r.classList.toggle('is-edit', mode === 'edit');
  r.setAttribute('data-npages', doc.pages.length); r.setAttribute('data-nav', doc.nav || 'auto'); r.setAttribute('data-w', +doc.width || 820);
  navLayout();
  document.title = curTitle();
}
var navSpyFn = null;
function render(focus) {
  app.innerHTML = navHTML(doc, mode === 'edit', false) + renderPage(doc, mode === 'edit');
  applyTheme();
  if (navSpyFn) navSpyFn();
  if (mode === 'edit') $$('textarea.code-ta', app).forEach(function (t) { autosize(t); syncCodeLayer(t); });
  mountMaps();
  tlFit(app);
  renderChrome();
  updateCheat();
  if (focus) focusField(focus.b, focus.k, focus.end !== false);
}
var panelMin = false;
try { panelMin = localStorage.getItem(LS + 'panelmin') === '1'; } catch (_) {}
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
    var inst = MapKit.mount(el, { view: b.view, bg: b.bg, markers: b.markers, zones: b.zones, routes: b.routes, cities: b.cities !== false, key: doc.mapKey }, {
      edit: ed, locked: !ed && !!b.lock, hideBg: !ed && !!b.hideBg,
      onView: function (v) { if (ed) { b.view = v; markDirty(true); } },
      onBg: function (bg) { if (!ed) return; b.bg = bg; markDirty(true); var s = $('.blk[data-id="' + b.id + '"] select[data-prop=bg]', app); if (s) s.value = bg; },
      onAdd: function (lat, lon) { addMarker(b, lat, lon, ''); },
      onMove: function (i, lat, lon) { keepView(b); change(function () { b.markers[i].lat = lat; b.markers[i].lon = lon; }); },
      onPin: function (i) { focusIn('.mk-in[data-b="' + b.id + '"][data-mk="' + i + '"][data-p=label]'); },
      onZone: function (z) {
        keepView(b); mapUi.draw = null;
        var nz = { label: '', color: 'accent', shape: z.shape }; if (z.shape === 'circle') { nz.c = z.c; nz.r = z.r; } else nz.pts = z.pts;
        change(function () { b.zones.push(nz); });
        focusIn('.zn-in[data-b="' + b.id + '"][data-zn="' + (b.zones.length - 1) + '"]');
      },
      onRoute: function (pts) {
        keepView(b); mapUi.draw = null;
        change(function () { b.routes.push({ label: '', color: 'accent', pts: pts, names: pts.map(function () { return ''; }) }); });
        focusIn('.rt-in[data-b="' + b.id + '"][data-rt="' + (b.routes.length - 1) + '"]');
      },
      onDrawEnd: function () { mapUi.draw = null; setTimeout(updateCheat); $$('.blk[data-id="' + b.id + '"] [data-act=map-draw]', app).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); },
      onZoneEdit: function (i, z) {
        keepView(b);
        change(function () { var t = b.zones[i]; t.shape = z.shape; if (z.shape === 'circle') { t.c = z.c; t.r = z.r; delete t.pts; } else { t.pts = z.pts; delete t.c; delete t.r; } });
      },
      onRouteEdit: function (i, pts, names, np) { keepView(b); change(function () { var r = b.routes[i]; r.pts = pts; r.names = names; r.np = np; delete r.no; }); },
      onLabelMove: function (kind, i, j, ll) {
        keepView(b);
        change(function () {
          if (kind === 'marker') { var mk = b.markers[i]; if (ll) mk.lp = ll; else delete mk.lp; return; }
          if (kind === 'zone') { var z = b.zones[i]; delete z.lo; if (ll) z.lp = ll; else delete z.lp; return; }
          var r = b.routes[i]; delete r.no;
          if (kind === 'route') { if (ll) r.lp = ll; else delete r.lp; return; }
          if (!r.np) r.np = r.pts.map(function () { return null; });
          while (r.np.length < r.pts.length) r.np.push(null);
          r.np[j] = ll;
        });
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
  change(function () { b.markers.push({ lat: lat, lon: lon, label: label || '', color: 'accent' }); });
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

