/* ---------- Filtre des lignes (tableau, requête en vue tableau) ---------- */
// Le filtre vit dans le DOM après le rendu : ni les lignes du bloc, ni le rendu en chaîne (fichier, export) ne changent.
var filtreSuivi = {};   // id du bloc → { bloc, terme, connues, gardees } : lignes présentes au dernier changement du terme, lignes gardées visibles
var LOUPE = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.4 10.4 14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
function filtrable(b) { return b.type === 'table' || (b.type === 'query' && (b.view || 'table') === 'table'); }
function filtreTable(bar, b) {
  if (b.type === 'table') { var tw = bar.nextElementSibling; return tw && $('table', tw); }
  return $('.q-res table.q-table', bar.parentNode);
}
function filtreBarre(id) {
  var bar = document.createElement('div'); bar.className = 'filtre'; bar.setAttribute('data-filtre', id);
  var ouvert = viewFiltre[id] != null;
  if (ouvert) bar.classList.add('ouvert');
  bar.innerHTML = '<button type="button" class="filtre-b" title="Filtrer les lignes" aria-label="Filtrer les lignes" aria-expanded="' + ouvert + '">' + LOUPE + '</button>' +
    (ouvert ? '<input class="filtre-q" type="text" placeholder="Filtrer les lignes…" aria-label="Filtrer les lignes" spellcheck="false" autocomplete="off">' +
      '<span class="filtre-n" aria-live="polite"></span><button type="button" class="filtre-x" title="Fermer le filtre (Échap)" aria-label="Fermer le filtre">×</button>' +
      '<p class="filtre-vide" hidden>Aucune ligne ne correspond</p>' : '');
  var q = $('.filtre-q', bar);
  if (q) {
    q.value = viewFiltre[id];
    q.addEventListener('input', function () { viewFiltre[id] = q.value; filtrerBloc(id); });
    q.addEventListener('keydown', function (e) {
      // Échap ferme le filtre ; Ctrl+Z / Ctrl+Y restent au champ (pas d'annulation du document)
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fermerFiltre(id); return; }
      if ((e.ctrlKey || e.metaKey) && /^[zy]$/i.test(e.key)) e.stopPropagation();
    });
  }
  $('.filtre-b', bar).addEventListener('click', function () { ouvrirFiltre(id); });
  var x = $('.filtre-x', bar); if (x) x.addEventListener('click', function () { fermerFiltre(id); });
  return bar;
}
function filtreHote(b) {
  // élément avant lequel la barre se pose : le tableau (.tablewrap) ou les résultats de la requête (.q-res)
  var ed = mode === 'edit';
  if (b.type === 'table') return $(ed ? '.blk[data-id="' + b.id + '"] > .tablewrap' : '.filtrable[data-bid="' + b.id + '"] > .tablewrap, .tablewrap[data-bid="' + b.id + '"]', app);
  return $('.q-blk[data-qid="' + b.id + '"] > .q-res', app);
}
function poserFiltre(b) {
  var hote = filtreHote(b); if (!hote) return null;
  if (b.type === 'table' && mode !== 'edit' && hote.hasAttribute('data-bid')) {
    // lecture : le tableau est un bloc de la page ; une enveloppe prend sa place (ancre de bascule, pli) pour porter la barre
    var env = document.createElement('div'); env.className = 'filtrable';
    ['data-bid', 'data-fh'].forEach(function (a) { if (hote.hasAttribute(a)) { env.setAttribute(a, hote.getAttribute(a)); hote.removeAttribute(a); } });
    hote.parentNode.insertBefore(env, hote); env.appendChild(hote);
  }
  var old = $('.filtre[data-filtre="' + b.id + '"]', app); if (old) old.remove();
  var bar = filtreBarre(b.id); hote.parentNode.insertBefore(bar, hote);
  filtrerBloc(b.id);
  return bar;
}
function poserFiltres(avant) {
  // après chaque rendu de la page : barres posées, filtres réappliqués, champ qui avait le focus rendu
  if (!doc) return;
  tousBlocs(doc.blocks).forEach(function (b) { if (filtrable(b)) poserFiltre(b); });   // tableaux des groupes compris
  var q = avant && $('.filtre[data-filtre="' + avant.id + '"] .filtre-q', app);
  if (q) { q.focus({ preventScroll: true }); try { q.setSelectionRange(avant.s, avant.e); } catch (_) {} }
}
function filtreFocus() {
  // champ de filtre qui a le focus, relevé avant un rendu
  var a = document.activeElement, bar = a && a.matches && a.matches('.filtre-q') && a.closest('.filtre');
  return bar ? { id: bar.getAttribute('data-filtre'), s: a.selectionStart, e: a.selectionEnd } : null;
}
function ouvrirFiltre(id) {
  if (viewFiltre[id] == null) viewFiltre[id] = '';
  var b = byId(id); if (!b) return;
  var bar = poserFiltre(b), q = bar && $('.filtre-q', bar); if (q) q.focus();
}
function fermerFiltre(id) {
  delete viewFiltre[id]; delete filtreSuivi[id];
  var b = byId(id), bar = b && poserFiltre(b), lp = bar && $('.filtre-b', bar); if (lp) lp.focus({ preventScroll: true });
}
function filtrerBloc(id) {
  var bar = $('.filtre[data-filtre="' + id + '"]', app), b = byId(id); if (!bar || !b) return;
  var table = filtreTable(bar, b), trs = table ? $$('tbody > tr', table) : [], terme = viewFiltre[id];
  bar.classList.toggle('sans-table', !table);
  if (table) table.classList.add('filtrable');
  var vus;
  if (terme == null) vus = trs.map(function () { return true; });
  else if (b.type === 'table' && b.rows.length - 1 === trs.length) {
    var lignes = b.rows.slice(1), s = filtreSuivi[id];
    // terme changé, ou document recréé (annulation, modification reçue) : les lignes présentes deviennent les lignes connues
    if (!s || s.bloc !== b || s.terme !== terme) s = filtreSuivi[id] = { bloc: b, terme: terme, connues: lignes.slice(), gardees: [] };
    trs.forEach(function (tr, i) { if (tr.contains(document.activeElement) && s.gardees.indexOf(lignes[i]) < 0) s.gardees.push(lignes[i]); });
    vus = lignesAffichees(lignes, terme, s.connues, s.gardees);
  } else vus = trs.map(function (tr) { return ligneCorrespond($$('td', tr).map(function (td) { return td.innerHTML; }), terme); });
  var n = 0;
  trs.forEach(function (tr, i) { if (vus[i]) { n++; tr.removeAttribute('hidden'); } else tr.setAttribute('hidden', ''); });
  var cpt = $('.filtre-n', bar), vide = $('.filtre-vide', bar);
  if (cpt) cpt.textContent = trs.length ? n + ' ligne' + (n > 1 ? 's' : '') + ' sur ' + trs.length : '';
  if (vide) vide.hidden = !(trs.length && !n);
}
// une cellule prise pendant un filtre reste visible jusqu'au prochain changement du terme
app.addEventListener('focusin', function (e) {
  var el = e.target; if (!el.hasAttribute || !el.hasAttribute('data-cell')) return;
  var s = filtreSuivi[el.dataset.b], r = posCellule(el).r, b = byId(el.dataset.b);   // posCellule : 13-menu-cellules.js
  if (s && b && s.bloc === b && r > 0 && s.gardees.indexOf(b.rows[r]) < 0) s.gardees.push(b.rows[r]);
});
function ligneMasquee(el) { return !!(el && el.closest('tr[hidden]')); }   // champ dans une ligne masquée par le filtre
// ligne voisine visible (dir = ±1) d'un tableau, ou -1 ; l'en-tête n'est jamais masqué
function ligneVoisine(b, r, dir) {
  for (var i = r + dir; i >= 0 && i < b.rows.length; i += dir) { var c = cellAt(b, i, 0); if (c && !ligneMasquee(c)) return i; }
  return -1;
}
// impression : toutes les lignes, comme l'export (afterprint refait le rendu, qui réapplique le filtre)
window.addEventListener('beforeprint', function () { $$('tbody > tr[hidden]', app).forEach(function (tr) { tr.removeAttribute('hidden'); }); });
