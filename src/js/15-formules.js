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
/* Fenêtre de la formule (édition) : un clic ou un toucher sur une formule ouvre sous elle sa source et l'aperçu en direct.
   Le texte ne change qu'à la fermeture (Entrée, Échap ou clic ailleurs : toutes valident) : une source modifiée est écrite
   en une étape d'historique, une source vidée retire la formule ; le curseur revient juste après la formule. */
function sourceFormule(el) { var a = el.querySelector('annotation'); return a ? a.textContent : el.textContent; }
function ouvrirFenetreFormule(el) {
  var fld = fieldOf(el); if (!fld) return;
  closePop(); hideLinkTip(); hidePillTip();
  var avant = sourceFormule(el);
  var p = document.createElement('div'); p.className = 'pop formule-pop'; pop = p;
  p.innerHTML = '<input class="menu-q" data-fsrc spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Source LaTeX de la formule" value="' + esc(avant) + '"><div class="f-apercu"></div>';
  var champ = $('[data-fsrc]', p), apercu = $('.f-apercu', p);
  var dessiner = function () { var m = texEnMathML(champ.value, 'ligne'); apercu.innerHTML = m || '<span class="muted">La formule sera retirée</span>'; };
  champ.addEventListener('input', dessiner);
  champ.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePop(); } });
  dessiner();
  placePop(p, el);
  popClose = function () { validerFormule(el, fld, avant, champ.value); };
  champ.focus({ preventScroll: true }); champ.select();
}
function validerFormule(el, fld, avant, source) {
  if (!fld.contains(el)) { if (source !== avant) toast('La formule a changé entre-temps : modifiez-la à nouveau'); return; }
  fld.focus({ preventScroll: true });
  exitInline(el, 1);   // curseur juste après la formule, gardé si elle est retirée
  if (source === avant) return;
  session.valider();   // la frappe en attente dans le champ est une étape, la formule en est une autre
  var m = texEnMathML(source, 'ligne');
  if (m) el.innerHTML = m; else el.parentNode.removeChild(el);
  fire(fld);
  session.valider();
}
app.addEventListener('mousedown', function (e) {
  // le navigateur ne pose pas la sélection autour de la formule : le clic ouvre sa fenêtre
  if (mode === 'edit' && e.target.closest && e.target.closest('.fld[data-rich] span.formule')) e.preventDefault();
});
app.addEventListener('click', function (e) {
  var el = mode === 'edit' && e.target.closest ? e.target.closest('span.formule') : null, fld = el && fieldOf(el);
  if (fld && fld.hasAttribute('data-rich') && fld.isContentEditable) ouvrirFenetreFormule(el);
});
