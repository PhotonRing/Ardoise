// Plugin Obsidian « Ardoise » : ouvre les documents Ardoise (.html) dans un onglet d'Obsidian
// et enregistre les modifications directement dans le fichier du coffre.
// JavaScript sans compilation : build.mjs y insère le document vierge (constante TEMPLATE) et écrit dist/obsidian/main.js.
'use strict';
const { Plugin, TextFileView, TFolder, Notice, normalizePath } = require('obsidian');

const VIEW_TYPE = 'ardoise';
const TEMPLATE = __ARDOISE_TEMPLATE__;   // dist/ardoise.html (document vierge)

const isArdoise = (html) => /<script id="ardoise-app"/.test(html);
const versionOf = (html) => { const m = String(html).match(/<meta name="generator" content="Ardoise ([\d.]+)"/); return m ? m[1] : ''; };
const newerThan = (a, b) => {
  a = String(a).split('.'); b = String(b).split('.');
  for (let i = 0; i < 3; i++) { const x = +a[i] || 0, y = +b[i] || 0; if (x !== y) return x > y; }
  return false;
};
const LATEST = versionOf(TEMPLATE);
// Même greffe que dans Ardoise (src/js/20-enregistrement.js) : l'éditeur du modèle, le contenu du document.
// Les données restent telles quelles, chiffrées ou non : pas besoin du mot de passe.
function graftFile(tpl, cur) {
  [/<html[^>]*>/i, /<title>[\s\S]*?<\/title>/i, /<script id="ardoise-doc"[^>]*>[\s\S]*?<\/script>/, /<div id="app">[\s\S]*?(?=<script id="ardoise-geo")/].forEach((re) => {
    const m = cur.match(re); if (m && re.test(tpl)) tpl = tpl.replace(re, () => m[0]);
  });
  return tpl;
}

/* Script injecté dans le document, exécuté avant Ardoise dans l'iframe isolée.
   Ardoise enregistre avec l'API File System Access : on lui fournit une « poignée de fichier »
   dont l'écriture est transmise à Obsidian, ainsi qu'un indexedDB minimal qui lui rend cette
   poignée au démarrage (l'auto-save fonctionne dès l'ouverture). Le script est placé dans <body> :
   Ardoise l'écarte en reconstruisant le fichier, il n'est donc jamais enregistré.
   Fonctionne aussi avec les documents créés par des versions antérieures d'Ardoise. */
function hostShim(name) {
  var pending = {}, seq = 0;
  function call(type, payload) {
    return new Promise(function (res, rej) {
      var id = ++seq; pending[id] = [res, rej];
      parent.postMessage({ ardoise: true, id: id, type: type, payload: payload }, '*');
    });
  }
  addEventListener('message', function (e) {
    if (e.source !== parent || !e.data || !e.data.ardoise) return;
    var d = e.data;
    if (d.type === 'reply' && pending[d.id]) { pending[d.id][d.ok ? 0 : 1](d.ok ? undefined : new Error(d.error)); delete pending[d.id]; }
    if (d.type === 'flush') {
      // onglet fermé : enregistrer les modifications que l'auto-save n'a pas encore écrites
      var st = document.getElementById('st'), pendingChanges = st && /\b(warn|busy)\b/.test(st.className);
      Promise.resolve(pendingChanges && window.ardoise && window.ardoise.save ? window.ardoise.save() : null)
        .then(function () { parent.postMessage({ ardoise: true, type: 'flushed', id: d.id }, '*'); });
    }
  });
  var handle = {
    kind: 'file', name: name,
    queryPermission: function () { return Promise.resolve('granted'); },
    requestPermission: function () { return Promise.resolve('granted'); },
    createWritable: function () {
      var parts = [];
      return Promise.resolve({
        write: function (d) { parts.push(String(d)); return Promise.resolve(); },
        close: function () { return call('save', parts.join('')); }
      });
    }
  };
  window.showSaveFilePicker = function () { return Promise.resolve(handle); };
  window.ardoiseHost = { app: 'obsidian' };
  var later = function (fn) { setTimeout(fn, 0); };
  var db = {
    transaction: function () {
      var tx = { objectStore: function () { return {
        get: function () { var r = { result: handle }; later(function () { if (r.onsuccess) r.onsuccess(); }); return r; },
        put: function () { later(function () { if (tx.oncomplete) tx.oncomplete(); }); return {}; }
      }; } };
      return tx;
    }
  };
  var idb = { open: function () { var rq = {}; later(function () { rq.result = db; if (rq.onsuccess) rq.onsuccess(); }); return rq; } };
  try { Object.defineProperty(window, 'indexedDB', { value: idb, configurable: true }); } catch (_) {}
}

class ArdoiseView extends TextFileView {
  constructor(leaf) {
    super(leaf);
    this.iframe = null;
    this.flushes = {};
    this.contentEl.addClass('ardoise-view');
    this.registerDomEvent(window, 'message', (e) => this.onMessage(e));
  }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return this.file ? this.file.basename : 'Ardoise'; }
  getIcon() { return 'layout-template'; }
  getViewData() { return this.data; }
  clear() { this.data = ''; }

  setViewData(data, clear) {
    this.data = data;
    this.contentEl.empty();
    const frame = this.contentEl.createEl('iframe', { cls: 'ardoise-frame' });
    // Pas de « allow-same-origin » : le document ne peut atteindre ni Obsidian ni le coffre,
    // il ne communique qu'avec la vue, par messages.
    if (isArdoise(data)) {
      const v = versionOf(data);
      if (v && newerThan(LATEST, v)) {
        const bar = this.contentEl.createDiv({ cls: 'ardoise-note ardoise-update' });
        bar.createSpan({ text: `Ce document utilise Ardoise ${v}. ` });
        bar.createEl('button', { text: `Mettre à jour vers ${LATEST}`, cls: 'mod-cta' }).addEventListener('click', () => this.update());
      }
      frame.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox allow-modals allow-forms allow-downloads');
      const shim = '<script id="ardoise-host">(' + hostShim.toString() + ')(' + JSON.stringify(this.file ? this.file.name : 'page.html').replace(/</g, '\\u003c') + ');<\/script>';
      frame.srcdoc = /<body[^>]*>/i.test(data) ? data.replace(/<body[^>]*>/i, (m) => m + shim) : shim + data;
    } else {
      // Fichier HTML quelconque (ou page exportée par Ardoise) : aperçu en lecture seule
      this.contentEl.createDiv({ cls: 'ardoise-note', text: 'Ce fichier HTML n’est pas un document Ardoise modifiable : aperçu en lecture seule.' });
      frame.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
      frame.srcdoc = data;
    }
    this.contentEl.appendChild(frame);
    this.iframe = frame;
  }

  onMessage(e) {
    if (!this.iframe || e.source !== this.iframe.contentWindow || !e.data || !e.data.ardoise) return;
    const d = e.data;
    if (d.type === 'save' && typeof d.payload === 'string') {
      const before = versionOf(this.data);
      this.data = d.payload;
      Promise.resolve(this.save(false)).then(
        () => {
          this.reply(d.id, true);
          // le document vient de remplacer son éditeur (Fichier → Mettre à jour Ardoise) : on le recharge
          if (versionOf(d.payload) !== before) this.setViewData(d.payload, false);
        },
        (err) => { new Notice('Ardoise : enregistrement impossible — ' + (err && err.message || err)); this.reply(d.id, false, String(err && err.message || err)); }
      );
    } else if (d.type === 'flushed' && this.flushes[d.id]) {
      this.flushes[d.id](); delete this.flushes[d.id];
    }
  }
  reply(id, ok, error) {
    if (this.iframe && this.iframe.contentWindow) this.iframe.contentWindow.postMessage({ ardoise: true, type: 'reply', id: id, ok: ok, error: error }, '*');
  }
  async update() {
    await this.flush();
    const html = graftFile(TEMPLATE, this.data);
    this.data = html;
    await this.save(false);
    this.setViewData(html, false);
    new Notice(`Ardoise ${LATEST} : document mis à jour`);
  }
  // Avant de quitter le fichier : laisse au document le temps d'écrire ses dernières modifications
  flush() {
    const w = this.iframe && this.iframe.contentWindow;
    if (!w || !isArdoise(this.data)) return Promise.resolve();
    const id = 'f' + Date.now();
    return new Promise((res) => {
      this.flushes[id] = res;
      w.postMessage({ ardoise: true, type: 'flush', id: id }, '*');
      setTimeout(() => { delete this.flushes[id]; res(); }, 3000);
    });
  }
  async onUnloadFile(file) {
    await this.flush();
    await super.onUnloadFile(file);
  }
  async onClose() {
    await this.flush();
    this.contentEl.empty(); this.iframe = null;
    await super.onClose();
  }
}

module.exports = class ArdoisePlugin extends Plugin {
  async onload() {
    this.registerView(VIEW_TYPE, (leaf) => new ArdoiseView(leaf));
    try {
      this.registerExtensions(['html'], VIEW_TYPE);
    } catch (e) {
      new Notice('Ardoise : les fichiers .html sont déjà pris en charge par un autre plugin. Utilisez la commande « Ouvrir dans Ardoise ».', 8000);
    }

    this.addRibbonIcon('layout-template', 'Nouveau document Ardoise', () => this.createDocument());
    this.addCommand({ id: 'new-document', name: 'Nouveau document', callback: () => this.createDocument() });
    this.addCommand({
      id: 'open-current',
      name: 'Ouvrir le fichier courant dans Ardoise',
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        if (!f || !/^html?$/i.test(f.extension)) return false;
        if (!checking) this.openInArdoise(f);
        return true;
      }
    });
    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      if (file instanceof TFolder) {
        menu.addItem((it) => it.setTitle('Nouveau document Ardoise').setIcon('layout-template').onClick(() => this.createDocument(file)));
      } else if (/^html?$/i.test(file.extension)) {
        menu.addItem((it) => it.setTitle('Ouvrir dans Ardoise').setIcon('layout-template').onClick(() => this.openInArdoise(file)));
      }
    }));
  }

  async openInArdoise(file, leaf) {
    const l = leaf || this.app.workspace.getLeaf(false);
    await l.setViewState({ type: VIEW_TYPE, state: { file: file.path }, active: true });
  }

  async createDocument(folder) {
    const parent = folder || this.app.fileManager.getNewFileParent(this.app.workspace.getActiveFile() ? this.app.workspace.getActiveFile().path : '');
    const base = parent.isRoot() ? '' : parent.path + '/';
    let path, n = 0;
    do { path = normalizePath(base + 'Ardoise' + (n ? ' ' + n : '') + '.html'); n++; } while (this.app.vault.getAbstractFileByPath(path));
    const file = await this.app.vault.create(path, TEMPLATE);
    await this.openInArdoise(file, this.app.workspace.getLeaf('tab'));
  }
};
