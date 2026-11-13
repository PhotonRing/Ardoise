/* ---------- Déplacer un bloc vers une autre page ----------
   Liste des pages filtrable (sur le modèle de la fenêtre de lien), page affichée inactive ; le bloc part à la fin de la
   page choisie (deplacerVersPage, 07-rendu.js), on reste sur place, et le message « Ouvrir » mène au bloc. */
function openMovePagePop(anchor, b) {
  closePop(); hideLinkTip(); hidePillTip();
  var p = document.createElement('div'); p.className = 'pop link-pop move-pop'; pop = p;
  p.innerHTML = '<h4>Déplacer vers la page…</h4><input class="menu-q" data-q placeholder="Rechercher une page…" aria-label="Rechercher une page" spellcheck="false" autocomplete="off"><div class="menu-list"></div>';
  var q = $('[data-q]', p), list = $('.menu-list', p), shown = [], curI = 0;
  var items = doc.pages.map(function (pg, i) { return { i: i, t: pageTitle(pg, i), pl: pageLv(doc.pages, i), here: i === doc.cur }; });
  // sélection : la page choisissable la plus proche de k dans le sens d (la page affichée est sautée)
  function proche(k, d) { for (; k >= 0 && k < shown.length; k += d) if (!shown[k].here) return k; return -1; }
  function draw() {
    var s = norm(q.value.trim());
    shown = items.filter(function (it) { return !s || norm(it.t).indexOf(s) >= 0; });
    if (curI >= shown.length || shown[curI].here) { var k = proche(Math.min(curI, shown.length - 1), 1); curI = k >= 0 ? k : Math.max(0, proche(shown.length - 1, -1)); }
    list.innerHTML = shown.length ? shown.map(function (it, k) {
      var ml = it.pl && !s ? Math.min(it.pl, 4) * 16 : 0;
      return '<button class="mi' + (k === curI && !it.here ? ' act' : '') + '" type="button" data-k="' + k + '"' + (it.here ? ' aria-disabled="true"' : '') +
        (ml ? ' style="margin-left:' + ml + 'px;width:calc(100% - ' + ml + 'px)"' : '') + '><span class="ic">' + (it.pl ? '↳' : '▤') + '</span><span>' + esc(it.t) +
        (it.here ? '<small>Page affichée</small>' : '') + '</span></button>';
    }).join('') : '<div class="menu-empty">Aucune page</div>';
  }
  function bouger(d) { var k = proche(curI + d, d); if (k >= 0) curI = k; draw(); var x = $('.mi.act', list); if (x) x.scrollIntoView({ block: 'nearest' }); }
  function choisir(k) { var it = shown[k]; if (!it || it.here) return; closePop(); deplacerBloc(b, it.i); }
  q.addEventListener('input', function () { curI = 0; draw(); });
  q.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); bouger(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); bouger(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); choisir(curI); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePop(); }
  });
  list.addEventListener('click', function (e) { var x = e.target.closest('[data-k]'); if (x) choisir(+x.dataset.k); });
  draw(); placePop(p, anchor);
  // près du bas d'un écran de téléphone, sans place au-dessus : la fenêtre remonte pour tenir dans l'écran
  var r = p.getBoundingClientRect(); if (r.bottom > innerHeight - 8) p.style.top = Math.max(8, innerHeight - r.height - 8) + 'px';
  q.focus({ preventScroll: true });
}
function deplacerBloc(b, vers) {
  var de = doc.cur, cible = doc.pages[vers], titre = pageTitle(cible, vers), pid = cible.id, bid = b.id;
  var etape = libelleDeplacement(pageTitle(doc.pages[de], de), b, titre);
  session.modifier(function () { deplacerVersPage(doc.pages, de, bid, vers); }, null, { etape: etape });
  toast('Déplacé vers « ' + titre + ' »', 8000, { label: 'Ouvrir', fn: function () { goLink('#pg-' + pid + '/' + bid); } });
}
