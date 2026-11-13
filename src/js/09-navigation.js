/* ---------- Précédent et Suivant ---------- */
// Un changement de page voulu (barre latérale, onglets, Alt+Page, lien) et un saut vers une section créent une entrée
// d'historique (naviguer) ; les autres changements de page (annulation, modification reçue, opérations de page, import)
// remplacent l'adresse sans entrée. Chaque entrée garde sa position de défilement (history.state.y), rétablie par Précédent.
// Dans une iframe (plugin Obsidian) : aucune entrée, Précédent n'est pas écouté.
var dansCadre = (function () { try { return window.self !== window.top; } catch (_) { return true; } })();
if (!dansCadre) try { history.scrollRestoration = 'manual'; } catch (_) {}
function noterDefilement() {
  if (dansCadre) return;
  try { history.replaceState({ y: scrollY }, '', location.href); } catch (_) {}
}
function naviguer(adresse) {
  if (adresse === location.hash) return;   // page et section déjà affichées : pas d'entrée en double
  if (dansCadre) { remplacerAdresse(adresse); return; }
  try { history.pushState({ y: 0 }, '', adresse); } catch (_) {}
}
function remplacerAdresse(adresse) { try { history.replaceState(history.state, '', adresse); } catch (_) {} }
// adresse lue (ouverture, Précédent) réécrite sous sa forme #pg-<page>[/<bloc>], sans entrée ; #edit est gardé
function corrigerAdresse(a) {
  if (a.mode === 'edit') return;
  var adr = adressePage(doc.pages, doc.cur, a.bloc && pageDuBloc(doc.pages, a.bloc) === doc.cur ? a.bloc : '');
  if (adr !== location.hash) remplacerAdresse(adr);
}
if (!dansCadre) {
  // la position de l'entrée courante suit le défilement : Précédent la retrouve même sans geste de navigation
  var defilT = null;
  window.addEventListener('scroll', function () { clearTimeout(defilT); defilT = setTimeout(noterDefilement, 150); }, { passive: true });
  window.addEventListener('popstate', function (e) {
    clearTimeout(defilT);
    if (!doc) return;   // fichier chiffré encore fermé
    closePop(); $$('.modal-bg', ui).forEach(function (m) { m.remove(); });
    session.valider();
    var a = lireAdresse(location.hash, doc.pages), y = e.state && typeof e.state.y === 'number' ? e.state.y : null;
    if (a.introuvable) toast('Page introuvable : elle a sans doute été supprimée');
    // rendu sans remonter en haut : la position de l'entrée est posée avant l'affichage, sans clignotement
    goPage(a.page, true, true); corrigerAdresse(a);
    if (y !== null) {
      scrollTo(0, y);
      requestAnimationFrame(function () { if (Math.abs(scrollY - y) > 1) scrollTo(0, y); });   // page encore trop courte au premier essai
    } else if (!(a.bloc && montrerBloc(a.bloc, false))) scrollTo(0, 0);
  });
}
// annulation, modification reçue : la page affichée peut changer sans navigation, l'adresse la suit sans entrée
session.abonner('rendu', function (focus, info) {
  if (!(info.historique || info.distant)) return;
  var a = lireAdresse(location.hash, doc.pages);
  if (a.introuvable || a.page !== doc.cur) remplacerAdresse(adressePage(doc.pages, doc.cur));
});
