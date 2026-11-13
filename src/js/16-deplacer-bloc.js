/* ---------- Déplacer un bloc vers une autre page ----------
   Liste des pages filtrable (sur le modèle de la fenêtre de lien), page affichée inactive ; le bloc part à la fin de la
   page choisie (deplacerVersPage, 07-rendu.js), on reste sur place, et le message « Ouvrir » mène au bloc. */
function ouvrirDeplacerBloc(ancre, b) {
  closePop(); hideLinkTip(); hidePillTip();
  var p = document.createElement('div'); p.className = 'pop link-pop deplacer-pop'; pop = p;
  p.innerHTML = '<h4>Déplacer vers la page…</h4><input class="menu-q" data-q placeholder="Rechercher une page…" aria-label="Rechercher une page" spellcheck="false" autocomplete="off"><div class="menu-list"></div>';
  var q = $('[data-q]', p), liste = $('.menu-list', p), affichees = [], actif = 0;
  var choix = doc.pages.map(function (pg, i) { return { i: i, t: pageTitle(pg, i), pl: pageLv(doc.pages, i), ici: i === doc.cur }; });
  // sélection : la page choisissable la plus proche de k dans le sens d (la page affichée est sautée)
  function proche(k, d) { for (; k >= 0 && k < affichees.length; k += d) if (!affichees[k].ici) return k; return -1; }
  function dessiner() {
    var s = norm(q.value.trim());
    affichees = choix.filter(function (it) { return !s || norm(it.t).indexOf(s) >= 0; });
    if (actif >= affichees.length || affichees[actif].ici) { var k = proche(Math.min(actif, affichees.length - 1), 1); actif = k >= 0 ? k : Math.max(0, proche(affichees.length - 1, -1)); }
    liste.innerHTML = affichees.length ? affichees.map(function (it, k) {
      var ml = it.pl && !s ? Math.min(it.pl, 4) * 16 : 0;
      return '<button class="mi' + (k === actif && !it.ici ? ' act' : '') + '" type="button" data-k="' + k + '"' + (it.ici ? ' aria-disabled="true"' : '') +
        (ml ? ' style="margin-left:' + ml + 'px;width:calc(100% - ' + ml + 'px)"' : '') + '><span class="ic">' + (it.pl ? '↳' : '▤') + '</span><span>' + esc(it.t) +
        (it.ici ? '<small>Page affichée</small>' : '') + '</span></button>';
    }).join('') : '<div class="menu-empty">Aucune page</div>';
  }
  function bouger(d) { var k = proche(actif + d, d); if (k >= 0) actif = k; dessiner(); var x = $('.mi.act', liste); if (x) x.scrollIntoView({ block: 'nearest' }); }
  function choisir(k) { var it = affichees[k]; if (!it || it.ici) return; closePop(); deplacerBloc(b, it.i); }
  q.addEventListener('input', function () { actif = 0; dessiner(); });
  q.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); bouger(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); bouger(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); choisir(actif); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePop(); }
  });
  liste.addEventListener('click', function (e) { var x = e.target.closest('[data-k]'); if (x) choisir(+x.dataset.k); });
  dessiner(); placePop(p, ancre);
  // près du bas d'un écran de téléphone, sans place au-dessus : la fenêtre remonte pour tenir dans l'écran
  var r = p.getBoundingClientRect(); if (r.bottom > innerHeight - 8) p.style.top = Math.max(8, innerHeight - r.height - 8) + 'px';
  q.focus({ preventScroll: true });
}
function deplacerBloc(b, vers) {
  var de = doc.cur, titre = pageTitle(doc.pages[vers], vers), bid = b.id, adr = adressePage(doc.pages, vers, bid);
  var etape = libelleDeplacement(pageTitle(doc.pages[de], de), b, titre);
  session.modifier(function () { deplacerVersPage(doc.pages, de, bid, vers); }, null, { etape: etape });
  toast('Déplacé vers « ' + titre + ' »', 8000, { label: 'Ouvrir', fn: function () { goLink(adr); } });
}
