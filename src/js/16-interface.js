/* ---------- Interface (barre, menus, barre de mise en forme) ---------- */
var ui = document.createElement('div'); ui.id = 'ui'; ui.setAttribute('data-ephemeral', ''); document.body.appendChild(ui);
var chrome = document.createElement('div'); ui.appendChild(chrome);
var pop = null, popClose = null;
// icône d'Ardoise : le favicon embarqué (src/assets/ardoise.svg), repris dans la barre et teinté selon la couleur d'accent
var faviconEl = $('link[rel=icon]');
var LOGO_SRC = (function () { try { return decodeURIComponent(faviconEl.getAttribute('href').replace(/^data:image\/svg\+xml,/, '')); } catch (_) { return ''; } })();
var LOGO_SVG = /^<svg/.test(LOGO_SRC) ? LOGO_SRC.replace(/^<svg/, '<svg aria-hidden="true" focusable="false"') : '';
function paintFavicon() {
  if (!faviconEl || !LOGO_SVG) return;
  var c = (PALETTES.filter(function (x) { return x[0] === doc.palette; })[0] || PALETTES[0])[1];
  var href = 'data:image/svg+xml,' + encodeURIComponent(LOGO_SRC.replace(/(class="bg"[^>]*?fill=")[^"]*/, '$1' + c));
  if (faviconEl.getAttribute('href') !== href) faviconEl.setAttribute('href', href);
}
function renderChrome() {
  if (mode === 'edit') {
    chrome.innerHTML = '<div class="tb" role="toolbar">' +
      '<span class="logo">' + LOGO_SVG + '<span class="lbl">Ardoise</span></span><span class="doc-name">' + esc(curTitle()) + '</span><span class="grow"></span>' +
      '<button class="ub wide" data-ui="undo" title="Annuler (Ctrl+Z)">↶</button><button class="ub wide" data-ui="redo" title="Rétablir (Ctrl+Maj+Z)">↷</button><span class="vsep wide"></span>' +
      '<button class="ub wide" data-ui="add" title="Insérer un bloc">+ <span class="lbl">Bloc</span></button>' +
      '<button class="ub wide" data-ui="style" title="Couleurs, typographie, largeur, thème">◐ <span class="lbl">Style</span></button>' +
      '<button class="ub wide" data-ui="file" title="Fichier">☰ <span class="lbl">Fichier</span></button><span class="vsep wide"></span>' +
      '<span class="syn" hidden></span><span class="st" id="st"><i></i><span></span></span>' +
      '<button class="ub out wide" data-ui="mode" title="Lecture (Ctrl+E)">◉ <span class="lbl">Lecture</span></button>' +
      '<button class="ub primary wide" data-ui="save" title="Enregistrer (Ctrl+S)"><span class="lbl">Enregistrer</span><span class="ic-seul">⤓</span></button>' +
      '<button class="ub burger" data-ui="burger" title="Menu" aria-label="Menu" aria-haspopup="dialog">☰</button></div>';
  } else {
    chrome.innerHTML = '<div class="fab' + (dirty ? ' dirty' : '') + '"><span class="syn" hidden></span><span class="st" id="st"><i></i><span></span></span>' +
      (dirty ? '<button class="ub wide" data-ui="save" title="Enregistrer (Ctrl+S)"><span class="lbl">Enregistrer</span><span class="ic-seul">⤓</span></button>' : '') +
      '<button class="ub wide" data-ui="print" title="Imprimer ou enregistrer en PDF">⎙ <span class="lbl">PDF</span></button>' +
      '<button class="ub wide" data-ui="vmenu" title="Autres actions de lecture" aria-label="Autres actions de lecture">⋯</button>' +
      '<button class="ub primary wide" data-ui="mode" title="Modifier (Ctrl+E)">' + (doc.lock && !unlocked ? '🔒' : '✎') + ' <span class="lbl">Modifier</span>' + '</button>' +
      '<button class="ub burger" data-ui="burger" title="Menu" aria-label="Menu" aria-haspopup="dialog">☰</button></div>';
  }
  updateUndo(); setStatus(); synPaint();
}
ui.addEventListener('click', function (e) {
  var a = e.target.closest('[data-ui]'); if (!a) return;
  var k = a.dataset.ui;
  if (k === 'sync') synDialog();
  else if (k === 'undo') undo();
  else if (k === 'redo') redo();
  else if (k === 'mode') toggleMode();
  else if (k === 'save') save(false);
  else if (k === 'add') {
    var f = document.activeElement && document.activeElement.closest && document.activeElement.closest('.blk');
    var b = f ? byId(f.dataset.id) : null;
    openBlockMenu(a, function (t) { var nb = insertAfter(b, t); if (t === 'image') pickImage(nb); }, null, dansUnGroupe(b));
  }
  else if (k === 'print') printPage();
  else if (k === 'vmenu') openViewMenu(a);
  else if (k === 'style') openStyle(a);
  else if (k === 'file') openFile(a);
  else if (k === 'burger') openSheet();
});
/* Menu plein écran (petits écrans) : la barre ne garde que l'état de la synchronisation et de l'enregistrement ;
   tout le reste est ici, en grands boutons, puis les menus Fichier (édition) ou Lecture */
var sheet = null;
function closeSheet() { if (sheet) { sheet.remove(); sheet = null; document.documentElement.classList.remove('sheet-on'); } }
function openSheet() {
  closePop(); closeSheet();
  var ed = mode === 'edit', stEl = $('#st'), stTxt = stEl ? stEl.title : '';
  var big = function (k, ic, label, extra, sub) { return '<button type="button" class="sh-big' + (extra || '') + '" data-sh="' + k + '"><span class="ic">' + ic + '</span><span class="sh-l"><span class="sh-n">' + label + '</span>' + (sub ? '<small class="sub"></small>' : '') + '</span></button>'; };
  var lockEd = doc.lock && !unlocked;
  sheet = document.createElement('div'); sheet.className = 'sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Menu');
  sheet.innerHTML = '<div class="sh-h"><span class="logo">' + LOGO_SVG + '</span><span class="sh-t">' + esc(curTitle()) + '</span><button type="button" class="sh-x" data-sh="close" aria-label="Fermer le menu">×</button></div>' +
    '<div class="sh-st"><span class="syn"></span><span class="st ' + (stEl ? stEl.className.replace(/\bst\b/, '') : '') + '"><i></i><span>' + esc(stTxt) + '</span></span></div>' +
    '<div class="sh-grid">' + (ed
      ? big('save', '⤓', 'Enregistrer', ' primary') + big('mode', '◉', 'Lecture') + big('undo', '↶', 'Annuler', '', true) + big('redo', '↷', 'Rétablir', '', true) + big('add', '+', 'Ajouter un bloc') + big('style', '◐', 'Style')
      : big('mode', lockEd ? '🔒' : '✎', 'Modifier', ' primary') + (dirty ? big('save', '⤓', 'Enregistrer') : '')) + '</div>' +
    '<div class="sh-list">' + (ed ? fileMenuHTML() : viewMenuHTML()) + '</div>';
  ui.appendChild(sheet); document.documentElement.classList.add('sheet-on');
  synPaint(); updateUndo();
  sheet.addEventListener('click', function (e) {
    var t = e.target.closest('[data-sh],[data-f],[data-vm],[data-ui]'); if (!t) return;
    if (t.dataset.f) { closeSheet(); fileMenuAct(t.dataset.f); return; }
    if (t.dataset.vm) { closeSheet(); viewMenuAct(t.dataset.vm); return; }
    if (t.dataset.ui === 'sync') { closeSheet(); return; }   // la fenêtre de synchronisation s'ouvre par le gestionnaire de la barre
    var k = t.dataset.sh, anchor = $('.burger', chrome);
    if (k === 'undo' || k === 'redo') { if (k === 'undo') undo(); else redo(); return; }   // le menu reste ouvert pour enchaîner (boutons repeints par updateUndo)
    closeSheet();
    if (k === 'save') save(false);
    else if (k === 'mode') toggleMode();
    else if (k === 'add') { var f = document.activeElement && document.activeElement.closest && document.activeElement.closest('.blk'); var b = f ? byId(f.dataset.id) : null; openBlockMenu(anchor, function (ty) { var nb = insertAfter(b, ty); if (ty === 'image') pickImage(nb); }, null, dansUnGroupe(b)); }
    else if (k === 'style') openStyle(anchor);
  });
  var x = $('.sh-x', sheet); if (x) x.focus({ preventScroll: true });
}
document.addEventListener('keydown', function (e) { if (sheet && e.key === 'Escape') { e.preventDefault(); closeSheet(); } }, true);
window.addEventListener('resize', function () { if (sheet && innerWidth > 760) closeSheet(); });

function closePop() { if (pop) { pop.remove(); pop = null; var c = popClose; popClose = null; if (c) c(); } }
// point { x, y } facultatif : le menu s'ouvre à ce point (clic droit) plutôt que sous l'ancre
function placePop(p, anchor, point) {
  var r = anchor.getBoundingClientRect(); if (point) r = { left: point.x, top: point.y, bottom: point.y };
  if (p.parentNode !== ui) ui.appendChild(p);   // déjà là (fenêtre d'une puce replacée) : pas déplacé, son défilement reste
  p.ancre = anchor;   // ancre : un clic dans un popup ouvert depuis une carte reste sur la carte
  var w = p.offsetWidth, h = p.offsetHeight;
  var left = Math.min(Math.max(8, r.left), innerWidth - w - 8);
  var top = r.bottom + 6; if (top + h > innerHeight - 8 && r.top - h - 6 > 8) top = r.top - h - 6;
  p.style.left = left + 'px'; p.style.top = Math.max(8, top) + 'px';
}
document.addEventListener('mousedown', function (e) { if (pop && !pop.contains(e.target) && !e.target.closest('[data-ui],[data-act=add-after],[data-act=add-end],[data-qpuce]')) closePop(); });   // puce : son clic ouvre ou ferme sa fenêtre
var norm = function (s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
// bloc d'un groupe de la page affichée : son menu d'insertion ne propose pas les types refusés dans un groupe
function dansUnGroupe(b) { var o = position(b); return !!(o && o.parent); }
function openBlockMenu(anchor, onPick, onCancel, dansGroupe) {
  closePop();
  var p = document.createElement('div'); p.className = 'pop'; pop = p; popClose = null;
  p.innerHTML = '<input class="menu-q" placeholder="Rechercher un bloc…" aria-label="Rechercher un bloc"><div class="menu-list"></div>';
  var q = $('.menu-q', p), list = $('.menu-list', p), cur = 0, shown = [];
  function draw() {
    var s = norm(q.value.trim());
    var rank = function (t) { var l = norm(T[t].label); return l === s ? -1 : l.indexOf(s) === 0 ? 0 : l.indexOf(s) > 0 ? 1 : 2; };
    shown = ORDER.filter(function (t) { return !(dansGroupe && HORS_GROUPE[t]) && (!s || norm(T[t].label + ' ' + T[t].kw + ' ' + T[t].desc).indexOf(s) >= 0); });
    if (s) shown = shown.map(function (t, i) { return { t: t, r: rank(t), i: i }; }).sort(function (a, b) { return a.r - b.r || a.i - b.i; }).map(function (x) { return x.t; });
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
      '<h4>Typographie</h4>' + seg('typo', doc.typo, [['display', 'Affiche'], ['sobre', 'Sobre']]) +
      '<h4>Largeur</h4>' + seg('width', doc.width, [[720, 'Étroite'], [820, 'Normale'], [960, 'Large'], [1200, 'Très large']]) +
      '<h4>Thème</h4>' + seg('theme', doc.theme, [['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']]) +
      '<h4>Navigation entre pages</h4>' + seg('nav', doc.nav || 'auto', [['auto', 'Auto'], ['tabs', 'Onglets'], ['side', 'Sommaire']]) +
      (mode === 'edit' ? '<div class="hr"></div><h4>Pastilles</h4><div style="padding:0 8px 8px"><button type="button" class="ub out" data-tagswin>Pastilles du document…</button></div>' : '') +
      '<div class="hr"></div><h4>Enregistrement automatique</h4>' + seg('autosave', autosaveOn ? 1 : 0, [[1, 'Activé'], [0, 'Désactivé']]) +
      '<div class="hr"></div><h4>Cartes : fond « Plan »</h4><div style="padding:0 8px 8px;display:flex;flex-direction:column;gap:6px;max-width:300px">' +
      '<input class="menu-q" data-mapkey placeholder="Clé CARTO (optionnelle)" value="' + esc(doc.mapKey || '') + '" spellcheck="false" autocomplete="off">' +
      '<span class="muted" style="font-size:12px;line-height:1.4">Sans clé : plan Esri. Avec une clé CARTO gratuite (carto.com/basemaps/apikey) : plan CARTO. La clé est enregistrée dans le fichier.</span></div>';
  }
  p.addEventListener('change', function (e) {
    if (!e.target.matches('[data-mapkey]')) return;
    var v = e.target.value.trim();
    $$('.map[data-mapid]', app).forEach(function (el) { var b = byId(el.dataset.mapid), m = mapOf(el.dataset.mapid); if (b && m && mode === 'edit') b.view = m.getView(); });
    session.modifier(function () { if (v) doc.mapKey = v; else delete doc.mapKey; });
    toast(v ? 'Clé CARTO enregistrée : le fond Plan utilise CARTO' : 'Clé retirée : le fond Plan utilise Esri');
  });
  p.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.matches('[data-mapkey]')) e.target.blur(); });
  p.addEventListener('click', function (e) {
    if (e.target.closest('[data-tagswin]')) { openTagsWindow(); return; }
    var b = e.target.closest('[data-set]'); if (!b) return;
    var k = b.dataset.set, v = b.dataset.v;
    if (k === 'autosave') { autosaveOn = v === '1'; try { localStorage.setItem(LS + 'autosave', autosaveOn ? '1' : '0'); } catch (_) {} setStatus(); draw(); return; }
    session.modifier(function () { doc[k] = k === 'width' ? +v : v; }); draw();
  });
  draw(); placePop(p, anchor);
}
/* Menu de lecture : rien de ce qu'il fait n'est enregistré dans le document */
var viewerTheme = '';   // thème choisi par ce lecteur (ce navigateur), prioritaire en lecture sur celui du document
try { viewerTheme = localStorage.getItem(LS + 'viewtheme') || ''; } catch (_) {}
function foldAll(open) {
  // lecture : plie ou déplie toutes les sections de la page (sans modifier le document)
  var hs = $$('.wrap [data-vfold]', app).map(function (b) { return b.parentNode; });
  (open ? hs : hs.slice().reverse()).forEach(function (h) { Reader.foldToggle(h, open); viewFold[h.id.slice(2)] = !open; });
}
function viewMenuHTML() {
  var anyFold = !!$('.wrap [data-vfold]', app);
  function mi(k, ic, label, sub, on) { return '<button class="mi" type="button" data-vm="' + k + '"' + (on ? ' aria-pressed="true"' : '') + '><span class="ic">' + ic + '</span><span>' + label + (sub ? '<small>' + sub + '</small>' : '') + '</span>' + (on ? '<kbd>✓</kbd>' : '') + '</button>'; }
  return '<h4>Lecture</h4>' + mi('print', '⎙', 'Imprimer / PDF') + mi('export', '◉', 'Exporter en page statique', 'Lecture seule, sans éditeur') +
    mi('word', 'W', 'Exporter la page en Word (.docx)', 'Titres, listes, tableaux et images') +
    (anyFold ? '<div class="hr"></div>' + mi('unfold', '⌄', 'Tout déplier') + mi('fold', '›', 'Tout plier') : '') +
    '<div class="hr"></div><h4>Thème (pour vous seulement)</h4>' + mi('th-', '◐', 'Celui du document', '', !viewerTheme) + mi('th-light', '☀', 'Clair', '', viewerTheme === 'light') + mi('th-dark', '☾', 'Sombre', '', viewerTheme === 'dark') +
    '<div class="hr"></div>' + mi('help', '⌨', 'Raccourcis clavier');
}
function viewMenuAct(k) {
  if (k === 'print') printPage(); else if (k === 'export') exportStatic(); else if (k === 'word') exporterPageWord(); else if (k === 'help') showHelp();
  else if (k === 'fold' || k === 'unfold') foldAll(k === 'unfold');
  else if (k.indexOf('th-') === 0) { viewerTheme = k.slice(3); try { if (viewerTheme) localStorage.setItem(LS + 'viewtheme', viewerTheme); else localStorage.removeItem(LS + 'viewtheme'); } catch (_) {} applyTheme(); }
}
function openViewMenu(anchor) {
  closePop();
  var p = document.createElement('div'); p.className = 'pop'; pop = p;
  p.innerHTML = viewMenuHTML();
  p.addEventListener('click', function (e) { var b = e.target.closest('[data-vm]'); if (!b) return; closePop(); viewMenuAct(b.dataset.vm); });
  placePop(p, anchor);
}
function fileMenuHTML() {
  var fsa = !!window.showSaveFilePicker;
  return '<h4>Nouveau document</h4>' +
    mi('new-vide', '□', 'Page vierge') + mi('new-runbook', '1.', 'Modèle procédure / runbook', 'Prérequis, étapes, vérification, retour arrière') +
    mi('new-outil', '{}', 'Modèle fiche outil / script', 'Utilisation, procédure, code complet') + mi('new-tour', '?', 'Visite guidée', 'Démonstration de tous les blocs') +
    '<div class="hr"></div>' +
    mi('save', '⤓', 'Enregistrer', fsa ? (fileHandle ? 'Dans ' + fileHandle.name : 'Choisir le fichier une fois, puis auto-save') : 'Télécharge le fichier à jour', 'Ctrl+S') +
    mi('saveas', '⧉', 'Enregistrer sous…', 'Nouvel emplacement ou copie') +
    mi('export', '◉', 'Exporter en page statique', 'Lecture seule, sans éditeur') +
    mi('word', 'W', 'Exporter la page en Word (.docx)', 'Titres, listes, tableaux et images') +
    mi('print', '⎙', 'Imprimer / PDF') +
    '<div class="hr"></div>' +
    mi('sync', '⇄', 'Synchronisation…', doc.sync ? 'Active · ' + doc.sync.relay : 'Garder plusieurs copies à jour, en direct') +
    '<div class="hr"></div>' +
    mi('json-copy', '{ }', 'Copier le JSON', 'Pour le faire modifier par une IA') + mi('json-import', '⇥', 'Importer du JSON…', 'Remplace le contenu de la page') +
    mi('md-import', '⇥', 'Importer du Markdown…', 'Remplace le contenu de la page courante') +
    '<div class="hr"></div>' +
    (doc.lock ? mi('pw-set', '🔒', 'Changer le mot de passe', isSealed() ? 'Édition protégée · contenu chiffré' : 'L’édition est protégée') +
                (isSealed() ? mi('pw-unseal', '🔓', 'Ne plus chiffrer le contenu', 'Le document redevient lisible sans mot de passe') : mi('pw-seal', '🔐', 'Chiffrer le contenu…', 'Mot de passe demandé pour ouvrir le document')) +
                mi('pw-lock', '⏻', 'Verrouiller maintenant', 'Repasse en lecture') + mi('pw-del', '✕', 'Retirer la protection')
              : mi('pw-set', '🔒', 'Protéger par mot de passe…', 'Édition protégée, contenu chiffré en option')) +
    '<div class="hr"></div>' + mi('update', '⟳', 'Mettre à jour Ardoise…', 'Version ' + (myVersion() || '?') + ' · garde le contenu') +
    mi('help', '⌨', 'Raccourcis clavier');
  function mi(k, ic, label, sub, kbd) { return '<button class="mi" type="button" data-f="' + k + '"><span class="ic">' + ic + '</span><span>' + label + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' + (kbd ? '<kbd>' + kbd + '</kbd>' : '') + '</button>'; }
}
function fileMenuAct(k) {
  if (k.indexOf('new-') === 0) newDoc(k.slice(4));
  else if (k === 'save') save(false);
  else if (k === 'saveas') save(true);
  else if (k === 'export') exportStatic();
  else if (k === 'word') exporterPageWord();
  else if (k === 'print') printPage();
  else if (k === 'json-copy') copyJSON();
  else if (k === 'json-import') importJSON();
  else if (k === 'md-import') ouvrirImportMarkdown();
  else if (k === 'help') showHelp();
  else if (k === 'sync') synDialog();
  else if (k === 'update') openUpdate();
  else if (k === 'pw-set') setPassword();
  else if (k === 'pw-del') removePassword();
  else if (k === 'pw-seal') sealExisting();
  else if (k === 'pw-unseal') unsealExisting();
  else if (k === 'pw-lock') lockNow();
}
function openFile(anchor) {
  closePop();
  var p = document.createElement('div'); p.className = 'pop'; pop = p;
  p.innerHTML = fileMenuHTML();
  p.addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (!b) return; closePop(); fileMenuAct(b.dataset.f); });
  placePop(p, anchor);
}

/* Barre de mise en forme : un seul élément, déplacé dans l'ancre .collant du bloc dont un texte riche a le curseur,
   à gauche de la bande collée du menu du bloc (13-collant.js). Jamais dans le HTML rendu d'un bloc : replacée après un rendu. */
// [data-mf, infobulle, contenu] ; '|' : séparateur
var BOUTONS_MF = [
  ['bold', 'Gras (Ctrl+B)', '<b>G</b>'], ['italic', 'Italique (Ctrl+I)', '<i>I</i>'], ['underline', 'Souligné (Ctrl+U)', '<u>S</u>'], ['strikeThrough', 'Barré', '<s>B</s>'], '|',
  ['code', 'Code (Ctrl+J)', '<span style="font-family:var(--f-mono)">&lt;/&gt;</span>'], ['link', 'Lien vers une adresse (Ctrl+K)', 'Lien'], ['pagelink', 'Lien vers une page ou une section du document', 'Page'], '|',
  ['pill', 'Pastille : sa couleur suit son nom (cliquez ensuite dans la pastille pour la changer)', '<span class="dot" style="background:conic-gradient(var(--ok) 0 25%,var(--bad) 0 50%,var(--warn) 0 75%,var(--info) 0)"></span> Pastille'],
  ['couleur', 'Couleur du texte', '<span class="bmf-c">A</span>'], ['surlignage', 'Surlignage', '<span class="bmf-s">ab</span>'], '|',
  ['clear', 'Effacer la mise en forme', '⌫']
];
var bmf = document.createElement('div'); bmf.className = 'bmf'; bmf.hidden = true;
// fenêtre étroite (moins de 600 px, editor.css) : le bouton « Aa » remplace la barre, et l'ouvre juste sous lui
bmf.innerHTML = '<button type="button" class="bmf-aa" data-mf="ouvrir" title="Mise en forme" aria-label="Mise en forme" aria-expanded="false">Aa</button>' +
  '<div class="bmf-b">' + BOUTONS_MF.map(function (x) {
  return x === '|' ? '<span class="vsep"></span>' : '<button type="button" data-mf="' + x[0] + '" title="' + x[1] + '" aria-label="' + x[1] + '">' + x[2] + '</button>';
}).join('') + '</div>';
// souris et toucher : la sélection et le focus restent dans le texte
// paletteAvant : palette ouverte à l'appui (pointerdown empêché supprime le mousedown, le document ne la referme donc pas) ;
// un second clic sur son bouton la ferme
var paletteAvant = null;
['mousedown', 'pointerdown'].forEach(function (t) { bmf.addEventListener(t, function (e) { e.preventDefault(); if (t === 'pointerdown') paletteAvant = pop && pop.bmfPal; }); });
bmf.addEventListener('click', function (e) {
  var b = e.target.closest('[data-mf]'), avant = paletteAvant; paletteAvant = null; if (!b) return;
  var k = b.dataset.mf;
  if (k === 'ouvrir') ouvrirBarre(!bmf.classList.contains('ouverte'));
  else if (FAMILLES_TEINTE[k]) { if (avant !== k) ouvrirPalette(k, b); else closePop(); }
  else inlineAction(k);
});
/* Couleur du texte et surlignage : palettes fixes (COULEURS_TEXTE, SURLIGNAGES, 02-assainissement.js), ouvertes en fenêtre pop
   qui ne prend pas le focus. Un texte porte au plus une couleur et au plus un surlignage, indépendants l'un de l'autre */
var FAMILLES_TEINTE = { couleur: COULEURS_TEXTE, surlignage: SURLIGNAGES };
function ouvrirPalette(famille, ancre) {
  closePop();
  var p = document.createElement('div'); p.className = 'pop bmf-pal'; p.bmfPal = famille;
  p.setAttribute('aria-label', famille === 'couleur' ? 'Couleur du texte' : 'Surlignage');
  p.innerHTML = FAMILLES_TEINTE[famille].map(function (x) {
    return '<button type="button" data-teinte="' + x[0] + '" title="' + x[1] + '" aria-label="' + x[1] + '"><span class="' + x[0] + '">A</span></button>';
  }).join('') + '<button type="button" class="bmf-sans" data-teinte="" title="Sans couleur" aria-label="Sans couleur"><span></span></button>';
  ['mousedown', 'pointerdown'].forEach(function (t) { p.addEventListener(t, function (e) { e.preventDefault(); }); });
  p.addEventListener('click', function (e) { var b = e.target.closest('[data-teinte]'); if (!b) return; closePop(); appliquerTeinte(famille, b.dataset.teinte); });
  pop = p; placePop(p, ancre);
}
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pop && pop.bmfPal) { e.preventDefault(); e.stopPropagation(); closePop(); } }, true);
function deLaFamille(n, famille) { return n.nodeType === 1 && n.tagName === 'SPAN' && FAMILLES_TEINTE[famille].some(function (x) { return n.classList.contains(x[0]); }); }
// retire les classes de la famille ; un span sans plus aucune classe est défait
function retirerFamille(el, famille) {
  FAMILLES_TEINTE[famille].forEach(function (x) { el.classList.remove(x[0]); });
  if (!el.classList.length) unwrap(el);
}
// haut, qui englobe la plage r, coupé en trois (avant, plage, après) : les deux bouts sont des copies de haut, qui ne garde
// que la plage ; rend la plage qui sélectionne haut
function couperAutour(haut, r) {
  var deb = r.startContainer, debO = r.startOffset, fin = r.endContainer, finO = r.endOffset;
  var bout = function (avant) {
    var b = document.createRange();
    if (avant) { b.setStart(haut, 0); b.setEnd(deb, debO); } else { b.setStart(fin, finO); b.setEnd(haut, haut.childNodes.length); }
    var f = b.extractContents(); if (!f.textContent.replace(/​/g, '') && !f.querySelector('br, span.pill')) return;
    // éléments vidés par la coupe (le reste d'un gras coupé à son bord) retirés
    Array.prototype.slice.call(f.querySelectorAll('*')).reverse().forEach(function (x) { if (!x.textContent && !x.matches('br') && !x.querySelector('br')) x.remove(); });
    var c = haut.cloneNode(false); c.appendChild(f); haut.parentNode.insertBefore(c, avant ? haut : haut.nextSibling);
  };
  bout(false); bout(true);   // la fin d'abord : le début de la plage reste valable
  var nr = document.createRange(); nr.selectNode(haut); return nr;
}
// cls : classe de la palette, '' pour « Sans couleur ». Sans sélection, rien
function appliquerTeinte(famille, cls) {
  var s = getSelection(); if (!s.rangeCount || s.isCollapsed) return;
  var r = s.getRangeAt(0), fld = fieldOf(r.commonAncestorContainer); if (!fld || !fld.hasAttribute('data-rich')) return;
  // ancêtre de la famille qui englobe la sélection : coupé en trois (avant, sélection, après), les deux bouts gardent leur teinte
  var n = r.commonAncestorContainer, haut = null; if (n.nodeType !== 1) n = n.parentNode;
  for (; n && n !== fld; n = n.parentNode) if (deLaFamille(n, famille)) haut = n;
  if (haut) r = couperAutour(haut, r);
  // les teintes de la famille présentes dans la sélection sont retirées, puis la sélection est enveloppée
  var f = r.extractContents();
  Array.prototype.slice.call(f.querySelectorAll('span')).forEach(function (x) { if (deLaFamille(x, famille)) retirerFamille(x, famille); });
  var nr = document.createRange();
  if (cls) { var el = document.createElement('span'); el.className = cls; el.appendChild(f); r.insertNode(el); nr.selectNodeContents(el); }
  else { var premier = f.firstChild, dernier = f.lastChild; if (!premier) return; r.insertNode(f); nr.setStartBefore(premier); nr.setEndAfter(dernier); }
  s.removeAllRanges(); s.addRange(nr);
  fire(fld);
}
// barre ouverte sous « Aa » (fenêtre étroite) ; fermée, une palette ouverte se ferme avec elle
function ouvrirBarre(oui) {
  if (oui) { bmf.classList.add('ouverte'); $('.bmf-aa', bmf).setAttribute('aria-expanded', 'true'); } else fermerBarre();
  if (bmf.parentNode && bmf.parentNode.style) ajusterBande(bmf.parentNode);
}
function fermerBarre() {
  if (pop && pop.bmfPal) closePop();
  bmf.classList.remove('ouverte'); $('.bmf-aa', bmf).setAttribute('aria-expanded', 'false');
}
function cacherBarreMiseEnForme() {
  fermerBarre();
  bmf.hidden = true;
  var a = bmf.parentNode; if (a && a.style) a.style.removeProperty('--recul');
}
// blocBarre : id du bloc qui porte la barre. Un nouveau rendu du même bloc (ligne ajoutée à un tableau…) remplace son ancre
// sans fermer la barre ouverte ; seul le départ du curseur vers un autre bloc la referme
var blocBarre = null;
function placerBarreMiseEnForme() {
  var f = mode === 'edit' ? fieldOf(document.activeElement) : null, blk = f && f.hasAttribute('data-rich') && f.closest('.blk');
  var ancre = blk && $(':scope > .collant', blk);
  if (!ancre) { cacherBarreMiseEnForme(); return; }
  if (bmf.parentNode !== ancre) { if (blk.dataset.id !== blocBarre) cacherBarreMiseEnForme(); ancre.appendChild(bmf); blocBarre = blk.dataset.id; }
  bmf.hidden = false;
  ajusterBande(ancre);
}
// barre à gauche, menu à droite, bas contre bas. Si la barre ne tient pas avant le menu (fenêtre étroite, menu large),
// elle passe juste au-dessus du menu, jamais par-dessus ; le recul de l'ancre suit la hauteur de la bande pour qu'une fois
// collée elle reste entière sous le haut d'écran
function ajusterBande(ancre) {
  var m = $(':scope > .blk-bar', ancre);
  var barre = $('.bmf-b', bmf);
  bmf.style.bottom = ''; barre.style.width = barre.style.left = '';
  if (!bmf.offsetWidth) { ancre.style.removeProperty('--recul'); return; }
  var place = m ? m.getBoundingClientRect().left - bmf.getBoundingClientRect().left - 8 : Infinity, dessus = bmf.offsetWidth > place;
  if (dessus) bmf.style.bottom = (m.offsetHeight + 6) + 'px';
  var h = bmf.offsetHeight + (dessus ? m.offsetHeight + 3 : 0);
  if (h > 30.5) ancre.style.setProperty('--recul', (h + 3) + 'px'); else ancre.style.removeProperty('--recul');
  // barre ouverte sous « Aa » (position absolue : hors de la bande mesurée par 13-collant.js) : largeur du bloc, dans l'écran
  if (bmf.classList.contains('ouverte') && etroite.matches) {
    var ra = ancre.getBoundingClientRect(), w = Math.min(ra.width, innerWidth - 16);
    barre.style.width = w + 'px';
    barre.style.left = (Math.min(Math.max(ra.left, 8), innerWidth - 8 - w) - bmf.getBoundingClientRect().left) + 'px';
  }
}
// largeur suivie sans rechargement : la barre ouverte se referme en passant 600 px dans un sens ou dans l'autre
var etroite = matchMedia('(max-width:599px)');
etroite.addEventListener('change', function () { fermerBarre(); if (!bmf.hidden && bmf.parentNode) ajusterBande(bmf.parentNode); });
// appui hors de la barre ouverte (et hors d'une palette ou de la fenêtre du lien ouvertes depuis elle) : elle se referme
document.addEventListener('pointerdown', function (e) { if (bmf.classList.contains('ouverte') && !bmf.contains(e.target) && !(pop && pop.contains(e.target))) ouvrirBarre(false); }, true);
document.addEventListener('selectionchange', placerBarreMiseEnForme);   // synchrone : avant la mesure du dégagement (13-collant.js)
document.addEventListener('focusin', placerBarreMiseEnForme);
document.addEventListener('focusout', function () { requestAnimationFrame(placerBarreMiseEnForme); });
window.addEventListener('resize', function () { if (!bmf.hidden && bmf.parentNode) ajusterBande(bmf.parentNode); });
function fieldOf(n) { while (n && n !== app) { if (n.nodeType === 1 && n.classList.contains('fld')) return n; n = n.parentNode; } return null; }
function unwrap(el) { var p = el.parentNode; while (el.firstChild) p.insertBefore(el.firstChild, el); p.removeChild(el); }
/* Effacer : la forme (gras, italique, souligné, barré, code, lien, couleur, surlignage) n'est retirée que du texte sélectionné.
   Une forme qui englobe la sélection est coupée en trois ; pastilles, taquets et sauts de ligne restent. Sans sélection, rien */
function deForme(n) {
  if (n.nodeType !== 1) return false;
  if (/^(B|I|U|S|STRIKE|CODE|A|STRONG|EM)$/.test(n.tagName)) return true;
  return n.tagName === 'SPAN' && (deLaFamille(n, 'couleur') || deLaFamille(n, 'surlignage'));
}
function intact(n) { return n.nodeType === 1 && n.tagName === 'SPAN' && (n.classList.contains('pill') || n.classList.contains('tab')); }
function sansForme(n) {
  if (intact(n)) return;   // pastille, taquet : intacts, contenu compris
  Array.prototype.slice.call(n.childNodes).forEach(function (x) { if (x.nodeType === 1) sansForme(x); });
  if (n.nodeType === 1 && deForme(n)) { if (n.tagName === 'SPAN') { retirerFamille(n, 'couleur'); if (n.parentNode) retirerFamille(n, 'surlignage'); } else unwrap(n); }
}
function effacerForme(s, r, fld) {
  if (s.isCollapsed) return;
  // un bord dans une pastille ou un taquet est repoussé hors de lui (jamais coupé) ; une sélection dans une pastille reste dedans
  var garde = function (n) { for (; n && n !== fld; n = n.parentNode) if (intact(n)) return n; return null; };
  var g1 = garde(r.startContainer), g2 = garde(r.endContainer);
  if (g1 !== g2) { if (g1) r.setStartBefore(g1); if (g2) r.setEndAfter(g2); }
  // forme la plus haute qui englobe la sélection, sans franchir une pastille : coupée en trois
  var n = r.commonAncestorContainer, haut = null; if (n.nodeType !== 1) n = n.parentNode;
  for (; n && n !== fld && !intact(n); n = n.parentNode) if (deForme(n)) haut = n;
  session.valider();   // la frappe en attente est une étape, Effacer en est une autre
  if (haut) r = couperAutour(haut, r);
  var f = r.extractContents();
  Array.prototype.slice.call(f.childNodes).forEach(function (x) { if (x.nodeType === 1) sansForme(x); });
  var premier = f.firstChild, dernier = f.lastChild; if (!premier) return;
  r.insertNode(f);
  // formes vidées aux bords de la sélection (extractContents y laisse des éléments vides) retirées
  Array.prototype.slice.call(fld.querySelectorAll('*')).reverse().forEach(function (x) { if (deForme(x) && !x.textContent.replace(/​/g, '') && !x.querySelector('br, span.pill, span.tab')) x.remove(); });
  var nr = document.createRange(); nr.setStartBefore(premier); nr.setEndAfter(dernier);
  s.removeAllRanges(); s.addRange(nr); fire(fld);
}
function inlineAction(kind) {
  var s = getSelection(); if (!s.rangeCount) return;
  var r = s.getRangeAt(0), fld = fieldOf(r.commonAncestorContainer); if (!fld) return;
  // sans sélection, la forme vaut pour la frappe suivante ; le barré de Chromium (<strike>) devient <s> à l'assainissement
  if (kind === 'bold' || kind === 'italic' || kind === 'underline' || kind === 'strikeThrough') { document.execCommand(kind); fire(fld); return; }
  function ancestor(test) { var n = r.commonAncestorContainer; if (n.nodeType !== 1) n = n.parentNode; while (n && n !== fld) { if (test(n)) return n; n = n.parentNode; } return null; }
  if (kind === 'clear') { effacerForme(s, r, fld); return; }
  var tag = 'span', cls = '';
  if (kind === 'code') tag = 'code';
  else if (kind === 'link' || kind === 'pagelink') tag = 'a';
  else cls = 'pill';
  var existing = ancestor(function (n) {
    if (tag === 'code') return n.tagName === 'CODE';
    if (tag === 'a') return n.tagName === 'A';
    return n.tagName === 'SPAN' && n.classList.contains('pill');
  });
  if (existing && tag === 'a') {
    // déjà un lien : on le modifie (sans le défaire)
    openLinkPop(kind === 'pagelink' || parseLink(existing.getAttribute('href')).page ? 'page' : 'url', null, fld, existing); return;
  }
  if (existing) {
    if (cls.indexOf('pill') === 0 && !existing.classList.contains(kind)) existing.className = cls; else unwrap(existing);
    fire(fld); return;
  }
  if (s.isCollapsed) return;
  if (tag === 'a') { openLinkPop(kind === 'pagelink' ? 'page' : 'url', r.cloneRange(), fld, null); return; }
  var nel = wrapInline(tag, cls, null, fld);
  if (nel && cls === 'pill') paintPill(nel);
}
/* Liens. Adresse : https://…, mailto:… ; page du document : #pg-<page> ; section : #pg-<page>/<bloc>
   (le lien suit la page ou la section si elle est déplacée ou renommée) */
function parseLink(href) {
  var m = String(href || '').match(/^#pg-([^/]+)(?:\/(.+))?$/);
  return m ? { page: true, pid: m[1], bid: m[2] || '' } : { page: false, url: String(href || '') };
}
function linkLabel(href) {
  var L = parseLink(href); if (!L.page) return L.url.replace(/^mailto:/i, '');
  var i = pageDuLien(doc.pages, L);   // une section déplacée est suivie sur sa page
  if (i < 0) return 'Page introuvable';
  var t = pageTitle(doc.pages[i], i);
  if (L.bid) { var x = sectionsOf(doc.pages[i]).filter(function (y) { return y.id === L.bid; })[0]; t += ' › ' + (x ? x.t : 'section introuvable'); }
  return t;
}
function goLink(href) {
  // ouvre la page liée, puis fait défiler jusqu'à la section (dépliée au besoin en édition)
  var L = parseLink(href); if (!L.page) return;
  // la section est cherchée dans tout le document : déplacée vers une autre page, le lien la retrouve (adresse de sa page réelle)
  var i = pageDuLien(doc.pages, L);
  if (i < 0) { toast('Page introuvable : elle a sans doute été supprimée'); return; }
  var moved = i !== doc.cur;
  if (!moved && !L.bid) return;
  // une seule entrée d'historique pour la page et la section : la position de départ est notée avant de quitter
  noterDefilement();
  if (moved) goPage(i, false, true);
  if (L.bid && montrerBloc(L.bid, !moved)) { naviguer(adressePage(doc.pages, i, L.bid)); return; }
  if (moved) naviguer(adressePage(doc.pages, i));
  if (L.bid) toast('Section introuvable : elle a sans doute été supprimée');
}
function montrerBloc(bid, doux) {
  // section de la page affichée : dépliée au besoin (en édition, étape annulable), puis amenée en haut de l'écran
  if (mode === 'edit' && byId(bid) && cacheEnEdition(doc.blocks, bid)) session.modifier(function () { revealBlock(bid); });   // section ou groupe
  // lecture : un bloc qui n'est pas un titre (adresse #pg-<page>/<bloc>, bloc d'un groupe) est retrouvé par son ancrage
  var el = document.getElementById('b-' + bid) || $('.blk[data-id="' + bid + '"]', app) || (mode === 'view' && $('[data-bid="' + bid + '"]', app));
  if (!el) return false;
  if (mode === 'view') Reader.foldReveal(el);
  el.scrollIntoView({ block: 'start', behavior: doux ? 'smooth' : 'auto' });
  return true;
}
function openLinkPop(kind, range, fld, a) {
  // kind : 'url' (adresse) ou 'page' (page ou section) ; a : lien existant à modifier, sinon range : texte à lier
  closePop(); hideLinkTip(); hidePillTip();
  var p = document.createElement('div'); p.className = 'pop link-pop'; pop = p;
  var cur = a ? a.getAttribute('href') || '' : '', L = parseLink(cur);
  function mi(k, ic, label) { return '<button class="mi" type="button" data-lk="' + k + '"><span class="ic">' + ic + '</span><span>' + label + '</span></button>'; }
  var foot = '<div class="hr"></div>' + (kind === 'url' ? mi('to-page', '▤', 'Lien vers une page ou une section…') : mi('to-url', '↗', 'Lien vers une adresse…')) + (a ? mi('unlink', '✕', 'Retirer le lien') : '');
  var shown = [], curI = 0, q = null, list = null, url = null;
  if (kind === 'url') {
    p.innerHTML = '<h4>' + (a ? 'Modifier le lien' : 'Lien vers une adresse') + '</h4><div class="link-url"><input class="menu-q" data-url placeholder="https://…" spellcheck="false" autocomplete="off" inputmode="url" value="' + esc(L.page ? '' : L.url) + '"><button class="ub primary" type="button" data-url-ok>OK</button></div>' + foot;
    url = $('[data-url]', p);
    url.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); applyUrl(); } else if (e.key === 'Escape') { e.preventDefault(); closePop(); } });
  } else {
    p.innerHTML = '<h4>' + (a ? 'Modifier le lien' : 'Lien vers une page ou une section') + '</h4><input class="menu-q" data-q placeholder="Rechercher une page ou une section…" spellcheck="false" autocomplete="off"><div class="menu-list"></div>' + foot;
    q = $('[data-q]', p); list = $('.menu-list', p);
    var items = [];
    doc.pages.forEach(function (pg, i) {
      var pt = pageTitle(pg, i);
      var pl = pageLv(doc.pages, i);
      items.push({ href: '#pg-' + pg.id, t: pt, ic: pl ? '↳' : '▤', lv: 0, pl: pl, here: i === doc.cur, pt: pt });
      sectionsOf(pg).forEach(function (x) { items.push({ href: '#pg-' + pg.id + '/' + x.id, t: (x.n ? x.n + ' · ' : '') + x.t, ic: '§', lv: x.lv, pl: pl, pt: pt }); });
    });
    var draw = function () {
      var s = norm(q.value.trim());
      shown = items.filter(function (it) { return !s || norm(it.t + ' ' + it.pt).indexOf(s) >= 0; });
      curI = Math.min(curI, Math.max(0, shown.length - 1));
      list.innerHTML = shown.length ? shown.map(function (it, k) {
        return '<button class="mi lk-lv' + it.lv + (k === curI ? ' act' : '') + (it.href === cur ? ' on' : '') + '" type="button" data-k="' + k + '"' + (it.pl && !s ? ' style="margin-left:' + Math.min(it.pl, 4) * 16 + 'px;width:calc(100% - ' + Math.min(it.pl, 4) * 16 + 'px)"' : '') + '><span class="ic">' + it.ic + '</span><span>' + esc(it.t) +
          (it.lv ? (s ? '<small>' + esc(it.pt) + '</small>' : '') : (it.here ? '<small>Page affichée</small>' : '')) + '</span></button>';
      }).join('') : '<div class="menu-empty">Aucune page ni section</div>';
    };
    var scrollAct = function () { var x = $('.mi.act', list); if (x) x.scrollIntoView({ block: 'nearest' }); };
    q.addEventListener('input', function () { curI = 0; draw(); });
    q.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); curI = Math.min(shown.length - 1, curI + 1); draw(); scrollAct(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); curI = Math.max(0, curI - 1); draw(); scrollAct(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (shown[curI]) apply(shown[curI].href); }
      else if (e.key === 'Escape') { e.preventDefault(); closePop(); }
    });
    for (var j = 0; j < items.length; j++) if (items[j].href === cur) { curI = j; break; }
    draw();
  }
  function restore() {
    fld.focus({ preventScroll: true });
    var s = getSelection(), r2 = range;
    if (a && fld.contains(a)) { r2 = document.createRange(); r2.selectNodeContents(a); r2.collapse(false); }
    if (r2) { s.removeAllRanges(); s.addRange(r2); }
  }
  function apply(href) {
    popClose = null; closePop();
    if (a) {
      if (!fld.contains(a)) { toast('Le lien a changé entre-temps : sélectionnez-le à nouveau'); return; }
      a.setAttribute('href', href); restore(); fire(fld); return;
    }
    restore(); wrapInline('a', '', href, fld);
  }
  function applyUrl() {
    var h = url.value.trim(); if (!h) return;
    if (!/^(https?:|mailto:|#)/i.test(h)) h = (/^[^\s@]+@[^\s@]+$/.test(h) ? 'mailto:' : 'https://') + h;
    apply(h);
  }
  p.addEventListener('click', function (e) {
    if (e.target.closest('[data-url-ok]')) { applyUrl(); return; }
    var it = e.target.closest('[data-k]'); if (it && list) { apply(shown[+it.dataset.k].href); return; }
    var b = e.target.closest('[data-lk]'); if (!b) return;
    var k = b.dataset.lk;
    if (k === 'to-page' || k === 'to-url') { popClose = null; closePop(); openLinkPop(k === 'to-page' ? 'page' : 'url', range, fld, a); return; }
    if (k === 'unlink') { popClose = null; closePop(); if (a && fld.contains(a)) { unwrap(a); fld.focus({ preventScroll: true }); fire(fld); } return; }
  });
  var anchor = a && fld.contains(a) ? a : (!bmf.hidden && bmf.parentNode ? bmf : fld);
  placePop(p, anchor);
  popClose = restore;
  (url || q).focus();
}
/* Bulle d'un lien (édition) : le curseur dans un lien affiche sa cible, avec ouvrir / modifier / retirer */
var ltip = document.createElement('div'); ltip.className = 'ltip'; ltip.style.display = 'none'; ui.appendChild(ltip);
var tipA = null;
function hideLinkTip() { if (tipA || ltip.style.display !== 'none') { ltip.style.display = 'none'; tipA = null; } }
function showLinkTip(a) {
  if (tipA === a && ltip.style.display !== 'none') return;
  tipA = a;
  var href = a.getAttribute('href') || '', L = parseLink(href);
  ltip.innerHTML = '<span class="ltip-t" title="' + esc(href) + '">' + (L.page ? '▤ ' : '↗ ') + esc(linkLabel(href)) + '</span><span class="vsep"></span>' +
    '<button type="button" data-l="open" title="' + (L.page ? 'Aller à la page' : 'Ouvrir dans un nouvel onglet') + '">Ouvrir</button><button type="button" data-l="edit">Modifier</button><button type="button" data-l="del">Retirer</button>';
  ltip.style.display = 'flex';
  var rs = a.getClientRects(), r = rs.length ? rs[rs.length - 1] : a.getBoundingClientRect(), w = ltip.offsetWidth, h = ltip.offsetHeight;
  var top = r.bottom + 6; if (top + h > innerHeight - 8) top = r.top - h - 6;
  ltip.style.left = Math.min(Math.max(8, r.left), innerWidth - w - 8) + 'px'; ltip.style.top = Math.max(8, top) + 'px';
}
ltip.addEventListener('mousedown', function (e) { e.preventDefault(); });
ltip.addEventListener('click', function (e) {
  var b = e.target.closest('[data-l]'), a = tipA, fld = a && fieldOf(a); if (!b || !a || !fld) return;
  var href = a.getAttribute('href') || '', k = b.dataset.l;
  if (k === 'open') { hideLinkTip(); if (parseLink(href).page) goLink(href); else window.open(href, '_blank', 'noopener'); }
  else if (k === 'edit') openLinkPop(parseLink(href).page ? 'page' : 'url', null, fld, a);
  else if (k === 'del') { hideLinkTip(); unwrap(a); fire(fld); }
});
window.addEventListener('scroll', hideLinkTip, { passive: true });
document.addEventListener('selectionchange', function () {
  var s = getSelection(), a = null;
  if (mode === 'edit' && s.rangeCount && s.isCollapsed && s.anchorNode) {
    var tb = (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentNode).closest('span.tab');
    if (tb && fieldOf(tb)) { tabExit(tb); return; }   // le curseur ne reste pas dans un taquet
    var an = s.anchorNode, nx = an.nodeType === 1 ? an.childNodes[s.anchorOffset] : (s.anchorOffset === an.nodeValue.length || an.nodeValue.slice(s.anchorOffset).replace(/\u200B/g, '') === '' ? an.nextSibling : null);
    if (nx && nx.nodeType === 1 && nx.classList.contains('ln')) nx = nx.firstChild;
    while (nx && nx.nodeType === 3 && nx.nodeValue.replace(/\u200B/g, '') === '') nx = nx.nextSibling;
    if (nx && nx.nodeType === 1 && nx.classList.contains('tab') && fieldOf(nx)) { tabExit(nx); return; }   // juste avant un taquet (touche Début…)
  }
  if (mode === 'edit' && !pop && s.rangeCount && s.isCollapsed) {
    var f = fieldOf(s.anchorNode), n = s.anchorNode;
    if (f && f.hasAttribute('data-rich')) { a = (n.nodeType === 1 ? n : n.parentNode).closest('a, span.pill'); if (a && !f.contains(a)) a = null; }
  }
  if (a && a.tagName === 'A') showLinkTip(a); else hideLinkTip();
  if (a && a.tagName === 'SPAN') showPillTip(a); else hidePillTip();
});
function wrapInline(tag, cls, href, fld) {
  var s = getSelection(); if (!s.rangeCount || s.isCollapsed) return;
  var r = s.getRangeAt(0);
  var el = document.createElement(tag); if (cls) el.className = cls; if (href) el.setAttribute('href', href);
  el.appendChild(r.extractContents());
  $$(tag === 'span' ? 'span.pill' : tag, el).forEach(unwrap);   // même famille seulement : une couleur ou un surlignage enveloppé reste
  r.insertNode(el);
  s.removeAllRanges(); var nr2 = document.createRange(); nr2.selectNodeContents(el); s.addRange(nr2);
  fire(fld);
  return el;
}
function fire(fld) { fld.dispatchEvent(new Event('input', { bubbles: true })); }

