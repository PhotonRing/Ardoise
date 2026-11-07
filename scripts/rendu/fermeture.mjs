// Fermeture de la fabrique de lecture et du moteur de carte ; page exportée lancée sans globale de l'éditeur.
import { monter, test, egal, vrai, js, DEUX_PAGES } from './commun.mjs';
import { readdirSync } from 'node:fs';
import vm from 'node:vm';
import { closureLeaks } from '../fermeture.mjs';

// Vérification de fermeture (scripts/fermeture.mjs, lancée par build.mjs) : un mini-bundle ouvert par l'IIFE commune
const BUNDLE = `
(function () {
var doc, mode = 'view', liste = [1, 2], norm = function (s) { return s; };
function render() {}
function ardoiseKit(opt) {
  var n = 0, cfg = { norm: 1, mode: 2 };   // clés d'objet : pas des références
  function ok(x) { try { return x.doc + n; } catch (render) { return render; } }
  // render() cité dans un commentaire ; et dans une chaîne :
  var s = 'doc ' + "mode", re = /doc'/g;
  return { ok: ok, s: s, re: re, cfg: cfg, opt: opt, fuite: liste };
}
})();`;
test('fermeture : nomme la globale citée, ignore locales, paramètres, chaînes, commentaires, propriétés et clés', () => {
  egal(closureLeaks(BUNDLE, 'ardoiseKit'), ['liste']);
  egal(closureLeaks(BUNDLE.replace('cfg: cfg', 'cfg: mode ? cfg : doc'), 'ardoiseKit'), ['mode', 'doc', 'liste'], 'ternaire : pas une clé');
  let err = ''; try { closureLeaks(BUNDLE, 'absente'); } catch (e) { err = e.message; }
  vrai(/absente/.test(err), 'fonction introuvable : erreur qui la nomme');
});

// noms déclarés dans une fonction de la fabrique : ne masquent pas une fuite du même nom dans une autre
const PORTEES = `
(function () {
var liste = [], doc = {}, mode = 'view', render = 0;
function ardoiseKit() {
  function a() { var liste = 1; return liste; }
  function b() { return liste; }
  function c(doc) { return doc; }
  function e() { return doc; }
  var f = function mode() { return mode; };
  function g() { try { return 1; } catch (render) { return render; } return render; }
  return { a: a, b: b, c: c, e: e, f: f, g: g, h: mode };
}
})();`;
test('fermeture : une déclaration locale ne vaut que dans sa fonction (var, paramètre, nom d\'une expression, catch)', () => {
  egal(closureLeaks(PORTEES, 'ardoiseKit'), ['liste', 'doc', 'render', 'mode']);
});

test('fermeture : ardoiseReader et ardoiseMapKit ne citent aucune globale de l\'éditeur', () => {
  const tout = readdirSync(new URL('../../src/js/', import.meta.url)).filter((f) => f.endsWith('.js')).sort().map(js).join('');
  egal(closureLeaks(tout, 'ardoiseMapKit'), [], 'ardoiseMapKit');
  egal(closureLeaks(tout, 'ardoiseReader'), [], 'ardoiseReader');
});

// Page exportée : le script de lecture (readerScript) tourne seul, dans un contexte sans aucune globale de l'éditeur,
// avec un document minimal qui note les écouteurs posés et les sélecteurs cherchés
function pageExportee() {
  const ecoute = { document: {}, window: {} }, cherche = [];
  const pose = (cible) => (type, fn) => { (ecoute[cible][type] = ecoute[cible][type] || []).push(fn); };
  const el = { getAttribute: () => null, classList: { contains: () => false, toggle() {} }, style: { setProperty() {} } };
  const document = {
    documentElement: el, title: 'Essai', readyState: 'complete',
    querySelector: (s) => { cherche.push(s); return null; }, querySelectorAll: (s) => { cherche.push(s); return []; },
    addEventListener: pose('document'), getElementById: () => null,
  };
  const ctx = vm.createContext({ document, innerWidth: 1200, location: { hash: '' }, scrollTo() {}, requestAnimationFrame: () => 1,
    Event: function (type) { this.type = type; }, addEventListener: pose('window'), dispatchEvent() {} });
  ctx.window = ctx;
  return { ctx, ecoute, cherche };
}

test('page exportée : le script de lecture démarre sans globale de l\'éditeur', () => {
  const page = pageExportee();
  new vm.Script(monter(DEUX_PAGES).ctx.readerScript(), { filename: 'lecture.js' }).runInContext(page.ctx);
  vrai(page.ecoute.document.click && page.ecoute.document.click.length >= 3, 'clics : pliage, copie, sommaire, pages');
  for (const t of ['beforeprint', 'afterprint', 'resize', 'scroll']) vrai(page.ecoute.window[t], 'écouteur ' + t + ' attendu');
  vrai(page.cherche.includes('.pg'), 'pages de l\'export cherchées');
  page.ecoute.window.beforeprint.forEach((f) => f());
  vrai(page.cherche.includes('details.fold:not([open])'), 'impression : blocs dépliables ouverts');
});
