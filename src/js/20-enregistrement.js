/* ---------- Enregistrement : le fichier se réécrit lui-même ---------- */
var dirty = false, fileHandle = null, autosaveOn = true, saving = false, saveTimer = null, draftTimer = null, lastMode = '', downloadMode = false;
try { autosaveOn = localStorage.getItem(LS + 'autosave') !== '0'; } catch (_) {}
var headKeep = $$('head > *');
function markDirty(fromHistory) {
  if (!fromHistory) { clearTimeout(htimer); htimer = setTimeout(snapshot, 500); }
  var was = dirty; dirty = true;
  if (!was && mode === 'view') renderChrome(); else setStatus();
  clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 700);
  clearTimeout(saveTimer); saveTimer = setTimeout(autoSave, 1200);
}
function setStatus(state, text) {
  var st = $('#st', ui); if (!st) return;
  var s = state, t = text;
  if (!s) {
    if (saving) { s = 'busy'; t = 'Enregistrement…'; }
    else if (!dirty) { s = 'ok'; t = fileHandle ? 'Enregistré · ' + fileHandle.name : (doc.savedAt ? 'Enregistré' : 'Jamais enregistré'); if (!fileHandle && !doc.savedAt) s = ''; }
    else if (fileHandle && autosaveOn && handleGranted) { s = 'busy'; t = 'Modifications en cours…'; }
    else if (fileHandle && autosaveOn) { s = 'warn'; t = 'Ctrl+S pour reprendre l’auto-save'; }
    else { s = 'warn'; t = 'Non enregistré · Ctrl+S'; }
  }
  st.className = 'st ' + (s || ''); $('span', st).textContent = t; st.title = t;
}
var handleGranted = false;
function serializeFile() {
  // renvoie une promesse du fichier complet ; chiffré si le document le demande
  doc.savedAt = new Date().toISOString();
  doc.title = docTitle();
  var json = JSON.stringify(doc);
  return (isSealed() ? sealJSON(json).then(function (env) {
    return JSON.stringify({ v: VERSION, id: doc.id, palette: doc.palette, typo: doc.typo, theme: doc.theme, enc: env });
  }) : Promise.resolve(json)).then(function (stored) { return buildFile(stored); });
}
function buildFile(stored) {
  var sealedFile = isSealed();
  var root = document.documentElement.cloneNode(true);
  root.classList.remove('is-edit', 'nav-none', 'nav-side', 'nav-tabs', 'nav-push'); root.style.removeProperty('--navw'); if (!root.getAttribute('style')) root.removeAttribute('style'); if (!root.className) root.removeAttribute('class');
  var liveHead = document.head.children, cloneHead = root.querySelector('head');
  for (var i = liveHead.length - 1; i >= 0; i--) if (headKeep.indexOf(liveHead[i]) < 0) cloneHead.children[i].remove();
  var body = root.querySelector('body');
  Array.prototype.slice.call(body.children).forEach(function (n) { if (['ardoise-doc', 'app', 'ardoise-geo', 'ardoise-app'].indexOf(n.id) < 0) n.remove(); });
  Array.prototype.slice.call(body.attributes).forEach(function (a) { body.removeAttribute(a.name); });
  root.querySelector('title').textContent = sealedFile ? 'Document protégé' : docTitle();
  root.querySelector('#ardoise-doc').textContent = stored.replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, function (c) { return c === '\u2028' ? '\\u2028' : '\\u2029'; });
  root.querySelector('#app').innerHTML = sealedFile ? '<div class="wrap"><p>Document chiffré : ouvrez ce fichier dans un navigateur et saisissez le mot de passe.</p></div>' : navHTML(doc, false, false) + renderPage(doc, false);
  return '<!doctype html>\n' + root.outerHTML;
}
// Poignées de fichier conservées par document (IndexedDB), pour l'auto-save après réouverture
function idb(fn) {
  return new Promise(function (res) {
    try {
      var rq = indexedDB.open('ardoise', 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore('handles'); };
      rq.onsuccess = function () { try { fn(rq.result, res); } catch (e) { res(null); } };
      rq.onerror = function () { res(null); };
    } catch (e) { res(null); }
  });
}
function getHandle() { return idb(function (db, res) { var r = db.transaction('handles').objectStore('handles').get(doc.id); r.onsuccess = function () { res(r.result || null); }; r.onerror = function () { res(null); }; }); }
function putHandle(h) { return idb(function (db, res) { var tx = db.transaction('handles', 'readwrite'); tx.objectStore('handles').put(h, doc.id); tx.oncomplete = function () { res(true); }; tx.onerror = function () { res(false); }; }); }
function perm(h, ask) {
  var o = { mode: 'readwrite' };
  return Promise.resolve(h.queryPermission ? h.queryPermission(o) : 'granted').then(function (p) {
    if (p === 'granted') return true;
    if (!ask || !h.requestPermission) return false;
    return h.requestPermission(o).then(function (q) { return q === 'granted'; });
  }).catch(function () { return false; });
}
function writeTo(h, html) { return h.createWritable().then(function (w) { return w.write(html).then(function () { return w.close(); }); }); }
function afterSave(where) {
  dirty = false; saving = false;
  try { localStorage.removeItem(LS + 'draft:' + doc.id); } catch (_) {}
  hideBanner();
  if (mode === 'view') renderChrome(); else setStatus();
  if (where) toast(where);
}
function saveFailed(e) { saving = false; setStatus(); toast('Enregistrement impossible : ' + (e && e.message || e), 5000); }
function save(as) {
  if (!doc) return Promise.resolve();
  if (htimer) snapshot();
  clearTimeout(saveTimer);
  var dl = function () { return serializeFile().then(function (html) { download(html, fileName()); afterSave('Téléchargé : remplacez l’ancien fichier par celui-ci'); }); };
  if (window.showSaveFilePicker && !downloadMode) {
    var chain = as ? Promise.resolve(null) : Promise.resolve(fileHandle);
    saving = true; setStatus();
    return chain.then(function (h) {
      if (h) return perm(h, true).then(function (ok) { return ok ? h : pickNew(); });
      return pickNew();
    }).then(function (h) {
      if (!h) { saving = false; setStatus(); return; }
      fileHandle = h; handleGranted = true;
      return serializeFile().then(function (html) { return writeTo(h, html); }).then(function () { putHandle(h); afterSave('Enregistré dans ' + h.name + (autosaveOn ? ' · auto-save actif' : '')); }, saveFailed);
    }).catch(function (err) {
      saving = false;
      if (err && err.name === 'AbortError') { setStatus(); return; }
      downloadMode = true; return dl().catch(saveFailed);
    });
  }
  return dl().catch(saveFailed);
}
function pickNew() {
  return window.showSaveFilePicker({ suggestedName: fileHandle ? fileHandle.name : fileName(), types: [{ description: 'Page HTML', accept: { 'text/html': ['.html', '.htm'] } }] });
}
function autoSave() {
  if (!dirty || !autosaveOn || !fileHandle || saving) return;
  perm(fileHandle, false).then(function (ok) {
    handleGranted = ok;
    if (!ok) { setStatus(); return; }
    if (htimer) snapshot();
    saving = true; setStatus();
    serializeFile().then(function (html) { return writeTo(fileHandle, html).then(function () { afterSave(); }, function () { saving = false; handleGranted = false; setStatus(); }); }, saveFailed);
  });
}
function download(text, name) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/html' })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function saveDraft() { if (!dirty || !doc) return; if (isSealed()) { forgetDraft(); return; } try { localStorage.setItem(LS + 'draft:' + doc.id, JSON.stringify({ t: Date.now(), json: JSON.stringify(doc) })); } catch (_) {} }
var bannerEl = null;
function hideBanner() { if (bannerEl) { bannerEl.remove(); bannerEl = null; } }
function checkDraft() {
  if (isSealed()) { forgetDraft(); return; }
  var d; try { d = JSON.parse(localStorage.getItem(LS + 'draft:' + doc.id) || 'null'); } catch (_) { d = null; }
  if (!d) return;
  var savedT = doc.savedAt ? Date.parse(doc.savedAt) : 0;
  if (d.t <= savedT || d.json === JSON.stringify(doc)) { try { localStorage.removeItem(LS + 'draft:' + doc.id); } catch (_) {} return; }
  bannerEl = document.createElement('div'); bannerEl.className = 'banner';
  bannerEl.innerHTML = '<span>Des modifications non enregistrées du <b>' + esc(new Date(d.t).toLocaleString('fr-FR')) + '</b> ont été retrouvées dans ce navigateur.</span>' +
    '<button class="ub primary" data-d="1">Restaurer</button><button class="ub out" data-d="0">Ignorer</button>';
  bannerEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-d]'); if (!b) return;
    if (b.dataset.d === '1') { var nd = normalize(JSON.parse(d.json)); if (nd) { doc = nd; render(); snapshot(); markDirty(true); toast('Brouillon restauré · pensez à enregistrer'); } }
    else { try { localStorage.removeItem(LS + 'draft:' + doc.id); } catch (_) {} }
    hideBanner();
  });
  ui.appendChild(bannerEl);
}
window.addEventListener('beforeunload', function (e) {
  if (dirty) { saveDraft(); e.preventDefault(); e.returnValue = ''; }
});

