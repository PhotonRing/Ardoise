// Banc d'essai de la session du document (src/js/05-session.js) : annuler, rétablir, regroupement de la frappe,
// troncature de l'historique, réception des autres copies. La session est chargée dans node:vm avec l'en-tête, le
// document, les types de blocs, les migrations, l'adaptateur et le moteur de synchronisation, un faux `document`, une
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
  ['03-types-de-blocs.js', '05-document.js', '05-migrations.js', '05-session.js', '05-synchro-adaptateur.js', '05-synchro-moteur.js'].map(js).join('\n');
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
  s.abonner('modifie', (depuisHistorique) => recu.modifie.push(depuisHistorique));
  s.abonner('historique', (etat) => recu.historique.push(etat));
  ctx.doc = ctx.attach(DEPART());
  s.repartir();
  const vider = () => { recu.rendu.length = 0; recu.modifie.length = 0; recu.historique.length = 0; sync.length = 0; };
  vider();
  return { s, ctx, avancer, recu, sync, faux, vider, get doc() { return ctx.doc; }, texte: () => ctx.doc.pages[0].blocks[0].html };
}

let n = 0;
const tests = [];
const test = (nom, fn) => tests.push([nom, fn]);
const egal = (a, b, msg) => { const ja = JSON.stringify(a), jb = JSON.stringify(b); if (ja !== jb) throw new Error(`${msg || ''}\n  obtenu  : ${ja}\n  attendu : ${jb}`); };
const ecrire = (m, html) => { m.doc.pages[0].blocks[0].html = html; };

test('modifier valide une étape et prévient rendu (avec le focus), modifié et historique', () => {
  const m = monter();
  m.s.modifier(() => ecrire(m, 'b'), { b: 'b1', k: 'html' });
  egal(m.recu.rendu.map((r) => r.focus), [{ b: 'b1', k: 'html' }]);
  egal(m.recu.modifie, [true]);
  egal(m.recu.historique, [{ annuler: true, retablir: false }]);
  m.s.annuler();
  egal(m.texte(), 'a');
});

test('une modification qui ne change rien ne crée pas d\'étape, mais redessine', () => {
  const m = monter();
  m.s.modifier(() => {});
  egal(m.recu.rendu.length, 1);
  egal(m.recu.historique, [{ annuler: false, retablir: false }]);
  egal(m.sync, [], 'rien ne part vers les autres copies');
});

test('saisir prévient « modifié » tout de suite, sans redessiner, et valide l\'étape après 500 ms sans frappe', () => {
  const m = monter();
  m.s.saisir(() => ecrire(m, 'ab'));
  egal(m.recu.modifie, [false]);
  egal(m.recu.rendu.length, 0);
  m.avancer(300);
  m.s.saisir(() => ecrire(m, 'abc'));
  m.avancer(499);
  egal(m.s.historique(), { annuler: false, retablir: false }, 'pas encore d\'étape à 499 ms du dernier caractère');
  m.avancer(1);
  egal(m.recu.historique, [{ annuler: true, retablir: false }]);
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
  egal(m.s.historique(), { annuler: true, retablir: false });
  m.avancer(1000);
  m.s.annuler();
  egal(m.texte(), 'a');
  egal(m.s.historique(), { annuler: false, retablir: true }, 'le délai ne crée pas d\'étape en double');
});

test('annuler et rétablir restaurent l\'état exact et respectent les bornes', () => {
  const m = monter();
  m.s.modifier(() => ecrire(m, 'b'));
  m.s.modifier(() => { m.doc.title = 'Titre'; m.doc.pages[0].blocks.push({ id: 'b2', type: 'p', html: 'c' }); });
  const apres = JSON.stringify(m.doc);
  m.s.annuler(); m.s.annuler();
  egal(JSON.parse(JSON.stringify(m.doc)), { title: 'Doc', pages: [{ id: 'p1', title: 'Accueil', blocks: [{ id: 'b1', type: 'p', html: 'a' }] }] });
  m.vider();
  m.s.annuler();
  egal(m.texte(), 'a', 'rien avant le premier état');
  egal(m.recu.rendu.length, 0, 'aucun rendu hors des bornes');
  egal(m.recu.historique, [{ annuler: false, retablir: true }]);
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
  egal(m.recu.modifie, [true]);
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
  egal(m.s.historique(), { annuler: true, retablir: false });
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
  egal(m.s.historique(), { annuler: false, retablir: true });
});

test('consigner valide une étape sans redessiner ; repartir vide l\'historique', () => {
  const m = monter();
  ecrire(m, 'b');
  m.s.consigner();
  egal(m.recu.rendu.length, 0);
  egal(m.s.historique(), { annuler: true, retablir: false });
  m.s.repartir();
  egal(m.s.historique(), { annuler: false, retablir: false });
  m.s.annuler();
  egal(m.texte(), 'b');
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
  ctx.doc = ctx.attach(DEPART());
  ctx.synSetCfg(ctx.doc, { relay: 'ws://relais', key: 'k' });
  ctx.session.repartir();
  ctx.session.modifier(() => { ctx.doc.title = 'Autre'; });
  ctx.session.annuler();
  egal([ctx.doc.title, ctx.doc.sync], ['Doc', { relay: 'ws://relais', key: 'k' }], 'après annuler');
  ctx.session.retablir();
  egal([ctx.doc.title, ctx.doc.sync], ['Autre', { relay: 'ws://relais', key: 'k' }], 'après rétablir');
  egal(Object.keys(ctx.doc).includes('sync'), false, 'reste hors de l\'historique');
});

// ---------- réception ----------
const distant = (m, f) => { const e = JSON.parse(JSON.stringify(m.ctx.synSubset(m.doc))); f(e); return e; };

test('une modification reçue s\'applique sans créer d\'étape d\'annulation, et prévient les abonnés', () => {
  const m = monter();
  m.s.modifier(() => ecrire(m, 'b'));
  m.vider();
  m.s.recevoir(distant(m, (e) => { e.title = 'Reçu'; }));
  egal(m.doc.title, 'Reçu');
  egal(m.recu.rendu, [{ focus: null, info: { distant: true } }]);
  egal(m.recu.modifie, [true]);
  egal(m.recu.historique, [{ annuler: true, retablir: false }]);
  egal(m.sync, [], 'rien ne repart vers les autres copies');
  m.s.annuler();
  egal(m.texte(), 'a', 'annuler revient d\'une seule étape locale');
  m.s.retablir();
  egal([m.texte(), m.doc.title], ['b', 'Reçu'], 'l\'état courant contenait l\'arrivée');
});

test('une clé absente de l\'état reçu est retirée ; les clés propres au fichier restent', () => {
  const m = monter();
  m.s.modifier(() => { m.doc.mapKey = 'cle'; m.doc.id = 'fichier'; });
  m.s.recevoir(distant(m, (e) => { delete e.mapKey; }));
  egal([m.doc.mapKey, m.doc.id], [undefined, 'fichier']);
});

test('la page affichée reste la même, repérée par son identifiant, quand une modification reçue réordonne les pages', () => {
  const m = monter();
  m.s.modifier(() => { m.doc.pages.push({ id: 'p2', title: 'Deux', blocks: [] }, { id: 'p3', title: 'Trois', blocks: [] }); });
  m.doc.cur = 1;
  m.s.recevoir(distant(m, (e) => { e.pages.reverse(); }));
  egal([m.doc.pages[m.doc.cur].id, m.doc.cur], ['p2', 1]);
  m.doc.cur = 0;
  m.s.recevoir(distant(m, (e) => { e.pages = e.pages.filter((p) => p.id !== 'p3'); }));
  egal(m.doc.pages[m.doc.cur].id, 'p2', 'p3 disparue : page bornée');
  m.s.recevoir(distant(m, (e) => { e.pages = []; }));
  egal(m.doc.pages.length, 1, 'jamais sans page');
});

// ---------- deux copies : vrai moteur et vrai adaptateur, faux transport ----------
const DEUX = () => ({ title: 'Doc', pages: [{ id: 'p1', title: 'Accueil', blocks: [{ id: 'b1', type: 'p', html: 'a' }, { id: 'b2', type: 'p', html: 'b' }] }] });
function copie(acteur, fraiche) {
  const { ctx, avancer } = contexte();
  ctx.doc = ctx.attach(DEUX());
  ctx.session.repartir();
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
function relier() { const a = copie('A'), b = copie('B', true); echanger(a, b); return { a, b }; }

test('deux copies : annuler ses propres modifications garde celles reçues entre-temps', () => {
  const { a, b } = relier();
  egal([b.bloc('b1'), b.bloc('b2')], ['a', 'b'], 'la copie fraîche a adopté le document');
  a.s.modifier(() => { a.ctx.doc.pages[0].blocks[0].html = 'a-A'; });
  b.s.modifier(() => { b.ctx.doc.pages[0].blocks[1].html = 'b-B'; });
  echanger(a, b);
  egal([a.bloc('b1'), a.bloc('b2'), b.bloc('b1'), b.bloc('b2')], ['a-A', 'b-B', 'a-A', 'b-B']);
  a.s.annuler();
  egal([a.bloc('b1'), a.bloc('b2')], ['a', 'b-B'], 'l\'annulation garde la modification de B');
  egal(a.s.historique(), { annuler: false, retablir: true }, 'l\'arrivée n\'a pas créé d\'étape chez A');
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
  egal(b.s.historique(), { annuler: false, retablir: true });
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

for (const [nom, fn] of tests) {
  try { fn(); n++; } catch (e) { console.error(`ÉCHEC : ${nom}\n${e.stack || e.message}`); process.exit(1); }
}
console.log(`session du document : OK (${n} tests)`);
