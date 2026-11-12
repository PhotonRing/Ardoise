/* ---------- Fiche de raccourcis de la carte (à droite, selon le mode) ---------- */
var CHEATS = {
  nav: ['Carte', [['Glisser', 'Déplacer la carte'], ['Molette', 'Zoomer (après un clic sur la carte)'], ['Double-clic', 'Zoomer ici (Maj : dézoomer)'], ['Flèches, + / −', 'Déplacer, zoomer (carte sélectionnée)']],
    'Modifier', [['✎ dans la liste', 'Déverrouiller un élément pour le déplacer'], ['Clic sur un élément', 'Sélectionner sa ligne dans la liste'], ['Échap', 'Terminer la modification']],
    'Ajouter', [['＋ Point', 'Placer des points au clic'], ['▱ ○ ⤳', 'Dessiner zone, cercle, itinéraire'], ['Recherche', 'Ville, port ou « lat, lon »'], ['▦ Pays', 'Colorer les pays selon une valeur']],
    'Données par pays', [['Clic sur un pays', 'Retrouver sa valeur, ou l’ajouter'], ['Glisser une valeur', 'Déplacer l’étiquette'], ['Double-clic dessus', 'La remettre à sa place'], ['Haut / Bas, Entrée', 'Valeur précédente / suivante'], ['Source', 'Saisie, ou un tableau du document']]],
  add: ['Placer des points', [['Clic', 'Ajouter un point'], ['Clic sur un point', 'Sans effet (pas de doublon)'], ['Glisser', 'Déplacer la carte'], ['Échap', 'Terminer']]],
  poly: ['Dessiner une zone', [['Clic', 'Poser un sommet'], ['Clic sur une pastille', 'Sommet exactement sur le point'], ['Alt + clic', 'Sans aimantation'], ['Retour arrière', 'Retirer le dernier sommet'], ['Double-clic, Entrée', 'Terminer'], ['Clic sur le 1er sommet', 'Fermer la zone'], ['Glisser', 'Déplacer la carte'], ['Échap', 'Annuler']]],
  circle: ['Dessiner un cercle', [['1er clic', 'Centre (aimanté aux points)'], ['2e clic', 'Rayon'], ['Alt + clic', 'Centre sans aimantation'], ['Glisser', 'Déplacer la carte'], ['Échap', 'Annuler']], 'Ensuite', [['Champ km', 'Rayon précis dans la liste']]],
  route: ['Tracer un itinéraire', [['Clic', 'Ajouter une étape (aimantée)'], ['Clic sur une pastille', 'Étape exactement sur le point'], ['Alt + clic', 'Étape sans aimantation'], ['Retour arrière', 'Retirer la dernière étape'], ['Double-clic, Entrée', 'Terminer'], ['Glisser', 'Déplacer la carte'], ['Échap', 'Annuler']]],
  epoly: ['Modifier une zone', [['Glisser un carré', 'Déplacer un sommet'], ['Glisser un rond', 'Ajouter un sommet'], ['Double-clic carré', 'Supprimer le sommet'], ['Alt en glissant', 'Sans aimantation'], ['Glisser l’étiquette', 'La déplacer'], ['Double-clic étiquette', 'La remettre à sa place'], ['Échap ou ✎', 'Terminer']], 'Note', [['Autres éléments', 'Figés pendant la modification']]],
  ecircle: ['Modifier un cercle', [['Glisser le carré', 'Déplacer le cercle'], ['Glisser le rond', 'Changer le rayon'], ['Champ km', 'Rayon précis'], ['Alt en glissant', 'Centre sans aimantation'], ['Glisser l’étiquette', 'La déplacer'], ['Double-clic étiquette', 'La remettre à sa place'], ['Échap ou ✎', 'Terminer']], 'Note', [['Autres éléments', 'Figés pendant la modification']]],
  emarker: ['Modifier un point', [['Glisser le point', 'Le déplacer'], ['Glisser l’étiquette', 'La déplacer (reste sur place au zoom)'], ['Double-clic étiquette', 'La remettre à sa place'], ['Champ coordonnées', 'Position précise'], ['Échap ou ✎', 'Terminer']], 'Note', [['Autres éléments', 'Figés pendant la modification']]],
  eroute: ['Modifier un itinéraire', [['Glisser un carré', 'Déplacer une étape'], ['Glisser un rond', 'Ajouter une étape'], ['Double-clic carré', 'Supprimer l’étape'], ['Clic sur une étape', 'Saisir son libellé'], ['Alt en glissant', 'Sans aimantation'], ['Glisser une étiquette', 'Étape ou distance : la déplacer'], ['Bouton km', 'Afficher ou masquer la distance'], ['Double-clic étiquette', 'La remettre à sa place'], ['Échap ou ✎', 'Terminer']], 'Note', [['Autres éléments', 'Figés pendant la modification']]]
};
var cheatEl = null, cheatMin = false;
try { cheatMin = localStorage.getItem(LS + 'cheatmin') === '1'; } catch (_) {}
function cheatMode() {
  if (mode !== 'edit') return null;
  if (mapUi.draw) return mapUi.kind;
  if (mapUi.edit && mapUi.editOf) {
    var b = byId(mapUi.editOf); if (!b) return 'nav';
    if (mapUi.edit.kind === 'route') return 'eroute';
    if (mapUi.edit.kind === 'marker') return 'emarker';
    var z = b.zones[mapUi.edit.i]; return z && z.shape === 'circle' ? 'ecircle' : 'epoly';
  }
  if (mapUi.add) return 'add';
  return cheatBlock && byId(cheatBlock) ? 'nav' : null;
}
function updateCheat() {
  var m = cheatMode(), activeB = m ? (mapUi.draw || mapUi.editOf || mapUi.add || cheatBlock) : null;
  $$('.mk-panel', app).forEach(function (pn) { pn.classList.toggle('show', pn.dataset.b === activeB); });
  $$('.map-sum', app).forEach(function (ps) { var pb = ps.closest('.blk'); ps.style.visibility = pb && pb.dataset.id === activeB ? 'hidden' : ''; });
  if (!m) { if (cheatEl) { cheatEl.remove(); cheatEl = null; } return; }
  if (!cheatEl) { cheatEl = document.createElement('aside'); cheatEl.className = 'cheat'; cheatEl.setAttribute('aria-label', 'Raccourcis de la carte'); ui.appendChild(cheatEl); }
  var c = CHEATS[m], h = '';
  for (var i = 1; i < c.length; i += 2) {
    var head = i === 1 ? '' : '<h5>' + esc(c[i - 1 + (i === 1 ? 0 : 0)]) + '</h5>';
    if (i > 1) head = '<h5>' + esc(c[i - 1]) + '</h5>';
    h += head + '<dl>' + c[i].map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>';
  }
  cheatEl.classList.toggle('min', cheatMin);
  cheatEl.innerHTML = '<div class="cheat-h"><span class="cheat-dot"></span><b>' + esc(c[0]) + '</b><button type="button" data-cheat="min" title="' + (cheatMin ? 'Afficher' : 'Réduire') + '">' + (cheatMin ? '▸' : '–') + '</button></div>' + (cheatMin ? '' : '<div class="cheat-b">' + h + '</div>');
}
ui.addEventListener('click', function (e) {
  var b = e.target.closest('[data-cheat=min]'); if (!b) return;
  cheatMin = !cheatMin; try { localStorage.setItem(LS + 'cheatmin', cheatMin ? '1' : '0'); } catch (_) {} updateCheat();
});
document.addEventListener('pointerdown', function (e) {
  if (mode !== 'edit') return;
  var t = e.target; if (!t || !t.closest) return;
  if (t.closest('.cheat')) return;
  // interface (barre du haut, menus, toasts) : hors de la carte, sauf un popup ouvert depuis la carte elle-même
  var pp = t.closest('#ui') && t.closest('.pop'), src = pp && pp.ancre && pp.ancre.closest && pp.ancre.closest('.blk[data-type=map]');
  var mb = t.closest('#ui') ? src || null : t.closest('.blk[data-type=map]');
  // clic hors de la carte active et de sa liste : on quitte l'édition de forme et l'ajout de points ; un dessin en cours est gardé
  var act = mapUi.editOf || mapUi.add;
  if (act && !(mb && mb.dataset.id === act)) setMapMode(null, null);
  if (t.closest('#ui')) return;
  var busy = mapUi.draw || mapUi.edit || mapUi.add;
  cheatBlock = mb ? mb.dataset.id : (busy ? cheatBlock : null);
  setTimeout(updateCheat);
}, true);
// seul passage d'un mode de carte à l'autre (voir mapModeNext) : état, moteurs, boutons, liste et aide ; vrai si un mode était actif
function setMapMode(id, want) {
  var avant = mapUi, apres = mapModeNext(avant, id, want), was = !!(avant.draw || avant.edit || avant.add);
  var same = function (a, b) { return !!a && !!b && a.kind === b.kind && a.i === b.i; };
  var formeDe = function (u, bid) { return u.editOf === bid ? u.edit : null; };
  // forme mémorisée par sa géométrie, pour la suivre si une annulation la décale dans sa liste
  if (apres.edit) apres.edit = mapShapeFollow(byId(apres.editOf), apres.edit) || apres.edit;
  mapUi = apres;
  maps.forEach(function (m) {
    var bid = m.blockId, oe = formeDe(avant, bid), ne = formeDe(apres, bid);
    // l'ajout d'abord : setDrawMode recalcule ensuite l'aspect de la carte avec les deux modes
    if ((avant.add === bid) !== (apres.add === bid)) m.setAddMode(apres.add === bid);
    var dessinAvant = avant.draw === bid ? avant.kind : null, dessinApres = apres.draw === bid ? apres.kind : null;
    if (dessinAvant !== dessinApres) m.setDrawMode(dessinApres);
    if (!same(oe, ne) && (oe || ne)) m.setEdit(ne ? ne.kind : null, ne ? ne.i : 0);
  });
  var blkOf = function (x) { var k = x.closest('.blk[data-type=map]'); return k ? k.dataset.id : null; };
  $$('[data-act=map-addmode]', app).forEach(function (x) { x.setAttribute('aria-pressed', String(!!apres.add && blkOf(x) === apres.add)); });
  $$('[data-act=map-draw]', app).forEach(function (x) { x.setAttribute('aria-pressed', String(!!apres.draw && blkOf(x) === apres.draw && x.dataset.kind === apres.kind)); });
  $$('[data-act=shape-edit]', app).forEach(function (x) {
    var on = !!apres.edit && blkOf(x) === apres.editOf && x.dataset.kind === apres.edit.kind && +x.dataset.i === apres.edit.i;
    x.setAttribute('aria-pressed', String(on));
    var it = x.closest('.mk-item'); if (it) it.classList.toggle('on', on);
  });
  if (id != null) cheatBlock = id;
  var oldRoute = avant.edit && avant.edit.kind === 'route' ? avant : null, newRoute = apres.edit && apres.edit.kind === 'route' ? apres : null;
  var routeChanged = (oldRoute || newRoute) && !(oldRoute && newRoute && oldRoute.editOf === newRoute.editOf && same(oldRoute.edit, newRoute.edit));
  // fin d'une édition d'itinéraire : lignes d'étapes retirées sans rendu (il perdrait la cible et le focus d'un clic ailleurs)
  if (routeChanged && oldRoute) $$('.mk-panel[data-b="' + oldRoute.editOf + '"] .st-row', app).forEach(function (r) { r.remove(); });
  if (routeChanged && newRoute) { var br = byId(newRoute.editOf); if (br) keepView(br); render(); }
  updateCheat();
  return was;
}
function endMapModes() {
  // Échap : termine le mode de carte en cours (dessin, modification, placement de points)
  return setMapMode(null, null);
}

