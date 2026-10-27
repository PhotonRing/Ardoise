/* ---------- Interface (barre, menus, barre de mise en forme) ---------- */
var ui = document.createElement('div'); ui.id = 'ui'; ui.setAttribute('data-ephemeral', ''); document.body.appendChild(ui);
var chrome = document.createElement('div'); ui.appendChild(chrome);
var pop = null, popClose = null;
function renderChrome() {
  if (mode === 'edit') {
    chrome.innerHTML = '<div class="tb" role="toolbar">' +
      '<span class="logo"><i></i><span class="lbl">Ardoise</span></span><span class="doc-name">' + esc(curTitle()) + '</span><span class="grow"></span>' +
      '<button class="ub" data-ui="undo" title="Annuler (Ctrl+Z)">↶</button><button class="ub" data-ui="redo" title="Rétablir (Ctrl+Maj+Z)">↷</button><span class="vsep"></span>' +
      '<button class="ub" data-ui="add" title="Insérer un bloc">+ <span class="lbl">Bloc</span></button>' +
      '<button class="ub" data-ui="style" title="Couleurs, typographie, largeur, thème">◐ <span class="lbl">Style</span></button>' +
      '<button class="ub" data-ui="file" title="Fichier">☰ <span class="lbl">Fichier</span></button><span class="vsep"></span>' +
      '<span class="st" id="st"><i></i><span></span></span>' +
      '<button class="ub out" data-ui="mode" title="Lecture (Ctrl+E)">◉ <span class="lbl">Lecture</span></button>' +
      '<button class="ub primary" data-ui="save" title="Enregistrer (Ctrl+S)"><span class="lbl">Enregistrer</span><span class="lbl" style="display:none">⤓</span></button></div>';
  } else {
    chrome.innerHTML = '<div class="fab' + (dirty ? ' dirty' : '') + '"><span class="st" id="st"><i></i><span></span></span>' +
      (dirty ? '<button class="ub" data-ui="save" title="Enregistrer (Ctrl+S)">Enregistrer</button>' : '') +
      '<button class="ub primary" data-ui="mode" title="Modifier (Ctrl+E)">' + (doc.lock && !unlocked ? '🔒 Modifier' : '✎ Modifier') + '</button></div>';
  }
  updateUndo(); setStatus();
}
ui.addEventListener('click', function (e) {
  var a = e.target.closest('[data-ui]'); if (!a) return;
  var k = a.dataset.ui;
  if (k === 'undo') undo();
  else if (k === 'redo') redo();
  else if (k === 'mode') toggleMode();
  else if (k === 'save') save(false);
  else if (k === 'add') {
    var f = document.activeElement && document.activeElement.closest && document.activeElement.closest('.blk');
    var b = f ? byId(f.dataset.id) : null;
    openBlockMenu(a, function (t) { var nb = insertAfter(b, t); if (t === 'image') pickImage(nb); });
  }
  else if (k === 'style') openStyle(a);
  else if (k === 'file') openFile(a);
});

function closePop() { if (pop) { pop.remove(); pop = null; var c = popClose; popClose = null; if (c) c(); } }
function placePop(p, anchor) {
  var r = anchor.getBoundingClientRect(); ui.appendChild(p);
  var w = p.offsetWidth, h = p.offsetHeight;
  var left = Math.min(Math.max(8, r.left), innerWidth - w - 8);
  var top = r.bottom + 6; if (top + h > innerHeight - 8 && r.top - h - 6 > 8) top = r.top - h - 6;
  p.style.left = left + 'px'; p.style.top = Math.max(8, top) + 'px';
}
document.addEventListener('mousedown', function (e) { if (pop && !pop.contains(e.target) && !e.target.closest('[data-ui],[data-act=add-after],[data-act=add-end]')) closePop(); });
var norm = function (s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
function openBlockMenu(anchor, onPick, onCancel) {
  closePop();
  var p = document.createElement('div'); p.className = 'pop'; pop = p; popClose = null;
  p.innerHTML = '<input class="menu-q" placeholder="Rechercher un bloc…" aria-label="Rechercher un bloc"><div class="menu-list"></div>';
  var q = $('.menu-q', p), list = $('.menu-list', p), cur = 0, shown = [];
  function draw() {
    var s = norm(q.value.trim());
    shown = ORDER.filter(function (t) { return !s || norm(T[t].label + ' ' + T[t].kw + ' ' + T[t].desc).indexOf(s) >= 0; });
    cur = Math.min(cur, Math.max(0, shown.length - 1));
    list.innerHTML = shown.length ? shown.map(function (t, i) {
      return '<button class="mi' + (i === cur ? ' act' : '') + '" data-t="' + t + '" type="button"><span class="ic">' + T[t].ic + '</span><span>' + T[t].label + '<small>' + T[t].desc + '</small></span></button>';
    }).join('') : '<div class="menu-empty">Aucun bloc</div>';
  }
  function pick(t) { popClose = null; closePop(); onPick(t); }
  q.addEventListener('input', function () { cur = 0; draw(); });
  q.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); cur = Math.min(shown.length - 1, cur + 1); draw(); scrollAct(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cur = Math.max(0, cur - 1); draw(); scrollAct(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[cur]) pick(shown[cur]); }
    else if (e.key === 'Escape') { e.preventDefault(); closePop(); }
    else if (e.key === 'Backspace' && !q.value) { e.preventDefault(); closePop(); }
  });
  function scrollAct() { var a = $('.mi.act', list); if (a) a.scrollIntoView({ block: 'nearest' }); }
  list.addEventListener('click', function (e) { var m = e.target.closest('.mi'); if (m) pick(m.dataset.t); });
  draw(); placePop(p, anchor); q.focus();
  popClose = onCancel || null;
}
function seg(name, cur, opts) {
  return '<div class="seg">' + opts.map(function (o) { return '<button type="button" data-set="' + name + '" data-v="' + o[0] + '" aria-pressed="' + (String(cur) === String(o[0])) + '">' + o[1] + '</button>'; }).join('') + '</div>';
}
var PALETTES = [['ambre', '#b4540a', 'Ambre'], ['petrole', '#0b6e8a', 'Pétrole'], ['indigo', '#4848c0', 'Indigo'], ['rubis', '#b4233c', 'Rubis'], ['foret', '#2f6f3e', 'Forêt'], ['graphite', '#3d5466', 'Graphite']];
function openStyle(anchor) {
  closePop();
  var p = document.createElement('div'); p.className = 'pop'; pop = p;
  function draw() {
    p.innerHTML = '<h4>Couleur d’accent</h4><div class="sw">' + PALETTES.map(function (x) { return '<button type="button" data-set="palette" data-v="' + x[0] + '" title="' + x[2] + '" style="background:' + x[1] + '" aria-pressed="' + (doc.palette === x[0]) + '"></button>'; }).join('') + '</div>' +
      '<h4>Typographie</h4>' + seg('typo', doc.typo, [['display', 'Affiche (runbook)'], ['sobre', 'Sobre (fiche outil)']]) +
      '<h4>Largeur</h4>' + seg('width', doc.width, [[720, 'Étroite'], [820, 'Normale'], [960, 'Large'], [1200, 'Très large']]) +
      '<h4>Thème</h4>' + seg('theme', doc.theme, [['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']]) +
      '<h4>Navigation entre pages</h4>' + seg('nav', doc.nav || 'auto', [['auto', 'Auto'], ['tabs', 'Onglets'], ['side', 'Sommaire']]) +
      '<div class="hr"></div><h4>Enregistrement automatique</h4>' + seg('autosave', autosaveOn ? 1 : 0, [[1, 'Activé'], [0, 'Désactivé']]) +
      '<div class="hr"></div><h4>Cartes : fond « Plan »</h4><div style="padding:0 8px 8px;display:flex;flex-direction:column;gap:6px;max-width:300px">' +
      '<input class="menu-q" data-mapkey placeholder="Clé CARTO (optionnelle)" value="' + esc(doc.mapKey || '') + '" spellcheck="false" autocomplete="off">' +
      '<span class="muted" style="font-size:12px;line-height:1.4">Sans clé : plan Esri. Avec une clé CARTO gratuite (carto.com/basemaps/apikey) : plan CARTO. La clé est enregistrée dans le fichier.</span></div>';
  }
  p.addEventListener('change', function (e) {
    if (!e.target.matches('[data-mapkey]')) return;
    var v = e.target.value.trim();
    $$('.map[data-mapid]', app).forEach(function (el) { var b = byId(el.dataset.mapid), m = mapOf(el.dataset.mapid); if (b && m && mode === 'edit') b.view = m.getView(); });
    change(function () { if (v) doc.mapKey = v; else delete doc.mapKey; });
    toast(v ? 'Clé CARTO enregistrée : le fond Plan utilise CARTO' : 'Clé retirée : le fond Plan utilise Esri');
  });
  p.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.matches('[data-mapkey]')) e.target.blur(); });
  p.addEventListener('click', function (e) {
    var b = e.target.closest('[data-set]'); if (!b) return;
    var k = b.dataset.set, v = b.dataset.v;
    if (k === 'autosave') { autosaveOn = v === '1'; try { localStorage.setItem(LS + 'autosave', autosaveOn ? '1' : '0'); } catch (_) {} setStatus(); draw(); return; }
    change(function () { doc[k] = k === 'width' ? +v : v; }); draw();
  });
  draw(); placePop(p, anchor);
}
function openFile(anchor) {
  closePop();
  var p = document.createElement('div'); p.className = 'pop'; pop = p;
  var fsa = !!window.showSaveFilePicker;
  p.innerHTML = '<h4>Nouveau document</h4>' +
    mi('new-vide', '□', 'Page vierge') + mi('new-runbook', '1.', 'Modèle procédure / runbook', 'Prérequis, étapes, vérification, retour arrière') +
    mi('new-outil', '{}', 'Modèle fiche outil / script', 'Utilisation, procédure, code complet') + mi('new-tour', '?', 'Visite guidée', 'Démonstration de tous les blocs') +
    '<div class="hr"></div>' +
    mi('save', '⤓', 'Enregistrer', fsa ? (fileHandle ? 'Dans ' + fileHandle.name : 'Choisir le fichier une fois, puis auto-save') : 'Télécharge le fichier à jour', 'Ctrl+S') +
    mi('saveas', '⧉', 'Enregistrer sous…', 'Nouvel emplacement ou copie') +
    mi('export', '◉', 'Exporter en page statique', 'Lecture seule, sans éditeur') +
    mi('print', '⎙', 'Imprimer / PDF') +
    '<div class="hr"></div>' +
    mi('json-copy', '{ }', 'Copier le JSON', 'Pour le faire modifier par une IA') + mi('json-import', '⇥', 'Importer du JSON…', 'Remplace le contenu de la page') +
    '<div class="hr"></div>' +
    (doc.lock ? mi('pw-set', '🔒', 'Changer le mot de passe', isSealed() ? 'Édition protégée · contenu chiffré' : 'L’édition est protégée') +
                (isSealed() ? mi('pw-unseal', '🔓', 'Ne plus chiffrer le contenu', 'Le document redevient lisible sans mot de passe') : mi('pw-seal', '🔐', 'Chiffrer le contenu…', 'Mot de passe demandé pour ouvrir le document')) +
                mi('pw-lock', '⏻', 'Verrouiller maintenant', 'Repasse en lecture') + mi('pw-del', '✕', 'Retirer la protection')
              : mi('pw-set', '🔒', 'Protéger par mot de passe…', 'Édition protégée, contenu chiffré en option')) +
    mi('help', '⌨', 'Raccourcis clavier');
  function mi(k, ic, label, sub, kbd) { return '<button class="mi" type="button" data-f="' + k + '"><span class="ic">' + ic + '</span><span>' + label + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' + (kbd ? '<kbd>' + kbd + '</kbd>' : '') + '</button>'; }
  p.addEventListener('click', function (e) {
    var b = e.target.closest('[data-f]'); if (!b) return; var k = b.dataset.f; closePop();
    if (k.indexOf('new-') === 0) newDoc(k.slice(4));
    else if (k === 'save') save(false);
    else if (k === 'saveas') save(true);
    else if (k === 'export') exportStatic();
    else if (k === 'print') printPage();
    else if (k === 'json-copy') copyJSON();
    else if (k === 'json-import') importJSON();
    else if (k === 'help') showHelp();
    else if (k === 'pw-set') setPassword();
    else if (k === 'pw-del') removePassword();
    else if (k === 'pw-seal') sealExisting();
    else if (k === 'pw-unseal') unsealExisting();
    else if (k === 'pw-lock') lockNow();
  });
  placePop(p, anchor);
}

/* Barre de mise en forme du texte sélectionné */
var itb = document.createElement('div'); itb.className = 'itb'; itb.style.display = 'none';
itb.innerHTML = '<button data-i="bold" title="Gras (Ctrl+B)"><b>G</b></button><button data-i="italic" title="Italique (Ctrl+I)"><i>I</i></button>' +
  '<button data-i="code" title="Code (Ctrl+J)" style="font-family:var(--f-mono)!important">&lt;/&gt;</button><button data-i="link" title="Lien (Ctrl+K)">Lien</button><span class="vsep"></span>' +
  '<button data-i="p-ok" title="Pastille verte"><span class="dot" style="background:#5fd09a"></span></button><button data-i="p-bad" title="Pastille rouge"><span class="dot" style="background:#ff8a80"></span></button>' +
  '<button data-i="p-warn" title="Pastille orange"><span class="dot" style="background:#f2c35b"></span></button><button data-i="p-info" title="Pastille bleue"><span class="dot" style="background:#8cc3f2"></span></button>' +
  '<button data-i="alert" title="Texte rouge" style="color:#ff8a80!important">A</button><span class="vsep"></span><button data-i="clear" title="Effacer la mise en forme">⌫</button>';
ui.appendChild(itb);
itb.addEventListener('mousedown', function (e) { e.preventDefault(); });
itb.addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (b) inlineAction(b.dataset.i); });
document.addEventListener('selectionchange', function () {
  if (mode !== 'edit') { itb.style.display = 'none'; return; }
  var s = getSelection();
  if (!s.rangeCount || s.isCollapsed) { itb.style.display = 'none'; return; }
  var f = fieldOf(s.anchorNode);
  if (!f || !f.hasAttribute('data-rich') || f !== fieldOf(s.focusNode)) { itb.style.display = 'none'; return; }
  var r = s.getRangeAt(0).getBoundingClientRect(); if (!r.width && !r.height) { itb.style.display = 'none'; return; }
  itb.style.display = 'flex';
  var w = itb.offsetWidth, top = r.top - 42; if (top < 58) top = r.bottom + 8;
  itb.style.left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8) + 'px'; itb.style.top = top + 'px';
});
function fieldOf(n) { while (n && n !== app) { if (n.nodeType === 1 && n.classList.contains('fld')) return n; n = n.parentNode; } return null; }
function unwrap(el) { var p = el.parentNode; while (el.firstChild) p.insertBefore(el.firstChild, el); p.removeChild(el); }
function inlineAction(kind) {
  var s = getSelection(); if (!s.rangeCount) return;
  var r = s.getRangeAt(0), fld = fieldOf(r.commonAncestorContainer); if (!fld) return;
  if (kind === 'bold' || kind === 'italic') { document.execCommand(kind); fire(fld); return; }
  function ancestor(test) { var n = r.commonAncestorContainer; if (n.nodeType !== 1) n = n.parentNode; while (n && n !== fld) { if (test(n)) return n; n = n.parentNode; } return null; }
  if (kind === 'clear') {
    var a; while ((a = ancestor(function (n) { return /^(B|I|U|S|CODE|A|SPAN|STRONG|EM)$/.test(n.tagName); }))) unwrap(a);
    var txt = r.toString(); r.deleteContents(); var tn = document.createTextNode(txt); r.insertNode(tn);
    s.removeAllRanges(); var nr = document.createRange(); nr.selectNode(tn); s.addRange(nr); fire(fld); return;
  }
  var tag = 'span', cls = '';
  if (kind === 'code') tag = 'code';
  else if (kind === 'link') tag = 'a';
  else if (kind === 'alert') cls = 'alert';
  else cls = 'pill ' + kind;
  var existing = ancestor(function (n) {
    if (tag === 'code') return n.tagName === 'CODE';
    if (tag === 'a') return n.tagName === 'A';
    if (kind === 'alert') return n.tagName === 'SPAN' && n.classList.contains('alert');
    return n.tagName === 'SPAN' && n.classList.contains('pill');
  });
  if (existing) {
    if (cls.indexOf('pill') === 0 && !existing.classList.contains(kind)) existing.className = cls; else unwrap(existing);
    fire(fld); return;
  }
  if (s.isCollapsed) return;
  var href = null;
  if (tag === 'a') { href = prompt('Adresse du lien :', 'https://'); if (!href || href === 'https://') return; if (!/^(https?:|mailto:|#)/i.test(href)) href = 'https://' + href; }
  var el = document.createElement(tag); if (cls) el.className = cls; if (href) el.setAttribute('href', href);
  el.appendChild(r.extractContents());
  $$(tag === 'span' ? 'span.pill,span.alert' : tag, el).forEach(unwrap);
  r.insertNode(el);
  s.removeAllRanges(); var nr2 = document.createRange(); nr2.selectNodeContents(el); s.addRange(nr2);
  fire(fld);
}
function fire(fld) { fld.dispatchEvent(new Event('input', { bubbles: true })); }

