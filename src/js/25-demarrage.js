/* ---------- Démarrage ---------- */
tlTips();
doc = loadInitial();
mode = (freshDoc || (location.hash === '#edit' && !doc.lock)) ? 'edit' : 'view';
(function () { var m = location.hash.match(/^#p(\d+)$/); if (m) doc.cur = Math.max(0, Math.min(doc.pages.length - 1, +m[1] - 1)); })();
navSpyFn = navSpy();
render();
snapshot();
if (freshDoc) setStatus('warn', 'Ctrl+S pour créer votre fichier');
checkDraft();
getHandle().then(function (h) {
  if (!h) return; fileHandle = h;
  perm(h, false).then(function (ok) { handleGranted = ok; setStatus(); });
});
window.ardoise = { get doc() { return doc; }, load: function (d) { if (doc.lock && !unlocked) return false; var nd = normalize(d); if (!nd) return false; nd.id = doc.id; if (doc.lock) nd.lock = doc.lock; else delete nd.lock; change(function () { doc = nd; }); return true; }, save: save };
})();
