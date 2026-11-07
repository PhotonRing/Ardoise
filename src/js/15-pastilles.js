/* ---------- Pastilles ---------- */
// Une pastille est nommée par son texte : sa couleur vient du registre du document (doc.tags, nom → couleur),
// attribuée automatiquement à la première apparition du nom. Une pastille peut porter sa propre couleur
// (classe pc-N, « exception ») ; la couleur du registre est posée au rendu (pa-N, jamais enregistrée).
var TAG_NAMES = ['Vert', 'Rouge', 'Orange', 'Bleu', 'Violet', 'Rose', 'Turquoise', 'Indigo', 'Olive', 'Cyan', 'Terre', 'Prune', 'Sapin', 'Gris', 'Moutarde', 'Corail'];
function tagColor(key, d) {
  // seule inscription au registre : réservée aux pastilles d'un texte (les puces des requêtes lisent par tagShade)
  d = d || doc; var c = tagShade(d, key); if (c != null) return c;
  if (!d.tags) d.tags = {};
  d.tags[key] = { c: nextTagColor(d.tags) }; return d.tags[key].c;
}
function pillOwn(el) { var m = el.className.match(/\bpc-(\d+)\b/); return m ? +m[1] : null; }
function paintPill(el) {
  el.className = el.className.replace(/\s*\bpa-\d+\b/g, '');
  if (pillOwn(el) != null) return;
  var key = tagKey(el.textContent); if (key) el.classList.add('pa-' + tagColor(key));
}
function paintPills(html, d) {
  // pose la couleur du registre du document d sur les pastilles d'un rendu (texte HTML)
  if (html.indexOf('class="pill') < 0) return html;
  return html.replace(/<span class="pill"((?:\s[^>]*)?)>((?:(?!<\/?span\b)[\s\S])*?)<\/span>/g, function (m, attrs, inner) {
    var key = tagKey(htmlText(inner));
    return key ? '<span class="pill pa-' + tagColor(key, d) + '"' + attrs + '>' + inner + '</span>' : m;
  });
}
function repaintPills() { $$('span.pill', app).forEach(paintPill); }
/* Bulle d'une pastille (édition) : couleur du nom partout, ou de cette pastille seulement ; retirer */
var ptip = null, tipPill = null, tipOnly = false;
function hidePillTip() { if (ptip && ptip.style.display !== 'none') ptip.style.display = 'none'; tipPill = null; }
function showPillTip(el, force) {
  if (!force && tipPill === el && ptip && ptip.style.display !== 'none') return;
  if (!ptip) {
    ptip = document.createElement('div'); ptip.className = 'ptip'; ptip.style.display = 'none'; ui.appendChild(ptip);
    ptip.addEventListener('mousedown', function (e) { e.preventDefault(); });
    ptip.addEventListener('click', pillTipClick);
  }
  tipPill = el; tipOnly = pillOwn(el) != null;
  var key = tagKey(el.textContent), cur = tipOnly ? pillOwn(el) : (key ? tagColor(key) : 0);
  ptip.innerHTML = '<div class="ptip-h"><span class="ptip-t">' + (tipOnly ? 'Couleur de cette pastille' : 'Couleur de « ' + esc(el.textContent.trim()) + ' » partout') + '</span>' +
    '<button type="button" data-pt="only" aria-pressed="' + tipOnly + '" title="Donner à cette pastille une couleur différente de celle de son nom">Seulement ici</button>' +
    '<button type="button" data-pt="del" title="Retirer la pastille (le texte reste)">Retirer</button></div>' +
    '<div class="ptip-sw">' + TAG_NAMES.map(function (n, i) { return '<button type="button" class="pa-' + i + '" data-c="' + i + '" title="' + n + '" aria-pressed="' + (i === cur) + '"></button>'; }).join('') + '</div>';
  ptip.style.display = 'block';
  var rs = el.getClientRects(), r = rs.length ? rs[rs.length - 1] : el.getBoundingClientRect(), w = ptip.offsetWidth, h = ptip.offsetHeight;
  var top = r.bottom + 6; if (top + h > innerHeight - 8) top = r.top - h - 6;
  ptip.style.left = Math.min(Math.max(8, r.left), innerWidth - w - 8) + 'px'; ptip.style.top = Math.max(8, top) + 'px';
}
function pillTipClick(e) {
  var b = e.target.closest('button'), el = tipPill, fld = el && fieldOf(el); if (!b || !el || !fld) return;
  var key = tagKey(el.textContent);
  if (b.dataset.pt === 'del') { hidePillTip(); unwrap(el); fire(fld); return; }
  if (b.dataset.pt === 'only') {
    // exception : la pastille garde la couleur affichée ; sans exception : elle reprend celle de son nom
    if (pillOwn(el) != null) el.className = el.className.replace(/\s*\bpc-\d+\b/g, '');
    else el.classList.add('pc-' + (key ? tagColor(key) : 0));
    paintPill(el); fire(fld); showPillTip(el, true); return;
  }
  var c = +b.dataset.c; if (!(c >= 0)) return;
  if (pillOwn(el) != null) { el.className = el.className.replace(/\s*\bpc-\d+\b/g, '') + ' pc-' + c; paintPill(el); fire(fld); }
  else if (key) { session.saisir(function () { doc.tags[key] = { c: c }; }); session.valider(); repaintPills(); }
  showPillTip(el, true);
}
window.addEventListener('scroll', hidePillTip, { passive: true });
/* Fenêtre « Pastilles du document » (édition) : apparitions et pages de chaque nom du registre, sa couleur,
   et la suppression des noms qui n'apparaissent plus ; tout passe par la session (annulable, même fenêtre ouverte) */
var tagsWin = null;
function tagsWinHTML() {
  var list = tagUsage(doc);
  if (!list.length) return '<p class="muted">Aucune pastille dans ce document.</p>';
  return list.map(function (t) {
    var c = tagShade(doc, t.key), k = esc(t.key);
    var where = t.n ? t.n + (t.n > 1 ? ' apparitions' : ' apparition') + ' · ' + t.pages.map(function (p) { return esc(p.title); }).join(', ') : 'N’apparaît plus dans le document';
    return '<div class="tgw-r"><div class="tgw-h"><span class="pill pa-' + c + '">' + esc(t.name) + '</span><span class="tgw-n muted">' + where + '</span>' +
      (t.n ? '' : '<button type="button" class="tgw-del" data-tdel="' + k + '" title="Retirer « ' + esc(t.name) + ' » du registre">Supprimer</button>') + '</div>' +
      '<div class="ptip-sw tgw-sw">' + TAG_NAMES.map(function (n, i) { return '<button type="button" class="pa-' + i + '" data-tc="' + i + '" data-tk="' + k + '" title="' + n + '" aria-pressed="' + (i === c) + '"></button>'; }).join('') + '</div></div>';
  }).join('');
}
function drawTagsWin() { if (!tagsWin || !tagsWin.isConnected) { tagsWin = null; return; } $('.tgw', tagsWin).innerHTML = tagsWinHTML(); }
function openTagsWindow() {
  closePop();
  tagsWin = modal('Pastilles du document', '<div class="tgw">' + tagsWinHTML() + '</div>', [{ label: 'Fermer', primary: true }]);
  var bg = tagsWin, close = $('[data-m]', bg);
  bg.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tc],[data-tdel]'); if (!b) return;
    if (b.dataset.tdel != null) {
      var key = b.dataset.tdel, u = tagUsage(doc).filter(function (t) { return t.key === key; })[0];
      if (u && !u.n) session.modifier(function () { delete doc.tags[key]; if (!Object.keys(doc.tags).length) delete doc.tags; });
      if (close) close.focus({ preventScroll: true });   // le bouton supprimé disparaît : le clavier reste dans la fenêtre
      return;
    }
    var tk = b.dataset.tk, c = +b.dataset.tc;
    if (tagShade(doc, tk) !== c) session.modifier(function () { doc.tags[tk] = { c: c }; });
  });
  // le raccourci global d'annulation est coupé sous une fenêtre : celle-ci le reprend
  bg.addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase(); if (!(e.ctrlKey || e.metaKey) || (k !== 'z' && k !== 'y')) return;
    e.preventDefault(); if (k === 'y' || e.shiftKey) redo(); else undo();
  });
  if (close) close.focus({ preventScroll: true });
}
session.abonner('historique', drawTagsWin);   // couleur, suppression, annulation : la liste suit le document
