/* ---------- Historique (annuler / rétablir) ---------- */
var hist = [], hpos = -1, htimer = null, histMarks = [];   // histMarks : repère des modifications reçues (synchronisation)
function snapshot() {
  clearTimeout(htimer); htimer = null;
  var s = JSON.stringify(doc);
  if (hist[hpos] === s) return;
  hist = hist.slice(0, hpos + 1); hist.push(s); histMarks = histMarks.slice(0, hpos + 1); histMarks.push(synHistMark());
  if (hist.length > 300) { hist.shift(); histMarks.shift(); synTrim(histMarks[0]); }
  hpos = hist.length - 1; updateUndo();
  synLocal();   // synchronisation : la modification part vers les autres copies
}
function restoreHist(json, mark) { var c = doc.cur, old = doc; doc = attach(JSON.parse(synRebase(json, mark))); synKeep(old, doc); doc.cur = Math.min(c, doc.pages.length - 1); }
function settleInput() {
  // termine la saisie en cours avant de redessiner : un clavier Android (même physique) compose le mot
  // en cours et le réinjecterait dans le champ recréé, d'où une ligne en double
  var a = document.activeElement;
  if (!a || !app.contains(a) || !(a.isContentEditable || a.tagName === 'TEXTAREA')) return null;
  var f = { b: a.dataset.b, k: a.dataset.k }; a.blur();
  return f.b ? f : null;
}
function histGo(d) {
  var f = settleInput();
  if (htimer) snapshot();
  var to = hpos + d;
  if (to >= 0 && to < hist.length) { hpos = to; restoreHist(hist[hpos], histMarks[hpos]); synLocal(); render(f && byId(f.b) ? f : null); markDirty(true); }
  updateUndo();
}
function undo() { histGo(-1); }
function redo() { histGo(1); }
function updateUndo() { var u = $('#ui [data-ui=undo]'), r = $('#ui [data-ui=redo]'); if (u) u.disabled = hpos <= 0; if (r) r.disabled = hpos >= hist.length - 1; }
function change(fn, focus) { fn(); snapshot(); render(focus); markDirty(true); }

