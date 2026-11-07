// Banc d'essai du rendu (src/js/07-rendu.js, 07-requetes.js, 07-kanban.js) et du runtime de lecture (01-lecture.js,
// scripts/fermeture.mjs). Une page, le sommaire, les requêtes et le fichier enregistré sont rendus dans node:vm, sans DOM, à partir d'un document et d'un contexte explicite. Les
// fonctions qui exigent le DOM (assainisseur R, textOf, linesHTML) et la couleur des pastilles (paintPills) sont
// remplacées par des équivalents purs : l'assainissement n'est pas couvert ici. La globale `doc` est piégée et l'état
// de vue de l'éditeur (mode, tris, plis) est rempli : le rendu ne doit lire ni l'un ni l'autre.  node scripts/test-rendu.mjs
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { closureLeaks } from './fermeture.mjs';

const js = (f) => readFileSync(new URL('../src/js/' + f, import.meta.url), 'utf8');
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
  ['01-lecture.js', '01-moteur-carte.js', '03-types-de-blocs.js', '05-document.js', '05-migrations.js', '06-coloration-syntaxique.js',
    '07-kanban.js', '07-rendu.js', '07-requetes.js'].map(js).join('\n');
const SCRIPT = new vm.Script(SOURCE, { filename: 'rendu.js' });

// Un contexte neuf, sans DOM : seul `document.querySelector` existe (l'en-tête cherche #app au chargement)
function contexte() {
  const ctx = vm.createContext({ document: { querySelector: () => null, querySelectorAll: () => [] } });
  SCRIPT.runInContext(ctx);
  return ctx;
}
// Document normalisé ; puis globale `doc` piégée et état de vue de l'éditeur rempli, que le rendu doit ignorer
function monter(brut, vue) {
  const ctx = contexte();
  const d = ctx.normalize(JSON.parse(JSON.stringify(brut)));
  ctx.doc = new Proxy({}, { get: (_, k) => { throw new Error('le rendu lit la globale doc (' + String(k) + ')'); } });
  ctx.mode = 'view';
  Object.assign(ctx.viewFold, (vue && vue.folds) || {});
  Object.assign(ctx.viewSort, (vue && vue.sort) || {});
  Object.assign(ctx.navFold, (vue && vue.navFolds) || {});
  return { ctx, d };
}

let n = 0;
const tests = [];
const test = (nom, fn) => tests.push([nom, fn]);
const egal = (a, b, msg) => { const ja = JSON.stringify(a), jb = JSON.stringify(b); if (ja !== jb) throw new Error(`${msg || ''}\n  obtenu  : ${ja}\n  attendu : ${jb}`); };
const vrai = (v, msg) => { if (!v) throw new Error(msg); };
// textes des balises <tag> d'un rendu, dans l'ordre
const textes = (html, re) => [...html.matchAll(re)].map((m) => m[1].replace(/<[^>]*>/g, ''));

const DEUX_PAGES = {
  title: 'Doc',
  pages: [
    { id: 'p1', title: 'Accueil', blocks: [{ id: 'a1', type: 'h2', html: 'Première page' }] },
    { id: 'p2', title: 'Suite', blocks: [{ id: 'b1', type: 'h2', html: 'Deuxième page' }, { id: 'b2', type: 'p', html: 'texte de la suite' }] },
  ],
};

test('rend une page autre que la page courante, sans changer la page courante', () => {
  const { ctx, d } = monter(DEUX_PAGES);
  const h = ctx.renderPage(d, { page: 1, view: 'read' });
  vrai(h.includes('Deuxième page') && h.includes('texte de la suite'), 'contenu de la page 2 attendu :\n' + h);
  vrai(!h.includes('Première page'), 'la page 1 ne doit pas apparaître');
  egal(d.cur, 0, 'page courante inchangée');
});

// requête sur des fiches de faits, rangées par nom croissant dans le document ; ordre lu dans la première colonne
const FICHE = (id, nom) => ({ id, type: 'facts', items: [{ k: 'Nom', v: nom }] });
const REQUETE = {
  title: 'Doc',
  pages: [{ id: 'p1', title: 'Accueil', blocks: [FICHE('f1', 'Alpha'), FICHE('f2', 'Bravo'), FICHE('f3', 'Charlie'),
    { id: 'q1', type: 'query', src: 'facts', scope: 'doc', view: 'table', sortBy: 'c:nom', sortDir: 'asc' }] }],
};
const TRI_DESC = { q1: { by: 'c:nom', dir: 'desc' } };
const ordre = (h) => textes(h, /<tr><td>([\s\S]*?)<\/td>/g);

test('le tri de lecture d\'une requête s\'applique en vue read', () => {
  const { ctx, d } = monter(REQUETE);
  egal(ordre(ctx.renderPage(d, { page: 0, view: 'read' })), ['Alpha', 'Bravo', 'Charlie'], 'sans tri de session : tri enregistré');
  egal(ordre(ctx.renderPage(d, { page: 0, view: 'read', sort: TRI_DESC })), ['Charlie', 'Bravo', 'Alpha'], 'tri de session');
});

test('le tri de session est ignoré en vue export et en édition ; l\'export n\'a pas d\'en-tête cliquable', () => {
  const { ctx, d } = monter(REQUETE);
  const ex = ctx.renderPage(d, { page: 0, view: 'export', sort: TRI_DESC });
  egal(ordre(ex), ['Alpha', 'Bravo', 'Charlie'], 'export');
  vrai(!ex.includes('data-qsort'), 'export : pas de bouton de tri');
  vrai(ctx.renderPage(d, { page: 0, view: 'read' }).includes('data-qsort'), 'lecture : en-têtes cliquables');
  const ed = ctx.renderPage(d, { page: 0, view: 'edit', sort: TRI_DESC });
  egal(ordre(ed), ['Alpha', 'Bravo', 'Charlie'], 'édition');
});

test('kanban : cartes déplaçables en lecture, sans commande de déplacement en vue export', () => {
  const { ctx, d } = monter({ title: 'Doc', pages: [{ id: 'p1', blocks: [{ id: 'k1', type: 'kanban', cols: [{ id: 'c1', title: 'À faire', cards: [{ id: 'x', title: 'Tâche' }] }] }] }] });
  const lu = ctx.renderPage(d, { page: 0, view: 'read' }), ex = ctx.renderPage(d, { page: 0, view: 'export' });
  vrai(lu.includes('data-kbmove') && lu.includes('draggable="true"'), 'lecture : carte déplaçable');
  vrai(ex.includes('Tâche') && !ex.includes('data-kbmove') && !ex.includes('draggable'), 'export : carte figée');
});

// deux sections : la première contient un paragraphe et une sous-section ; la seconde est pliée dans le document
const SECTIONS = {
  title: 'Doc',
  pages: [{ id: 'p1', title: 'Accueil', blocks: [
    { id: 's1', type: 'h2', html: 'Section un' }, { id: 'x1', type: 'p', html: 'dans un' },
    { id: 's2', type: 'h3', html: 'Sous-section' }, { id: 'x2', type: 'p', html: 'dans la sous-section' },
    { id: 's3', type: 'h2', html: 'Section deux', folded: true }, { id: 'x3', type: 'p', html: 'dans deux' },
  ] }],
};
// attributs de pliage posés sur la balise de chaque bloc rendu en lecture
const plis = (h) => Object.fromEntries([...h.matchAll(/<\w+[^>]*>(?:<button[^>]*data-vfold[^>]*><\/button>)?([^<]+)</g)]
  .map((m) => [m[1], /data-folded/.test(m[0]) ? 'plié' : /data-fh/.test(m[0]) ? 'masqué' : '']));

test('pliage en lecture : plis de session en vue read, état enregistré sinon', () => {
  const { ctx, d } = monter(SECTIONS);
  egal(plis(ctx.renderPage(d, { page: 0, view: 'read' })),
    { 'Section un': '', 'dans un': '', 'Sous-section': '', 'dans la sous-section': '', 'Section deux': 'plié', 'dans deux': 'masqué' }, 'état enregistré');
  egal(plis(ctx.renderPage(d, { page: 0, view: 'read', folds: { s1: true, s3: false } })),
    { 'Section un': 'plié', 'dans un': 'masqué', 'Sous-section': 'masqué', 'dans la sous-section': 'masqué', 'Section deux': '', 'dans deux': '' }, 'plis de session');
  egal(plis(ctx.renderPage(d, { page: 0, view: 'export', folds: { s1: true, s3: false } }))['Section deux'], 'plié', 'export : plis de session ignorés');
});

test('pliage en édition : les blocs d\'une section pliée ne sont pas rendus', () => {
  const { ctx, d } = monter(SECTIONS);
  const h = ctx.renderPage(d, { page: 0, view: 'edit', folds: { s3: false } });
  vrai(h.includes('Section deux') && !h.includes('dans deux'), 'section pliée du document masquée en édition');
  vrai(h.includes('1 bloc masqué'), 'nombre de blocs masqués affiché');
});

test('barre d\'outils maintenue : seulement en édition, sur le bloc du contexte', () => {
  const { ctx, d } = monter(SECTIONS);
  const h = ctx.renderPage(d, { page: 0, view: 'edit', editor: { bar: 'x1' } });
  egal([...h.matchAll(/class="blk bar-on[^"]*" data-id="(\w+)"/g)].map((m) => m[1]), ['x1']);
  vrai(!ctx.renderPage(d, { page: 0, view: 'edit' }).includes('bar-on'), 'sans contexte d\'édition : aucune barre maintenue');
});

// trois pages : Accueil, et sa sous-page Détail (avec deux sections et un bloc sommaire), puis Annexe
const ARBRE = {
  title: 'Doc',
  pages: [
    { id: 'p1', title: 'Accueil', blocks: [{ id: 'a1', type: 'h2', html: 'Intro' }] },
    { id: 'p2', title: 'Détail', lv: 1, blocks: [{ id: 'm1', type: 'summary' }, { id: 'd1', type: 'h2', html: 'Méthode' }, { id: 'd2', type: 'h3', html: 'Mesures' }] },
    { id: 'p3', title: 'Annexe', blocks: [{ id: 'z1', type: 'h2', html: 'Sources' }] },
  ],
};
const liens = (h) => textes(h, /<a href="[^"]*"[^>]*>([\s\S]*?)<\/a>/g);

test('bloc sommaire d\'une page autre que la page courante : ses propres sections', () => {
  const { ctx, d } = monter(ARBRE);
  egal(liens(ctx.renderPage(d, { page: 1, view: 'read' })), ['Méthode', 'Mesures']);
  egal(ctx.summaryList(d.pages[1].blocks[0], d, 1).includes('#pg-p2/d1'), true, 'lien vers la section de la page 2');
});

test('sommaire latéral : page du contexte, ses sections, plis du sommaire', () => {
  const { ctx, d } = monter(ARBRE);
  const h = ctx.navHTML(d, { page: 1, view: 'read' });
  egal([...h.matchAll(/<li class="toc-p on[^"]*" data-pgi="(\d)"/g)].map((m) => m[1]), ['1'], 'page 2 en cours');
  egal(textes(h, /<a href="#b-[^"]*" data-sec="[^"]*">([\s\S]*?)<\/a>/g), ['Méthode', 'Mesures'], 'sections de la page en cours seulement');
  vrai(/data-pgi="0"[^>]*>/.test(h) && /class="toc-p has-kids open" data-pgi="0"/.test(h), 'parent de la page en cours déplié');
  vrai(/class="toc-p has-kids" data-pgi="0"/.test(ctx.navHTML(d, { page: 1, view: 'read', navFolds: { p1: false } })), 'replié à la main');
  const ex = ctx.navHTML(d, { page: 0, view: 'export' });
  egal(textes(ex, /<a href="#b-[^"]*" data-sec="[^"]*">([\s\S]*?)<\/a>/g), ['Intro', 'Méthode', 'Mesures', 'Sources'], 'export : sections de toutes les pages');
  vrai(!ex.includes('data-pgm') && h.indexOf('data-pgm') < 0 && ctx.navHTML(d, { page: 1, view: 'edit' }).includes('data-pgm'), 'menus de page en édition seulement');
});

test('fichier enregistré : le même en lecture et en édition, avec des tris et des plis de session', () => {
  const brut = { title: 'Doc', pages: [REQUETE.pages[0], SECTIONS.pages[0]].map((pg, i) => ({ ...pg, id: 'p' + i })) };
  const neutre = monter(brut), session = monter(brut, { sort: TRI_DESC, folds: { s1: true, s3: false }, navFolds: { p0: false } });
  const ref = neutre.ctx.fileAppHTML(neutre.d, 0);
  egal(ordre(ref), ['Alpha', 'Bravo', 'Charlie'], 'tri enregistré');
  for (const m of ['view', 'edit']) {
    session.ctx.mode = m; session.ctx.barHold = 'q1';
    egal(session.ctx.fileAppHTML(session.d, 0), ref, 'mode ' + m);
  }
  session.d.cur = 1; neutre.d.cur = 1;
  egal(plis(session.ctx.fileAppHTML(session.d, 1))['Section deux'], 'plié', 'plis enregistrés, pas ceux de la session');
  egal(session.ctx.fileAppHTML(session.d, 1), neutre.ctx.fileAppHTML(neutre.d, 1), 'page 2');
});

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

test('fermeture : ardoiseReader et ardoiseMapKit ne citent aucune globale de l\'éditeur', () => {
  const tout = readdirSync(new URL('../src/js/', import.meta.url)).filter((f) => f.endsWith('.js')).sort().map(js).join('');
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

for (const [nom, fn] of tests) {
  try { fn(); n++; } catch (e) { console.error(`ÉCHEC : ${nom}\n${e.stack || e.message}`); process.exit(1); }
}
console.log(`rendu : OK (${n} tests)`);
