/* ---------- Adresse de la page ---------- */
// Pur : ni DOM ni document global (banc de rendu). Adresse d'une page : #pg-<page>, d'une section : #pg-<page>/<bloc>,
// les mêmes que les liens internes ; #p<N> (ancienne forme, N-ième page) et #edit (ouverture en édition) restent lus.
function lireAdresse(hash, pages) {
  var h = String(hash || ''), r = { page: 0, bloc: '', mode: '', introuvable: false }, n = pages.length, m;
  if (h === '#edit') r.mode = 'edit';
  else if ((m = h.match(/^#pg-([^/]+)(?:\/(.+))?$/))) {
    var i = pageDuLien(pages, { pid: m[1], bid: m[2] || '' });
    if (i < 0) r.introuvable = true; else { r.page = i; r.bloc = m[2] || ''; }
  } else if ((m = h.match(/^#p(\d+)$/))) r.page = Math.max(0, Math.min(n - 1, +m[1] - 1));
  return r;
}
// page d'un lien ou d'une adresse : celle qui contient la section (déplacée vers une autre page), sinon la page nommée ; -1 sinon
function pageDuLien(pages, L) { var i = L.bid ? pageDuBloc(pages, L.bid) : -1; return i >= 0 ? i : pageIndex(pages, L.pid); }
function adressePage(pages, i, bloc) { return '#pg-' + pages[i].id + (bloc ? '/' + bloc : ''); }
