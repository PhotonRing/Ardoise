/* ---------- Adresse de la page ---------- */
// Pur : ni DOM ni document global (banc de rendu). Adresse d'une page : #pg-<page>, d'une section : #pg-<page>/<bloc>,
// les mêmes que les liens internes ; #p<N> (ancienne forme, N-ième page) et #edit (ouverture en édition) restent lus.
function lireAdresse(hash, pages) {
  var h = String(hash || ''), r = { page: 0, bloc: '', mode: '', introuvable: false }, n = pages.length, m;
  if (h === '#edit') r.mode = 'edit';
  else if ((m = h.match(/^#pg-([^/]+)(?:\/(.+))?$/))) {
    var i = pageIndex(pages, m[1]);
    if (i < 0) r.introuvable = true; else { r.page = i; r.bloc = m[2] || ''; }
  } else if ((m = h.match(/^#p(\d+)$/))) r.page = Math.max(0, Math.min(n - 1, +m[1] - 1));
  return r;
}
function adressePage(pages, i, bloc) { return '#pg-' + pages[i].id + (bloc ? '/' + bloc : ''); }
