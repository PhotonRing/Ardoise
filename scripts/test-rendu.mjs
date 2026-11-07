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
    '07-kanban.js', '07-rendu.js', '07-requetes.js', '19-mode-lecture-edition.js'].map(js).join('\n');
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

// étapes : automatique, saisie, reprise après un numéro saisi, nonum (sans pastille, ne compte pas), saisie sans chiffre
const ETAPES = {
  title: 'Doc',
  pages: [{ id: 'p1', title: 'Étapes', blocks: [
    { id: 'm1', type: 'summary' },
    { id: 'e1', type: 'step', title: 'Un' },
    { id: 'e2', type: 'step', title: 'Deux' },
    { id: 'e3', type: 'step', title: 'Cinq', num: '5' },
    { id: 'e4', type: 'step', title: 'Six' },
    { id: 'e5', type: 'step', title: 'Sans numéro', nonum: true },
    { id: 'e6', type: 'step', title: 'Sept' },
    { id: 'e7', type: 'step', title: 'Annexe', num: '2b' },
    { id: 'e8', type: 'step', title: 'Trois' },
    { id: 'e9', type: 'step', title: 'Lettre', num: 'A' },
    { id: 'e10', type: 'step', title: 'Quatre' },
  ] }],
};
const NUMEROS = ['1', '2', '5', '6', '7', '2b', '3', 'A', '4'];
const tocN = (h) => textes(h, /<span class="toc-n">([\s\S]*?)<\/span>/g);

test('numérotation des étapes : la même dans la page, le bloc sommaire et le sommaire latéral', () => {
  const { ctx, d } = monter(ETAPES);
  const page = ctx.renderPage(d, { page: 0, view: 'read' });
  egal(textes(page, /<span class="num">([\s\S]*?)<\/span>/g), NUMEROS, 'pastilles de la page');
  egal(tocN(ctx.summaryList(d.pages[0].blocks[0], d, 0)), NUMEROS, 'bloc sommaire');
  egal(tocN(ctx.navHTML(d, { page: 0, view: 'read' })), NUMEROS, 'sommaire latéral');
});

test('numérotation en édition : la pastille vide montre le numéro calculé, la saisie reste telle quelle', () => {
  const { ctx, d } = monter(ETAPES);
  const h = ctx.renderPage(d, { page: 0, view: 'edit' });
  egal([...h.matchAll(/<span class="num fld"[^>]*data-ph="([^"]*)">([^<]*)<\/span>/g)].map((m) => m[1] + '|' + m[2]),
    ['1|', '2|', '5|5', '6|', '7|', '2b|2b', '3|', 'A|A', '4|']);
});

test('stepNums : numéro affiché de chaque étape d\'une page, étapes nonum exclues', () => {
  const { ctx, d } = monter(ETAPES);
  egal(JSON.parse(JSON.stringify(ctx.stepNums(d.pages[0].blocks))),
    { e1: '1', e2: '2', e3: '5', e4: '6', e6: '7', e7: '2b', e8: '3', e9: 'A', e10: '4' });
});

// pliage : niveaux de foldLevel (étape et h2 = 1, h3 = 2, en-tête et pied = 0, autres = -1) ; r[i] = titre plié qui masque i, ou -1
const cache = (levels, plies) => JSON.parse(JSON.stringify(monter(SECTIONS).ctx.Reader.foldHidden(levels, levels.map((_, i) => plies.includes(i)))));

test('foldHidden : une étape ou un h2 plié masque jusqu\'au prochain titre de niveau 1 ou 0, h3 compris', () => {
  egal(cache([1, -1, 2, -1, 1, -1], [0]), [-1, 0, 0, 0, -1, -1], 'étape : jusqu\'à l\'étape suivante');
  egal(cache([1, -1, 0, -1], [0]), [-1, 0, -1, -1], 'h2 : jusqu\'au pied');
});

test('foldHidden : un h3 plié s\'arrête au h3 suivant ou à tout niveau inférieur', () => {
  egal(cache([2, -1, 2, -1], [0]), [-1, 0, -1, -1], 'h3 suivant');
  egal(cache([2, -1, 1, -1], [0]), [-1, 0, -1, -1], 'h2 ou étape');
  egal(cache([2, -1, 0, -1], [0]), [-1, 0, -1, -1], 'en-tête ou pied');
});

test('foldHidden : en-tête, pied et blocs ordinaires ne plient rien ; un titre sans contenu ne masque rien', () => {
  egal(cache([0, -1, -1, 0, -1], [0, 1, 3]), [-1, -1, -1, -1, -1]);
  egal(cache([1, 1, -1], [0]), [-1, -1, -1]);
});

test('foldHidden : plis imbriqués, le titre le plus extérieur masque tout ; déplié, le pli intérieur masque encore le sien', () => {
  egal(cache([1, -1, 2, -1, 2, -1, 1], [0, 2]), [-1, 0, 0, 0, 0, 0, -1], 'h2 et h3 pliés');
  egal(cache([1, -1, 2, -1, 2, -1, 1], [2]), [-1, -1, -1, 2, -1, -1, -1], 'h3 seul');
});

// page en lecture montée dans un DOM minimal (une ligne par bloc, sections d'étape), pour le pliage de la page exportée :
// chaque élément garde ses attributs ; etats() rend texte du bloc → 'plié' | 'masqué' | '' comme plis()
function domLecture(html) {
  const el = (tag, attrs, parent) => {
    const e = { tagName: tag.toUpperCase(), attrs, children: [], parentNode: parent, texte: '',
      getAttribute: (k) => (k in e.attrs ? e.attrs[k] : null), hasAttribute: (k) => k in e.attrs,
      setAttribute: (k, v) => { e.attrs[k] = String(v); }, removeAttribute: (k) => { delete e.attrs[k]; },
      classList: { contains: (c) => (e.attrs.class || '').split(' ').includes(c) },
      get nextElementSibling() { const s = e.parentNode.children; return s[s.indexOf(e) + 1] || null; },
      get previousElementSibling() { const s = e.parentNode.children; return s[s.indexOf(e) - 1] || null; },
      querySelector: (s) => (s === '[data-vfold]' && e.bouton) || null,
      closest: (s) => { for (let x = e; x; x = x.parentNode) if (correspond(x, s)) return x; return null; } };
    if (parent) parent.children.push(e);
    return e;
  };
  const correspond = (x, s) => (s[0] === '.' ? x.classList.contains(s.slice(1)) : s[0] === '[' ? x.hasAttribute(s.slice(1, -1)) : false);
  const attrsDe = (t) => Object.fromEntries([...t.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].slice(1).map((m) => [m[1], m[2] == null ? '' : m[2]]));
  const wrap = el('div', { class: 'wrap' }, null), blocs = [];
  let parent = wrap;
  for (const ligne of html.replace(/^<div[^>]*>/, '').replace(/<\/div>$/, '').split('\n')) {
    if (ligne === '</section>') { parent = wrap; continue; }
    const t = ligne.match(/^<[^>]*>/)[0], e = el(t.match(/^<(\w+)/)[1], attrsDe(t), parent);
    if (e.tagName === 'SECTION') { parent = e; continue; }
    if (/data-vfold/.test(ligne)) e.bouton = { setAttribute() {} };
    e.texte = ligne.replace(/<[^>]*>/g, ''); blocs.push(e);
  }
  const etats = () => Object.fromEntries(blocs.map((e) => [e.texte, e.hasAttribute('data-folded') ? 'plié' : e.hasAttribute('data-fh') ? 'masqué' : '']));
  return { bloc: (texte) => blocs.find((e) => e.texte === texte), etats };
}
// sections imbriquées et étapes : h3 plié dans un h2, étape pliée qui contient un h3
const IMBRIQUES = {
  title: 'Doc',
  pages: [{ id: 'p1', title: 'Accueil', blocks: [
    { id: 's1', type: 'h2', html: 'Section' }, { id: 'x1', type: 'p', html: 'texte de section' },
    { id: 's2', type: 'h3', html: 'Sous-section', folded: true }, { id: 'x2', type: 'p', html: 'texte de sous-section' },
    { id: 's3', type: 'h2', html: 'Autre section' }, { id: 'x3', type: 'p', html: 'autre texte' },
    { id: 'e1', type: 'step', title: 'Étape un', folded: true }, { id: 's4', type: 'h3', html: 'Détail' }, { id: 'x4', type: 'p', html: 'texte d\'étape' },
    { id: 'e2', type: 'step', title: 'Étape deux' }, { id: 'x5', type: 'p', html: 'suite' },
  ] }],
};
function lecture(folds) {
  const { ctx, d } = monter(IMBRIQUES);
  ctx.window = { dispatchEvent() {} }; ctx.Event = function () {};
  const rendu = (f) => domLecture(ctx.renderPage(d, { page: 0, view: 'read', folds: f })).etats();
  return { ctx, rendu, page: domLecture(ctx.renderPage(d, { page: 0, view: 'read', folds })) };
}

test('pliage au clic de la page exportée : masque la même chose que le rendu de l\'éditeur pour les mêmes plis', () => {
  const { ctx, rendu, page } = lecture({});
  const etapeUn = Object.keys(page.etats()).find((t) => t.includes('Étape un'));
  ctx.Reader.foldToggle(page.bloc('Section'));
  egal(page.etats(), rendu({ s1: true }), 'h2 plié par-dessus un h3 plié');
  ctx.Reader.foldToggle(page.bloc('Section'));
  egal(page.etats(), rendu({}), 'h2 déplié : le h3 reste plié');
  ctx.Reader.foldToggle(page.bloc(etapeUn));
  egal(page.etats(), rendu({ e1: false }), 'étape dépliée');
  ctx.Reader.foldToggle(page.bloc('Détail'));
  egal(page.etats(), rendu({ e1: false, s4: true }), 'h3 plié dans une étape : jusqu\'à l\'étape suivante');
});

test('foldReveal : déplie tous les titres qui cachent le bloc visé, comme revealBlock dans l\'éditeur', () => {
  const { ctx, rendu, page } = lecture({ s1: true });
  ctx.Reader.foldReveal(page.bloc('texte de sous-section'));
  egal(page.etats(), rendu({ s1: false, s2: false }), 'h2 et h3 dépliés');
});

// Ancrage à la bascule lecture / édition : bloc qui garde sa hauteur à l'écran dans la vue cible
const ANCRES = {
  title: 'Doc',
  pages: [{ id: 'p1', title: 'Page', blocks: [
    { id: 't1', type: 'h2', html: 'Section pliée', folded: true },
    { id: 'x1', type: 'p', html: 'dans la section pliée' },
    { id: 't2', type: 'h3', html: 'Sous-section pliée', folded: true },
    { id: 'x2', type: 'p', html: 'dans la sous-section' },
    { id: 't3', type: 'h2', html: 'Section ouverte' },
    { id: 'x3', type: 'p', html: 'visible partout' },
  ] }],
};

test('ancrage en édition : un bloc de section pliée s\'ancre sur son titre, le plus externe s\'il y en a plusieurs', () => {
  const { ctx, d } = monter(ANCRES);
  const edit = { page: 0, view: 'edit' };
  egal(ctx.anchorBlock(d, edit, 'x1'), 't1', 'bloc de la section pliée');
  egal(ctx.anchorBlock(d, edit, 'x2'), 't1', 'bloc d\'une sous-section pliée dans une section pliée');
  egal(ctx.anchorBlock(d, edit, 'x3'), 'x3', 'bloc visible');
  egal(ctx.anchorBlock(d, edit, 't1'), 't1', 'titre plié');
});

test('ancrage en lecture : les plis de la session décident, pas l\'état enregistré', () => {
  const { ctx, d } = monter(ANCRES);
  const lecture = { page: 0, view: 'read', folds: { t1: false, t3: true } };
  egal(ctx.anchorBlock(d, lecture, 'x1'), 'x1', 'section dépliée pendant la session');
  egal(ctx.anchorBlock(d, lecture, 'x2'), 't2', 'sous-section restée pliée');
  egal(ctx.anchorBlock(d, lecture, 'x3'), 't3', 'section pliée pendant la session');
});

test('ancrage en lecture : un bloc qui n\'affiche rien s\'ancre sur le bloc visible le plus proche, le précédent d\'abord', () => {
  // un sommaire sans titre à lister n'affiche rien en lecture
  const { ctx, d } = monter({ title: 'Doc', pages: [{ id: 'p1', title: 'Page', blocks: [
    { id: 's1', type: 'summary' }, { id: 'y1', type: 'p', html: 'un' }, { id: 's2', type: 'summary' }, { id: 'y2', type: 'p', html: 'deux' },
  ] }] });
  const lecture = { page: 0, view: 'read' };
  egal(ctx.anchorBlock(d, lecture, 's2'), 'y1', 'le précédent');
  egal(ctx.anchorBlock(d, lecture, 's1'), 'y1', 'le suivant quand rien ne précède');
  egal(ctx.anchorBlock(d, { page: 0, view: 'edit' }, 's2'), 's2', 'en édition le sommaire vide s\'affiche');
});

test('lecture : chaque bloc affiché porte son id (data-bid) pour l\'ancrage ; l\'export n\'en porte aucun', () => {
  const { ctx, d } = monter(ANCRES);
  const ids = (h) => [...h.matchAll(/data-bid="([^"]*)"/g)].map((m) => m[1]);
  egal(ids(ctx.renderPage(d, { page: 0, view: 'read' })), ['t1', 'x1', 't2', 'x2', 't3', 'x3']);
  egal(ids(ctx.renderPage(d, { page: 0, view: 'export' })), []);
});

for (const [nom, fn] of tests) {
  try { fn(); n++; } catch (e) { console.error(`ÉCHEC : ${nom}\n${e.stack || e.message}`); process.exit(1); }
}
console.log(`rendu : OK (${n} tests)`);
