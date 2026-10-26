/* ---------- Moteur de carte (autonome : réutilisé tel quel dans l'export statique) ---------- */
function ardoiseMapKit() {
  var GEO = null, instances = [], tileCache = {}, stats = { plan: { ok: 0, err: 0 }, sat: { ok: 0, err: 0 } }, offline = { plan: false, sat: false };
  var TILES = {
    plan: { max: 19,
      attr: function (key) { return key ? '© OpenStreetMap · © CARTO' : '© Esri, HERE, Garmin, © OpenStreetMap'; },
      url: function (z, x, y, dark, hd, key) {
        if (key) return 'https://basemaps.cartocdn.com/rastertiles/voyager/' + z + '/' + x + '/' + y + (hd ? '@2x' : '') + '.png?key=' + encodeURIComponent(key);
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/' + z + '/' + y + '/' + x;
      } },
    sat: { max: 18, attr: function () { return '© Esri, Maxar, Earthstar Geographics'; }, url: function (z, x, y) { return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + z + '/' + y + '/' + x; } }
  };
  var BG = ['vector', 'plan', 'sat'], BG_LABEL = { vector: 'Simplifié', plan: 'Plan', sat: 'Satellite' };
  var CVAR = { accent: '--accent', ok: '--ok', bad: '--bad', warn: '--warn', info: '--info' };
  var R_EARTH = 6371008.8, RAD = Math.PI / 180;
  function escH(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function merc(lon, lat) {
    lat = Math.max(-85.05, Math.min(85.05, lat));
    var s = Math.sin(lat * RAD);
    return [(lon + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)];
  }
  function unmerc(x, y) {
    var n = Math.PI - 2 * Math.PI * y;
    return [x * 360 - 180, 180 / Math.PI * Math.atan((Math.exp(n) - Math.exp(-n)) / 2)];
  }
  // Géodésie : distance orthodromique, point à distance donnée, distance loxodromique (ligne droite sur la carte)
  function gcDist(a, b) {
    var p1 = a[0] * RAD, p2 = b[0] * RAD, dp = p2 - p1, dl = (b[1] - a[1]) * RAD;
    var h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function dest(c, brg, d) {
    var p1 = c[0] * RAD, l1 = c[1] * RAD, t = brg * RAD, dr = d / R_EARTH;
    var p2 = Math.asin(Math.sin(p1) * Math.cos(dr) + Math.cos(p1) * Math.sin(dr) * Math.cos(t));
    var l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(dr) * Math.cos(p1), Math.cos(dr) - Math.sin(p1) * Math.sin(p2));
    return [p2 / RAD, ((l2 / RAD + 540) % 360) - 180];
  }
  function rhumbDist(a, b) {
    var p1 = a[0] * RAD, p2 = b[0] * RAD, dp = p2 - p1, dl = (b[1] - a[1]) * RAD;
    if (Math.abs(dl) > Math.PI) dl = dl > 0 ? -(2 * Math.PI - dl) : 2 * Math.PI + dl;
    var dps = Math.log(Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2));
    var q = Math.abs(dps) > 1e-12 ? dp / dps : Math.cos(p1);
    return Math.sqrt(dp * dp + q * q * dl * dl) * R_EARTH;
  }
  function pathLen(pts) { var d = 0; for (var i = 1; i < pts.length; i++) d += rhumbDist(pts[i - 1], pts[i]); return d; }
  function fmtNum(v) { return v >= 100 ? String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : v.toFixed(1).replace('.', ','); }
  function fmtDist(m) { return fmtNum(m / 1000) + ' km · ' + fmtNum(m / 1852) + ' NM'; }
  function circlePts(c, r) { var o = []; for (var i = 0; i < 72; i++) o.push(dest(c, i * 5, r)); return o; }

  function load() {
    if (GEO) return GEO;
    var el = document.getElementById('ardoise-geo');
    if (!el) return (GEO = { countries: [], lakes: [], ports: [], cities: [], cityDraw: [], cn: [], byLabel: [] });
    var g = JSON.parse(el.textContent), bin = atob(g.data), p = 0, q = g.q;
    function rv() { var r = 0, s = 0, b; do { b = bin.charCodeAt(p++); r += (b & 127) * Math.pow(2, s); s += 7; } while (b & 128); return (r % 2) ? -(r + 1) / 2 : r / 2; }
    function ring(n) {
      var a = new Float64Array(n * 2), x = 0, y = 0, b = [9, 9, -9, -9];
      for (var i = 0; i < n; i++) {
        x += rv(); y += rv();
        var m = merc(x / q, y / q); a[2 * i] = m[0]; a[2 * i + 1] = m[1];
        if (m[0] < b[0]) b[0] = m[0]; if (m[1] < b[1]) b[1] = m[1]; if (m[0] > b[2]) b[2] = m[0]; if (m[1] > b[3]) b[3] = m[1];
      }
      return { a: a, b: b };
    }
    var countries = g.countries.map(function (c) {
      var rings = c[4].map(ring), b = [9, 9, -9, -9];
      rings.forEach(function (r) { b[0] = Math.min(b[0], r.b[0]); b[1] = Math.min(b[1], r.b[1]); b[2] = Math.max(b[2], r.b[2]); b[3] = Math.max(b[3], r.b[3]); });
      var lp = merc(c[1], c[2]);
      return { name: c[0], lx: lp[0], ly: lp[1], ml: c[3], rings: rings, b: b };
    });
    var lakes = g.lakes.map(ring);
    var cities = g.cities || [];
    var cityDraw = cities.map(function (c) { var m = merc(c[2], c[3]); return { name: c[1] || c[0], x: m[0], y: m[1], mz: c[6] / 10, cap: !!c[7] }; })
      .sort(function (a, b) { return a.mz - b.mz; });
    GEO = { countries: countries, lakes: lakes, ports: g.ports || [], cities: cities, cityDraw: cityDraw, cn: g.cn || [],
      byLabel: countries.slice().sort(function (a, b) { return a.ml - b.ml; }) };
    return GEO;
  }
  function redrawAll() { instances.forEach(function (i) { i.request(); }); }
  function tile(bg, url) {
    var t = tileCache[url]; if (t) return t;
    t = tileCache[url] = { img: new Image(), ok: false, err: false };
    t.img.onload = function () { t.ok = true; stats[bg].ok++; redrawAll(); };
    t.img.onerror = function () { t.err = true; stats[bg].err++; if (!stats[bg].ok && stats[bg].err >= 3) { offline[bg] = true; redrawAll(); } };
    t.img.src = url;
    return t;
  }
  // carte « active » pour la molette : la dernière cliquée, retrouvée par son identifiant même après un nouveau rendu
  var activeId = null;
  document.addEventListener('pointerdown', function (e) { var m = e.target && e.target.closest ? e.target.closest('.map[data-mapid]') : null; activeId = m ? m.getAttribute('data-mapid') : null; }, true);
  var darkMQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (darkMQ && darkMQ.addEventListener) darkMQ.addEventListener('change', redrawAll);

  function cleanM(arr) { return (arr || []).map(function (m) { return { lat: +m.lat, lon: +m.lon, label: m.label || '', color: m.color || 'accent', lp: cleanLL(m.lp) }; }); }
  function cleanZ(arr) {
    return (arr || []).map(function (z) {
      if (!z) return null;
      var lp = cleanLL(z.lp);
      if (z.shape === 'circle' && z.c && +z.r > 0) { var c = [+z.c[0], +z.c[1]], r = +z.r; return { label: z.label || '', color: z.color || 'accent', shape: 'circle', c: c, r: r, pts: circlePts(c, r), lp: lp }; }
      if (!z.pts || z.pts.length < 3) return null;
      return { label: z.label || '', color: z.color || 'accent', shape: 'poly', pts: z.pts.map(function (p) { return [+p[0], +p[1]]; }), lp: lp };
    }).filter(Boolean);
  }
  function cleanLL(v) { return (v && v.length === 2 && isFinite(+v[0]) && isFinite(+v[1]) && Math.abs(+v[0]) <= 90) ? [+v[0], +v[1]] : null; }
  function cleanR(arr) {
    return (arr || []).filter(function (r) { return r && r.pts && r.pts.length >= 2; })
      .map(function (r) {
        var pts = r.pts.map(function (p) { return [+p[0], +p[1]]; }), names = (r.names || []).slice(0, pts.length).map(function (n) { return String(n || ''); });
        while (names.length < pts.length) names.push('');
        var np = (r.np || []).slice(0, pts.length).map(cleanLL);
        while (np.length < pts.length) np.push(null);
        return { label: r.label || '', color: r.color || 'accent', pts: pts, names: names, np: np, lp: cleanLL(r.lp), hideDist: !!r.hideDist };
      });
  }
  function r5(v) { return +(+v).toFixed(5); }

  function mount(el, st, o) {
    o = o || {};
    var G = load();
    var v0 = st.view || { lat: 30, lon: 10, z: 1.6 }, c0 = merc(v0.lon, v0.lat);
    var view = { cx: c0[0], cy: c0[1], z: +v0.z || 1.6 };
    var bg = BG.indexOf(st.bg) >= 0 ? st.bg : 'vector', key = String(st.key || '').trim();
    var showCities = st.cities !== false, locked = !!o.locked, hideBg = !!o.hideBg;
    var markers = cleanM(st.markers), zones = cleanZ(st.zones), routes = cleanR(st.routes);
    el.innerHTML = '<canvas></canvas><div class="map-zl"></div><div class="map-pins"></div><div class="map-ctl">' +
      (locked ? '' : '<button type="button" data-z="1" title="Zoom avant" aria-label="Zoom avant">+</button><button type="button" data-z="-1" title="Zoom arrière" aria-label="Zoom arrière">−</button>' +
        '<button type="button" data-fit title="Cadrer sur tout le contenu" aria-label="Cadrer sur tout le contenu">⌖</button>') +
      (hideBg ? '' : '<button type="button" data-bgc title="Changer de fond">' + BG_LABEL[bg] + '</button>') + '</div><div class="map-attr"></div><div class="map-hint"></div>';
    el.classList.toggle('locked', locked); el.classList.toggle('editing', !!o.edit);
    var cv = el.querySelector('canvas'), ctx = cv.getContext('2d'), pins = el.querySelector('.map-pins'), zl = el.querySelector('.map-zl'),
      attr = el.querySelector('.map-attr'), hint = el.querySelector('.map-hint'), bgBtn = el.querySelector('[data-bgc]');
    var W = 0, H = 0, dpr = 1, raf = 0, addMode = false, drawMode = null, draft = [], hoverP = null, edit = null, vDrag = false, hintT = 0, viewT = 0, alive = true, lastTap = null;

    function size() {
      W = el.clientWidth; H = el.clientHeight; dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr));
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
    }
    function scale() { return 256 * Math.pow(2, view.z); }
    function tilesOn() { return bg !== 'vector' && !offline[bg]; }
    function clamp() {
      var minZ = Math.max(0, Math.log(Math.max(H, 1) / 256) / Math.LN2);
      var maxZ = tilesOn() ? TILES[bg].max : 11;
      view.z = Math.max(minZ, Math.min(maxZ, view.z));
      var hh = H / 2 / scale();
      view.cy = hh >= 0.5 ? 0.5 : Math.max(hh, Math.min(1 - hh, view.cy));
      view.cx = ((view.cx % 1) + 1) % 1;
    }
    function request() { if (!raf && alive) raf = requestAnimationFrame(draw); }
    function colors() {
      var cs = getComputedStyle(el), g = function (n) { return cs.getPropertyValue(n).trim(); };
      var C = { sea: g('--map-sea') || '#dbe6ec', land: g('--map-land') || '#f8fafb', line: g('--map-border') || '#b7c4cd', label: g('--map-label') || '#566573',
        fg: g('--fg') || '#17212b', font: g('--f-body') || 'sans-serif', dark: String(cs.colorScheme || '').indexOf('dark') >= 0, z: {} };
      for (var k in CVAR) C.z[k] = g(CVAR[k]) || '#b4540a';
      return C;
    }
    function path(a, ox, oy, s) {
      var n = a.length, px = a[0] * s + ox, py = a[1] * s + oy;
      ctx.moveTo(px, py);
      for (var i = 2; i < n; i += 2) {
        var x = a[i] * s + ox, y = a[i + 1] * s + oy;
        if (i < n - 2 && Math.abs(x - px) + Math.abs(y - py) < 0.8) continue;
        ctx.lineTo(x, y); px = x; py = y;
      }
      ctx.closePath();
    }
    function vis(b, x0, y0, x1, y1) { return !(b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1); }
    function drawVector(ox, oy, s, C) {
      var x0 = -ox / s, x1 = (W - ox) / s, y0 = -oy / s, y1 = (H - oy) / s;
      ctx.beginPath();
      G.countries.forEach(function (c) {
        if (!vis(c.b, x0, y0, x1, y1)) return;
        c.rings.forEach(function (r) { if (vis(r.b, x0, y0, x1, y1)) path(r.a, ox, oy, s); });
      });
      ctx.fillStyle = C.land; ctx.fill('evenodd');
      ctx.lineJoin = 'round'; ctx.strokeStyle = C.line; ctx.lineWidth = view.z < 3 ? 0.5 : 0.8; ctx.stroke();
      ctx.beginPath();
      G.lakes.forEach(function (r) { if (vis(r.b, x0, y0, x1, y1)) path(r.a, ox, oy, s); });
      ctx.fillStyle = C.sea; ctx.fill(); ctx.stroke();
    }
    function overlaps(boxes, bx) {
      for (var j = 0; j < boxes.length; j++) { var b = boxes[j]; if (bx[0] < b[2] && bx[2] > b[0] && bx[1] < b[3] && bx[3] > b[1]) return true; }
      return false;
    }
    function drawLabels(ox, oy, s, C) {
      var boxes = [];
      markers.forEach(function (m) { var p = merc(m.lon, m.lat), k = Math.round(view.cx - p[0]), x = (p[0] + k) * s + ox, y = p[1] * s + oy; boxes.push([x - 10, y - 12, x + 12 + 8 * (m.label || '').length, y + 12]); });
      ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = C.land;
      if (view.z >= 1.8) {
        ctx.font = '500 11px ' + C.font; ctx.textAlign = 'center'; ctx.fillStyle = C.label;
        var lim = view.z + 1.3;
        for (var i = 0; i < G.byLabel.length; i++) {
          var c = G.byLabel[i]; if (c.ml > lim) break;
          var k = Math.round(view.cx - c.lx), x = (c.lx + k) * s + ox, y = c.ly * s + oy;
          if (x < -40 || x > W + 40 || y < 0 || y > H) continue;
          var w = ctx.measureText(c.name).width / 2 + 4, bx = [x - w, y - 9, x + w, y + 9];
          if (overlaps(boxes, bx)) continue;
          boxes.push(bx); ctx.strokeText(c.name, x, y); ctx.fillText(c.name, x, y);
        }
      }
      if (!showCities || view.z < 2.5) return;
      ctx.textAlign = 'left';
      var climit = view.z + 0.4, drawn = 0;
      for (var j = 0; j < G.cityDraw.length && drawn < 160; j++) {
        var t = G.cityDraw[j]; if (t.mz > climit) break;
        var kk = Math.round(view.cx - t.x), cx = (t.x + kk) * s + ox, cy = t.y * s + oy;
        if (cx < -10 || cx > W + 10 || cy < -10 || cy > H + 10) continue;
        ctx.font = (t.cap ? '600 ' : '400 ') + '11px ' + C.font;
        var tw = ctx.measureText(t.name).width, bb = [cx - 4, cy - 8, cx + 8 + tw, cy + 8];
        if (overlaps(boxes, bb)) continue;
        boxes.push(bb); drawn++;
        ctx.beginPath(); ctx.arc(cx, cy, t.cap ? 3.2 : 2.4, 0, 6.2832); ctx.fillStyle = C.fg; ctx.fill();
        ctx.fillStyle = C.fg; ctx.strokeText(t.name, cx + 6, cy); ctx.fillText(t.name, cx + 6, cy);
      }
    }
    function drawTiles(ox, oy, s, C) {
      var T = TILES[bg], tz = Math.max(0, Math.min(T.max, Math.round(view.z))), n = Math.pow(2, tz), ts = s / n, hd = dpr > 1 && bg === 'plan';
      var tx0 = Math.floor(-ox / ts), tx1 = Math.floor((W - ox) / ts), ty0 = Math.max(0, Math.floor(-oy / ts)), ty1 = Math.min(n - 1, Math.floor((H - oy) / ts));
      if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 120) return;
      for (var ty = ty0; ty <= ty1; ty++) for (var tx = tx0; tx <= tx1; tx++) {
        var t = tile(bg, T.url(tz, ((tx % n) + n) % n, ty, C.dark, hd, key));
        if (t.ok) ctx.drawImage(t.img, Math.floor(tx * ts + ox), Math.floor(ty * ts + oy), Math.ceil(ts) + 1, Math.ceil(ts) + 1);
      }
    }
    // Projette une liste [lat, lon] vers l'écran, sur la copie du monde la plus proche du centre ; les longitudes sont déroulées pour franchir l'antiméridien
    function project(list, ox, oy, s) {
      var m = [], prev = null;
      list.forEach(function (p) { var q = merc(p[1], p[0]); if (prev !== null) { while (q[0] - prev > 0.5) q[0] -= 1; while (q[0] - prev < -0.5) q[0] += 1; } prev = q[0]; m.push(q); });
      var sx = 0; m.forEach(function (q) { sx += q[0]; });
      var k = Math.round(view.cx - sx / m.length);
      return m.map(function (q) { return [(q[0] + k) * s + ox, q[1] * s + oy]; });
    }
    function zoneAnchor(z, ox, oy, s) {
      if (z.shape === 'circle') return project([z.c], ox, oy, s)[0];
      var P = project(z.pts, ox, oy, s), cx = 0, cy = 0;
      P.forEach(function (p) { cx += p[0]; cy += p[1]; });
      return [cx / P.length, cy / P.length];
    }
    function routeMid(P) {
      var tot = 0, half = 0, j;
      for (j = 1; j < P.length; j++) tot += Math.hypot(P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1]);
      for (j = 1; j < P.length; j++) {
        var d = Math.hypot(P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1]);
        if (half + d >= tot / 2) { var f = d ? (tot / 2 - half) / d : 0; return [P[j - 1][0] + (P[j][0] - P[j - 1][0]) * f, P[j - 1][1] + (P[j][1] - P[j - 1][1]) * f]; }
        half += d;
      }
      return P[0];
    }
    // ancre (sur la forme) et position (étiquette) à l'écran ; kind : zone | route | step
    function markerXY(i, ox, oy, s) { var m = markers[i], p = merc(m.lon, m.lat), k = Math.round(view.cx - p[0]); return [(p[0] + k) * s + ox, p[1] * s + oy]; }
    function labelAnchor(kind, i, k, ox, oy, s) {
      if (kind === 'marker') return markers[i] ? markerXY(i, ox, oy, s) : null;
      if (kind === 'zone') { var z = zones[i]; return z ? zoneAnchor(z, ox, oy, s) : null; }
      var r = routes[i]; if (!r) return null;
      var P = project(r.pts, ox, oy, s);
      return kind === 'route' ? routeMid(P) : P[k];
    }
    function labelGeo(kind, i, k) {
      if (kind === 'marker') return markers[i] && markers[i].lp;
      if (kind === 'zone') return zones[i] && zones[i].lp;
      var r = routes[i]; if (!r) return null;
      return kind === 'route' ? r.lp : r.np[k];
    }
    function setLabelGeo(kind, i, k, v) {
      if (kind === 'marker') markers[i].lp = v; else if (kind === 'zone') zones[i].lp = v; else if (kind === 'route') routes[i].lp = v; else routes[i].np[k] = v;
    }
    function labelXY(kind, i, k, ox, oy, s) {
      var g = labelGeo(kind, i, k);
      if (g) { var A = labelAnchor(kind, i, k, ox, oy, s), q = merc(g[1], g[0]), x = q[0] * s + ox; if (A) { var w = 360 / 360 * s; while (x - A[0] > w / 2) x -= w; while (x - A[0] < -w / 2) x += w; } return [x, q[1] * s + oy]; }
      var A0 = labelAnchor(kind, i, k, ox, oy, s);
      return (A0 && kind === 'marker') ? [A0[0] + 11, A0[1] - 1] : A0;
    }
    function leader(a, lab, col) {
      // trait discret entre le point d'ancrage et une étiquette déplacée, accroché au côté de l'étiquette qui fait face à l'ancre
      if (!lab || !a) return;
      var r = lab.getBoundingClientRect(), cr = cv.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var x0 = r.left - cr.left, y0 = r.top - cr.top, x1 = r.right - cr.left, y1 = r.bottom - cr.top;
      var gx = a[0] < x0 ? x0 - a[0] : a[0] > x1 ? a[0] - x1 : 0, gy = a[1] < y0 ? y0 - a[1] : a[1] > y1 ? a[1] - y1 : 0;
      if (Math.hypot(gx, gy) < 8) return;
      var b;
      if (gy >= gx) b = [Math.max(x0 + 6, Math.min(x1 - 6, a[0])), a[1] < y0 ? y0 : y1];   // ancre au-dessus / au-dessous : bord haut / bas
      else b = [a[0] < x0 ? x0 : x1, Math.max(y0 + 4, Math.min(y1 - 4, a[1]))];          // ancre à gauche / à droite : bord gauche / droit
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]); ctx.globalAlpha = 0.8; ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(a[0], a[1], 2.5, 0, 6.2832); ctx.fillStyle = col; ctx.fill();
    }
    function poly(P, close) { ctx.beginPath(); P.forEach(function (p, j) { if (j) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); if (close) ctx.closePath(); }
    function arrow(a, b, col, w, casing) {
      var ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = 7 + w * 2;
      ctx.beginPath(); ctx.moveTo(b[0], b[1]);
      ctx.lineTo(b[0] - L * Math.cos(ang - 0.45), b[1] - L * Math.sin(ang - 0.45));
      ctx.lineTo(b[0] - L * Math.cos(ang + 0.45), b[1] - L * Math.sin(ang + 0.45)); ctx.closePath();
      if (casing) { ctx.lineJoin = 'round'; ctx.lineWidth = 2.5; ctx.strokeStyle = casing; ctx.setLineDash([]); ctx.stroke(); }
      ctx.fillStyle = col; ctx.fill();
    }
    function drawRoute(P, col, casing, active) {
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      poly(P, false); ctx.strokeStyle = casing; ctx.lineWidth = 6; ctx.setLineDash([]); ctx.stroke();
      poly(P, false); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash(active ? [8, 5] : []); ctx.stroke(); ctx.setLineDash([]);
      // une flèche au bout de chaque segment, juste avant l'étape qu'il rejoint, pour montrer le sens
      for (var j = 1; j < P.length; j++) {
        var a0 = P[j - 1], b0 = P[j], d0 = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]), last = j === P.length - 1;
        if (d0 < (last ? 6 : 22)) continue;
        var t0 = (d0 - (last ? 0 : 5)) / d0;
        arrow(a0, [a0[0] + (b0[0] - a0[0]) * t0, a0[1] + (b0[1] - a0[1]) * t0], col, last ? 3 : 2, casing);
      }
      P.forEach(function (p, j) { if (j === 0 || j === P.length - 1) return; ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, 6.2832); ctx.fillStyle = casing; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = col; ctx.stroke(); });
      if (P.length) { ctx.beginPath(); ctx.arc(P[0][0], P[0][1], 4.5, 0, 6.2832); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = casing; ctx.stroke(); }
    }
    function drawShapes(ox, oy, s, C) {
      zones.forEach(function (z, i) {
        var act = edit && edit.kind === 'zone' && edit.i === i, P = project(z.pts, ox, oy, s), col = C.z[z.color] || C.z.accent;
        poly(P, true); ctx.globalAlpha = act ? 0.26 : 0.17; ctx.fillStyle = col; ctx.fill();
        ctx.globalAlpha = 0.95; ctx.lineWidth = act ? 2.5 : 2; ctx.strokeStyle = col; ctx.setLineDash(act ? [6, 4] : []); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      });
      var casing = C.dark ? '#0b1218' : '#ffffff';
      routes.forEach(function (r, i) {
        var P = project(r.pts, ox, oy, s), col = C.z[r.color] || C.z.accent;
        drawRoute(P, col, casing, edit && edit.kind === 'route' && edit.i === i);
      });
      if (!drawMode || !draft.length) return;
      var col = C.z.accent, sc = scale(), P = draft.map(function (q) { return [q[0] * sc + ox, q[1] * sc + oy]; });
      if (drawMode === 'circle') {
        if (!hoverP) { ctx.beginPath(); ctx.arc(P[0][0], P[0][1], 4, 0, 6.2832); ctx.fillStyle = col; ctx.fill(); return; }
        var c = unitLL(draft[0]), e2 = toLL(hoverP[0], hoverP[1]), cp = project(circlePts(c, gcDist(c, [e2.lat, e2.lon])), ox, oy, s);
        poly(cp, true); ctx.globalAlpha = 0.12; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); ctx.lineTo(hoverP[0], hoverP[1]); ctx.stroke();
        ctx.beginPath(); ctx.arc(P[0][0], P[0][1], 4, 0, 6.2832); ctx.fillStyle = col; ctx.fill();
        return;
      }
      if (drawMode === 'route') {
        var Q = hoverP ? P.concat([hoverP]) : P;
        drawRoute(Q, col, casing, true);
        return;
      }
      poly(hoverP ? P.concat([hoverP]) : P, false);
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
      if (P.length >= 3) { poly(P, true); ctx.globalAlpha = 0.12; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1; }
      P.forEach(function (p, j) { ctx.beginPath(); ctx.arc(p[0], p[1], j === 0 ? 6 : 4, 0, 6.2832); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke(); });
    }
    function drawLeaders(ox, oy, s, C) {
      // après le placement des étiquettes, pour connaître leur boîte réelle
      routes.forEach(function (r, i) {
        var col = C.z[r.color] || C.z.accent, P = null;
        r.names.forEach(function (n, k) {
          if (!n || !r.np[k]) return; P = P || project(r.pts, ox, oy, s);
          leader(P[k], zl.querySelector('.slab[data-r="' + i + '"][data-s="' + k + '"] span'), col);
        });
        if (r.lp) { P = P || project(r.pts, ox, oy, s); leader(routeMid(P), zl.querySelector('.rlab[data-r="' + i + '"] span'), col); }
      });
      markers.forEach(function (m, i) { if (m.label && m.lp && pins.children[i]) leader(markerXY(i, ox, oy, s), pins.children[i].querySelector('span'), C.z[m.color] || C.z.accent); });
      zones.forEach(function (z, i) { if (z.label && z.lp) leader(zoneAnchor(z, ox, oy, s), zl.querySelector('.zlab[data-z="' + i + '"] span'), C.z[z.color] || C.z.accent); });
    }
    function draw() {
      raf = 0; if (!alive) return;
      if (!W) { size(); if (!W) return; clamp(); }
      var C = colors(), s = scale(), ox = W / 2 - view.cx * s, oy = H / 2 - view.cy * s;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = C.sea; ctx.fillRect(0, 0, W, H);
      var k0 = Math.floor(-ox / s), k1 = Math.floor((W - ox) / s), k;
      for (k = k0; k <= k1; k++) drawVector(ox + k * s, oy, s, C);
      if (tilesOn()) drawTiles(ox, oy, s, C);
      drawShapes(ox, oy, s, C);
      if (!tilesOn()) drawLabels(ox, oy, s, C);
      placeOverlays(ox, oy, s);
      drawLeaders(ox, oy, s, C);
      attr.textContent = tilesOn() ? TILES[bg].attr(key) : 'Natural Earth';
      if (!hintT) hint.textContent = (bg !== 'vector' && offline[bg]) ? 'Hors ligne : fond simplifié affiché' : '';
    }
    function buildPins() {
      pins.innerHTML = markers.map(function (m, i) {
        return '<div class="pin c-' + escH(m.color) + '" data-i="' + i + '" title="' + escH(m.label || 'Point ' + (i + 1)) + '"><i></i>' + (m.label ? '<span>' + escH(m.label) + '</span>' : '') + '</div>';
      }).join('');
    }
    function editTarget() { if (!edit || edit.kind === 'marker') return null; return edit.kind === 'zone' ? zones[edit.i] : routes[edit.i]; }
    function sig() { var t = editTarget(); return zones.length + ':' + routes.length + ':' + routes.map(function (r) { return r.names.join('\u0001') + (r.hideDist ? '-' : '+'); }).join('\u0002') + ':' + (edit ? edit.kind + edit.i + ':' + (t ? t.shape + (t.shape === 'circle' ? '' : t.pts.length) : 'x') : '-'); }
    function buildZl() {
      var h = zones.map(function (z, i) { return '<div class="zlab c-' + escH(z.color) + '" data-z="' + i + '">' + (z.label ? '<span>' + escH(z.label) + '</span>' : '') + '</div>'; }).join('') +
        routes.map(function (r, i) {
          var rtxt = r.hideDist ? (r.label ? '<b>' + escH(r.label) + '</b>' : '') : (r.label ? '<b>' + escH(r.label) + '</b> · ' : '') + escH(fmtDist(pathLen(r.pts)));
          return (rtxt ? '<div class="rlab c-' + escH(r.color) + '" data-r="' + i + '"><span>' + rtxt + '</span></div>' : '') +
            r.names.map(function (n, j) { return n ? '<div class="slab c-' + escH(r.color) + '" data-r="' + i + '" data-s="' + j + '"><span>' + escH(n) + '</span></div>' : ''; }).join('');
        }).join('');
      var t = editTarget();
      if (t) {
        if (t.shape === 'circle') h += '<div class="vh" data-cc title="Glisser pour déplacer le cercle"></div><div class="vh mid rad" data-cr title="Glisser pour changer le rayon"></div>';
        else {
          var n = t.pts.length, closed = edit.kind === 'zone';
          for (var j = 0; j < n; j++) {
            h += '<div class="vh" data-v="' + j + '" title="Glisser pour déplacer · double-clic pour supprimer"></div>';
            if (closed || j < n - 1) h += '<div class="vh mid" data-m="' + j + '" title="Glisser pour ajouter un sommet"></div>';
          }
        }
      }
      zl.innerHTML = h; zl._sig = sig();
    }
    function at(el2, x, y, hideMargin) {
      el2.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      el2.style.display = (x < -hideMargin || x > W + hideMargin || y < -40 || y > H + 40) ? 'none' : '';
    }
    function placeOverlays(ox, oy, s) {
      if (pins.childElementCount !== markers.length) buildPins();
      markers.forEach(function (m, i) {
        var p = merc(m.lon, m.lat), k = Math.round(view.cx - p[0]), x = (p[0] + k) * s + ox, y = p[1] * s + oy, pe = pins.children[i];
        at(pe, x, y, 80);
        pe.classList.toggle('sel', !!(edit && edit.kind === 'marker' && edit.i === i));
        var sp = pe.querySelector('span');
        if (sp) { if (m.lp) { var L = labelXY('marker', i, -1, ox, oy, s); sp.style.left = (L[0] - x).toFixed(1) + 'px'; sp.style.top = (L[1] - y - 11).toFixed(1) + 'px'; } else { sp.style.left = ''; sp.style.top = ''; } }
      });
      if (zl._sig !== sig() && !vDrag) buildZl();
      zones.forEach(function (z, i) {
        var le = zl.querySelector('.zlab[data-z="' + i + '"]'), L = labelXY('zone', i, -1, ox, oy, s);
        if (le && L) at(le, L[0], L[1], 100);
      });
      routes.forEach(function (r, i) {
        var le = zl.querySelector('.rlab[data-r="' + i + '"]'), L = labelXY('route', i, -1, ox, oy, s);
        if (le && L) at(le, L[0], L[1], 120);
        r.names.forEach(function (n, k) { if (!n) return; var se = zl.querySelector('.slab[data-r="' + i + '"][data-s="' + k + '"]'), L2 = labelXY('step', i, k, ox, oy, s); if (se && L2) at(se, L2[0], L2[1], 120); });
      });
      var t = editTarget(); if (!t) return;
      if (t.shape === 'circle') {
        var cc = project([t.c], ox, oy, s)[0], rp = project([t.c, dest(t.c, 90, t.r)], ox, oy, s)[1];
        var hc = zl.querySelector('[data-cc]'), hr = zl.querySelector('[data-cr]');
        if (hc) at(hc, cc[0], cc[1], 50); if (hr) at(hr, rp[0], rp[1], 50);
        return;
      }
      var P2 = project(t.pts, ox, oy, s);
      P2.forEach(function (p, j) {
        var v = zl.querySelector('[data-v="' + j + '"]'), mid = zl.querySelector('[data-m="' + j + '"]'), q = P2[(j + 1) % P2.length];
        if (v) at(v, p[0], p[1], 50);
        if (mid) at(mid, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, 50);
      });
    }
    function local(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    function toUnit(px, py) { var s = scale(); return [view.cx + (px - W / 2) / s, view.cy + (py - H / 2) / s]; }
    function unitLL(u) { var ll = unmerc(((u[0] % 1) + 1) % 1, Math.max(0, Math.min(1, u[1]))); return [ll[1], ll[0]]; }
    function toLL(px, py) { var ll = unitLL(toUnit(px, py)); return { lat: ll[0], lon: ll[1] }; }
    function zoomAt(dz, px, py) {
      var s0 = scale(), ux = view.cx + (px - W / 2) / s0, uy = view.cy + (py - H / 2) / s0;
      view.z += dz; clamp();
      var s1 = scale(); view.cx = ux - (px - W / 2) / s1; view.cy = uy - (py - H / 2) / s1; clamp(); request();
    }
    function getView() { var ll = unmerc(view.cx, view.cy); return { lat: +ll[1].toFixed(4), lon: +ll[0].toFixed(4), z: +view.z.toFixed(2) }; }
    function changed(delay) {
      if (!o.onView) return;
      clearTimeout(viewT); viewT = setTimeout(function () { if (alive) o.onView(getView()); }, delay || 0);
    }
    function showHint(t, ms) { hint.textContent = t; clearTimeout(hintT); hintT = setTimeout(function () { hintT = 0; request(); }, ms || 1800); }
    function fitPts(list, maxZ) {
      if (!list.length) return false;
      var b = [9, 9, -9, -9];
      list.forEach(function (ll) { var p = merc(ll[1], ll[0]); b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); });
      var w = Math.max(b[2] - b[0], 1e-6), h = Math.max(b[3] - b[1], 1e-6);
      view.z = Math.min(maxZ, Math.log(Math.min((W - 140) / (w * 256), (H - 90) / (h * 256))) / Math.LN2);
      view.cx = (b[0] + b[2]) / 2; view.cy = (b[1] + b[3]) / 2; clamp(); request(); changed();
      return true;
    }
    function fit() {
      var all = markers.map(function (m) { return [m.lat, m.lon]; });
      zones.forEach(function (z) { all = all.concat(z.pts); });
      routes.forEach(function (r) { all = all.concat(r.pts); });
      if (!fitPts(all, all.length === 1 ? 7 : 11)) { var c = merc(10, 30); view.cx = c[0]; view.cy = c[1]; view.z = 1.6; clamp(); request(); changed(); }
    }
    function flash(sel) { var le = zl.querySelector(sel) || pins.querySelector(sel); if (le) { le.classList.remove('flash'); void le.offsetWidth; le.classList.add('flash'); } }
    function goTo(i) {
      var m = markers[i]; if (!m) return;
      if (!locked) { var p = merc(m.lon, m.lat); view.cx = p[0]; view.cy = p[1]; view.z = Math.max(view.z, 6); clamp(); request(); changed(); }
      flash('.pin[data-i="' + i + '"]');
    }
    function goZone(i) { var z = zones[i]; if (!z) return; if (!locked) fitPts(z.pts, 11); flash('.zlab[data-z="' + i + '"]'); }
    function goRoute(i) { var r = routes[i]; if (!r) return; if (!locked) fitPts(r.pts, 11); flash('.rlab[data-r="' + i + '"]'); }

    // Dessin : zone (polygone), cercle, itinéraire
    var HINTS = {
      poly: 'Cliquez pour poser les sommets · double-clic ou Entrée pour terminer · Échap pour annuler',
      circle: 'Cliquez au centre (aimanté aux points, Alt pour le placer librement), puis une seconde fois pour le rayon',
      route: 'Cliquez pour poser les étapes (aimantées aux points, Alt pour les placer librement) · double-clic ou Entrée pour terminer'
    };
    function setDrawMode(kind) {
      drawMode = kind || null; draft = []; hoverP = null;
      if (drawMode) addMode = false;
      el.classList.toggle('adding', !!drawMode || addMode);
      if (drawMode) { showHint(HINTS[drawMode], 5000); el.focus({ preventScroll: true }); }
      request();
    }
    function endDraw(msg) { var k = drawMode; setDrawMode(null); if (o.onDrawEnd) o.onDrawEnd(k); if (msg) showHint(msg); }
    function finishDraft() {
      var kind = drawMode, pts = draft.map(function (q) { var ll = unitLL(q); return [r5(ll[0]), r5(ll[1])]; });
      if (kind === 'route') {
        if (pts.length < 2) { endDraw('Itinéraire annulé : il faut au moins 2 étapes'); return; }
        endDraw(); if (o.onRoute) o.onRoute(pts); return;
      }
      if (pts.length < 3) { endDraw('Zone annulée : il faut au moins 3 sommets'); return; }
      endDraw(); if (o.onZone) o.onZone({ shape: 'poly', pts: pts });
    }
    function snap(pos, ev) {
      // aimante sur un point existant (à moins de 14 px) ; maintenir Alt pour placer librement
      if (ev && ev.altKey) return pos;
      var s = scale(), ox = W / 2 - view.cx * s, oy = H / 2 - view.cy * s, best = null, bd = 14;
      markers.forEach(function (m) { var p = merc(m.lon, m.lat), k = Math.round(view.cx - p[0]), x = (p[0] + k) * s + ox, y = p[1] * s + oy, d = Math.hypot(x - pos[0], y - pos[1]); if (d < bd) { bd = d; best = [x, y]; } });
      return best || pos;
    }
    function drawClick(pos, ev) {
      var s = scale(), ox = W / 2 - view.cx * s, oy = H / 2 - view.cy * s;
      if (drawMode === 'circle') {
        if (!draft.length) { pos = snap(pos, ev); draft.push(toUnit(pos[0], pos[1])); request(); return; }
        var c = unitLL(draft[0]), e2 = toLL(pos[0], pos[1]), r = gcDist(c, [e2.lat, e2.lon]);
        if (r < 1) return;
        endDraw(); if (o.onZone) o.onZone({ shape: 'circle', c: [r5(c[0]), r5(c[1])], r: Math.round(r) });
        return;
      }
      pos = snap(pos, ev);
      if (drawMode === 'poly' && draft.length >= 3) { var f = draft[0]; if (Math.hypot(f[0] * s + ox - pos[0], f[1] * s + oy - pos[1]) < 10) { finishDraft(); return; } }
      if (draft.length) { var l = draft[draft.length - 1]; if (Math.hypot(l[0] * s + ox - pos[0], l[1] * s + oy - pos[1]) < 5) return; }
      draft.push(toUnit(pos[0], pos[1])); request();
    }

    // Déplacement, zoom à deux doigts, clic
    var ptrs = {}, drag = null, pinch = null, moved = false;
    function pts() { return Object.keys(ptrs).map(function (k) { return ptrs[k]; }); }
    cv.addEventListener('pointerdown', function (e) {
      if (locked) return;
      el.focus({ preventScroll: true });
      try { cv.setPointerCapture(e.pointerId); } catch (_) {}
      ptrs[e.pointerId] = local(e);
      var P = pts();
      if (P.length === 1) { drag = { p: P[0], cx: view.cx, cy: view.cy }; moved = false; }
      else if (P.length === 2) { pinch = { d: Math.hypot(P[0][0] - P[1][0], P[0][1] - P[1][1]) || 1, z: view.z }; drag = null; moved = true; }
    });
    cv.addEventListener('pointermove', function (e) {
      if (drawMode && !ptrs[e.pointerId]) { var lp = local(e); hoverP = (drawMode === 'circle' && draft.length) ? lp : snap(lp, e); request(); return; }
      if (!ptrs[e.pointerId]) return;
      ptrs[e.pointerId] = local(e);
      var P = pts();
      if (pinch && P.length >= 2) {
        var d = Math.hypot(P[0][0] - P[1][0], P[0][1] - P[1][1]) || 1;
        zoomAt(pinch.z + Math.log(d / pinch.d) / Math.LN2 - view.z, (P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2);
      } else if (drag) {
        var dx = P[0][0] - drag.p[0], dy = P[0][1] - drag.p[1];
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        if (moved) { var s = scale(); view.cx = drag.cx - dx / s; view.cy = drag.cy - dy / s; clamp(); request(); }
      }
    });
    cv.addEventListener('pointerleave', function () { if (drawMode) { hoverP = null; request(); } });
    function up(e) {
      var pos = ptrs[e.pointerId]; delete ptrs[e.pointerId];
      if (pinch) { if (pts().length < 2) { pinch = null; drag = null; changed(); } return; }
      if (!drag) return;
      drag = null;
      if (moved) { changed(); return; }
      if (e.type !== 'pointerup' || !pos) return;
      if (drawMode) { drawClick(pos, e); return; }
      if (addMode && o.onAdd) { var ll = toLL(pos[0], pos[1]); o.onAdd(r5(ll.lat), r5(ll.lon)); }
    }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('dblclick', function (e) {
      if (locked) return;
      if (drawMode) { e.preventDefault(); if (drawMode !== 'circle') finishDraft(); return; }
      var p = local(e); zoomAt(e.shiftKey ? -1 : 1, p[0], p[1]); changed();
    });
    el.addEventListener('wheel', function (e) {
      if (locked) return;
      if (!(e.ctrlKey || e.metaKey || (activeId && activeId === el.getAttribute('data-mapid')) || document.activeElement === el)) { showHint('Cliquez sur la carte, puis utilisez la molette'); return; }
      e.preventDefault();
      var p = local(e); zoomAt(-e.deltaY * (e.deltaMode ? 0.05 : 0.003), p[0], p[1]); changed(300);
    }, { passive: false });
    el.addEventListener('keydown', function (e) {
      if (drawMode) {
        if (e.key === 'Enter') { e.preventDefault(); if (drawMode !== 'circle') finishDraft(); return; }
        if (e.key === 'Escape') { e.preventDefault(); endDraw('Dessin annulé'); return; }
        if (e.key === 'Backspace') { e.preventDefault(); draft.pop(); request(); return; }
      }
      if (locked) return;
      var s = scale(), step = 80 / s, k = e.key;
      if (k === 'ArrowLeft') view.cx -= step; else if (k === 'ArrowRight') view.cx += step;
      else if (k === 'ArrowUp') view.cy -= step; else if (k === 'ArrowDown') view.cy += step;
      else if (k === '+' || k === '=') { zoomAt(1, W / 2, H / 2); changed(); e.preventDefault(); return; }
      else if (k === '-') { zoomAt(-1, W / 2, H / 2); changed(); e.preventDefault(); return; }
      else return;
      e.preventDefault(); clamp(); request(); changed(300);
    });
    el.querySelector('.map-ctl').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-z')) { zoomAt(+b.getAttribute('data-z'), W / 2, H / 2); changed(); }
      else if (b.hasAttribute('data-fit')) fit();
      else if (b.hasAttribute('data-bgc')) {
        bg = BG[(BG.indexOf(bg) + 1) % BG.length]; bgBtn.textContent = BG_LABEL[bg];
        if (bg !== 'vector') { offline[bg] = false; stats[bg].err = 0; }
        clamp(); request(); if (o.onBg) o.onBg(bg);
      }
    });
    // Points : déplacement (édition) ou sélection
    pins.addEventListener('pointerdown', function (e) {
      var pe = e.target.closest('.pin'); if (!pe) return;
      e.stopPropagation(); e.preventDefault();
      var i = +pe.getAttribute('data-i');
      if (drawMode) {
        // clic sur la pastille : coordonnées exactes du point ; clic sur l'étiquette ou avec Alt : position du clic
        if (e.altKey || e.target.tagName !== 'I') { drawClick(local(e), e); return; }
        var m0 = markers[i], pp = merc(m0.lon, m0.lat), s0 = scale();
        drawClick([(pp[0] + Math.round(view.cx - pp[0]) - view.cx) * s0 + W / 2, (pp[1] - view.cy) * s0 + H / 2], null); return;
      }
      if (addMode) return;
      if (!o.edit) { goTo(i); return; }
      var mine = edit && edit.kind === 'marker' && edit.i === i;
      if (!mine) {
        if (edit) { showHint('Terminez la modification en cours (✎ ou Échap) pour modifier un autre élément'); return; }
        if (o.onPin) o.onPin(i);
        return;
      }
      try { pe.setPointerCapture(e.pointerId); } catch (_) {}
      if (e.target.tagName === 'SPAN') {
        // glisser l'étiquette du point (double-clic : la remettre à sa place)
        var key3 = 'marker' + i, now3 = Date.now();
        if (lastTap && lastTap.lab === key3 && now3 - lastTap.t < 450) { lastTap = null; markers[i].lp = null; request(); if (o.onLabelMove) o.onLabelMove('marker', i, -1, null); return; }
        var scm = scale(), oxm = W / 2 - view.cx * scm, oym = H / 2 - view.cy * scm, stm = local(e), Lm = labelXY('marker', i, -1, oxm, oym, scm), lmv2 = false;
        var lm = function (ev) { var q = local(ev), dx = q[0] - stm[0], dy = q[1] - stm[1]; if (!lmv2 && Math.abs(dx) + Math.abs(dy) < 3) return; lmv2 = true; var ll2 = toLL(Lm[0] + dx, Lm[1] + dy); markers[i].lp = [ll2.lat, ll2.lon]; request(); };
        var lu = function () {
          pe.removeEventListener('pointermove', lm); pe.removeEventListener('pointerup', lu); pe.removeEventListener('pointercancel', lu);
          if (lmv2) { lastTap = null; if (o.onLabelMove) o.onLabelMove('marker', i, -1, [r5(markers[i].lp[0]), r5(markers[i].lp[1])]); } else lastTap = { lab: key3, t: Date.now() };
        };
        pe.addEventListener('pointermove', lm); pe.addEventListener('pointerup', lu); pe.addEventListener('pointercancel', lu);
        return;
      }
      var mv = false, start = local(e);
      function mvh(ev) {
        var p = local(ev); if (!mv && Math.abs(p[0] - start[0]) + Math.abs(p[1] - start[1]) < 3) return;
        mv = true; var ll = toLL(p[0], p[1]); markers[i].lat = ll.lat; markers[i].lon = ll.lon; request();
      }
      function uph() {
        pe.removeEventListener('pointermove', mvh); pe.removeEventListener('pointerup', uph); pe.removeEventListener('pointercancel', uph);
        if (mv && o.onMove) o.onMove(i, r5(markers[i].lat), r5(markers[i].lon));
      }
      pe.addEventListener('pointermove', mvh); pe.addEventListener('pointerup', uph); pe.addEventListener('pointercancel', uph);
    });
    // Zones et itinéraires : nom cliquable, poignées (édition)
    function commitEdit() {
      var t = editTarget(); if (!t) return;
      if (edit.kind === 'route') { if (o.onRouteEdit) o.onRouteEdit(edit.i, t.pts.map(function (p) { return [r5(p[0]), r5(p[1])]; }), t.names.slice(), t.np.map(function (v) { return v ? [r5(v[0]), r5(v[1])] : null; })); return; }
      if (!o.onZoneEdit) return;
      if (t.shape === 'circle') o.onZoneEdit(edit.i, { shape: 'circle', c: [r5(t.c[0]), r5(t.c[1])], r: Math.round(t.r) });
      else o.onZoneEdit(edit.i, { shape: 'poly', pts: t.pts.map(function (p) { return [r5(p[0]), r5(p[1])]; }) });
    }
    zl.addEventListener('pointerdown', function (e) {
      var lab = e.target.closest('.zlab,.rlab,.slab');
      if (lab) {
        e.stopPropagation();
        var lk = lab.classList.contains('zlab') ? 'zone' : lab.classList.contains('rlab') ? 'route' : 'step';
        var li = +lab.getAttribute(lk === 'zone' ? 'data-z' : 'data-r'), lj = lk === 'step' ? +lab.getAttribute('data-s') : -1;
        if (!o.edit) { if (lk === 'zone') goZone(li); else goRoute(li); return; }
        e.preventDefault();
        // pendant la modification d'un élément, seules ses propres étiquettes restent modifiables
        if (!(edit && ((edit.kind === 'zone' && lk === 'zone' && edit.i === li) || (edit.kind === 'route' && lk !== 'zone' && edit.i === li)))) {
          if (edit) { showHint('Terminez la modification en cours (✎ ou Échap) pour modifier un autre élément'); return; }
          if (lk === 'step') { if (o.onStepPick) o.onStepPick(li, lj); } else if (o.onPick) o.onPick(lk, li);
          return;
        }
        var key2 = lk + li + ':' + lj, now2 = Date.now();
        if (lastTap && lastTap.lab === key2 && now2 - lastTap.t < 450) {
          lastTap = null; setLabelGeo(lk, li, lj, null); buildZl(); request();
          if (o.onLabelMove) o.onLabelMove(lk, li, lj, null);
          return;
        }
        try { lab.setPointerCapture(e.pointerId); } catch (_) {}
        vDrag = true;
        var sc0 = scale(), ox0 = W / 2 - view.cx * sc0, oy0 = H / 2 - view.cy * sc0;
        var st0 = local(e), L0 = labelXY(lk, li, lj, ox0, oy0, sc0), lmv = false;
        var lmove = function (ev) {
          var p = local(ev), dx = p[0] - st0[0], dy = p[1] - st0[1];
          if (!lmv && Math.abs(dx) + Math.abs(dy) < 3) return;
          lmv = true; var ll = toLL(L0[0] + dx, L0[1] + dy); setLabelGeo(lk, li, lj, [ll.lat, ll.lon]); request();
        };
        var lup = function () {
          lab.removeEventListener('pointermove', lmove); lab.removeEventListener('pointerup', lup); lab.removeEventListener('pointercancel', lup);
          vDrag = false;
          if (lmv) { lastTap = null; var v = labelGeo(lk, li, lj); if (o.onLabelMove) o.onLabelMove(lk, li, lj, [r5(v[0]), r5(v[1])]); }
          else {
            lastTap = { lab: key2, t: Date.now() };
            if (lk === 'step') { if (o.onStepPick) o.onStepPick(li, lj); } else if (o.onPick) o.onPick(lk, li);
          }
        };
        lab.addEventListener('pointermove', lmove); lab.addEventListener('pointerup', lup); lab.addEventListener('pointercancel', lup);
        return;
      }
      var h = e.target.closest('.vh'), t = editTarget(); if (!h || !t) return;
      e.stopPropagation(); e.preventDefault();
      var kind = h.hasAttribute('data-cc') ? 'cc' : h.hasAttribute('data-cr') ? 'cr' : h.hasAttribute('data-v') ? 'v' : 'm';
      var j = kind === 'v' ? +h.getAttribute('data-v') : kind === 'm' ? +h.getAttribute('data-m') + 1 : -1;
      // double-clic sur un sommet : suppression (détecté ici car la poignée peut être reconstruite entre deux clics)
      var now = Date.now();
      if (kind === 'v' && lastTap && lastTap.j === j && now - lastTap.t < 450) {
        lastTap = null;
        var minN = edit.kind === 'route' ? 2 : 3;
        if (t.pts.length <= minN) { showHint(edit.kind === 'route' ? 'Un itinéraire garde au moins 2 étapes' : 'Une zone garde au moins 3 sommets'); return; }
        t.pts.splice(j, 1); if (t.names) { t.names.splice(j, 1); t.np.splice(j, 1); } buildZl(); request(); commitEdit(); return;
      }
      try { h.setPointerCapture(e.pointerId); } catch (_) {}
      vDrag = true;
      var start = local(e), mv = false, inserted = false;
      function mvh(ev) {
        var p = local(ev);
        if (!mv && Math.abs(p[0] - start[0]) + Math.abs(p[1] - start[1]) < 3) return;
        mv = true;
        if (kind !== 'cr') p = snap(p, ev);
        var ll = toLL(p[0], p[1]);
        if (kind === 'cc') { t.c = [ll.lat, ll.lon]; t.pts = circlePts(t.c, t.r); }
        else if (kind === 'cr') { t.r = Math.max(10, gcDist(t.c, [ll.lat, ll.lon])); t.pts = circlePts(t.c, t.r); }
        else {
          if (kind === 'm' && !inserted) { t.pts.splice(j, 0, [ll.lat, ll.lon]); if (t.names) { t.names.splice(j, 0, ''); t.np.splice(j, 0, null); } inserted = true; }
          t.pts[j] = [ll.lat, ll.lon];
        }
        request();
      }
      function uph() {
        h.removeEventListener('pointermove', mvh); h.removeEventListener('pointerup', uph); h.removeEventListener('pointercancel', uph);
        vDrag = false;
        if (mv) { lastTap = null; buildZl(); request(); commitEdit(); }
        else if (kind === 'v') { lastTap = { j: j, t: Date.now() }; if (edit.kind === 'route' && o.onStepPick) o.onStepPick(edit.i, j); }
      }
      h.addEventListener('pointermove', mvh); h.addEventListener('pointerup', uph); h.addEventListener('pointercancel', uph);
    });
    // Liste sous la carte
    var host = el.parentNode, onList = function (e) {
      var b = e.target.closest('[data-go],[data-gz],[data-gr]'); if (!b || !host.contains(b)) return;
      e.preventDefault();
      if (b.hasAttribute('data-go')) goTo(+b.getAttribute('data-go'));
      else if (b.hasAttribute('data-gz')) goZone(+b.getAttribute('data-gz'));
      else goRoute(+b.getAttribute('data-gr'));
    };
    if (host) host.addEventListener('click', onList);

    var ro = window.ResizeObserver ? new ResizeObserver(function () { size(); clamp(); request(); }) : null;
    if (ro) ro.observe(el);
    size(); clamp(); request();
    var api = {
      request: request, fit: fit, goTo: goTo, goZone: goZone, goRoute: goRoute, getView: getView,
      setMarkers: function (arr) { markers = cleanM(arr); buildPins(); request(); },
      setZones: function (arr) { zones = cleanZ(arr); buildZl(); request(); },
      setRoutes: function (arr) { routes = cleanR(arr); buildZl(); request(); },
      setAddMode: function (on) { addMode = !!on; if (addMode) { drawMode = null; draft = []; } el.classList.toggle('adding', addMode); if (addMode) showHint('Cliquez sur la carte pour placer un point', 2500); },
      setDrawMode: setDrawMode,
      setEdit: function (kind, i) { edit = kind ? { kind: kind, i: i } : null; lastTap = null; el.classList.toggle('pin-edit', !!(edit && edit.kind === 'marker')); buildZl(); request(); },
      center: function (lat, lon, z) { var p = merc(lon, lat); view.cx = p[0]; view.cy = p[1]; if (z) view.z = Math.max(view.z, z); clamp(); request(); changed(); },
      destroy: function () { alive = false; if (ro) ro.disconnect(); if (host) host.removeEventListener('click', onList); clearTimeout(viewT); var i = instances.indexOf(api); if (i >= 0) instances.splice(i, 1); }
    };
    instances.push(api);
    return api;
  }
  return { mount: mount, data: load, merc: merc, pathLen: pathLen, fmtDist: fmtDist };
}


