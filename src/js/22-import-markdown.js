/* ---------- Importer du Markdown ----------
   Fenêtre : texte collé ou fichier .md choisi ; le contenu remplace celui de la page courante (en-tête et pied de page
   gardés) en une étape annulable. Conversion : blocsDuMarkdown (05-markdown.js). */
function ouvrirImportMarkdown() {
  if (mode !== 'edit') return;
  var m = modal('Importer du Markdown', '<p class="muted">Collez une note Markdown (Obsidian…) ou choisissez un fichier .md. Le contenu de la page courante sera remplacé ; Ctrl+Z permet de revenir en arrière.</p>' +
    '<textarea placeholder="# Titre&#10;&#10;Texte, listes, tableaux…" spellcheck="false"></textarea><p class="muted" id="mderr" style="color:var(--bad)"></p><p class="muted" id="mdetat"></p>' +
    '<input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden>', [
    { label: 'Annuler' },
    { label: 'Choisir un fichier…', fn: function (bg) { $('input[type=file]', bg).click(); return false; } },
    { label: 'Importer', primary: true, fn: function (bg) {
      if (bg.dataset.attente) return false;   // images en cours de téléchargement
      var texte = $('textarea', bg).value, err = $('#mderr', bg);
      if (!texte.trim()) { err.textContent = 'Rien à importer : collez du Markdown ou choisissez un fichier.'; return false; }
      var r = blocsDuMarkdown(texte, doc.pages, doc.cur);
      if (pageAContenu(doc.blocks) && !confirm('Le contenu de la page « ' + pageTitle(doc.pages[doc.cur], doc.cur) + ' » sera remplacé par la note importée. Continuer ?')) return false;
      if (!r.images.length) { appliquerImportMarkdown(r); return; }
      // images distantes : téléchargées avant l'étape, fenêtre ouverte, pour que l'import reste une seule étape (un Ctrl+Z)
      var n = r.images.length, k = 0, etat = $('#mdetat', bg);
      bg.dataset.attente = '1'; err.textContent = '';
      etat.textContent = 'Téléchargement des images (0/' + n + ')…';
      Promise.all(r.images.map(function (im) {
        function fini() { etat.textContent = 'Téléchargement des images (' + (++k) + '/' + n + ')…'; }
        return telechargerImage(im.url, 15000).then(function (src) { r.blocs[im.bloc].src = src; fini(); },
          function () { r.blocs[im.bloc].caption = esc(im.nom); r.imagesManquantes++; fini(); });
      })).then(function () {
        if (!bg.isConnected) return;   // fenêtre fermée pendant le téléchargement (Échap, clic à côté) : import abandonné
        bg.remove(); appliquerImportMarkdown(r);
      });
      return false;
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
function appliquerImportMarkdown(r) {
  var haut = [], bas = [];
  // une page n'a qu'un en-tête : un second bloc En-tête de la page n'est pas gardé
  doc.blocks.forEach(function (b) { if (b.type === 'header' && !haut.length) haut.push(b); else if (b.type === 'footer') bas.push(b); });
  var nb = r.blocs.length;
  session.modifier(function () {
    if (r.entete) { if (haut.length) haut[0].title = assainirMd(r.entete.title); else haut.push(mk('header', { title: assainirMd(r.entete.title) })); }
    doc.blocks = haut.concat(r.blocs.map(function (b) { return mk(b.type, blocAssaini(b)); }), bas);
  }, null, { etape: ETAPE_MARKDOWN });
  scrollTo(0, 0);
  var ni = r.imagesManquantes;
  toast(nb + (nb > 1 ? ' blocs importés' : ' bloc importé') + (ni ? ' · ' + ni + (ni > 1 ? ' images à remettre' : ' image à remettre') : ''), ni ? 6000 : 2600);
}
function assainirMd(h) { return paintPills(sanitize(h), doc); }
function blocAssaini(b) {
  var o = {};
  for (var k in b) if (k !== 'type') o[k] = b[k];
  if (o.html != null) o.html = assainirMd(o.html);
  if (o.caption) o.caption = assainirMd(o.caption);
  if (b.type === 'details') o.title = assainirMd(o.title);
  if (b.type === 'facts') o.items = o.items.map(function (it) { return { k: it.k, v: assainirMd(it.v) }; });   // clé en texte simple
  else if (o.items) o.items = o.items.map(function (it) { var c = {}; for (var j in it) c[j] = it[j]; c.html = assainirMd(it.html); return c; });
  if (o.rows) o.rows = o.rows.map(function (l) { return l.map(assainirMd); });
  return o;
}
