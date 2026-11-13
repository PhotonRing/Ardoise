/* ---------- Copier pour Office ----------
   HTML à styles en ligne et texte brut d'un bloc (08-office.js) ; une carte ou une chronologie part en image PNG, dessinée
   hors écran en thème clair à la largeur de la page imprimée, sans bibliothèque. Hors historique : rien n'est modifié. */
function copierPourOffice(b) {
  var refus = function () { toast('Le presse-papier a refusé la copie'); };
  if (!navigator.clipboard || !navigator.clipboard.write || typeof ClipboardItem !== 'function') { refus(); return Promise.resolve(false); }
  var texte = function (t) { return new Blob([t], { type: 'text/plain' }); }, item, horsLigne = false;
  // l'élément du presse-papier est créé pendant le clic, avec des promesses : l'image se dessine après sans perdre le geste
  if (b.type === 'map' || b.type === 'timeline') {
    var img = imageDeBloc(b);
    item = { 'image/png': img.then(function (r) { horsLigne = r.horsLigne; return r.blob; }), 'text/plain': img.then(function () { return texte(officeTexte(officeBloc(b, doc, { page: doc.cur }))); }) };
  } else {
    // un groupe emporte en images les cartes et chronologies de ses blocs
    var elts = imagesOffice([b], { cartes: b.type === 'group' }).then(function (r) { horsLigne = r.horsLigne; return officeBloc(b, doc, { page: doc.cur, images: r.images }); });
    item = { 'text/html': elts.then(function (e) { return new Blob([officeHtml(e, doc)], { type: 'text/html' }); }), 'text/plain': elts.then(function (e) { return texte(officeTexte(e)); }) };
  }
  return navigator.clipboard.write([new ClipboardItem(item)]).then(function () {
    toast(horsLigne ? 'Copié pour Office, sur le fond hors ligne : le fond en ligne de la carte ne peut pas être copié' : 'Copié pour Office', horsLigne ? 6000 : 0);
    return true;
  }, function () { refus(); return false; });
}
/* Images des blocs pour l'export Office, enfants des groupes compris : { images: { idBloc: { src, mime, l, h } }, horsLigne }.
   o.png : une image ni PNG ni JPEG (WebP, GIF, SVG…) est redessinée en PNG (le .docx ne prend que ces deux formats) ;
   o.cartes : cartes et chronologies dessinées en PNG, l'une après l'autre (un seul montage hors écran à la fois). */
function imagesOffice(blocs, o) {
  o = o || {}; var images = {}, horsLigne = false, suite = Promise.resolve();
  tousBlocs(blocs).forEach(function (b) {
    if (b.type === 'image' && b.src) suite = suite.then(function () { return imageDocument(b, o.png).then(function (r) { images[b.id] = r; }); });
    else if (o.cartes && (b.type === 'map' || b.type === 'timeline')) suite = suite.then(function () {
      return imageDeBloc(b).then(function (r) {
        horsLigne = horsLigne || r.horsLigne;
        return enDataUrl(r.blob).then(function (src) { images[b.id] = { src: src, mime: 'image/png', l: r.l, h: r.h }; });
      }, function () { /* dessin impossible : équivalent texte */ });
    });
  });
  return suite.then(function () { return { images: images, horsLigne: horsLigne }; });
}
// image du document : dimensions lues au décodage (le collage et le .docx gardent la taille), PNG si demandé
function imageDocument(b, png) {
  return new Promise(function (ok) {
    var im = new Image(), mime = (String(b.src).match(/^data:([^;,]+)/) || [])[1] || '';
    var fin = function (src, m, l, h) { ok({ src: src, mime: m, l: l, h: h }); };
    im.onload = function () {
      var l = im.naturalWidth, h = im.naturalHeight;
      if (!png || /^image\/(png|jpe?g)$/i.test(mime) || !l || !h) return fin(b.src, mime, l, h);
      try { var cv = document.createElement('canvas'); cv.width = l; cv.height = h; cv.getContext('2d').drawImage(im, 0, 0); fin(cv.toDataURL('image/png'), 'image/png', l, h); }
      catch (_) { fin(b.src, mime, l, h); }   // canvas sali (image d'une autre origine) : l'export la remplace par sa légende
    };
    im.onerror = function () { fin(b.src, mime, 0, 0); }; im.src = b.src;
  });
}
function enDataUrl(blob) { return new Promise(function (ok, ko) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = ko; r.readAsDataURL(blob); }); }
// conteneur hors écran : variables du thème clair posées sur lui, donc styles calculés de son contenu en thème clair
function conteneurClair(b) {
  var c = document.createElement('div'), v = officeVariables(doc), k;
  c.style.cssText = 'position:fixed;left:-30000px;top:0;width:' + OFFICE_LARGEUR + 'px;padding:8px;box-sizing:content-box;background:#ffffff;color:' + OFFICE_CLAIR.fg + ';color-scheme:light;font:15px/1.6 var(--f-body)';
  for (k in v) c.style.setProperty(k, v[k]);
  c.innerHTML = paintPills(renderBlock(b, doc, { page: doc.cur, view: 'export' }, null), doc);
  document.body.appendChild(c);
  return c;
}
// un canvas est-il lisible (pas sali par des tuiles d'une autre origine) ?
function canvasLisible(cv) { try { cv.getContext('2d').getImageData(0, 0, 1, 1); return true; } catch (_) { return false; } }
// image PNG d'une carte ou d'une chronologie : Promise de { blob, l, h (px CSS), horsLigne }
function imageDeBloc(b) {
  var c = conteneurClair(b), inst = null, horsLigne = false;
  var deuxImages = function () { return new Promise(function (ok) { requestAnimationFrame(function () { requestAnimationFrame(ok); }); }); };
  var pret = (document.fonts && document.fonts.ready) || Promise.resolve();
  if (b.type === 'timeline') pret = pret.then(function () {
    Reader.tlFit(c);
    var hin = c.querySelector('.tl-h-in'); if (hin && hin.scrollWidth > c.clientWidth) { c.style.width = hin.scrollWidth + 'px'; Reader.tlFit(c); }   // frise large : rien de coupé
  });
  else pret = pret.then(function () {
    // carte : redessinée à la largeur de la page avec l'étendue affichée ; fond en ligne illisible → fond hors ligne
    var el = c.querySelector('.map'), aff = $('.map[data-mapid="' + b.id + '"]', app), m = mapOf(b.id), view = m ? m.getView() : b.view, bg = b.bg || 'vector';
    var cv = aff && aff.querySelector('canvas');
    if (bg !== 'vector' && !(cv && canvasLisible(cv))) { bg = 'vector'; horsLigne = true; }
    if (aff && aff.clientWidth) view = { lat: view.lat, lon: view.lon, z: view.z + Math.log(OFFICE_LARGEUR / aff.clientWidth) / Math.LN2 };
    if (!MapKit) MapKit = ardoiseMapKit();
    inst = MapKit.mount(el, { view: view, bg: bg, markers: b.markers, zones: b.zones, routes: b.routes || [], choro: chView(b, doc), cities: b.cities !== false, countries: b.countries !== false, key: doc.mapKey }, { locked: true, hideBg: true, dpr: 2 });
    return deuxImages();
  });
  var fin = function () { if (inst) inst.destroy(); c.remove(); };
  return pret.then(function () {
    if (inst) inst.print(true);   // dessin immédiat (comme à l'impression) : un redimensionnement en attente aurait vidé le canvas
    var r = c.getBoundingClientRect(), cv = document.createElement('canvas'), g = cv.getContext('2d');
    cv.width = Math.ceil(r.width * 2); cv.height = Math.ceil(r.height * 2);
    g.scale(2, 2); g.fillStyle = '#ffffff'; g.fillRect(0, 0, r.width, r.height);
    peindreDom(g, c, { x: r.left, y: r.top, echelle: 2 });
    return new Promise(function (ok, ko) { cv.toBlob(function (blob) { if (blob) ok({ blob: blob, l: Math.round(r.width), h: Math.round(r.height), horsLigne: horsLigne }); else ko(new Error('image vide')); }, 'image/png'); });
  }).then(function (r) { fin(); return r; }, function (e) { fin(); throw e; });
}

/* Peintre par boîtes : redessine sur un canvas un sous-arbre du DOM d'après sa mise en page calculée (fonds, bordures,
   anneaux et ombres, texte mot par mot, images et canvas, transformations, découpe des débordements). */
function peindreDom(g, racine, o) { peindreElement(g, racine, o); }
function officeTransparent(c) { return !c || c === 'transparent' || /^rgba\(.*,\s*0\)$/.test(c); }
function officeRayons(cs, w, h) {
  return ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'].map(function (k) {
    var v = String(cs[k] || '0').split(' ')[0], n = parseFloat(v) || 0; if (/%$/.test(v)) n = n * w / 100;
    return Math.max(0, Math.min(n, w / 2, h / 2));
  });
}
function officeForme(g, x, y, w, h, rr) { g.beginPath(); if (rr.some(function (v) { return v > 0; }) && g.roundRect) g.roundRect(x, y, w, h, rr); else g.rect(x, y, w, h); }
// ombres : « couleur dx dy flou étalement » séparées par des virgules hors parenthèses
function officeOmbres(v) {
  if (!v || v === 'none') return [];
  return v.split(/,(?![^(]*\))/).map(function (s) {
    var col = (s.match(/(rgba?|color|hsla?)\([^)]*\)|#[0-9a-f]+/i) || [''])[0], n = s.replace(col, '').match(/-?[\d.]+px/g) || [];
    return { col: col, inset: /inset/.test(s), dx: parseFloat(n[0]) || 0, dy: parseFloat(n[1]) || 0, flou: parseFloat(n[2]) || 0, etal: parseFloat(n[3]) || 0 };
  }).filter(function (s) { return s.col && !s.inset; });
}
function peindreElement(g, el, o) {
  var cs = getComputedStyle(el); if (cs.display === 'none') return;
  var tr = cs.transform, avant = null, prio = '';
  g.save();
  if (tr && tr !== 'none') {
    // transformation : mesurée sans elle (sous-arbre compris), puis appliquée au contexte autour de son origine
    avant = el.style.getPropertyValue('transform'); prio = el.style.getPropertyPriority('transform');
    el.style.setProperty('transform', 'none', 'important');
    var r0 = el.getBoundingClientRect(), org = cs.transformOrigin.split(' ').map(parseFloat), m = new DOMMatrix(tr), ox = r0.left - o.x + (org[0] || 0), oy = r0.top - o.y + (org[1] || 0);
    g.translate(ox, oy); g.transform(m.a, m.b, m.c, m.d, m.e, m.f); g.translate(-ox, -oy);
  }
  if (+cs.opacity < 1) g.globalAlpha *= +cs.opacity;
  var r = el.getBoundingClientRect(), x = r.left - o.x, y = r.top - o.y, w = r.width, h = r.height, vu = cs.visibility !== 'hidden';
  if (vu && w && h) peindreBoite(g, cs, x, y, w, h, o);
  if (vu && (el.tagName === 'CANVAS' || el.tagName === 'IMG') && w && h) { try { g.drawImage(el, x, y, w, h); } catch (_) { /* image non chargée */ } }
  if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { g.beginPath(); g.rect(x, y, w, h); g.clip(); }
  // enfants dans l'ordre d'empilement : z-index des éléments positionnés, puis ordre du document
  var kids = Array.prototype.map.call(el.childNodes, function (n, i) {
    var z = 0; if (n.nodeType === 1) { var s = getComputedStyle(n); z = s.position !== 'static' && s.zIndex !== 'auto' ? +s.zIndex || 0 : 0; }
    return { n: n, i: i, z: z };
  }).sort(function (a, b) { return a.z - b.z || a.i - b.i; });
  kids.forEach(function (k) {
    if (k.n.nodeType === 1) peindreElement(g, k.n, o);
    else if (k.n.nodeType === 3 && vu) peindreTexte(g, k.n, cs, o);
  });
  g.restore();
  if (avant !== null) { if (avant) el.style.setProperty('transform', avant, prio); else el.style.removeProperty('transform'); }
}
function peindreBoite(g, cs, x, y, w, h, o) {
  var rr = officeRayons(cs, w, h), fond = cs.backgroundColor;
  officeOmbres(cs.boxShadow).reverse().forEach(function (s) {
    g.save(); g.fillStyle = s.col;
    if (!s.flou && !s.dx && !s.dy) { if (s.etal > 0) { officeForme(g, x - s.etal, y - s.etal, w + 2 * s.etal, h + 2 * s.etal, rr.map(function (v) { return v + s.etal; })); g.fill(); } }   // anneau
    else if (!officeTransparent(fond)) { g.shadowColor = s.col; g.shadowBlur = s.flou * o.echelle; g.shadowOffsetX = s.dx * o.echelle; g.shadowOffsetY = s.dy * o.echelle; officeForme(g, x - s.etal, y - s.etal, w + 2 * s.etal, h + 2 * s.etal, rr); g.fill(); }
    g.restore();
  });
  if (!officeTransparent(fond)) { g.fillStyle = fond; officeForme(g, x, y, w, h, rr); g.fill(); }
  var cotes = ['Top', 'Right', 'Bottom', 'Left'].map(function (k) { return { w: parseFloat(cs['border' + k + 'Width']) || 0, c: cs['border' + k + 'Color'], s: cs['border' + k + 'Style'] }; });
  var visible = function (b) { return b.w > 0 && b.s !== 'none' && b.s !== 'hidden' && !officeTransparent(b.c); };
  var tiret = function (b) { g.setLineDash(b.s === 'dashed' ? [b.w * 3, b.w * 2] : b.s === 'dotted' ? [b.w, b.w] : []); };
  var a = cotes[0], uni = cotes.every(function (b) { return b.w === a.w && b.c === a.c && b.s === a.s; });
  g.save();
  if (uni && visible(a) && rr.some(function (v) { return v > 0; })) {
    g.strokeStyle = a.c; g.lineWidth = a.w; tiret(a);
    officeForme(g, x + a.w / 2, y + a.w / 2, w - a.w, h - a.w, rr.map(function (v) { return Math.max(0, v - a.w / 2); })); g.stroke();
  } else cotes.forEach(function (b, i) {
    if (!visible(b)) return;
    g.strokeStyle = b.c; g.lineWidth = b.w; tiret(b); g.beginPath();
    if (i === 0) { g.moveTo(x, y + b.w / 2); g.lineTo(x + w, y + b.w / 2); }
    else if (i === 1) { g.moveTo(x + w - b.w / 2, y); g.lineTo(x + w - b.w / 2, y + h); }
    else if (i === 2) { g.moveTo(x, y + h - b.w / 2); g.lineTo(x + w, y + h - b.w / 2); }
    else { g.moveTo(x + b.w / 2, y); g.lineTo(x + b.w / 2, y + h); }
    g.stroke();
  });
  g.restore();
}
// texte d'un nœud, mot par mot à la place que lui donne la mise en page (retours à la ligne, alignement, espaces compris)
function peindreTexte(g, n, cs, o) {
  var s = n.nodeValue; if (!s || !s.trim()) return;
  var rg = document.createRange(), mots = [], cur = null, i = 0;
  while (i < s.length) {
    var lg = /[\ud800-\udbff]/.test(s.charAt(i)) ? 2 : 1, ch = s.substr(i, lg);
    rg.setStart(n, i); rg.setEnd(n, i + lg); i += lg;
    var rc = rg.getClientRects()[0];
    if (!rc || /\s/.test(ch)) { cur = null; continue; }
    if (cur && Math.abs(rc.top - cur.top) < 1 && rc.left >= cur.droite - 1) { cur.t += ch; cur.droite = rc.right; }
    else { cur = { t: ch, gauche: rc.left, top: rc.top, h: rc.height, droite: rc.right }; mots.push(cur); }
  }
  if (!mots.length) return;
  g.save();
  g.font = [cs.fontStyle, cs.fontWeight, cs.fontSize, cs.fontFamily].join(' ');
  g.fillStyle = cs.color; g.textBaseline = 'alphabetic';
  if ('letterSpacing' in g) g.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
  var mt = g.measureText('Hg'), asc = mt.fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.8, desc = mt.fontBoundingBoxDescent || parseFloat(cs.fontSize) * 0.2;
  var maj = cs.textTransform === 'uppercase', min = cs.textTransform === 'lowercase', deco = cs.textDecorationLine || '';
  mots.forEach(function (m) {
    var t = maj ? m.t.toUpperCase() : min ? m.t.toLowerCase() : m.t, x = m.gauche - o.x, base = m.top - o.y + (m.h - asc - desc) / 2 + asc;
    g.fillText(t, x, base);
    if (/underline|line-through/.test(deco)) {
      g.fillRect(x, /underline/.test(deco) ? base + 1.5 : base - asc * 0.3, m.droite - m.gauche, Math.max(1, parseFloat(cs.fontSize) / 14));
    }
  });
  g.restore();
}
