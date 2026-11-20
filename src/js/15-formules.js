/* ---------- Formules dans un champ en édition ---------- */
// Une formule insérée dans le DOM sous sa forme stockée (<span class="formule">source</span>, après un collage) est
// remplacée sur place par son élément rendu, non éditable (05-formules.js), comme paintPill pour une pastille.
function peindreFormulesDans(el) {
  $$('span.formule', el).forEach(function (f) {
    if (f.querySelector('math')) return;
    var m = texEnMathML(f.textContent, 'ligne');
    if (!m) { f.parentNode.removeChild(f); return; }
    f.contentEditable = 'false'; f.innerHTML = m;
  });
}
