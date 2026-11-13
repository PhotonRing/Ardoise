// impression : requêtes en texte et colonnes réduites affichées sur place, sans rendu de la page (une carte recréée n'aurait pas le temps de se dessiner)
var printing = false;
window.addEventListener('beforeprint', function () {
  if (!doc) return; printing = true;
  $$('button.q-th', app).forEach(function (bt) { var sp = document.createElement('span'); sp.innerHTML = bt.innerHTML; bt.replaceWith(sp); });
  $$('button.q-box', app).forEach(function (bt) { var sp = document.createElement('span'); sp.className = 'q-box'; sp.textContent = bt.textContent; bt.replaceWith(sp); });
  // kanban à colonne réduite : redessiné en place, toutes colonnes affichées (un kanban n'a pas de carte géographique à attendre)
  $$('.kb[data-kb]', app).forEach(function (el) {
    var b = byId(el.dataset.kb); if (!b || !$('[data-red]', el)) return;
    var ctx = viewCtx(); ctx.kbCols = {}; b.cols.forEach(function (c) { ctx.kbCols[c.id] = { red: false, base: !!c.collapsed }; });
    el.outerHTML = renderBlock(b, doc, ctx, null);
  });
  Reader.printPrep(true);
});
window.addEventListener('afterprint', function () { if (!printing) return; printing = false; var sy = scrollY; render(); scrollTo(0, sy); });
function exportStatic() {
  if (isSealed() && !confirm('L’export statique n’est pas chiffré : la page exportée sera lisible par toute personne qui obtient le fichier. Continuer ?')) return;
  session.valider();
  var r = document.documentElement;
  var html = '<!doctype html>\n<html lang="fr" data-palette="' + esc(doc.palette) + '" data-typo="' + esc(doc.typo) + '"' + (doc.theme !== 'auto' ? ' data-theme="' + esc(doc.theme) + '"' : '') +
    ' data-npages="' + doc.pages.length + '" data-nav="' + esc(doc.nav || 'auto') + '" data-w="' + (+doc.width || 820) + '" data-docid="' + esc(doc.id) + '">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<title>' + esc(docTitle()) + '</title>\n' +
    $$('link[rel=icon], link[rel=stylesheet], link[rel=preconnect]').map(function (l) { return l.outerHTML; }).join('\n') + '\n<style>' + $('#page-css').textContent + '</style>\n</head>\n<body>\n' +
    navHTML(doc, { page: 0, view: 'export' }) + doc.pages.map(function (pg, i) {
      return '<div class="pg" data-pgi="' + i + '" data-pgid="' + esc(pg.id) + '"' + (i ? ' hidden' : '') + '>' + renderPage(doc, { page: i, view: 'export' }) + '</div>';
    }).join('\n') + '\n<script>' + readerScript() + '<\/script>\n' +
    (doc.pages.some(function (pg) { return tousBlocs(pg.blocks).some(function (b) { return b.type === 'map'; }); }) ?
      '<script id="ardoise-geo" type="application/json">' + $('#ardoise-geo').textContent + '<\/script>\n<script>\n' + ardoiseMapKit.toString() +
      '\n(function () { var K = ardoiseMapKit(); Array.prototype.forEach.call(document.querySelectorAll(".map[data-state]"), function (el) { var st = JSON.parse(el.getAttribute("data-state")); K.mount(el, st, { edit: false, locked: !!st.lock, hideBg: !!st.hideBg }); }); })();\n<\/script>\n' : '') +
    '</body>\n</html>\n';
  download(html, fileName().replace(/\.html?$/i, '') + '-lecture.html');
  toast('Page statique téléchargée');
}
function printPage() { var m = mode; if (m === 'edit') { mode = 'view'; render(); } setTimeout(function () { window.print(); if (m === 'edit') { mode = 'edit'; render(); } }, 300); /* le temps que les cartes se dessinent */ }
function copyJSON() {
  session.valider();
  var base = { v: VERSION, title: docTitle(), palette: doc.palette, typo: doc.typo, width: doc.width, theme: doc.theme, nav: doc.nav };
  if (doc.tags) base.tags = doc.tags;
  if (doc.pages.length > 1) base.pages = doc.pages.map(function (pg) { var o = { title: pg.title, blocks: pg.blocks }; if (pg.lv) o.lv = pg.lv; return o; }); else { base.pageTitle = doc.pages[0].title || undefined; base.blocks = doc.pages[0].blocks; }
  var t = JSON.stringify(base, null, 2);
  try { navigator.clipboard.writeText(t).then(function () { toast('JSON copié dans le presse-papiers'); }, function () { showJSON(t); }); } catch (_) { showJSON(t); }
}
function showJSON(t) { var m = modal('JSON de la page', '<textarea readonly>' + esc(t) + '</textarea>', [{ label: 'Fermer', primary: true }]); var ta = $('textarea', m); ta.focus(); ta.select(); }
function importJSON() {
  var m = modal('Importer du JSON', '<p class="muted">Collez un document (objet avec un tableau <code>blocks</code>, ou <code>pages</code> pour plusieurs pages). Le contenu actuel sera remplacé ; Ctrl+Z permet de revenir en arrière.</p><textarea placeholder="{ &quot;blocks&quot;: [ … ] }"></textarea><p class="muted" id="jerr" style="color:var(--bad)"></p>', [
    { label: 'Annuler' },
    { label: 'Importer', primary: true, fn: function (bg) {
      var raw = $('textarea', bg).value, d;
      try { d = JSON.parse(raw); } catch (e) { $('#jerr', bg).textContent = 'JSON invalide : ' + e.message; return false; }
      if (Array.isArray(d)) d = { blocks: d };
      var r = session.remplacer(d, 'import');   // identifiant, mot de passe, clé de carte et date gardés ; étape annulable
      if (r.refus === 'plus-recent') { $('#jerr', bg).textContent = 'Ce JSON vient d’une version plus récente d’Ardoise (format ' + r.format + ') : mettez d’abord Ardoise à jour.'; return false; }
      if (r.refus) { $('#jerr', bg).textContent = r.message ? 'Conversion impossible : ' + r.message : 'Il manque un tableau « blocks » (ou « pages »).'; return false; }
      var nb = 0; doc.pages.forEach(function (pg) { nb += tousBlocs(pg.blocks).length; });   // blocs des groupes compris
      pageHash(0);
      toast(nb + ' blocs importés' + (doc.pages.length > 1 ? ' sur ' + doc.pages.length + ' pages' : ''));
    } }]);
  $('textarea', m).focus();
}

