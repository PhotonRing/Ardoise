/* ---------- Famille carte et chronologie (types map et timeline) ---------- */
// Pas de facette office : Copier pour Office passe par les éléments neutres (officeHtmlElements) ou l'image préparée. Les aides
// partagées avec le moteur de carte (chView, choroPanel, mapShapeAlive, MapKit, MK_COLORS) et opt, tog, act restent dans 07-rendu.js.

// carte : conteneur de la carte, liste des éléments en lecture ; outils et panneau « Éléments de la carte » en édition
function carteRendu(b, x) {
  var e = x.edit, editorUi = x.editor, d = x.d, f = x.f;
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
  var mapState = editorUi.map || {}, dk = mapState.draw === b.id ? mapState.kind : null, ed = mapState.editOf === b.id && mapShapeAlive(b, mapState.edit) ? mapState.edit : null;
  var tool = function (kind, label, title) { return '<button type="button" class="ub out" data-act="map-draw" data-kind="' + kind + '" aria-pressed="' + (dk === kind) + '" title="' + title + '">' + label + '</button>'; };
  var rtp = editorUi.routePaste, rtOpen = function (i) { return !!rtp && rtp.b === b.id && rtp.i === i; };
  var rtBox = function (i) {
    // zone de collage ouverte par le contexte d'édition : un nouvel itinéraire (i = -1) ou le remplacement de l'itinéraire i
    return rtOpen(i) ? '<div class="ch-paste rt-paste"><textarea class="ch-ta rt-ta" data-b="' + b.id + '" rows="5" spellcheck="false" placeholder="Une ligne par point : latitude, longitude (ex. 48.38, -4.47), puis un libellé facultatif après une tabulation ou un point-virgule. Un point sans libellé prend le nom d’un lieu de la carte à moins de 50 m."></textarea>' +
      '<div class="ch-r"><button type="button" class="ub" data-act="rt-import" data-i="' + i + '">' + (i < 0 ? 'Créer l’itinéraire' : 'Remplacer les points') + '</button></div></div>' : '';
  };
  var edBtn = function (kind, i) { return '<button type="button" class="mk-b" data-act="shape-edit" data-kind="' + kind + '" data-i="' + i + '" aria-pressed="' + (!!ed && ed.kind === kind && ed.i === i) + '" title="Modifier sur la carte">✎</button>'; };
  return '<div class="mapblk">' + mapEl +
    '<div class="map-tools"><div class="map-search"><input type="text" class="map-q" data-b="' + b.id + '" placeholder="Ajouter un point : ville, port, ou « 48.38, -4.47 »" autocomplete="off" spellcheck="false"><div class="map-res" hidden></div></div>' +
    '<button type="button" class="ub out" data-act="map-addmode" aria-pressed="' + (mapState.add === b.id) + '" title="Placer des points en cliquant sur la carte (Échap pour terminer)">＋ Point</button>' +
    tool('poly', '▱ Zone', 'Dessiner une zone sommet par sommet') + tool('circle', '○ Cercle', 'Dessiner une zone circulaire : centre puis rayon') + tool('route', '⤳ Itinéraire', 'Tracer un itinéraire étape par étape') +
    '<button type="button" class="ub out" data-act="ch-on" aria-pressed="' + !!b.choro + '" title="Colorer les pays selon une valeur (carte choroplèthe)">▦ Pays</button></div>' +
    '<p class="muted map-sum">' + (mks.length + zns.length + rts.length ? [mks.length ? mks.length + ' point' + (mks.length > 1 ? 's' : '') : '', zns.length ? zns.length + ' zone' + (zns.length > 1 ? 's' : '') : '', rts.length ? rts.length + ' itinéraire' + (rts.length > 1 ? 's' : '') : ''].filter(Boolean).join(' · ') + ' — cliquez sur la carte pour afficher la liste à gauche.' : 'Rien sur la carte : cherchez une ville ou un port, placez un point, dessinez une zone, un cercle ou un itinéraire.') + '</p>' +
    '<div class="mk-panel' + (editorUi.panelMin ? ' min' : '') + '" data-b="' + b.id + '"><div class="mk-panel-h"><span class="cheat-dot"></span><b>Éléments de la carte</b><span class="mk-cnt">' + (mks.length + zns.length + rts.length) + '</span><button type="button" data-act="panel-min" title="Réduire / afficher">' + (editorUi.panelMin ? '▸' : '–') + '</button></div>' +
    '<div class="mk-list">' + ((mks.length || zns.length || rts.length || b.choro) ? '' : '<p class="muted">Aucun élément pour l’instant.</p>') + choroPanel(b, d, editorUi) +
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
      '<div class="mk-h">Itinéraires</div>' + '<div class="ch-r"><button type="button" class="mk-b mk-t" data-act="rt-paste" data-i="-1" aria-pressed="' + rtOpen(-1) + '" title="Créer un itinéraire à partir d’une liste de coordonnées collée">Coller un itinéraire…</button></div>' + rtBox(-1) + rts.map(function (r, i) {
        return '<div class="mk-item' + (ed && ed.kind === 'route' && ed.i === i ? ' on' : '') + '"><div class="mk-l1"><span class="rdot c-' + esc(r.color || 'accent') + '"></span>' +
          '<input class="mk-in rt-in" data-b="' + b.id + '" data-rt="' + i + '" value="' + esc(r.label) + '" placeholder="Nom de l’itinéraire">' +
          edBtn('route', i) + '<button type="button" class="mk-b" data-gr="' + i + '" title="Cadrer la carte sur cet itinéraire">⌖</button><button type="button" class="mk-b" data-act="route-del" data-i="' + i + '" title="Supprimer l’itinéraire">×</button></div>' +
          '<div class="mk-l2">' + colorSel('rt-color', 'data-rt="' + i + '"', r.color) + '<span class="mk-n">' + r.pts.length + ' étapes · ' + rdist(r) + '</span>' +
          '<button type="button" class="mk-b mk-t" data-act="route-dist" data-i="' + i + '" aria-pressed="' + !r.hideDist + '" title="Afficher la distance sur la carte">km</button>' +
          '<button type="button" class="mk-b mk-t" data-act="rt-paste" data-i="' + i + '" aria-pressed="' + rtOpen(i) + '" title="Remplacer les étapes par une liste de coordonnées collée (nom et couleur gardés)">Remplacer les points…</button></div>' + rtBox(i) +
          ((ed && ed.kind === 'route' && ed.i === i) ? r.pts.map(function (pt, j) {
            return '<div class="mk-row st-row"><span class="st-n">' + (j + 1) + '</span><input class="mk-in st-in" data-b="' + b.id + '" data-rt="' + i + '" data-s="' + j + '" value="' + esc((r.names || [])[j] || '') + '" placeholder="' + (j === 0 ? 'Départ' : j === r.pts.length - 1 ? 'Arrivée' : 'Étape ' + (j + 1)) + ' (facultatif)">' +
              '<span class="st-ll">' + (+pt[0]).toFixed(3) + ', ' + (+pt[1]).toFixed(3) + '</span></div>';
          }).join('') : '') + '</div>';
      }).join('') + '</div></div></div>';
}
// chronologie verticale (liens entre événements) ou horizontale (frise inclinée, fiches ou bulles en lecture)
function chronologieRendu(b, x) {
  var e = x.edit, f = x.f;
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
}
function carteReglages(b) {
  return '<select data-act="set" data-prop="height" title="Hauteur">' + opt(300, b.height, 'Petite') + opt(420, b.height, 'Moyenne') + opt(560, b.height, 'Grande') + '</select>' +
    '<select data-act="set" data-prop="bg" title="Fond affiché à l’ouverture">' + opt('vector', b.bg, 'Simplifié') + opt('plan', b.bg, 'Plan') + opt('sat', b.bg, 'Satellite') + '</select>' +
    tog('list', b.list, 'Liste', 'Afficher la liste des points et zones en lecture') + tog('countries', b.countries !== false, 'Pays', 'Afficher les noms des pays sur le fond simplifié (avec des données par pays, le réglage « Étiquettes » peut les afficher sur les pays colorés)') + tog('cities', b.cities !== false, 'Villes', 'Afficher les villes sur le fond simplifié') +
    tog('lock', b.lock, 'Figée', 'Lecture : empêcher de déplacer et de zoomer la carte') + tog('hideBg', b.hideBg, 'Fond fixe', 'Lecture : masquer le bouton de changement de fond');
}
function chronologieReglages(b) {
  return '<select data-act="set" data-prop="orient" title="Orientation">' + opt('v', b.orient || 'v', 'Verticale') + opt('h', b.orient || 'v', 'Horizontale (45°)') + '</select>' + (b.orient === 'h' ? '<select data-act="set" data-prop="segPos" title="Position des libellés de liens">' + opt('above', b.segPos || 'above', 'Libellés au-dessus') + opt('below', b.segPos || 'above', 'Libellés en dessous') + '</select>' + tog('noCards', !b.noCards, 'Fiches', 'Afficher les fiches de description sous la frise') : '') + act('tl-add', '+ événement', 'Ajouter un événement à la fin');
}
// éléments neutres : l'image préparée (opts.images) si elle existe, sinon le titre « Carte » et la liste des éléments
function carteElements(b, x) {
  var images = x.images, image = x.image, txt = x.txt, para = x.para, out = [];
  if (images[b.id]) { out.push(image(images[b.id], 'Carte')); return out; }
  var pts = (b.markers || []).map(function (m, i) { return { niveau: 0, segs: [txt(m.label || 'Point ' + (i + 1)), txt(' (' + (+m.lat).toFixed(4) + ', ' + (+m.lon).toFixed(4) + ')', { couleur: OFFICE_CLAIR.muted })] }; })
    .concat((b.zones || []).map(function (z, i) { return { niveau: 0, segs: [txt(z.label || 'Zone ' + (i + 1))] }; }))
    .concat((b.routes || []).map(function (r, i) { return { niveau: 0, segs: [txt(r.label || 'Itinéraire ' + (i + 1))] }; }));
  out.push(para([txt('Carte', { gras: true })]));
  if (pts.length) out.push({ t: 'liste', ordonnee: false, items: pts });
  return out;
}
// éléments neutres : l'image préparée si elle existe, sinon la liste des événements (date, titre, description)
function chronologieElements(b, x) {
  var images = x.images, image = x.image, txt = x.txt, gras = x.gras, S = x.S, out = [];
  if (images[b.id]) { out.push(image(images[b.id], 'Chronologie')); return out; }
  var evs = (b.items || []).map(function (it) {
    var segs = (it.date ? [txt(it.date + ' — ', { couleur: OFFICE_CLAIR.muted })] : []).concat(gras(S(it.title)));
    if (!officeVide(S(it.text))) segs = segs.concat([txt(' : ')], S(it.text));
    return { niveau: 0, segs: segs };
  });
  if (evs.length) out.push({ t: 'liste', ordonnee: false, items: evs });
  return out;
}

T.map = { label: 'Carte', ic: '◎', desc: 'Points, zones, cercles, itinéraires · hors ligne ou plan / satellite', kw: 'carte map geo port ville zone cercle itineraire route trajet distance localisation monde', make: function () { return { height: 420, bg: 'vector', view: { lat: 30, lon: 10, z: 1.6 }, markers: [], zones: [], routes: [], list: true, cities: true, lock: false, hideBg: false }; }, sans: ['office', 'normaliser', 'libelle'],
  rendu: carteRendu, reglages: carteReglages, elements: carteElements };
T.timeline = { label: 'Chronologie', ic: '⟿', desc: 'Événements datés, verticale ou horizontale', kw: 'timeline chronologie frise evenements dates historique deroule',
    make: function () { return { orient: 'v', items: [{ date: '', title: '', text: '', color: 'accent' }, { date: '', title: '', text: '', color: 'accent' }, { date: '', title: '', text: '', color: 'accent' }] }; }, sans: ['office', 'normaliser', 'libelle'],
  rendu: chronologieRendu, reglages: chronologieReglages, elements: chronologieElements };
