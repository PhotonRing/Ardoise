/* ---------- Bloc kanban ---------- */
// Colonnes de cartes (titre, description, échéance, responsable et priorité facultatifs). Les cartes se déplacent par
// glisser-déposer ou par « Déplacer vers… », en édition comme en lecture (le déplacement est enregistré).
function kbNewCard() { return { id: uid(), title: '', html: '', due: '', who: '' }; }
// priorité : P1 (haute, cadre rouge), P2 (moyenne, orange), P3 (basse, bleu) ; absente par défaut
var KB_PRIO = { p1: 'haute', p2: 'moyenne', p3: 'basse' };
function kbPrio(p) { return KB_PRIO[p] ? '<span class="kb-prio ' + p + '" title="Priorité ' + KB_PRIO[p] + '">' + p.toUpperCase() + '</span>' : ''; }
function kbToday(n, u) {
  // date du jour (aaaa-mm-jj), ou dans n jours (u = 'j'), semaines ('s') ou mois ('m')
  var d = new Date(); d.setHours(12, 0, 0, 0);
  if (n) { if (u === 'm') d.setMonth(d.getMonth() + n); else d.setDate(d.getDate() + n * (u === 's' ? 7 : 1)); }
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function kbDate(iso, long) {
  // aaaa-mm-jj → « 12 mars 2025 » (long) ou « 12/03/2025 »
  var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return String(iso || '');
  if (!long) return m[3] + '/' + m[2] + '/' + m[1];
  try { return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); } catch (_) { return m[3] + '/' + m[2] + '/' + m[1]; }
}
function kbParseDate(text, today) {
  // date saisie (j/m, j/m/aa, j/m/aaaa ; séparateurs / . - ; jour avant mois) → « aaaa-mm-jj », '' si vide, null si impossible
  var t = String(text || '').trim(); if (!t) return '';
  var m = t.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2}|\d{4}))?$/); if (!m) return null;
  var y = m[3] ? +m[3] + (m[3].length === 2 ? 2000 : 0) : +String(today).slice(0, 4), mo = +m[2], j = +m[1];
  var d = new Date(Date.UTC(y, mo - 1, j)); d.setUTCFullYear(y);
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== j) return null;
  return ('000' + y).slice(-4) + '-' + ('0' + mo).slice(-2) + '-' + ('0' + j).slice(-2);
}
function kbLate(iso, last) {
  // échéance passée (hors dernière colonne, considérée comme « terminé »)
  if (!iso || last) return false;
  return iso < kbToday();
}
function kbWho(name) {
  var n = String(name || '').trim(); if (!n) return '';
  return '<span class="kb-who"><i aria-hidden="true">' + esc(n.charAt(0).toUpperCase()) + '</i>' + esc(n) + '</span>';
}
function kanbanHTML(b, ctx, f) {
  // vue 'export' : cartes sans commandes de déplacement (page exportée sans script d'édition)
  var cols = b.cols || [], e = ctx.edit, st = ctx.static;
  return '<div class="kb' + (e ? ' kb-edit' : '') + '" data-kb="' + b.id + '"><div class="kb-cols">' + cols.map(function (c, ci) {
    var last = ci === cols.length - 1, cards = c.cards || [];
    return '<section class="kb-col" data-ci="' + ci + '"><div class="kb-head">' + f('span', 'kb-title', 'cols.' + ci + '.title', c.title, { rich: false, ph: 'Colonne', nl: 1 }) +
      '<span class="kb-n">' + cards.length + '</span>' +
      (e ? '<span class="kb-ctools"><button type="button" data-act="kb-col-left" data-i="' + ci + '" title="Déplacer la colonne à gauche"' + (ci ? '' : ' disabled') + '>←</button>' +
        '<button type="button" data-act="kb-col-right" data-i="' + ci + '" title="Déplacer la colonne à droite"' + (last ? ' disabled' : '') + '>→</button>' +
        '<button type="button" data-act="kb-col-del" data-i="' + ci + '" title="Supprimer la colonne">×</button></span>' : '') + '</div>' +
      '<div class="kb-list" data-ci="' + ci + '">' + cards.map(function (k, ki) {
        var base = 'cols.' + ci + '.cards.' + ki, meta;
        if (e) meta = '<div class="kb-meta"><select class="kb-prio-in' + (KB_PRIO[k.prio] ? ' ' + k.prio : '') + '" data-b="' + b.id + '" data-k="' + base + '.prio" title="Priorité (facultative)">' +
            [['', 'Priorité'], ['p1', 'P1 · haute'], ['p2', 'P2 · moyenne'], ['p3', 'P3 · basse']].map(function (o) { return '<option value="' + o[0] + '"' + ((k.prio || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
          '<label class="kb-duei" title="Échéance (facultative)"><span aria-hidden="true">Échéance</span><input type="text" class="kb-due-in" inputmode="numeric" autocomplete="off" placeholder="jj/mm/aaaa" data-b="' + b.id + '" data-k="' + base + '.due" value="' + esc(kbDate(k.due)) + '">' +
            '<button type="button" class="kb-due-cal" data-act="kb-due-cal" title="Choisir dans le calendrier" aria-label="Choisir dans le calendrier">📅</button>' +
            '<input type="date" class="kb-due-pick" tabindex="-1" aria-hidden="true" data-b="' + b.id + '" data-k="' + base + '.due" value="' + esc(k.due || '') + '"></label>' +
          f('span', 'kb-whoi', base + '.who', k.who, { rich: false, ph: 'Responsable', nl: 1 }) + '</div>';
        else meta = k.due || k.who || KB_PRIO[k.prio] ? '<div class="kb-meta">' + kbPrio(k.prio) + (k.due ? '<span class="kb-due' + (kbLate(k.due, last) ? ' late' : '') + '" title="Échéance">' + esc(kbDate(k.due, true)) + '</span>' : '') + kbWho(k.who) + '</div>' : '';
        return '<article class="kb-card' + (KB_PRIO[k.prio] ? ' prio-' + k.prio : '') + '" data-ci="' + ci + '" data-ki="' + ki + '"' + (e || st ? '' : ' draggable="true"') + '>' +
          (st ? '' : '<div class="kb-ctl">' + (e ? '<span class="kb-grip" title="Glisser pour déplacer">⋮⋮</span>' : '') +
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
  session.modifier(function () { var c = from.splice(ki, 1)[0]; if (tc === ci && tk > ki) tk--; to.splice(tk, 0, c); });
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
