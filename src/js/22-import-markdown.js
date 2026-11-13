/* ---------- Importer du Markdown ----------
   Fenêtre : texte collé ou fichier .md choisi ; le contenu remplace celui de la page courante (en-tête et pied de page
   gardés) en une étape annulable. Conversion : blocsDuMarkdown (05-markdown.js). */
function importMarkdown() {
  if (mode !== 'edit') return;
  var m = modal('Importer du Markdown', '<p class="muted">Collez une note Markdown (Obsidian…) ou choisissez un fichier .md. Le contenu de la page courante sera remplacé ; Ctrl+Z permet de revenir en arrière.</p>' +
    '<textarea placeholder="# Titre&#10;&#10;Texte, listes, tableaux…" spellcheck="false"></textarea><p class="muted" id="mderr" style="color:var(--bad)"></p>' +
    '<input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden>', [
    { label: 'Annuler' },
    { label: 'Choisir un fichier…', fn: function (bg) { $('input[type=file]', bg).click(); return false; } },
    { label: 'Importer', primary: true, fn: function (bg) {
      var texte = $('textarea', bg).value, err = $('#mderr', bg);
      if (!texte.trim()) { err.textContent = 'Rien à importer : collez du Markdown ou choisissez un fichier.'; return false; }
      var r = blocsDuMarkdown(texte, doc.pages);
      if (pageAContenu(doc.blocks) && !confirm('Le contenu de la page « ' + pageTitle(doc.pages[doc.cur], doc.cur) + ' » sera remplacé par la note importée. Continuer ?')) return false;
      // ticket des images (Obsidian) : les images distantes se téléchargent ici, avant l'étape, puis importerMarkdown(r)
      importerMarkdown(r);
    } }]);
  var ta = $('textarea', m);
  $('input[type=file]', m).addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    var fr = new FileReader();
    fr.onload = function () { ta.value = String(fr.result).replace(/^﻿/, ''); $('#mderr', m).textContent = ''; ta.focus(); };
    fr.onerror = function () { $('#mderr', m).textContent = 'Lecture impossible : ' + f.name; };
    fr.readAsText(f, 'utf-8');
    e.target.value = '';
  });
  ta.focus();
}
// blocs convertis → page courante, en une étape « page importée du Markdown » ; champs HTML assainis comme un collage
function importerMarkdown(r) {
  var haut = [], bas = [];
  doc.blocks.forEach(function (b) { if (b.type === 'header' && !haut.length) haut.push(b); else if (b.type === 'footer') bas.push(b); });
  var nb = r.blocs.length;
  session.modifier(function () {
    if (r.entete) { if (haut.length) haut[0].title = assainirMd(r.entete.title); else haut.push(mk('header', { title: assainirMd(r.entete.title) })); }
    doc.blocks = haut.concat(r.blocs.map(function (b) { return mk(b.type, blocAssaini(b)); }), bas);
  }, null, { etape: ETAPE_MARKDOWN });
  scrollTo(0, 0);
  toast(nb + (nb > 1 ? ' blocs importés' : ' bloc importé'));
}
function assainirMd(h) { return paintPills(sanitize(h), doc); }
function blocAssaini(b) {
  var o = {};
  for (var k in b) if (k !== 'type') o[k] = b[k];
  if (o.html != null) o.html = assainirMd(o.html);
  if (b.type === 'details') o.title = assainirMd(o.title);
  if (o.items) o.items = o.items.map(function (it) { var c = {}; for (var j in it) c[j] = it[j]; c.html = assainirMd(it.html); return c; });
  if (o.rows) o.rows = o.rows.map(function (l) { return l.map(assainirMd); });
  return o;
}
