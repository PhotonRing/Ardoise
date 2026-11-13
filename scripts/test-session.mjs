// Banc d'essai de la session du document (src/js/05-session.js) : annuler, rétablir, regroupement de la frappe,
// troncature de l'historique, réception des autres copies. La session est chargée dans node:vm avec l'en-tête, le
// document, les types de blocs, les migrations, l'adaptateur et le moteur de synchronisation, les requêtes (noms des pastilles des libellés), un faux `document`, une
// horloge factice et de faux abonnés ; soit avec un faux adaptateur qui enregistre ses appels, soit, à deux copies,
// avec le vrai adaptateur et un faux relais. Les tests ne passent que par l'interface de la session.  node scripts/test-session.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const js = (f) => readFileSync(new URL('../src/js/' + f, import.meta.url), 'utf8');
// l'en-tête ouvre l'IIFE commune : on la retire pour que `doc` soit une globale du contexte
const OUVERTURE = '\n(function () {\n';
const entete = js('00-entete.js');
if (!entete.startsWith(OUVERTURE)) throw new Error('00-entete.js : ouverture de l\'IIFE introuvable, adapter le banc');
const SOURCE = entete.slice(OUVERTURE.length) +
  ['03-types-de-blocs.js', '05-document.js', '05-libelle-etape.js', '05-markdown.js', '05-migrations.js', '05-session.js', '05-synchro-adaptateur.js', '05-synchro-moteur.js', '05-tableau.js', '07-requetes.js'].map(js).join('\n');
const SCRIPT = new vm.Script(SOURCE, { filename: 'session.js' });

// Un contexte neuf : faux document, horloge factice ; toast et synFlush appartiennent à l'interface (17, 24)
function contexte() {
  const horloge = { t: 0, n: 0, minuteurs: new Map() };
  const ctx = vm.createContext({
    document: { querySelector: () => null, querySelectorAll: () => [] },
    setTimeout: (fn, ms) => { const id = ++horloge.n; horloge.minuteurs.set(id, { fn, at: horloge.t + ms }); return id; },
    clearTimeout: (id) => { horloge.minuteurs.delete(id); },
    toast: () => {},
    synFlush: () => {},
  });
  SCRIPT.runInContext(ctx);
  const avancer = (ms) => {
    horloge.t += ms;
    for (;;) {
      const prochain = [...horloge.minuteurs].filter(([, m]) => m.at <= horloge.t).sort((a, b) => a[1].at - b[1].at)[0];
      if (!prochain) break;
      horloge.minuteurs.delete(prochain[0]); prochain[1].fn();
    }
  };
  return { ctx, avancer };
}
const DEPART = () => ({ title: 'Doc', pages: [{ id: 'p1', title: 'Accueil', blocks: [{ id: 'b1', type: 'p', html: 'a' }] }] });

// Une session avec un faux adaptateur de synchronisation, qui enregistre ses appels
function monter() {
  const { ctx, avancer } = contexte();
  const sync = [];
  const faux = {
    n: 0,
    marque: () => faux.n,
    envoyer: () => { sync.push('envoyer'); },
    rebaser: (json, marque) => { sync.push('rebaser:' + marque); return json; },
    oublier: (marque) => { sync.push('oublier:' + marque); },
    reprendre: (de, vers) => { sync.push('reprendre'); },
  };
  const recu = { rendu: [], modifie: [], historique: [] };
  const s = ctx.creerSession(faux);
  s.abonner('rendu', (focus, info) => recu.rendu.push({ focus, info }));
  s.abonner('modifie', (...args) => recu.modifie.push(args));   // un appel par événement, sans argument
  s.abonner('historique', (etat) => recu.historique.push(etat));
  s.remplacer(DEPART(), 'demarrage');
  const vider = () => { recu.rendu.length = 0; recu.modifie.length = 0; recu.historique.length = 0; sync.length = 0; };
  vider();
  return { s, ctx, avancer, recu, sync, faux, vider, get doc() { return ctx.doc; }, texte: () => ctx.doc.pages[0].blocks[0].html };
}

let n = 0;
const tests = [];
const test = (nom, fn) => tests.push([nom, fn]);
const egal = (a, b, msg) => { const ja = JSON.stringify(a), jb = JSON.stringify(b); if (ja !== jb) throw new Error(`${msg || ''}\n  obtenu  : ${ja}\n  attendu : ${jb}`); };
const ecrire = (m, html) => { m.doc.pages[0].blocks[0].html = html; };
// possibilité d'annuler et de rétablir, sans les libellés (sujet de leurs propres tests)
const possible = (e) => ({ annuler: e.annuler, retablir: e.retablir });

test('modifier valide une étape et prévient rendu (avec le focus), modifié et historique', () => {
  const m = monter();
  m.s.modifier(() => ecrire(m, 'b'), { b: 'b1', k: 'html' });
  egal(m.recu.rendu.map((r) => r.focus), [{ b: 'b1', k: 'html' }]);
  egal(m.recu.modifie, [[]]);
  egal(m.recu.historique.map(possible), [{ annuler: true, retablir: false }]);
  m.s.annuler();
  egal(m.texte(), 'a');
});

test('une modification qui ne change rien ne crée pas d\'étape, mais redessine', () => {
  const m = monter();
  m.s.modifier(() => {});
  egal(m.recu.rendu.length, 1);
  egal(m.recu.historique.map(possible), [{ annuler: false, retablir: false }]);
  egal(m.sync, [], 'rien ne part vers les autres copies');
});

test('saisir prévient « modifié » tout de suite, sans redessiner, et valide l\'étape après 500 ms sans frappe', () => {
  const m = monter();
  m.s.saisir(() => ecrire(m, 'ab'));
  egal(m.recu.modifie, [[]]);
  egal(m.recu.rendu.length, 0);
  m.avancer(300);
  m.s.saisir(() => ecrire(m, 'abc'));
  m.avancer(499);
  egal(possible(m.s.historique()), { annuler: false, retablir: false }, 'pas encore d\'étape à 499 ms du dernier caractère');
  m.avancer(1);
  egal(m.recu.historique.map(possible), [{ annuler: true, retablir: false }]);
  egal(m.sync.filter((x) => x === 'envoyer'), ['envoyer']);
  m.s.annuler();
  egal(m.texte(), 'a', 'une seule étape pour toute la frappe');
});

test('valider valide tout de suite la frappe en attente ; sans frappe en attente, il ne fait rien', () => {
  const m = monter();
  m.s.valider();
  egal(m.recu.historique, [], 'rien sans frappe');
  m.s.saisir(() => ecrire(m, 'ab'));
  m.s.valider();
  egal(possible(m.s.historique()), { annuler: true, retablir: false });
  m.avancer(1000);
  m.s.annuler();
  egal(m.texte(), 'a');
  egal(possible(m.s.historique()), { annuler: false, retablir: true }, 'le délai ne crée pas d\'étape en double');
});

test('annuler et rétablir restaurent l\'état exact et respectent les bornes', () => {
  const m = monter();
  const initial = JSON.stringify(m.doc);
  m.s.modifier(() => ecrire(m, 'b'));
  m.s.modifier(() => { m.doc.title = 'Titre'; m.doc.pages[0].blocks.push({ id: 'b2', type: 'p', html: 'c' }); });
  const apres = JSON.stringify(m.doc);
  m.s.annuler(); m.s.annuler();
  egal(JSON.stringify(m.doc), initial);
  egal([m.doc.title, m.doc.pages[0].blocks.length], ['Doc', 1]);
  m.vider();
  m.s.annuler();
  egal(m.texte(), 'a', 'rien avant le premier état');
  egal(m.recu.rendu.length, 0, 'aucun rendu hors des bornes');
  egal(m.recu.historique.map(possible), [{ annuler: false, retablir: true }]);
  m.s.retablir(); m.s.retablir(); m.vider(); m.s.retablir();
  egal(JSON.stringify(m.doc), apres, 'rétablir refait exactement');
  egal(m.recu.rendu.length, 0, 'rien après le dernier état');
});

test('annuler prévient le rendu avec le focus demandé, « modifié » depuis l\'historique, et envoie les modifications locales', () => {
  const m = monter();
  m.s.modifier(() => ecrire(m, 'b'));
  m.vider();
  m.s.annuler({ b: 'b1', k: 'html' });
  egal(m.recu.rendu, [{ focus: { b: 'b1', k: 'html' }, info: { historique: true } }]);
  egal(m.recu.modifie, [[]]);
  egal(m.sync.filter((x) => x === 'envoyer'), ['envoyer']);
});

test('annuler valide d\'abord la frappe en attente, qui devient annulable', () => {
  const m = monter();
  m.s.modifier(() => ecrire(m, 'b'));
  m.s.saisir(() => ecrire(m, 'bc'));
  m.s.annuler();
  egal(m.texte(), 'b');
  m.s.retablir();
  egal(m.texte(), 'bc');
});

test('annuler garde la page affichée, bornée au nombre de pages', () => {
  const m = monter();
  m.s.modifier(() => { m.doc.pages.push({ id: 'p2', title: 'Deux', blocks: [] }); });
  m.s.modifier(() => { m.doc.pages.push({ id: 'p3', title: 'Trois', blocks: [] }); });
  m.doc.cur = 1;
  m.s.annuler();
  egal(m.doc.cur, 1, 'même page');
  m.s.retablir();
  m.doc.cur = 2;
  m.s.annuler();
  egal([m.doc.pages.length, m.doc.cur], [2, 1], 'dernière page si la sienne n\'existe plus');
  egal(m.doc.blocks, [], 'doc.blocks suit la page affichée');
});

test('une nouvelle modification après des annulations efface les étapes « rétablir »', () => {
  const m = monter();
  m.s.modifier(() => ecrire(m, 'b'));
  m.s.modifier(() => ecrire(m, 'c'));
  m.s.annuler(); m.s.annuler();
  m.s.modifier(() => ecrire(m, 'z'));
  egal(possible(m.s.historique()), { annuler: true, retablir: false });
  m.s.retablir();
  egal(m.texte(), 'z');
  m.s.annuler();
  egal(m.texte(), 'a');
});

test('l\'historique garde les 300 derniers états', () => {
  const m = monter();
  for (let i = 1; i <= 310; i++) m.s.modifier(() => ecrire(m, 'v' + i));
  for (let i = 0; i < 400; i++) m.s.annuler();
  egal(m.texte(), 'v11', '300 états : v11 à v310');
  egal(possible(m.s.historique()), { annuler: false, retablir: true });
});

test('modification en place : saisir puis valider donne une étape tout de suite, sans redessiner', () => {
  const m = monter();
  m.s.saisir(() => ecrire(m, 'b'));
  m.s.valider();
  egal(m.recu.rendu.length, 0, 'pas de rendu');
  egal(m.recu.modifie.length, 1, '« modifié » prévenu');
  egal(m.sync.filter((x) => x === 'envoyer').length, 1, 'un seul envoi');
  egal(possible(m.s.historique()), { annuler: true, retablir: false });
  m.avancer(1000);
  egal(m.sync.filter((x) => x === 'envoyer').length, 1, 'le délai ne valide rien de plus');
  m.s.annuler();
  egal(m.texte(), 'a');
});

// ---------- adaptateur de synchronisation ----------
test('les modifications locales partent après chaque étape validée et après annuler / rétablir, jamais sans effet', () => {
  const m = monter();
  const envois = () => m.sync.filter((x) => x === 'envoyer').length;
  m.s.modifier(() => {});
  egal(envois(), 0, 'modification sans effet');
  m.s.modifier(() => ecrire(m, 'b'));
  egal(envois(), 1, 'après modifier');
  m.s.saisir(() => ecrire(m, 'bc'));
  egal(envois(), 1, 'pas pendant la frappe');
  m.s.valider();
  egal(envois(), 2, 'après valider');
  m.s.saisir(() => ecrire(m, 'bcd'));
  m.avancer(500);
  egal(envois(), 3, 'après les 500 ms de la frappe');
  m.s.annuler();
  egal(envois(), 4, 'après annuler');
  m.s.retablir();
  egal(envois(), 5, 'après rétablir');
});

test('annuler rebase l\'état restauré à partir de sa marque et reprend la configuration de synchronisation', () => {
  const m = monter();
  m.faux.n = 7;
  m.s.modifier(() => ecrire(m, 'b'));
  m.faux.n = 9;
  m.s.modifier(() => ecrire(m, 'c'));
  m.vider();
  m.s.annuler();
  egal(m.sync, ['rebaser:7', 'reprendre', 'envoyer']);
});

test('la troncature de l\'historique fait oublier les modifications reçues plus anciennes que le plus ancien état', () => {
  const m = monter();
  for (let i = 1; i <= 300; i++) { m.faux.n = i; m.s.modifier(() => ecrire(m, 'v' + i)); }
  egal(m.sync.filter((x) => x.startsWith('oublier')), ['oublier:1'], 'le 301e état fait tomber le premier ; le plus ancien gardé porte la marque 1');
});

test('la configuration de synchronisation survit à annuler / rétablir (vrai adaptateur, synchronisation inactive)', () => {
  const { ctx } = contexte();
  ctx.session.remplacer(DEPART(), 'demarrage');
  ctx.synSetCfg(ctx.doc, { relay: 'ws://relais', key: 'k' });
  ctx.session.modifier(() => { ctx.doc.title = 'Autre'; });
  ctx.session.annuler();
  egal([ctx.doc.title, ctx.doc.sync], ['Doc', { relay: 'ws://relais', key: 'k' }], 'après annuler');
  ctx.session.retablir();
  egal([ctx.doc.title, ctx.doc.sync], ['Autre', { relay: 'ws://relais', key: 'k' }], 'après rétablir');
  egal(Object.keys(ctx.doc).includes('sync'), false, 'reste hors de l\'historique');
});

// ---------- réception ----------
const distant = (m, f) => { const e = JSON.parse(JSON.stringify(m.ctx.synSubset(m.doc))); f(e); return e; };
const recevoir = (m, f) => m.s.recevoir(distant(m, f), m.ctx.SYN_KEYS);   // l'appelant donne les clés à appliquer

test('une modification reçue s\'applique sans créer d\'étape d\'annulation, et prévient les abonnés', () => {
  const m = monter();
  m.s.modifier(() => ecrire(m, 'b'));
  m.vider();
  recevoir(m, (e) => { e.title = 'Reçu'; });
  egal(m.doc.title, 'Reçu');
  egal(m.recu.rendu, [{ focus: null, info: { distant: true } }]);
  egal(m.recu.modifie, [[]]);
  egal(m.recu.historique.map(possible), [{ annuler: true, retablir: false }]);
  egal(m.sync, [], 'rien ne repart vers les autres copies');
  m.s.annuler();
  egal(m.texte(), 'a', 'annuler revient d\'une seule étape locale');
  m.s.retablir();
  egal([m.texte(), m.doc.title], ['b', 'Reçu'], 'l\'état courant contenait l\'arrivée');
});

test('une clé absente de l\'état reçu est retirée ; les clés propres au fichier restent', () => {
  const m = monter();
  m.s.modifier(() => { m.doc.mapKey = 'cle'; m.doc.id = 'fichier'; });
  recevoir(m, (e) => { delete e.mapKey; });
  egal([m.doc.mapKey, m.doc.id], [undefined, 'fichier']);
});

test('la page affichée reste la même, repérée par son identifiant, quand une modification reçue réordonne les pages', () => {
  const m = monter();
  m.s.modifier(() => { m.doc.pages.push({ id: 'p2', title: 'Deux', blocks: [] }, { id: 'p3', title: 'Trois', blocks: [] }); });
  m.doc.cur = 1;
  recevoir(m, (e) => { e.pages.reverse(); });
  egal([m.doc.pages[m.doc.cur].id, m.doc.cur], ['p2', 1]);
  m.doc.cur = 0;
  recevoir(m, (e) => { e.pages = e.pages.filter((p) => p.id !== 'p3'); });
  egal(m.doc.pages[m.doc.cur].id, 'p2', 'p3 disparue : page bornée');
  recevoir(m, (e) => { e.pages = []; });
  egal(m.doc.pages.length, 1, 'jamais sans page');
});

// ---------- deux copies : vrai moteur et vrai adaptateur, faux transport ----------
const DEUX = () => ({ title: 'Doc', pages: [{ id: 'p1', title: 'Accueil', blocks: [{ id: 'b1', type: 'p', html: 'a' }, { id: 'b2', type: 'p', html: 'b' }] }] });
function copie(acteur, fraiche, depart) {
  const { ctx, avancer } = contexte();
  ctx.session.remplacer((depart || DEUX)(), 'demarrage');
  // synchronisation minimale, comme synStart sans connexion ; une copie fraîche adopte le document des autres
  ctx.syn = { st: ctx.synCreate(acteur), base: {}, pending: [], patches: [], patchBase: 0, adopt: !!fraiche, sendT: 0 };
  ctx.synLocal();
  const bloc = (id) => ctx.doc.pages[0].blocks.filter((x) => x.id === id)[0].html;
  return { ctx, avancer, s: ctx.session, bloc };
}
// le relais : ce qui attend chez l'une est intégré chez l'autre, jusqu'à ce que plus rien ne circule
function echanger(a, b) {
  for (let tour = 0; tour < 10; tour++) {
    let rien = true;
    for (const [de, vers] of [[a, b], [b, a]]) {
      const ops = de.ctx.syn.pending; de.ctx.syn.pending = [];
      if (ops.length) { rien = false; vers.ctx.synIntegrer(vers.ctx.syn, [JSON.parse(JSON.stringify(ops))], false); }
    }
    if (rien) return;
  }
  throw new Error('le relais ne se stabilise pas');
}
function relier(depart) { const a = copie('A', false, depart), b = copie('B', true, depart); echanger(a, b); return { a, b }; }

test('deux copies : annuler ses propres modifications garde celles reçues entre-temps', () => {
  const { a, b } = relier();
  egal([b.bloc('b1'), b.bloc('b2')], ['a', 'b'], 'la copie fraîche a adopté le document');
  a.s.modifier(() => { a.ctx.doc.pages[0].blocks[0].html = 'a-A'; });
  b.s.modifier(() => { b.ctx.doc.pages[0].blocks[1].html = 'b-B'; });
  echanger(a, b);
  egal([a.bloc('b1'), a.bloc('b2'), b.bloc('b1'), b.bloc('b2')], ['a-A', 'b-B', 'a-A', 'b-B']);
  a.s.annuler();
  egal([a.bloc('b1'), a.bloc('b2')], ['a', 'b-B'], 'l\'annulation garde la modification de B');
  egal(possible(a.s.historique()), { annuler: false, retablir: true }, 'l\'arrivée n\'a pas créé d\'étape chez A');
  echanger(a, b);
  egal([b.bloc('b1'), b.bloc('b2')], ['a', 'b-B'], 'l\'annulation part vers B');
  a.s.retablir();
  echanger(a, b);
  egal([a.bloc('b1'), a.bloc('b2'), b.bloc('b1'), b.bloc('b2')], ['a-A', 'b-B', 'a-A', 'b-B'], 'rétablir aussi');
});

test('deux copies : la frappe en cours n\'est pas écrasée par une arrivée, part vers l\'autre copie et reste annulable seule', () => {
  const { a, b } = relier();
  b.s.saisir(() => { b.ctx.doc.pages[0].blocks[1].html = 'b-frappe'; });
  a.s.modifier(() => { a.ctx.doc.pages[0].blocks[0].html = 'a-A'; });
  echanger(a, b);
  egal([b.bloc('b1'), b.bloc('b2')], ['a-A', 'b-frappe'], 'chez B');
  egal([a.bloc('b1'), a.bloc('b2')], ['a-A', 'b-frappe'], 'chez A');
  b.avancer(1000);
  b.s.annuler();
  egal([b.bloc('b1'), b.bloc('b2')], ['a-A', 'b'], 'B n\'annule que sa frappe');
  egal(possible(b.s.historique()), { annuler: false, retablir: true });
});

test('deux copies : la troncature de l\'historique fait oublier les modifications reçues trop anciennes', () => {
  const { a, b } = relier();
  b.s.modifier(() => { b.ctx.doc.title = 'reçu'; });
  echanger(a, b);
  egal(a.ctx.syn.patches.length, 1);
  for (let i = 1; i <= 300; i++) a.s.modifier(() => { a.ctx.doc.pages[0].blocks[0].html = 'v' + i; });
  egal(a.ctx.syn.patches.length, 0, 'plus aucun état gardé n\'est antérieur à l\'arrivée');
  for (let i = 0; i < 400; i++) a.s.annuler();
  egal([a.bloc('b1'), a.ctx.doc.title], ['v1', 'reçu']);
});

// ---------- deux copies : l'autre copie change la structure (pages, blocs) ----------
// trois pages ; la première a quatre blocs. On lit l'état d'une copie : ordre des pages, niveaux, blocs d'une page.
const TROIS = () => ({ title: 'Doc', pages: [
  { id: 'p1', title: 'Un', blocks: [{ id: 'b1', type: 'p', html: '1' }, { id: 'b2', type: 'p', html: '2' }, { id: 'b3', type: 'p', html: '3' }, { id: 'b4', type: 'p', html: '4' }] },
  { id: 'p2', title: 'Deux', blocks: [] }, { id: 'p3', title: 'Trois', blocks: [] }] });
const pages = (c) => c.ctx.doc.pages.map((p) => p.id);
const niveaux = (c) => c.ctx.doc.pages.map((p) => p.lv || 0);
const blocs = (c, pid = 'p1') => c.ctx.doc.pages.filter((p) => p.id === pid)[0].blocks.map((x) => x.id + '=' + x.html);
const page = (d, pid) => d.pages.filter((p) => p.id === pid)[0];
const bloc = (d, id, pid = 'p1') => page(d, pid).blocks.filter((x) => x.id === id)[0];
const deplacer = (t, id, i) => { const j = t.findIndex((x) => x.id === id); const [x] = t.splice(j, 1); t.splice(i, 0, x); };
// A fait `local`, échange, B fait `recu`, échange, A annule puis rétablit ; après chacun, `lire(copie)` donne `annule`
// puis `retabli`, chez A comme chez B. `local` et `recu` reçoivent le document de leur copie
function croiser(depart, local, recu, lire, annule, retabli) {
  const { a, b } = relier(depart);
  a.s.modifier(() => local(a.ctx.doc)); echanger(a, b);
  b.s.modifier(() => recu(b.ctx.doc)); echanger(a, b);
  a.s.annuler(); echanger(a, b);
  for (const c of [a, b]) egal(lire(c), annule, 'après annuler, chez ' + c.ctx.syn.st.actor);
  a.s.retablir(); echanger(a, b);
  for (const c of [a, b]) egal(lire(c), retabli, 'après rétablir, chez ' + c.ctx.syn.st.actor);
  return { a, b };
}
// A tape dans b1, B fait `changement` ; `attendu(tape)` : pages et blocs de p1, frappe annulée ou rétablie
const frappePuis = (changement, attendu) =>
  croiser(TROIS, (d) => { bloc(d, 'b1').html = '1-A'; }, changement, (c) => [pages(c), blocs(c)], attendu(false), attendu(true));
const b1 = (tape) => 'b1=' + (tape ? '1-A' : '1');

test('deux copies : annuler sa frappe garde le nouvel ordre des pages reçu', () => {
  frappePuis((d) => { d.pages.reverse(); }, (t) => [['p3', 'p2', 'p1'], [b1(t), 'b2=2', 'b3=3', 'b4=4']]);
});

test('deux copies : annuler sa frappe garde la page ajoutée ou supprimée par l\'autre copie', () => {
  frappePuis((d) => { d.pages.splice(1, 0, { id: 'p4', title: 'Quatre', blocks: [] }); }, (t) => [['p1', 'p4', 'p2', 'p3'], [b1(t), 'b2=2', 'b3=3', 'b4=4']]);
  frappePuis((d) => { d.pages.splice(1, 1); }, (t) => [['p1', 'p3'], [b1(t), 'b2=2', 'b3=3', 'b4=4']]);
});

test('deux copies : annuler sa frappe garde le bloc ajouté, supprimé ou déplacé par l\'autre copie dans la même page', () => {
  frappePuis((d) => { page(d, 'p1').blocks.splice(2, 0, { id: 'b5', type: 'p', html: '5' }); }, (t) => [['p1', 'p2', 'p3'], [b1(t), 'b2=2', 'b5=5', 'b3=3', 'b4=4']]);
  frappePuis((d) => { page(d, 'p1').blocks.splice(2, 1); }, (t) => [['p1', 'p2', 'p3'], [b1(t), 'b2=2', 'b4=4']]);
  frappePuis((d) => { deplacer(page(d, 'p1').blocks, 'b1', 3); }, (t) => [['p1', 'p2', 'p3'], ['b2=2', 'b3=3', 'b4=4', b1(t)]]);
});

test('deux copies : annuler son propre déplacement de page ou de bloc, malgré un ajout de l\'autre copie au même endroit', () => {
  croiser(TROIS,
    (d) => { deplacer(d.pages, 'p3', 0); deplacer(page(d, 'p1').blocks, 'b4', 0); },
    (d) => { d.pages.splice(2, 0, { id: 'p4', title: 'Quatre', blocks: [] }); page(d, 'p1').blocks.splice(3, 0, { id: 'b5', type: 'p', html: '5' }); },
    (c) => [pages(c), blocs(c).map((x) => x[1])],
    [['p1', 'p4', 'p2', 'p3'], ['1', '2', '5', '3', '4']], [['p3', 'p1', 'p4', 'p2'], ['4', '1', '2', '5', '3']]);
});

test('deux copies : annuler l\'ajout d\'un bloc que l\'autre copie a modifié le retire ; rétablir le rend avec la modification', () => {
  croiser(TROIS, (d) => { page(d, 'p1').blocks.splice(1, 0, { id: 'b5', type: 'p', html: '' }); }, (d) => { bloc(d, 'b5').html = '5-B'; },
    (c) => blocs(c), ['b1=1', 'b2=2', 'b3=3', 'b4=4'], ['b1=1', 'b5=5-B', 'b2=2', 'b3=3', 'b4=4']);
});

test('deux copies : annuler une suppression ramène le bloc après son voisin, même si l\'ordre ou le voisin a changé', () => {
  const supprimer = (d) => { page(d, 'p1').blocks.splice(1, 1); };
  croiser(TROIS, supprimer, (d) => deplacer(page(d, 'p1').blocks, 'b4', 0), (c) => blocs(c), ['b4=4', 'b1=1', 'b2=2', 'b3=3'], ['b4=4', 'b1=1', 'b3=3']);
  croiser(TROIS, supprimer, (d) => page(d, 'p1').blocks.splice(0, 1), (c) => blocs(c), ['b2=2', 'b3=3', 'b4=4'], ['b3=3', 'b4=4']);
});

test('deux copies : annuler un changement de niveau de page garde celui de l\'autre copie sur une autre page', () => {
  croiser(TROIS, (d) => { page(d, 'p2').lv = 1; }, (d) => { page(d, 'p3').lv = 2; }, niveaux, [0, 0, 2], [0, 1, 2]);
});

test('deux copies : plusieurs annulations d\'affilée gardent chacune les modifications reçues entre-temps', () => {
  const { a, b } = relier(TROIS);
  a.s.modifier(() => { bloc(a.ctx.doc, 'b1').html = '1-A'; });
  a.s.modifier(() => { bloc(a.ctx.doc, 'b2').html = '2-A'; });
  echanger(a, b);
  b.s.modifier(() => { b.ctx.doc.pages.reverse(); });
  echanger(a, b);
  a.s.annuler(); echanger(a, b);
  egal([pages(a), blocs(a)], [['p3', 'p2', 'p1'], ['b1=1-A', 'b2=2', 'b3=3', 'b4=4']], 'première annulation');
  b.s.modifier(() => { page(b.ctx.doc, 'p1').blocks.push({ id: 'b5', type: 'p', html: '5' }); });
  echanger(a, b);
  a.s.annuler(); echanger(a, b);
  for (const c of [a, b]) egal([pages(c), blocs(c)], [['p3', 'p2', 'p1'], ['b1=1', 'b2=2', 'b3=3', 'b4=4', 'b5=5']], 'seconde annulation chez ' + c.ctx.syn.st.actor);
  a.s.retablir(); a.s.retablir(); echanger(a, b);
  for (const c of [a, b]) egal([pages(c), blocs(c)], [['p3', 'p2', 'p1'], ['b1=1-A', 'b2=2-A', 'b3=3', 'b4=4', 'b5=5']], 'rétabli chez ' + c.ctx.syn.st.actor);
});

test('deux copies sans réception : annuler et rétablir un déplacement et une frappe comme sans synchronisation', () => {
  const { a, b } = relier(TROIS);
  a.s.modifier(() => { deplacer(a.ctx.doc.pages, 'p1', 2); });
  a.s.modifier(() => { bloc(a.ctx.doc, 'b1').html = '1-A'; });
  echanger(a, b);
  a.s.annuler(); egal([pages(a), blocs(a)[0]], [['p2', 'p3', 'p1'], 'b1=1']);
  a.s.annuler(); egal([pages(a), blocs(a)[0]], [['p1', 'p2', 'p3'], 'b1=1']);
  a.s.retablir(); a.s.retablir(); echanger(a, b);
  for (const c of [a, b]) egal([pages(c), blocs(c)[0]], [['p2', 'p3', 'p1'], 'b1=1-A'], 'chez ' + c.ctx.syn.st.actor);
});

// ---------- deux copies : l'autre copie modifie une autre ligne du même bloc (listes sans identifiant) ----------
// un seul bloc `x` dans la page ; `frappe`, `changement` et `lire` reçoivent ce bloc
const ligneVoisine = (x, frappe, changement, lire, annule, retabli) => croiser(
  () => ({ title: 'Doc', pages: [{ id: 'p1', title: 'Un', blocks: [Object.assign({ id: 'x' }, x)] }] }),
  (d) => frappe(bloc(d, 'x')), (d) => changement(bloc(d, 'x')), (c) => lire(bloc(c.ctx.doc, 'x')), annule, retabli);

test('deux copies : annuler sa frappe dans une liste à cocher garde la case cochée par l\'autre copie ; rétablir aussi', () => {
  ligneVoisine({ type: 'check', items: [{ html: 'un', done: false }, { html: 'deux', done: false }] },
    (x) => { x.items[1].html = 'deux-A'; }, (x) => { x.items[0].done = true; },
    (x) => x.items.map((e) => e.html + (e.done ? ' ☑' : ' ☐')), ['un ☑', 'deux ☐'], ['un ☑', 'deux-A ☐']);
});

test('deux copies : annuler sa frappe dans une cellule garde la cellule modifiée par l\'autre copie ; rétablir aussi', () => {
  ligneVoisine({ type: 'table', rows: [['Nom', 'État'], ['a', ''], ['b', '']] },
    (x) => { x.rows[1][1] = 'OK-A'; }, (x) => { x.rows[2][1] = 'KO-B'; x.rows[1][0] = 'a-B'; },
    (x) => x.rows, [['Nom', 'État'], ['a-B', ''], ['b', 'KO-B']], [['Nom', 'État'], ['a-B', 'OK-A'], ['b', 'KO-B']]);
});

test('deux copies : même chose pour une fiche de faits, une frise et une liste', () => {
  ligneVoisine({ type: 'facts', items: [{ k: 'Clé', v: '', alert: false }, { k: 'Clé', v: '', alert: false }] },
    (x) => { x.items[0].v = 'v-A'; }, (x) => { x.items[1].alert = true; },
    (x) => x.items.map((e) => e.v + (e.alert ? '!' : '')), ['', '!'], ['v-A', '!']);
  ligneVoisine({ type: 'timeline', orient: 'v', items: [{ date: '', title: '', text: '', color: 'accent' }, { date: '', title: '', text: '', color: 'accent' }] },
    (x) => { x.items[0].title = 't-A'; }, (x) => { x.items[1].date = '2026'; },
    (x) => x.items.map((e) => e.date + '|' + e.title), ['|', '2026|'], ['|t-A', '2026|']);
  ligneVoisine({ type: 'list', ordered: true, items: [{ html: 'un' }, { html: 'deux' }] },
    (x) => { x.items[1].html = 'deux-A'; }, (x) => { x.items[0].lv = 1; },
    (x) => x.items.map((e) => e.html + (e.lv || 0)), ['un1', 'deux0'], ['un1', 'deux-A0']);
});

test('deux copies : limite connue, une ligne ajoutée par l\'autre copie dans la même liste laisse la frappe après annuler', () => {
  const { a } = ligneVoisine({ type: 'check', items: [{ html: 'un', done: false }, { html: 'deux', done: false }] },
    (x) => { x.items[1].html = 'deux-A'; }, (x) => { x.items.push({ html: 'trois-B', done: false }); },
    (x) => x.items.map((e) => e.html), ['un', 'deux-A', 'trois-B'], ['un', 'deux-A', 'trois-B']);
  egal(possible(a.s.historique()), { annuler: true, retablir: false }, 'l\'étape locale reste à annuler');
});

test('deux copies : annuler l\'ajout local d\'une ligne l\'emporte sur la ligne voisine modifiée par l\'autre copie', () => {
  // la liste restaurée n'a plus la longueur reçue : la case cochée par B ne s'applique pas, plutôt que sur la mauvaise ligne
  ligneVoisine({ type: 'check', items: [{ html: 'un', done: false }, { html: 'deux', done: false }] },
    (x) => { x.items.splice(0, 0, { html: 'zéro-A', done: false }); }, (x) => { x.items[2].done = true; },
    (x) => x.items.map((e) => e.html + (e.done ? ' ☑' : ' ☐')), ['un ☐', 'deux ☐'], ['zéro-A ☐', 'un ☐', 'deux ☑']);
});

// ---------- deux copies : ordre local changé sans changer la longueur (listes sans identifiant) ----------
// la ligne d'avant n'est plus à sa position dans l'état restauré : la liste reste celle reçue (Ctrl+Z sans effet sur
// ce bloc, limite connue), jamais la modification de l'autre copie sur la mauvaise ligne
test('deux copies : annuler le glissement d\'une ligne de tableau ne reporte pas la cellule reçue sur la mauvaise ligne', () => {
  ligneVoisine({ type: 'table', rows: [['a'], ['b'], ['c']] },
    (x) => { x.rows.push(x.rows.shift()); }, (x) => { x.rows[0][0] = 'b-B'; },
    (x) => x.rows, [['b-B'], ['c'], ['a']], [['b-B'], ['c'], ['a']]);
});

test('deux copies : annuler l\'échange de deux colonnes ne reporte pas la cellule reçue dans la mauvaise colonne', () => {
  ligneVoisine({ type: 'table', rows: [['a', 'b'], ['c', 'd']] },
    (x) => { x.rows.forEach((r) => r.reverse()); }, (x) => { x.rows[1][0] = 'd-B'; },
    (x) => x.rows, [['b', 'a'], ['d-B', 'c']], [['b', 'a'], ['d-B', 'c']]);
});

test('deux copies : annuler l\'échange de deux lignes d\'une liste à cocher ne coche pas la mauvaise case', () => {
  ligneVoisine({ type: 'check', items: [{ html: 'un', done: false }, { html: 'deux', done: false }] },
    (x) => { x.items.reverse(); }, (x) => { x.items[0].done = true; },
    (x) => x.items.map((e) => e.html + (e.done ? ' ☑' : ' ☐')), ['deux ☑', 'un ☐'], ['deux ☑', 'un ☐']);
});

test('deux copies : deux étapes locales qui rendent la même longueur ne reportent pas la cellule reçue sur la mauvaise ligne', () => {
  const { a, b } = relier(() => ({ title: 'Doc', pages: [{ id: 'p1', title: 'Un', blocks: [{ id: 'x', type: 'table', rows: [['a'], ['b'], ['c']] }] }] }));
  const lignes = (c) => bloc(c.ctx.doc, 'x').rows;
  a.s.modifier(() => { lignes(a).pop(); }); echanger(a, b);
  a.s.modifier(() => { lignes(a).unshift(['z']); }); echanger(a, b);
  b.s.modifier(() => { lignes(b)[2][0] = 'b-B'; }); echanger(a, b);
  a.s.annuler(); echanger(a, b);
  for (const c of [a, b]) egal(lignes(c), [['a'], ['b']], 'première annulation : la longueur diffère, l\'annulation l\'emporte');
  a.s.annuler(); echanger(a, b);
  for (const c of [a, b]) egal(lignes(c), [['z'], ['a'], ['b-B']], 'seconde annulation : la liste reçue, pas « c » remplacé');
  a.s.retablir(); a.s.retablir(); echanger(a, b);
  for (const c of [a, b]) egal(lignes(c), [['z'], ['a'], ['b-B']], 'rétabli');
});

// --- remplacer : démarrage, déverrouillage, nouveau document ---
const FICHIER = () => ({ v: 5, id: 'fichier', title: 'Fichier', savedAt: '2026-11-01T10:00:00.000Z', mapKey: 'cle-carte',
  lock: { salt: 's', hash: 'h', iter: 1000 }, sync: { relay: 'ws://relais', key: 'k' },
  pages: [{ id: 'p1', title: 'Un', blocks: [{ id: 'x1', type: 'p', html: 'un' }] }, { id: 'p2', title: 'Deux', blocks: [] }, { id: 'p3', title: 'Trois', blocks: [] }] });

test('démarrage : garde ce qui vient du fichier, et un annuler immédiat ne change rien', () => {
  const m = monter();
  m.s.modifier(() => ecrire(m, 'b'));
  m.vider();
  egal(m.s.remplacer(FICHIER(), 'demarrage'), { ok: true });
  egal([m.doc.id, m.doc.savedAt, m.doc.mapKey, m.doc.lock.hash, m.doc.sync.relay, m.doc.cur], ['fichier', '2026-11-01T10:00:00.000Z', 'cle-carte', 'h', 'ws://relais', 0]);
  egal(possible(m.s.historique()), { annuler: false, retablir: false });
  m.s.annuler();
  egal(m.doc.pages[0].blocks[0].html, 'un');
  egal(m.recu.rendu.length, 1, 'le document ouvert est dessiné');
  egal(m.recu.modifie, [], 'ouvrir ne marque pas le document modifié');
  egal(m.sync, [], 'rien ne part vers les autres copies');
});

test('démarrage : la page du lien #pN est respectée et bornée au nombre de pages', () => {
  const m = monter();
  m.s.remplacer(FICHIER(), 'demarrage', { page: 1 });
  egal(m.doc.cur, 1);
  m.s.remplacer(FICHIER(), 'demarrage', { page: 8 });
  egal(m.doc.cur, 2, 'bornée à la dernière page');
  m.s.remplacer(FICHIER(), 'demarrage');
  egal(m.doc.cur, 0, 'sans lien : la première page');
});

test('déverrouillage : l\'historique repart du document déchiffré', () => {
  const m = monter();
  m.s.modifier(() => ecrire(m, 'b'));
  egal(m.s.remplacer(FICHIER(), 'deverrouillage', { page: 2 }), { ok: true });
  egal([m.doc.id, m.doc.lock.hash, m.doc.cur], ['fichier', 'h', 2]);
  egal(possible(m.s.historique()), { annuler: false, retablir: false });
  m.s.modifier(() => { m.doc.pages[0].blocks[0].html = 'deux'; });
  m.s.annuler(); m.s.annuler();
  egal(m.doc.pages[0].blocks[0].html, 'un', 'on ne remonte pas avant le document déchiffré');
});

test('nouveau : nouvel identifiant, ni date d\'enregistrement, ni mot de passe, ni clé de carte, ni synchronisation', () => {
  const m = monter();
  m.s.remplacer(FICHIER(), 'demarrage', { page: 2 });
  m.s.modifier(() => { m.doc.title = 'modifié'; });
  const nf = []; m.s.abonner('nouveauFichier', () => nf.push(1));
  m.vider();
  egal(m.s.remplacer(FICHIER(), 'nouveau', { page: 2 }), { ok: true });
  if (m.doc.id === 'fichier' || !m.doc.id) throw new Error('identifiant non renouvelé : ' + m.doc.id);
  egal([m.doc.savedAt, m.doc.lock, m.doc.mapKey, m.doc.sync, m.doc.cur], [null, undefined, undefined, undefined, 0]);
  egal(m.doc.pages[0].blocks[0].html, 'un', 'le contenu du modèle');
  egal(nf.length, 1, '« nouveau fichier » prévenu');
  egal(possible(m.s.historique()), { annuler: false, retablir: false });
  egal(m.recu.modifie, [], 'un nouveau document n\'est pas marqué modifié');
  const autre = m.doc.id;
  m.s.remplacer(FICHIER(), 'nouveau');
  if (m.doc.id === autre) throw new Error('deux nouveaux documents ont le même identifiant');
});

test('nouveau : « nouveau fichier » est prévenu avant que l\'historique reparte (la synchronisation est déjà arrêtée)', () => {
  const m = monter();
  m.faux.n = 37;   // marque de la synchronisation du document précédent
  m.s.abonner('nouveauFichier', () => { m.faux.n = 0; });   // l'arrêt de la synchronisation remet la marque à 0
  m.s.remplacer(FICHIER(), 'nouveau');
  m.s.modifier(() => { m.doc.title = 'autre'; });
  m.vider();
  m.s.annuler();
  egal(m.sync.filter((x) => x.startsWith('rebaser')), ['rebaser:0']);
});

test('démarrage : un format plus récent est ouvert ; une donnée illisible est refusée sans toucher au document', () => {
  const m = monter();
  egal(m.s.remplacer(Object.assign(FICHIER(), { v: 999 }), 'demarrage'), { ok: true });
  if (!m.doc.newer) throw new Error('format plus récent non signalé');
  m.s.remplacer(FICHIER(), 'demarrage');
  egal(m.s.remplacer('pas un document', 'demarrage'), { refus: 'illisible' });
  egal(m.s.remplacer({ pages: 3 }, 'nouveau'), { refus: 'illisible' });
  egal(m.doc.id, 'fichier');
});

test('remplacer valide d\'abord la frappe en attente, qui ne passe pas dans le nouvel historique', () => {
  const m = monter();
  m.s.saisir(() => ecrire(m, 'ab'));
  m.s.remplacer(FICHIER(), 'demarrage');
  m.avancer(1000);
  egal(possible(m.s.historique()), { annuler: false, retablir: false });
  egal(m.doc.pages[0].blocks[0].html, 'un');
});

test('un document déjà normalisé reste identique une fois remplacé', () => {
  const m = monter();
  const d = m.ctx.normalize(FICHIER());
  const avant = JSON.stringify(d);
  m.s.remplacer(d, 'demarrage');
  egal(JSON.stringify(m.doc), avant);
  egal(m.doc.sync.key, 'k');
});

// --- remplacer : import JSON, chargement externe (plugin Obsidian), brouillon ---
const ENTRANT = () => ({ id: 'autre', title: 'Importé', savedAt: '2020-01-01T00:00:00.000Z', mapKey: 'cle-entrante',
  lock: { salt: 's2', hash: 'h2', iter: 1000 },
  pages: [{ id: 'q1', title: 'A', blocks: [{ id: 'y1', type: 'p', html: 'importé' }] }, { id: 'q2', title: 'B', blocks: [] }, { id: 'q3', title: 'C', blocks: [] }] });
// une session ouverte sur FICHIER, page 2 affichée
function ouvert() { const m = monter(); m.s.remplacer(FICHIER(), 'demarrage', { page: 1 }); m.vider(); return m; }
const propres = (m) => [m.doc.id, m.doc.savedAt, m.doc.mapKey, m.doc.lock && m.doc.lock.hash];

test('import : garde identifiant, mot de passe, clé de carte et date d\'enregistrement, ouvre la page 1, et s\'annule', () => {
  const m = ouvert();
  egal(m.s.remplacer(ENTRANT(), 'import'), { ok: true });
  egal(propres(m), ['fichier', '2026-11-01T10:00:00.000Z', 'cle-carte', 'h']);
  egal([m.doc.title, m.doc.pages[0].blocks[0].html, m.doc.cur], ['Importé', 'importé', 0]);
  egal(m.recu.modifie, [[]]);
  egal(m.recu.rendu.length, 1);
  egal(m.recu.historique.map(possible), [{ annuler: true, retablir: false }]);
  egal(m.sync.filter((x) => x === 'envoyer').length, 1, 'l\'import part vers les autres copies');
  m.s.annuler();
  egal([m.doc.title, m.doc.pages[0].blocks[0].html], ['Fichier', 'un']);
});

test('import : sur un document sans mot de passe, clé de carte ni date d\'enregistrement, ceux de l\'entrant sont retirés', () => {
  const m = monter();
  m.s.remplacer(ENTRANT(), 'import');
  egal([m.doc.lock, m.doc.mapKey, m.doc.savedAt], [undefined, undefined, null]);
  if (m.doc.id === 'autre') throw new Error('identifiant de l\'entrant repris');
});

test('import et chargement externe : les identifiants de blocs en double sont renouvelés, le premier garde le sien', () => {
  for (const origine of ['import', 'externe']) {
    const m = ouvert();
    const e = ENTRANT();
    e.pages[0].blocks.push({ id: 'y1', type: 'p', html: 'deux' });
    e.pages[1].blocks.push({ id: 'y1', type: 'p', html: 'trois' });
    m.s.remplacer(e, origine, { deverrouille: true });
    const ids = m.doc.pages.flatMap((pg) => pg.blocks.map((b) => b.id));
    egal(ids.length, 3, origine);
    egal(new Set(ids).size, 3, origine + ' : identifiants distincts');
    egal(ids[0], 'y1', origine);
  }
});

test('chargement externe : garde les mêmes champs que l\'import, et la page affichée', () => {
  const m = ouvert();
  egal(m.s.remplacer(ENTRANT(), 'externe', { deverrouille: true }), { ok: true });
  egal(propres(m), ['fichier', '2026-11-01T10:00:00.000Z', 'cle-carte', 'h'], 'la clé de carte et la date d\'enregistrement sont gardées');
  egal([m.doc.title, m.doc.cur], ['Importé', 1]);
  egal(m.recu.modifie, [[]]);
  m.s.annuler();
  egal([m.doc.title, m.doc.cur], ['Fichier', 1]);
});

test('chargement externe et brouillon : la page affichée qui n\'existe plus ramène à la première', () => {
  for (const origine of ['externe', 'brouillon']) {
    const m = monter();
    m.s.remplacer(FICHIER(), 'demarrage', { page: 2 });
    const e = ENTRANT(); e.pages.length = 2;
    m.s.remplacer(e, origine, { deverrouille: true });
    egal(m.doc.cur, 0, origine);
  }
});

test('brouillon : garde identifiant et mot de passe, prend clé de carte et date d\'enregistrement du brouillon, et s\'annule', () => {
  const m = ouvert();
  egal(m.s.remplacer(ENTRANT(), 'brouillon'), { ok: true });
  egal(propres(m), ['fichier', '2020-01-01T00:00:00.000Z', 'cle-entrante', 'h']);
  egal([m.doc.pages[0].blocks[0].html, m.doc.cur], ['importé', 1]);
  egal(m.recu.modifie, [[]]);
  egal(possible(m.s.historique()), { annuler: true, retablir: false });
  m.s.annuler();
  egal(m.doc.pages[0].blocks[0].html, 'un');
});

test('refus : un format plus récent, pour l\'import, le chargement externe et le brouillon, ne touche à rien', () => {
  for (const origine of ['import', 'externe', 'brouillon']) {
    const m = ouvert();
    const avant = JSON.stringify(m.doc);
    egal(m.s.remplacer(Object.assign(ENTRANT(), { v: 999 }), origine, { deverrouille: true }), { refus: 'plus-recent', format: 999 }, origine);
    egal(JSON.stringify(m.doc), avant, origine);
    egal(possible(m.s.historique()), { annuler: false, retablir: false }, origine);
    egal([m.recu.rendu.length, m.recu.modifie.length, m.recu.historique.length, m.sync.length], [0, 0, 0, 0], origine);
  }
});

test('refus : le chargement externe d\'un document verrouillé et non déverrouillé ; l\'import et le brouillon l\'acceptent', () => {
  const m = ouvert();
  egal(m.s.remplacer(ENTRANT(), 'externe'), { refus: 'verrouille' });
  egal([m.doc.title, m.recu.rendu.length], ['Fichier', 0]);
  egal(m.s.remplacer(ENTRANT(), 'externe', { deverrouille: false }), { refus: 'verrouille' });
  egal(m.s.remplacer(ENTRANT(), 'externe', { deverrouille: true }), { ok: true });
  const n = monter();
  egal(n.s.remplacer(ENTRANT(), 'externe'), { ok: true }, 'document courant sans mot de passe');
  egal(ouvert().s.remplacer(ENTRANT(), 'import'), { ok: true });
  egal(ouvert().s.remplacer(ENTRANT(), 'brouillon'), { ok: true });
});

test('refus : une donnée illisible porte le message de la conversion, s\'il y en a un', () => {
  const m = ouvert();
  egal(m.s.remplacer({ title: 'sans pages' }, 'import'), { refus: 'illisible' });
  const r = m.s.remplacer({ pages: [{ blocks: [{ type: 'p', get html() { throw new Error('bloc cassé'); } }] }] }, 'import');
  egal(r, { refus: 'illisible', message: 'bloc cassé' });
  egal(m.doc.title, 'Fichier');
});

test('chaque remplacement annulable garde la configuration de synchronisation du document courant', () => {
  for (const origine of ['import', 'externe', 'brouillon']) {
    const m = ouvert();
    m.s.remplacer(Object.assign(ENTRANT(), { sync: { relay: 'ws://autre', key: 'autre' } }), origine, { deverrouille: true });
    egal(m.sync.includes('reprendre'), true, origine + ' : reprise par l\'adaptateur');
  }
  // vrai adaptateur : la configuration du document courant survit, celle de l'entrant n'est pas reprise
  for (const origine of ['import', 'externe', 'brouillon']) {
    const { ctx } = contexte();
    const s = ctx.creerSession(ctx.adaptateurSynchro());
    s.remplacer(FICHIER(), 'demarrage');
    s.remplacer(Object.assign(ENTRANT(), { sync: { relay: 'ws://autre', key: 'autre' } }), origine, { deverrouille: true });
    egal([ctx.doc.sync.relay, ctx.doc.sync.key], ['ws://relais', 'k'], origine);
    s.remplacer(DEPART(), 'demarrage');
    s.remplacer(Object.assign(ENTRANT(), { sync: { relay: 'ws://autre', key: 'autre' } }), origine);
    egal(ctx.doc.sync, undefined, origine + ' : un JSON entrant n\'impose pas sa synchronisation');
  }
});

test('import : la frappe en attente est validée d\'abord et reste annulable séparément', () => {
  const m = ouvert();
  m.s.saisir(() => ecrire(m, 'unx'));
  m.s.remplacer(ENTRANT(), 'import');
  m.s.annuler();
  egal(m.texte(), 'unx');
  m.s.annuler();
  egal(m.texte(), 'un');
});

test('import d\'un contenu identique au document courant : aucune étape', () => {
  const m = ouvert();
  const d = JSON.parse(JSON.stringify(m.doc));
  m.s.remplacer(d, 'import');
  egal(possible(m.s.historique()), { annuler: false, retablir: false });
});

// Libellé de ce qu'annuler défait et de ce que rétablir refait : du plus large au plus précis, puis la nature
const libelles = (m) => { const e = m.s.historique(); return [e.libelleAnnuler, e.libelleRetablir]; };

test('libellé : texte modifié, avec la page, le type de bloc et ses premiers mots sans balise', () => {
  const m = monter();
  m.s.modifier(() => { ecrire(m, 'Bonjour <b>tout</b> le monde'); });
  egal(libelles(m), ['Accueil · Paragraphe « Bonjour tout le monde » : texte modifié', '']);
  egal(m.recu.historique.map((e) => e.libelleAnnuler), ['Accueil · Paragraphe « Bonjour tout le monde » : texte modifié'], 'l\'abonné le reçoit');
});

const blocsDe = (m) => m.doc.pages[0].blocks;
test('libellé : plusieurs modifications dans une étape, la première puis le nombre des autres', () => {
  const m = monter();
  m.s.modifier(() => { blocsDe(m).push({ id: 'b2', type: 'h2', html: 'Deux' }, { id: 'b3', type: 'p', html: 'Trois' }); });
  m.s.modifier(() => { blocsDe(m)[0].html = 'Un'; blocsDe(m)[1].html = 'Deux bis'; blocsDe(m)[2].html = 'Trois bis'; });
  egal(libelles(m)[0], 'Accueil · Paragraphe « Un » : texte modifié et 2 autres modifications');
  m.s.modifier(() => { blocsDe(m)[0].html = 'Un ter'; blocsDe(m)[1].html = 'Deux ter'; });
  egal(libelles(m)[0], 'Accueil · Paragraphe « Un ter » : texte modifié et 1 autre modification');
});

test('libellé : un geste peut donner le libellé complet de son étape ({ etape }), affiché tel quel', () => {
  const m = monter();
  m.s.modifier(() => { blocsDe(m).push({ id: 'b2', type: 'h2', html: 'Section' }); blocsDe(m).splice(0, 1); }, null, { etape: 'Accueil : page importée du Markdown' });
  egal(libelles(m)[0], 'Accueil : page importée du Markdown');
  m.s.annuler();
  egal(libelles(m)[1], 'Accueil : page importée du Markdown', 'rétablir reprend le même libellé');
});

test('libellé : l\'import Markdown remplace la page en une étape « page importée du Markdown », défaite d\'un seul Ctrl+Z', () => {
  const m = monter();
  const r = m.ctx.blocsDuMarkdown('# Note\n\nUn\n\n- a', []);
  m.s.modifier(() => { m.doc.pages[0].blocks = r.blocs.map((b) => m.ctx.mk(b.type, b)); }, null, { etape: m.ctx.ETAPE_MARKDOWN });
  egal(libelles(m)[0], 'page importée du Markdown');
  egal(blocsDe(m).map((b) => b.type), ['p', 'list']);
  m.s.annuler();
  egal(blocsDe(m), [{ html: 'a', id: 'b1', type: 'p' }], 'un seul Ctrl+Z rend la page d\'avant');
  egal(libelles(m), ['', 'page importée du Markdown']);
});

test('libellé : bloc ajouté, supprimé, déplacé', () => {
  const m = monter();
  m.s.modifier(() => { blocsDe(m).push({ id: 'b2', type: 'h2', html: 'Section' }); });
  egal(libelles(m)[0], 'Accueil · Titre de section « Section » : bloc ajouté');
  m.s.modifier(() => { blocsDe(m).reverse(); });
  egal(libelles(m)[0], 'Accueil · Paragraphe « a » : bloc déplacé', 'un seul déplacement, hors de la plus longue sous-suite commune');
  m.s.modifier(() => { blocsDe(m).splice(1, 1); });
  egal(libelles(m)[0], 'Accueil · Paragraphe « a » : bloc supprimé', 'premiers mots de l\'état d\'avant');
  m.s.modifier(() => { blocsDe(m).push({ id: 'b4', type: 'divider' }); });
  egal(libelles(m)[0], 'Accueil · Séparateur : bloc ajouté', 'sans texte : le type seul');
});

test('libellé : dépendance entre cartes de kanban ajoutée puis retirée', () => {
  const m = monter();
  m.s.modifier(() => { blocsDe(m).push({ id: 'kb', type: 'kanban', cols: [{ id: 'c1', title: 'À faire', cards: [{ id: 'k1', title: 'Écrire' }, { id: 'k2', title: 'Relire' }] }] }); });
  const carte = () => blocsDe(m)[1].cols[0].cards[0];
  m.s.modifier(() => { carte().dep = ['k2']; });
  egal(libelles(m)[0], 'Accueil · Kanban « À faire Écrire Relire » : dépendance modifiée');
  m.s.modifier(() => { delete carte().dep; });
  egal(libelles(m)[0], 'Accueil · Kanban « À faire Écrire Relire » : dépendance modifiée', 'retirée');
  m.s.annuler();
  egal(libelles(m), ['Accueil · Kanban « À faire Écrire Relire » : dépendance modifiée', 'Accueil · Kanban « À faire Écrire Relire » : dépendance modifiée']);
});

test('libellé : colonne de kanban réduite puis affichée, annulée puis rétablie', () => {
  const m = monter();
  m.s.modifier(() => { blocsDe(m).push({ id: 'kb', type: 'kanban', cols: [{ id: 'c1', title: 'À faire', cards: [] }, { id: 'c2', title: 'Fait', cards: [{ id: 'k1', title: 'Écrire' }] }] }); });
  const col = () => blocsDe(m)[1].cols[1];
  m.s.modifier(() => { col().collapsed = true; });
  egal(libelles(m)[0], 'Accueil · Kanban « À faire Fait Écrire » : colonne réduite');
  m.s.modifier(() => { delete col().collapsed; });
  egal(libelles(m)[0], 'Accueil · Kanban « À faire Fait Écrire » : colonne affichée');
  m.s.annuler();
  egal(col().collapsed, true, 'annuler : de nouveau réduite');
  egal(libelles(m), ['Accueil · Kanban « À faire Fait Écrire » : colonne réduite', 'Accueil · Kanban « À faire Fait Écrire » : colonne affichée']);
  m.s.annuler();
  egal('collapsed' in col(), false, 'annuler : affichée, sans le champ');
  m.s.retablir();
  egal(col().collapsed, true, 'rétablir : réduite');
  egal(libelles(m), ['Accueil · Kanban « À faire Fait Écrire » : colonne réduite', 'Accueil · Kanban « À faire Fait Écrire » : colonne affichée']);
});

test('libellé : ligne ou colonne ajoutée ou supprimée dans un tableau, à l\'annulation comme au rétablissement', () => {
  const m = monter();
  m.s.modifier(() => { blocsDe(m).push({ id: 't', type: 'table', rows: [['Ville', 'Pays'], ['Lyon', 'France']] }); });
  const t = () => blocsDe(m)[1];
  m.s.modifier(() => { t().rows.splice(1, 0, ['', '']); });
  egal(libelles(m)[0], 'Accueil · Tableau « Ville Pays Lyon France » : ligne ajoutée');
  m.s.modifier(() => { t().rows.splice(2, 1); });
  egal(libelles(m)[0], 'Accueil · Tableau « Ville Pays » : ligne supprimée');
  m.s.modifier(() => { t().rows.forEach((r, j) => r.splice(1, 0, j ? '' : 'Colonne')); });
  egal(libelles(m)[0], 'Accueil · Tableau « Ville Colonne Pays » : colonne ajoutée');
  m.s.modifier(() => { t().rows.forEach((r) => r.splice(0, 1)); });
  egal(libelles(m)[0], 'Accueil · Tableau « Colonne Pays » : colonne supprimée');
  m.s.annuler();
  egal(libelles(m), ['Accueil · Tableau « Ville Colonne Pays » : colonne ajoutée', 'Accueil · Tableau « Colonne Pays » : colonne supprimée']);
});

test('libellé : une plage collée dans un tableau est « cellules collées », qu\'elle l\'agrandisse, ne change qu\'une cellule ou en vide', () => {
  const m = monter();
  m.s.modifier(() => { blocsDe(m).push({ id: 't', type: 'table', rows: [['Ville', 'Pays'], ['Lyon', 'France']] }); });
  const t = () => blocsDe(m)[1];
  const coller = (r, c, g) => m.s.modifier(() => { t().rows = m.ctx.collerGrille(t().rows, r, c, g); }, null, 'cellules collées');
  coller(1, 0, [['Lille', 'France'], ['Gand', 'Belgique']]);
  egal(libelles(m)[0], 'Accueil · Tableau « Ville Pays Lille France Gand Belgique » : cellules collées', 'une ligne de plus');
  coller(1, 1, [['FR', 'Nord'], ['BE', 'Flandre']]);
  egal(libelles(m)[0], 'Accueil · Tableau « Ville Pays Colonne Lille FR Nord Gand BE… » : cellules collées', 'une colonne de plus');
  coller(1, 0, [['Paris', 'FR'], ['Liège', 'BE']]);
  egal(libelles(m)[0], 'Accueil · Tableau « Ville Pays Colonne Paris FR Nord Liège B… » : cellules collées', 'même taille');
  coller(2, 2, [['Wallonie', 'x'], ['y', 'z']]);
  egal(libelles(m)[0], 'Accueil · Tableau « Ville Pays Colonne Colonne Paris FR Nord » : cellules collées', 'ligne et colonne de plus');
  m.s.annuler();
  egal(t().rows, [['Ville', 'Pays', 'Colonne'], ['Paris', 'FR', 'Nord'], ['Liège', 'BE', 'Flandre']], 'annuler retire la plage d\'un coup');
  coller(1, 0, [['Paris', 'BE']]);
  egal(libelles(m)[0], 'Accueil · Tableau « Ville Pays Colonne Paris BE Nord Liège B… » : cellules collées', 'une seule cellule changée');
  coller(1, 0, [['', ''], ['', '']]);
  egal(libelles(m)[0], 'Accueil · Tableau « Ville Pays Colonne Nord Flandre » : cellules collées', 'cellules vidées par la plage');
});

test('libellé : une plage coupée (Ctrl+X) ou effacée est « cellules vidées », même si une seule cellule était pleine', () => {
  const m = monter();
  m.s.modifier(() => { blocsDe(m).push({ id: 't', type: 'table', rows: [['Ville', 'Pays'], ['Lyon', 'France'], ['Gand', 'Belgique']] }); });
  const t = () => blocsDe(m)[1];
  m.s.modifier(() => { t().rows[1][0] = ''; t().rows[2][0] = ''; }, null, 'cellules vidées');
  egal(libelles(m)[0], 'Accueil · Tableau « Ville Pays France Belgique » : cellules vidées');
  m.s.annuler();
  egal(t().rows, [['Ville', 'Pays'], ['Lyon', 'France'], ['Gand', 'Belgique']], 'annuler rend les cellules');
  m.s.retablir();
  egal(libelles(m)[0], 'Accueil · Tableau « Ville Pays France Belgique » : cellules vidées', 'rétablir');
  m.s.modifier(() => { t().rows[1][1] = ''; t().rows[2][1] = t().rows[2][1]; }, null, 'cellules vidées');
  egal(libelles(m)[0], 'Accueil · Tableau « Ville Pays Belgique » : cellules vidées', 'une seule cellule pleine dans la plage');
  m.s.modifier(() => { t().rows[2][1] = ''; });
  egal(libelles(m)[0], 'Accueil · Tableau « Ville Pays » : cellule modifiée', 'une cellule vidée par la frappe');
});

test('libellé : une ligne ou une colonne déplacée n\'est pas un collage', () => {
  const m = monter();
  m.s.modifier(() => { blocsDe(m).push({ id: 't', type: 'table', rows: [['Ville', 'Pays'], ['Lyon', 'France'], ['Gand', 'Belgique']] }); });
  const t = () => blocsDe(m)[1];
  m.s.modifier(() => { t().rows.splice(1, 0, t().rows.splice(2, 1)[0]); });
  egal(libelles(m)[0], 'Accueil · Tableau « Ville Pays Gand Belgique Lyon France » : cellule modifiée', 'ligne déplacée');
  m.s.modifier(() => { t().rows.forEach((r) => r.reverse()); });
  egal(libelles(m)[0], 'Accueil · Tableau « Pays Ville Belgique Gand France Lyon » : cellule modifiée', 'colonne déplacée');
});

test('libellé : cellule modifiée, case cochée ou décochée, autre changement d\'un bloc', () => {
  const m = monter();
  m.s.modifier(() => { blocsDe(m).push({ id: 't', type: 'table', rows: [['Ville', 'Pays'], ['', '']] }, { id: 'c', type: 'check', items: [{ html: 'Pain', done: false }, { html: 'Lait', done: false }] }); });
  m.s.modifier(() => { blocsDe(m)[1].rows[1][0] = 'Lyon'; });
  egal(libelles(m)[0], 'Accueil · Tableau « Ville Pays Lyon » : cellule modifiée');
  m.s.modifier(() => { blocsDe(m)[2].items[1].done = true; });
  egal(libelles(m)[0], 'Accueil · Liste à cocher « Pain Lait » : case cochée');
  m.s.modifier(() => { blocsDe(m)[2].items[1].done = false; });
  egal(libelles(m)[0], 'Accueil · Liste à cocher « Pain Lait » : case décochée');
  m.s.modifier(() => { blocsDe(m)[2].items[0].html = 'Pain complet'; });
  egal(libelles(m)[0], 'Accueil · Liste à cocher « Pain complet Lait » : texte modifié', 'texte d\'un élément');
  m.s.modifier(() => { blocsDe(m)[0].type = 'h2'; });
  egal(libelles(m)[0], 'Accueil · Titre de section « a » : bloc modifié', 'type de bloc changé');
});

test('libellé : page ajoutée, renommée, déplacée, changée de niveau, supprimée', () => {
  const m = monter();
  m.s.modifier(() => { m.doc.pages.push({ id: 'p2', title: 'Annexe', blocks: [{ id: 'x', type: 'p', html: 'x' }] }); });
  egal(libelles(m)[0], 'page « Annexe » ajoutée', 'une seule modification, ses blocs compris');
  m.s.modifier(() => { m.doc.pages[1].title = 'Annexes'; });
  egal(libelles(m)[0], 'page « Annexe » renommée en « Annexes »');
  m.s.modifier(() => { m.doc.pages.reverse(); });
  egal(libelles(m)[0], 'page « Accueil » déplacée');
  m.s.modifier(() => { m.doc.pages[1].lv = 1; });
  egal(libelles(m)[0], 'page « Accueil » : niveau modifié');
  m.s.modifier(() => { m.doc.pages.splice(0, 1); });
  egal(libelles(m)[0], 'page « Annexes » supprimée');
  m.s.modifier(() => { m.doc.pages.push({ id: 'p3', title: '', blocks: [] }); });
  egal(libelles(m)[0], 'page sans titre ajoutée');
});

test('libellé : réglage modifié, couleur de pastille, pastille supprimée ; une pastille inscrite par un texte ne compte pas à part', () => {
  const m = monter();
  m.s.modifier(() => { m.doc.theme = 'dark'; });
  egal(libelles(m)[0], 'Thème : réglage modifié');
  m.s.modifier(() => { m.doc.title = 'Carnet'; m.doc.width = 900; });
  egal(libelles(m)[0], 'Titre du document : réglage modifié et 1 autre modification');
  m.s.modifier(() => { ecrire(m, 'a <span class="tag">OK</span>'); m.doc.tags = { ok: { c: 2 } }; });
  egal(libelles(m)[0], 'Accueil · Paragraphe « a OK » : texte modifié');
  m.s.modifier(() => { m.doc.tags.ok.c = 5; });
  egal(libelles(m)[0], 'pastille « ok » : couleur modifiée');
  m.s.modifier(() => { delete m.doc.tags.ok; });
  egal(libelles(m)[0], 'pastille « ok » supprimée');
});

test('libellé : une pastille est nommée comme dans le texte, sinon par le nom vu au rendu pendant la session, sinon par sa clé', () => {
  const m = monter();
  m.s.modifier(() => { ecrire(m, 'a <span class="pill">Prod  Web</span>'); m.doc.tags = { 'prod web': { c: 2 }, ko: { c: 1 }, ok: { c: 0 } }; });
  m.s.modifier(() => { m.doc.tags['prod web'].c = 5; });
  egal(libelles(m)[0], 'pastille « Prod Web » : couleur modifiée', 'nom du texte');
  m.ctx.noteTagName('ko', 'KO');
  m.s.modifier(() => { delete m.doc.tags.ko; });
  egal(libelles(m)[0], 'pastille « KO » supprimée', 'nom vu au rendu');
  m.s.modifier(() => { delete m.doc.tags.ok; });
  egal(libelles(m)[0], 'pastille « ok » supprimée', 'jamais vue : la clé');
});

test('libellé : une étape qui ne change aucun champ décrit (mot de passe…) se dit « document modifié »', () => {
  const m = monter();
  m.s.modifier(() => { m.doc.lock = { salt: 'x', check: 'y' }; });
  egal(libelles(m), ['document modifié', '']);
  m.s.annuler();
  egal(libelles(m), ['', 'document modifié']);
});

test('libellé : vide quand rien n\'est possible ; après annuler puis rétablir, chaque bouton décrit sa propre étape', () => {
  const m = monter();
  egal(libelles(m), ['', ''], 'rien à annuler ni à rétablir');
  m.s.modifier(() => { ecrire(m, 'un'); });
  m.s.modifier(() => { ecrire(m, 'deux'); });
  m.s.annuler();
  egal(libelles(m), ['Accueil · Paragraphe « un » : texte modifié', 'Accueil · Paragraphe « deux » : texte modifié']);
  egal(m.recu.historique.at(-1).libelleRetablir, 'Accueil · Paragraphe « deux » : texte modifié', 'l\'abonné le reçoit');
  m.s.annuler();
  egal(libelles(m), ['', 'Accueil · Paragraphe « un » : texte modifié']);
  m.s.retablir(); m.s.retablir();
  egal(libelles(m), ['Accueil · Paragraphe « deux » : texte modifié', '']);
});

test('libellé : la frappe n\'a de libellé qu\'une fois validée ; un import en étape décrit la différence entière', () => {
  const m = monter();
  m.s.saisir(() => { ecrire(m, 'frappe'); });
  egal(libelles(m), ['', '']);
  m.avancer(500);
  egal(libelles(m)[0], 'Accueil · Paragraphe « frappe » : texte modifié');
  m.s.remplacer({ title: 'Doc', pages: [{ id: 'p1', title: 'Accueil', blocks: [{ id: 'b1', type: 'p', html: 'importé' }] }, { id: 'p9', title: 'Neuve', blocks: [] }] }, 'import');
  egal(libelles(m)[0], 'Accueil · Paragraphe « importé » : texte modifié et 1 autre modification');
});

test('libellé : la troncature de l\'historique garde chaque libellé avec son étape', () => {
  const m = monter();
  for (let i = 1; i <= 305; i++) m.s.modifier(() => { ecrire(m, 'v' + i); });
  for (let i = 0; i < 299; i++) m.s.annuler();
  egal(libelles(m), ['', 'Accueil · Paragraphe « v7 » : texte modifié'], 'le plus ancien état restant est v6');
});

test('libellé, deux copies : une modification reçue n\'apparaît jamais, ni pour annuler ni pour rétablir', () => {
  const { a, b } = relier();
  const lib = (c) => { const e = c.s.historique(); return [e.libelleAnnuler, e.libelleRetablir]; };
  a.s.modifier(() => { a.ctx.doc.pages[0].blocks[0].html = 'a-A'; });
  b.s.modifier(() => { b.ctx.doc.pages[0].blocks[1].html = 'b-B'; });
  echanger(a, b);
  egal(lib(a), ['Accueil · Paragraphe « a-A » : texte modifié', ''], 'chez A, rien de B');
  b.s.modifier(() => { b.ctx.doc.pages[0].blocks.push({ id: 'b3', type: 'p', html: 'c-B' }); });
  echanger(a, b);
  egal(lib(a), ['Accueil · Paragraphe « a-A » : texte modifié', ''], 'après une seconde arrivée');
  a.s.modifier(() => { a.ctx.doc.pages[0].blocks[0].html = 'a-A2'; });
  egal(lib(a)[0], 'Accueil · Paragraphe « a-A2 » : texte modifié', 'l\'étape suivante ne reprend pas les arrivées d\'avant');
  a.s.annuler(); a.s.annuler();
  egal(lib(a), ['', 'Accueil · Paragraphe « a-A » : texte modifié'], 'rétablir ne décrit que l\'étape locale');
  egal(lib(b), ['Accueil · Paragraphe « c-B » : bloc ajouté', ''], 'chez B, rien de A');
});

for (const [nom, fn] of tests) {
  try { fn(); n++; } catch (e) { console.error(`ÉCHEC : ${nom}\n${e.stack || e.message}`); process.exit(1); }
}
console.log(`session du document : OK (${n} tests)`);
