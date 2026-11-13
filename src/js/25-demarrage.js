/* ---------- Démarrage ---------- */
// un clic en cours sur le sommaire : refreshDerived attend sa fin pour reconstruire (07-rendu.js)
document.addEventListener('pointerdown', function () { pointerBusy = true; }, true);
document.addEventListener('pointerup', function () { setTimeout(function () { pointerBusy = false; if (navPending) { navPending = false; refreshDerived(); } }, 0); }, true);
try { panelMin = localStorage.getItem(LS + 'panelmin') === '1'; } catch (_) {}
Reader.tlTips();
navSpyFn = Reader.navSpy();
function boot(d, origine) {
  // le mode et l'état replié de la navigation avant le remplacement : le rendu prévenu par la session en dépend
  loadNavFold(d);
  // adresse : #pg-<page>[/<bloc>], ancienne forme #p<N>, ou #edit (ouverture en édition)
  var a = lireAdresse(location.hash, d.pages || []);
  mode = (freshDoc || (a.mode === 'edit' && (!d.lock || unlocked) && !d.newer)) ? 'edit' : 'view';
  session.remplacer(d, origine || 'demarrage', { page: a.page });
  if (a.introuvable) toast('Page introuvable : elle a sans doute été supprimée'); else if (a.bloc) montrerBloc(a.bloc, false);
  corrigerAdresse(a);
  noterDefilement();   // première entrée : sa position, pour y revenir par Précédent
  if (freshDoc) setStatus('warn', 'Ctrl+S pour créer votre fichier');
  if (doc.newer) newerNotice(false); else checkDraft();
  synStart();   // synchronisation entre copies, si le fichier l'a activée
  // poignée reprise : si la permission est déjà accordée, on écarte tout de suite celle qui ne désigne pas le fichier ouvert ;
  // sinon le contrôle attend le prochain enregistrement (Ctrl+S demande la permission)
  getHandle().then(function (h) {
    if (!h) return; fileHandle = h; poigneeReprise = h;
    perm(h, false).then(function (ok) {
      if (!ok) { handleGranted = false; setStatus(); return; }
      return verifierPoignee(h).then(function () { handleGranted = true; }, function (e) { if (fileHandle === h && staleHandle(e)) dropHandle(h); });
    }).then(function () { setStatus(); });
  });
}
var initial = loadInitial();
if (sealed) lockScreen(sealed); else boot(initial);
window.ardoise = { get doc() { return doc; }, load: function (d) { return !!session.remplacer(d, 'externe', { deverrouille: unlocked }).ok; }, save: save };
})();
