/* ---------- Démarrage ---------- */
tlTips();
navSpyFn = navSpy();
function boot(d, origine) {
  // le mode et l'état replié de la navigation avant le remplacement : le rendu prévenu par la session en dépend
  loadNavFold(d);
  mode = (freshDoc || (location.hash === '#edit' && (!d.lock || unlocked) && !d.newer)) ? 'edit' : 'view';
  var m = location.hash.match(/^#p(\d+)$/);
  session.remplacer(d, origine || 'demarrage', { page: m ? +m[1] - 1 : 0 });
  if (freshDoc) setStatus('warn', 'Ctrl+S pour créer votre fichier');
  if (doc.newer) newerNotice(false); else checkDraft();
  synStart();   // synchronisation entre copies, si le fichier l'a activée
  getHandle().then(function (h) {
    if (!h) return; fileHandle = h;
    perm(h, false).then(function (ok) { handleGranted = ok; setStatus(); });
  });
}
var initial = loadInitial();
if (sealed) lockScreen(sealed); else boot(initial);
window.ardoise = { get doc() { return doc; }, load: function (d) { if (doc.lock && !unlocked) return false; var nd = normalize(d); if (!nd || nd.newer) return false; nd.id = doc.id; synKeep(doc, nd); if (doc.lock) nd.lock = doc.lock; else delete nd.lock; change(function () { doc = nd; }); return true; }, save: save };
})();
