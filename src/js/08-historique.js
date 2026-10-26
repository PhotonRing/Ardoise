/* ---------- Historique (annuler / rétablir) ---------- */
var hist = [], hpos = -1, htimer = null;
function snapshot() {
  clearTimeout(htimer); htimer = null;
  var s = JSON.stringify(doc);
  if (hist[hpos] === s) return;
  hist = hist.slice(0, hpos + 1); hist.push(s);
  if (hist.length > 300) hist.shift();
  hpos = hist.length - 1; updateUndo();
}
function restoreHist(json) { var c = doc.cur; doc = attach(JSON.parse(json)); doc.cur = Math.min(c, doc.pages.length - 1); }
function undo() { if (htimer) snapshot(); if (hpos > 0) { hpos--; restoreHist(hist[hpos]); render(); markDirty(true); } updateUndo(); }
function redo() { if (hpos < hist.length - 1) { hpos++; restoreHist(hist[hpos]); render(); markDirty(true); } updateUndo(); }
function updateUndo() { var u = $('#ui [data-ui=undo]'), r = $('#ui [data-ui=redo]'); if (u) u.disabled = hpos <= 0; if (r) r.disabled = hpos >= hist.length - 1; }
function change(fn, focus) { fn(); snapshot(); render(focus); markDirty(true); }

