/* ---------- Runtime de lecture (autonome : recopié tel quel dans l'export statique, fermeture vérifiée par build.mjs) ---------- */
// tout ce que la page exportée exécute (pliage, sommaire, pages, impression, frises), utilisé aussi par l'éditeur (Reader) ; aucun nom du bundle, aucun accès au DOM avant un appel
function ardoiseReader() {
  function tlFit(root) {
    // marge au-dessus de la frise = hauteur réelle du titre incliné le plus long ; marges latérales = débord du dernier titre
    Array.prototype.forEach.call((root || document).querySelectorAll('.tl-h-in'), function (g) {
      var items = g.children; if (!items.length) return;
      var mx = 0, last = 0, lh = 17;
      Array.prototype.forEach.call(g.querySelectorAll('.tl-h-title'), function (t, i, all) {
        var w = Math.min(t.scrollWidth, 200); lh = t.offsetHeight || lh;
        if (w > mx) mx = w; if (i === all.length - 1) last = w;
      });
      var cw = items[0].getBoundingClientRect().width || 92;
      g.style.setProperty('--cw', cw + 'px');
      g.style.paddingTop = Math.ceil((mx + lh) * 0.7071 + 12) + 'px';
      var side = Math.max(12, Math.ceil(last * 0.7071 + 18 - cw / 2));
      g.style.paddingLeft = g.style.paddingRight = side + 'px';
    });
    Array.prototype.forEach.call((root || document).querySelectorAll('.tl-v-slab .tl-seg-txt'), function (lb) {
      var row = lb.closest('.tl-v-seg'), a = row && row.previousElementSibling, b2 = row && row.nextElementSibling;
      var da = a && a.querySelector('.tl-dot'), db = b2 && b2.querySelector('.tl-dot'); if (!da || !db) return;
      lb.style.transform = '';
      var ra = da.getBoundingClientRect(), rb = db.getBoundingClientRect(), r = lb.getBoundingClientRect();
      if (r.left > ra.right) return;   // écran étroit : le libellé reste sur sa ligne, à droite du rail
      var mid = (ra.top + ra.height / 2 + rb.top + rb.height / 2) / 2;
      lb.style.transform = 'translateY(' + (mid - (r.top + r.height / 2)).toFixed(1) + 'px)';
    });
  }
  function tlTips() {
    var refit = function () { tlFit(document); };
    window.addEventListener('resize', refit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
    if (document.readyState !== 'loading') refit(); else document.addEventListener('DOMContentLoaded', refit);
    // bulle façon BD sous la pastille d'une chronologie horizontale : immédiate, au survol, au clavier ou au toucher
    var tip = null, cur = null;
    function hide() { if (tip) { tip.remove(); tip = null; } cur = null; }
    function show(it) {
      if (cur === it) return;
      hide();
      if (document.documentElement.classList.contains('is-edit') || !it.closest('.tl-tips')) return;
      cur = it;
      var dot = it.querySelector('.tl-dot'), date = it.querySelector('.tl-h-date'), src = it.querySelector('.tl-h-tip');
      if (!dot || !src) return;
      tip = document.createElement('div'); tip.className = 'tl-bubble'; tip.setAttribute('role', 'tooltip');
      tip.innerHTML = src.innerHTML;
      tip.style.setProperty('--bc', getComputedStyle(dot).backgroundColor);
      document.body.appendChild(tip);
      var d = dot.getBoundingClientRect(), r = date && date.textContent ? date.getBoundingClientRect() : d, w = tip.offsetWidth, h = tip.offsetHeight;
      var cx = d.left + d.width / 2, left = Math.max(8, Math.min(innerWidth - w - 8, cx - w / 2)), top = r.bottom + 12;
      if (top + h > innerHeight - 8 && d.top - h - 14 > 8) { top = d.top - h - 14; tip.classList.add('up'); }
      tip.style.left = left + 'px'; tip.style.top = top + 'px';
      tip.style.setProperty('--ax', Math.max(18, Math.min(w - 18, cx - left)) + 'px');
      requestAnimationFrame(function () { if (tip) tip.classList.add('on'); });
    }
    document.addEventListener('pointerover', function (e) {
      var it = e.target && e.target.closest ? e.target.closest('.tl-h-item') : null;
      if (it) show(it); else if (cur && document.activeElement !== cur) hide();
    });
    document.addEventListener('focusin', function (e) { var it = e.target && e.target.closest ? e.target.closest('.tl-h-item') : null; if (it) show(it); });
    document.addEventListener('focusout', function (e) { if (cur && e.target === cur) hide(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
  }
  function foldHidden(levels, folded) {
    // règle de pliage (éditeur et page exportée) : un titre plié (niveau > 0) masque la suite jusqu'au prochain titre de niveau égal ou inférieur (0 : en-tête, pied) ; r[i] = titre plié le plus extérieur qui masque i, ou -1
    var r = [], cur = -1;
    for (var i = 0; i < levels.length; i++) {
      var lv = levels[i];
      if (cur >= 0 && lv >= 0 && lv <= levels[cur]) cur = -1;
      r.push(cur);
      if (cur < 0 && lv > 0 && folded[i]) cur = i;
    }
    return r;
  }
  function foldList(el) {
    // blocs de la page de el, dans l'ordre : ceux d'une section d'étape suivent la section, qui reste une frontière de niveau 1
    var out = [], wrap = el.closest('.wrap') || el.parentNode;
    Array.prototype.forEach.call(wrap.children, function (c) {
      out.push(c);
      if (c.tagName === 'SECTION' && c.classList.contains('step')) Array.prototype.forEach.call(c.children, function (x) { out.push(x); });
    });
    return out;
  }
  function foldApply(list) {
    // data-fh selon foldHidden, d'après data-fl et data-folded ; rend l'indice du titre qui masque chaque bloc
    var r = foldHidden(list.map(function (x) { return x.hasAttribute('data-fl') ? +x.getAttribute('data-fl') : -1; }),
      list.map(function (x) { return x.hasAttribute('data-folded'); }));
    list.forEach(function (x, i) { if (r[i] >= 0) x.setAttribute('data-fh', ''); else x.removeAttribute('data-fh'); });
    return r;
  }
  function foldToggle(h, open) {
    // lecture : plie / déplie la section du titre h, sans toucher au document (les sections pliées à l'intérieur restent pliées)
    var btn = h.querySelector('[data-vfold]');
    if (open == null) open = h.hasAttribute('data-folded');
    if (open) h.removeAttribute('data-folded'); else h.setAttribute('data-folded', '');
    if (btn) btn.setAttribute('aria-expanded', String(open));
    foldApply(foldList(h));
    if (open) window.dispatchEvent(new Event('resize'));   // cartes et chronologies révélées : remise en page
    return open;
  }
  function foldReveal(el) {
    // lecture : déplie les sections qui masquent el, la plus extérieure d'abord (comme revealBlock dans l'éditeur)
    var x = el.closest('[data-fh]'); if (!x) return;
    for (var k = 0; k < 20; k++) {
      var list = foldList(x), h = foldApply(list)[list.indexOf(x)];
      if (!(h >= 0)) return;
      foldToggle(list[h], true);
    }
  }
  function printKeep(on) {
    // impression : chaque titre (section, sous-section, sous-titre, étape, en-tête) est groupé avec ce qui le suit dans un
    // ensemble insécable, pour ne jamais rester seul en bas de page, y compris dans les navigateurs qui ignorent
    // break-after: avoid (Firefox). Ce qui suit n'est emmené que s'il n'est pas trop haut ; les groupes sont défaits après
    Array.prototype.forEach.call(document.querySelectorAll('.keep-print'), function (g) { while (g.firstChild) g.parentNode.insertBefore(g.firstChild, g); g.remove(); });
    if (!on) return;
    var SEL = 'h2, h3, .subtitle, .step-head, header.b-header', LIMIT = 700;   // au-delà, la suite ne tiendrait pas sur une page de toute façon
    var isHead = function (el) { return el.matches(SEL) && !(el.matches('h2') && el.parentNode.matches('.step-head')); };
    Array.prototype.forEach.call(document.querySelectorAll('.wrap ' + SEL.split(', ').join(', .wrap ')), function (h) {
      if (!isHead(h) || h.closest('.keep-print') || h.parentNode.closest('.kb, .q-blk, .toc-blk, .sub, .fold, .tl-card, .facts')) return;
      var items = [h];
      for (var n = h.nextElementSibling; n; n = n.nextElementSibling) {
        if (n.offsetParent === null && getComputedStyle(n).display === 'none') continue;   // section pliée, masquée
        if (isHead(n)) { items.push(n); continue; }
        if (n.getBoundingClientRect().height <= LIMIT) items.push(n);
        break;
      }
      if (items.length < 2) return;
      var g = document.createElement('div'); g.className = 'keep-print'; h.parentNode.insertBefore(g, h);
      items.forEach(function (x) { g.appendChild(x); });
    });
  }
  function printPrep(on) {
    // impression : blocs dépliables ouverts et titres groupés avec leur suite, puis tout est rétabli
    Array.prototype.forEach.call(document.querySelectorAll(on ? 'details.fold:not([open])' : 'details.fold[data-pr]'), function (d) { if (on) { d.open = true; d.setAttribute('data-pr', ''); } else { d.open = false; d.removeAttribute('data-pr'); } });
    printKeep(on);
  }
  function viewScript() {
    document.addEventListener('click', function (e) {
      var f = e.target.closest && e.target.closest('[data-vfold]'); if (f) foldToggle(f.parentNode);
      // colonne de kanban réduite ou affichée pour soi (ses cartes sont dans la page, masquées)
      var k = e.target.closest && e.target.closest('[data-kbfold]'), col = k && k.closest('.kb-col');
      if (col) {
        var red = !col.hasAttribute('data-red');
        if (red) col.setAttribute('data-red', ''); else col.removeAttribute('data-red');
        Array.prototype.forEach.call(col.querySelectorAll('[data-kbfold]'), function (bt) { bt.setAttribute('aria-expanded', String(!red)); });
      }
    });
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-copy]'); if (!b) return;
      var box = b.closest('.code,.codebox'), pre = box.querySelector('pre');
      var t = pre.classList.contains('src') ? Array.prototype.map.call(pre.children, function (l) { return l.textContent; }).join('\n') : pre.textContent;
      var old = b.textContent;
      function done(m) { b.textContent = m; setTimeout(function () { b.textContent = old; }, 1600); }
      function sel() { var r = document.createRange(); r.selectNodeContents(pre); var s = getSelection(); s.removeAllRanges(); s.addRange(r); done('Sélectionné : Ctrl+C'); }
      try { navigator.clipboard.writeText(t).then(function () { done('Copié ✓'); }, sel); } catch (_) { sel(); }
    });
    var K = 'bp:' + (document.documentElement.getAttribute('data-docid') || document.title) + ':';
    Array.prototype.forEach.call(document.querySelectorAll('ul.check input'), function (c) {
      try { var v = localStorage.getItem(K + c.id); if (v !== null) c.checked = v === '1'; } catch (_) {}
      c.addEventListener('change', function () { try { localStorage.setItem(K + c.id, c.checked ? '1' : '0'); } catch (_) {} });
    });
  }
  function lireAdresse(hash, pages) {
    // copie autonome de lireAdresse (09-adresse.js) : #pg-<page>[/<bloc>], ancienne forme #p<N>, #edit ; la section déplacée
    // vers une autre page n'y est pas cherchée (pages sans blocs) mais dans la page exportée, par cible
    var h = String(hash || ''), r = { page: 0, bloc: '', mode: '', introuvable: false }, n = pages.length, m;
    if (h === '#edit') r.mode = 'edit';
    else if ((m = h.match(/^#pg-([^/]+)(?:\/(.+))?$/))) {
      var i = -1; for (var k = 0; k < n; k++) if (pages[k].id === m[1]) { i = k; break; }
      if (i < 0) r.introuvable = true; else { r.page = i; r.bloc = m[2] || ''; }
    } else if ((m = h.match(/^#p(\d+)$/))) r.page = Math.max(0, Math.min(n - 1, +m[1] - 1));
    return r;
  }
  function exportPages() {
    // export statique : bascule entre les pages, sommaire et onglets. Adresse #pg-<page>[/<bloc>] (#p<N> encore lu) ;
    // un changement de page et un saut vers une section créent une entrée d'historique, dont la position de défilement
    // (state.y) est rétablie par Précédent / Suivant. Dans une iframe : adresse remplacée, aucune entrée, Précédent non écouté
    var pages = Array.prototype.slice.call(document.querySelectorAll('.pg')), spy = navSpy(sauter), cur = -1;
    var ids = pages.map(function (p) { return { id: p.getAttribute('data-pgid') }; }), defilT = null;
    var cadre = (function () { try { return window.self !== window.top; } catch (_) { return true; } })();
    function show(i, noScroll) {
      i = Math.max(0, Math.min(pages.length - 1, i || 0)); cur = i;
      pages.forEach(function (p, k) { p.hidden = k !== i; });
      Array.prototype.forEach.call(document.querySelectorAll('[data-pg]'), function (b) {
        var on = +b.getAttribute('data-pg') === i, w = b.closest('.ptab-w,.toc-p');
        if (w) w.classList.toggle('on', on); if (on) { b.setAttribute('aria-current', 'page'); document.title = b.textContent; } else b.removeAttribute('aria-current');
      });
      // sous-page : onglet du groupe surligné, rangée de ses sous-pages visible, groupe déplié dans le sommaire
      var cb = document.querySelector('[data-pg="' + i + '"]'), g = cb ? cb.getAttribute('data-pgg') : String(i);
      var gt = document.querySelector('.tabs-in [data-pg="' + g + '"]'); if (gt) gt.closest('.ptab-w').classList.add('on');
      Array.prototype.forEach.call(document.querySelectorAll('.tabs-sub'), function (r) { r.hidden = r.getAttribute('data-grp') !== g; });
      var li = document.querySelector('.toc-p[data-pgi="' + i + '"]');
      for (var pa = li && li.parentNode.closest('.toc-p'); pa; pa = pa.parentNode.closest('.toc-p')) { var pf = pa.querySelector('.toc-pr [data-pgfold]'); if (pf) tocFold(pf, true); }
      tlFit(pages[i]);
      window.dispatchEvent(new Event('resize'));
      if (!noScroll) scrollTo(0, 0);
      spy();
    }
    function section(bloc) { return bloc ? document.getElementById('b-' + bloc) || document.querySelector('.blk[data-id="' + bloc + '"]') : null; }
    function cible(pid, bloc) {
      // page d'une adresse : celle qui contient la section si elle existe (section déplacée), sinon la page nommée
      var s = section(bloc), t = (s && s.closest('.pg')) || document.querySelector('.pg[data-pgid="' + pid + '"]');
      return t ? { page: pages.indexOf(t), bloc: s ? bloc : '' } : null;
    }
    function montrer(bloc, doux) {
      var s = section(bloc); if (!s) return false;
      foldReveal(s); s.scrollIntoView({ block: 'start', behavior: doux ? 'smooth' : 'auto' }); return true;
    }
    function adresse(i, bloc) { return '#pg-' + ids[i].id + (bloc ? '/' + bloc : ''); }
    function noter() { if (!cadre) try { history.replaceState({ y: scrollY }, '', location.href); } catch (_) {} }
    function remplacer(adr) { try { history.replaceState(history.state, '', adr); } catch (_) {} }
    // adresse lue (ouverture, Précédent) réécrite sous sa forme #pg-<page>[/<bloc>], sans entrée : ancienne forme, section déplacée
    function corriger(c) { var adr = ids.length ? adresse(c.page, c.bloc) : ''; if (adr && adr !== location.hash) remplacer(adr); }
    function aller(i, bloc) {
      // navigation voulue : la position de départ est notée, puis une seule entrée pour la page et la section
      var moved = i !== cur; if (!moved && !bloc) return;
      noter();
      if (moved) show(i);
      var adr = adresse(i, bloc && montrer(bloc, !moved) ? bloc : '');
      if ((!moved && adr === adresse(i)) || adr === location.hash) return;   // adresse déjà affichée : pas d'entrée en double
      if (cadre) remplacer(adr); else try { history.pushState({ y: 0 }, '', adr); } catch (_) {}
    }
    function sauter(id) {
      // section du sommaire latéral, sur la page affichée ou une autre
      var t = section(id), pg = t && t.closest('.pg'); if (pg) aller(pages.indexOf(pg), id);
    }
    function ouvrir(hash) {
      var a = lireAdresse(hash, ids), c = a.introuvable || !ids.length ? null : cible(ids[a.page].id, a.bloc);
      return c || { page: a.page, bloc: '' };
    }
    document.addEventListener('click', function (e) {
      if (!e.target.closest) return;
      var a = e.target.closest('a[href^="#pg-"]');
      if (a) {
        // lien vers une page (#pg-<page>) ou une section (#pg-<page>/<bloc>) ; la section est cherchée dans toutes les
        // pages : déplacée, elle s'ouvre sur sa page réelle (cible)
        e.preventDefault(); var h = a.getAttribute('href').slice(4).split('/'), c = cible(h[0], h[1]);
        if (c) aller(c.page, c.bloc);
        return;
      }
      var f = e.target.closest('[data-pgfold]'); if (f) { tocFold(f); return; }
      var b = e.target.closest('[data-pg]'); if (!b) return;
      e.preventDefault(); aller(+b.getAttribute('data-pg'), '');
    });
    if (!cadre) {
      try { history.scrollRestoration = 'manual'; } catch (_) {}
      // la position de l'entrée courante suit le défilement : Précédent la retrouve
      window.addEventListener('scroll', function () { clearTimeout(defilT); defilT = setTimeout(noter, 150); }, { passive: true });
      window.addEventListener('popstate', function (e) {
        clearTimeout(defilT);
        var c = ouvrir(location.hash), y = e.state && typeof e.state.y === 'number' ? e.state.y : null;
        show(c.page, true); corriger(c);   // sans remonter en haut : la position de l'entrée est posée aussitôt
        if (y !== null) {
          scrollTo(0, y);
          requestAnimationFrame(function () { if (Math.abs(scrollY - y) > 1) scrollTo(0, y); });
        } else if (!montrer(c.bloc, false)) scrollTo(0, 0);
      });
    }
    var o = ouvrir(location.hash);
    navLayout(); show(o.page, true); montrer(o.bloc, false); corriger(o);
    noter();   // première entrée : sa position, pour y revenir par Précédent
  }
  function tocFold(btn, open) {
    // déplie / replie un groupe de sous-pages du sommaire
    var li = btn.closest('.toc-p'); if (open == null) open = !li.classList.contains('open');
    li.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open));
    return open;
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
  function navSpy(sauter) {
    // section en cours surlignée dans le sommaire ; clic sur une section : défilement sans changer l'adresse, ou confié à
    // sauter(id) (export statique : entrée d'historique, page de la section ouverte au besoin)
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
      e.preventDefault(); if (sauter) { sauter(a.getAttribute('data-sec')); return; }
      foldReveal(t); t.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    window.addEventListener('resize', navLayout);
    return spy;
  }
  function startExport() {
    // page exportée : boutons de lecture, impression, frises, puis pages et sommaire
    viewScript();
    window.addEventListener('beforeprint', function () { printPrep(true); });
    window.addEventListener('afterprint', function () { printPrep(false); });
    tlTips();
    exportPages();
  }
  return { tlFit: tlFit, tlTips: tlTips, foldHidden: foldHidden, foldToggle: foldToggle, foldReveal: foldReveal, printKeep: printKeep, printPrep: printPrep,
    viewScript: viewScript, lireAdresse: lireAdresse, exportPages: exportPages, tocFold: tocFold, navLayout: navLayout, navSpy: navSpy, startExport: startExport };
}
var Reader = ardoiseReader();
// le script de lecture de la page exportée : la fabrique, recopiée telle quelle, puis son démarrage
function readerScript() { return ardoiseReader.toString() + '\nardoiseReader().startExport();'; }
