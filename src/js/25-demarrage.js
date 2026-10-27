/* ---------- Démarrage ---------- */
tlTips();
navSpyFn = navSpy();
function boot(d) {
  doc = d;
  mode = (freshDoc || (location.hash === '#edit' && (!doc.lock || unlocked))) ? 'edit' : 'view';
  var m = location.hash.match(/^#p(\d+)$/); if (m) doc.cur = Math.max(0, Math.min(doc.pages.length - 1, +m[1] - 1));
  render();
  snapshot();
  if (freshDoc) setStatus('warn', 'Ctrl+S pour créer votre fichier');
  checkDraft();
  getHandle().then(function (h) {
    if (!h) return; fileHandle = h;
    perm(h, false).then(function (ok) { handleGranted = ok; setStatus(); });
  });
}
var initial = loadInitial();
if (sealed) lockScreen(sealed); else boot(initial);
window.ardoise = { get doc() { return doc; }, load: function (d) { if (doc.lock && !unlocked) return false; var nd = normalize(d); if (!nd) return false; nd.id = doc.id; if (doc.lock) nd.lock = doc.lock; else delete nd.lock; change(function () { doc = nd; }); return true; }, save: save };
})();
