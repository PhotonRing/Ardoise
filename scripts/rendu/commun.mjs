// Outils communs du banc du rendu : chargement des sources dans node:vm sans DOM, document monté, assertions.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export const js = (f) => readFileSync(new URL('../../src/js/' + f, import.meta.url), 'utf8');
// l'en-tête ouvre l'IIFE commune : on la retire pour que les déclarations soient des globales du contexte
const OUVERTURE = '\n(function () {\n';
const entete = js('00-entete.js');
if (!entete.startsWith(OUVERTURE)) throw new Error('00-entete.js : ouverture de l\'IIFE introuvable, adapter le banc');
// équivalents purs des fonctions de 02-assainissement.js et 15-pastilles.js (le texte des essais est déjà propre)
const PURS = `
function R(h) { return String(h == null ? '' : h); }
function textOf(h) { return htmlText(h).replace(/\\s+/g, ' ').trim(); }
function isBlank(h) { return !textOf(h); }
function linesHTML(h) { return h; }
function paintPills(h) { return h; }
`;
const SOURCE = entete.slice(OUVERTURE.length) + PURS +
  ['01-lecture.js', '01-moteur-carte.js', '03-types-de-blocs.js', '05-document.js', '05-migrations.js', '05-presse-papier.js', '05-tableau.js', '06-coloration-syntaxique.js',
    '07-kanban.js', '07-rendu.js', '07-requetes.js'].map(js).join('\n');
const SCRIPT = new vm.Script(SOURCE, { filename: 'rendu.js' });

// Un contexte neuf, sans DOM : seul `document.querySelector` existe (l'en-tête cherche #app au chargement) ;
// `window` et `document` n'écoutent rien, pour que le moteur de carte se construise (distances de l'import d'itinéraire)
export function contexte() {
  const sourd = () => {};
  const ctx = vm.createContext({ document: { querySelector: () => null, querySelectorAll: () => [], addEventListener: sourd }, window: { addEventListener: sourd } });
  SCRIPT.runInContext(ctx);
  return ctx;
}
// Document normalisé ; puis globale `doc` piégée et état de vue de l'éditeur rempli, que le rendu doit ignorer
export function monter(brut, vue) {
  const ctx = contexte();
  const d = ctx.normalize(JSON.parse(JSON.stringify(brut)));
  ctx.doc = new Proxy({}, { get: (_, k) => { throw new Error('le rendu lit la globale doc (' + String(k) + ')'); } });
  ctx.mode = 'view';
  Object.assign(ctx.viewFold, (vue && vue.folds) || {});
  Object.assign(ctx.viewSort, (vue && vue.sort) || {});
  Object.assign(ctx.navFold, (vue && vue.navFolds) || {});
  Object.assign(ctx.viewCol, (vue && vue.kbCols) || {});
  return { ctx, d };
}

export const tests = [];
export const test = (nom, fn) => tests.push([nom, fn]);
export const egal = (a, b, msg) => { const ja = JSON.stringify(a), jb = JSON.stringify(b); if (ja !== jb) throw new Error(`${msg || ''}\n  obtenu  : ${ja}\n  attendu : ${jb}`); };
export const vrai = (v, msg) => { if (!v) throw new Error(msg); };
// textes des balises <tag> d'un rendu, dans l'ordre
export const textes = (html, re) => [...html.matchAll(re)].map((m) => m[1].replace(/<[^>]*>/g, ''));
// deux sections : la première contient un paragraphe et une sous-section ; la seconde est pliée dans le document
export const SECTIONS = {
  title: 'Doc',
  pages: [{ id: 'p1', title: 'Accueil', blocks: [
    { id: 's1', type: 'h2', html: 'Section un' }, { id: 'x1', type: 'p', html: 'dans un' },
    { id: 's2', type: 'h3', html: 'Sous-section' }, { id: 'x2', type: 'p', html: 'dans la sous-section' },
    { id: 's3', type: 'h2', html: 'Section deux', folded: true }, { id: 'x3', type: 'p', html: 'dans deux' },
  ] }],
};
export const DEUX_PAGES = {
  title: 'Doc',
  pages: [
    { id: 'p1', title: 'Accueil', blocks: [{ id: 'a1', type: 'h2', html: 'Première page' }] },
    { id: 'p2', title: 'Suite', blocks: [{ id: 'b1', type: 'h2', html: 'Deuxième page' }, { id: 'b2', type: 'p', html: 'texte de la suite' }] },
  ],
};
