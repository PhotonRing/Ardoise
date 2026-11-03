/* ---------- Bloc kanban ---------- */
// Colonnes de cartes (titre, description, échéance et responsable facultatifs). Les cartes se déplacent par
// glisser-déposer ou par « Déplacer vers… », en édition comme en lecture (le déplacement est enregistré).
function kbNewCard() { return { id: uid(), title: '', html: '', due: '', who: '' }; }
function kbDate(iso, long) {
  // aaaa-mm-jj → « 12 mars 2025 » (long) ou « 12/03/2025 »
  var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return String(iso || '');
  if (!long) return m[3] + '/' + m[2] + '/' + m[1];
  try { return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); } catch (_) { return m[3] + '/' + m[2] + '/' + m[1]; }
}
function kbLate(iso, last) {
  // échéance passée (hors dernière colonne, considérée comme « terminé »)
  if (!iso || last) return false;
  var d = new Date(), t = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  return iso < t;
}
function kbWho(name) {
  var n = String(name || '').trim(); if (!n) return '';
  return '<span class="kb-who"><i aria-hidden="true">' + esc(n.charAt(0).toUpperCase()) + '</i>' + esc(n) + '</span>';
}
function kanbanHTML(b, e, f) {
  var cols = b.cols || [];
  return '<div class="kb' + (e ? ' kb-edit' : '') + '" data-kb="' + b.id + '"><div class="kb-cols">' + cols.map(function (c, ci) {
    var last = ci === cols.length - 1, cards = c.cards || [];
    return '<section class="kb-col" data-ci="' + ci + '"><div class="kb-head">' + f('span', 'kb-title', 'cols.' + ci + '.title', c.title, { rich: false, ph: 'Colonne', nl: 1 }) +
      '<span class="kb-n">' + cards.length + '</span>' +
      (e ? '<span class="kb-ctools"><button type="button" data-act="kb-col-left" data-i="' + ci + '" title="Déplacer la colonne à gauche"' + (ci ? '' : ' disabled') + '>←</button>' +
        '<button type="button" data-act="kb-col-right" data-i="' + ci + '" title="Déplacer la colonne à droite"' + (last ? ' disabled' : '') + '>→</button>' +
        '<button type="button" data-act="kb-col-del" data-i="' + ci + '" title="Supprimer la colonne">×</button></span>' : '') + '</div>' +
      '<div class="kb-list" data-ci="' + ci + '">' + cards.map(function (k, ki) {
        var base = 'cols.' + ci + '.cards.' + ki, meta;
        if (e) meta = '<div class="kb-meta"><label class="kb-duei" title="Échéance (facultative)"><span aria-hidden="true">Échéance</span><input type="date" class="kb-due-in" data-b="' + b.id + '" data-k="' + base + '.due" value="' + esc(k.due || '') + '"></label>' +
          f('span', 'kb-whoi', base + '.who', k.who, { rich: false, ph: 'Responsable', nl: 1 }) + '</div>';
        else meta = k.due || k.who ? '<div class="kb-meta">' + (k.due ? '<span class="kb-due' + (kbLate(k.due, last) ? ' late' : '') + '" title="Échéance">' + esc(kbDate(k.due, true)) + '</span>' : '') + kbWho(k.who) + '</div>' : '';
        return '<article class="kb-card" data-ci="' + ci + '" data-ki="' + ki + '"' + (e || staticRender ? '' : ' draggable="true"') + '>' +
          (staticRender ? '' : '<div class="kb-ctl">' + (e ? '<span class="kb-grip" title="Glisser pour déplacer">⋮⋮</span>' : '') +
          '<button type="button" class="kb-mv" data-kbmove="' + b.id + '|' + ci + '|' + ki + '" title="Déplacer vers…" aria-label="Déplacer vers une autre colonne">⇄</button>' +
          (e ? '<button type="button" class="kb-del" data-act="kb-card-del" data-ci="' + ci + '" data-ki="' + ki + '" title="Supprimer la carte">×</button>' : '') + '</div>') +
          f('div', 'kb-ct', base + '.title', k.title, { ph: 'Titre de la carte', nl: 1 }) +
          ((e || !isBlank(k.html)) ? f('div', 'kb-tx', base + '.html', k.html, { ph: 'Description (facultative)', ml: 1, soft: 1 }) : '') + meta + '</article>';
      }).join('') + (!cards.length && !e ? '<p class="kb-empty">—</p>' : '') + '</div>' +
      (e ? '<button type="button" class="kb-add" data-act="kb-card-add" data-i="' + ci + '">+ Carte</button>' : '') + '</section>';
  }).join('') + (e ? '<button type="button" class="kb-addcol" data-act="kb-col-add" title="Ajouter une colonne">+ Colonne</button>' : '') + '</div></div>';
}
function kbMove(b, ci, ki, tc, tk) {
  // déplace la carte (ci, ki) vers la colonne tc, à la position tk (fin si absente) ; enregistré, en lecture comme en édition
  var from = b.cols[ci] && b.cols[ci].cards, to = b.cols[tc] && b.cols[tc].cards; if (!from || !to || !from[ki]) return;
  if (tk == null) tk = to.length;
  if (tc === ci && (tk === ki || tk === ki + 1)) return;
  var sy = scrollY;
  change(function () { var c = from.splice(ki, 1)[0]; if (tc === ci && tk > ki) tk--; to.splice(tk, 0, c); });
  scrollTo(0, sy);
}
function kbMoveMenu(anchor, b, ci, ki) {
  closePop();
  var p = document.createElement('div'); p.className = 'pop'; pop = p;
  p.innerHTML = '<h4>Déplacer vers</h4>' + b.cols.map(function (c, i) {
    return '<button class="mi" type="button" data-tc="' + i + '"' + (i === ci ? ' disabled style="opacity:.4"' : '') + '><span class="ic">' + (i + 1) + '</span><span>' + esc(c.title || 'Colonne ' + (i + 1)) + '</span></button>';
  }).join('');
  p.addEventListener('click', function (e) { var x = e.target.closest('[data-tc]'); if (!x || x.disabled) return; closePop(); kbMove(b, ci, ki, +x.dataset.tc); });
  placePop(p, anchor);
}
