/* ---------- Bandeaux, toasts, fenêtres ---------- */
var toastT;
function toast(msg, ms) {
  var t = $('.toast', ui); if (!t) { t = document.createElement('div'); t.className = 'toast'; ui.appendChild(t); }
  t.textContent = msg; t.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(function () { t.style.display = 'none'; }, ms || 2600);
}
function modal(title, bodyHTML, buttons) {
  var bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = '<div class="modal" role="dialog" aria-label="' + esc(title) + '"><h3>' + esc(title) + '</h3>' + bodyHTML + '<div class="row">' +
    buttons.map(function (b, i) { return '<button class="ub ' + (b.primary ? 'primary' : 'out') + '" data-m="' + i + '">' + b.label + '</button>'; }).join('') + '</div></div>';
  ui.appendChild(bg);
  function close() { bg.remove(); }
  bg.addEventListener('click', function (e) {
    if (e.target === bg) { close(); return; }
    var b = e.target.closest('[data-m]'); if (!b) return; var fn = buttons[+b.dataset.m].fn; if (!fn || fn(bg) !== false) close();
  });
  bg.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  return bg;
}
function showHelp() {
  var rows = [['Ctrl+E', 'Basculer lecture / édition'], ['Ctrl+S', 'Enregistrer'], ['Ctrl+Z / Ctrl+Maj+Z', 'Annuler / rétablir'], ['/', 'Dans un paragraphe vide : insérer un bloc'],
    ['Entrée', 'Nouveau paragraphe, nouvel élément de liste'], ['Maj+Entrée', 'Saut de ligne'], ['Entrée sur élément vide', 'Sortir de la liste'], ['Alt+↑ / Alt+↓', 'Déplacer le bloc'],
    ['Ctrl+B, Ctrl+I', 'Gras, italique'], ['Ctrl+J, Ctrl+K', 'Code, lien'], ['Tab (code)', 'Indenter de 2 espaces'], ['Alt+Page↓ / Alt+Page↑', 'Page suivante / précédente'], ['Double-clic sur un onglet', 'Renommer la page']];
  modal('Raccourcis clavier', '<div class="tablewrap"><table style="min-width:0"><tbody>' + rows.map(function (r) { return '<tr><td><code>' + esc(r[0]) + '</code></td><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</tbody></table></div>', [{ label: 'Fermer', primary: true }]);
}

