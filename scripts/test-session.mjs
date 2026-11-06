// Banc d'essai de la session du document (src/js/05-session.js) : annuler, rétablir, regroupement de la frappe,
// troncature de l'historique. La session est chargée dans node:vm avec l'en-tête, le document, les types de blocs,
// les migrations et le moteur de synchronisation, un faux `document`, une horloge factice et de faux abonnés.
// Les tests ne passent que par l'interface de la session.  node scripts/test-session.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const js = (f) => readFileSync(new URL('../src/js/' + f, import.meta.url), 'utf8');
// l'en-tête ouvre l'IIFE commune : on la retire pour que `doc` soit une globale du contexte
const OUVERTURE = '\n(function () {\n';
const entete = js('00-entete.js');
if (!entete.startsWith(OUVERTURE)) throw new Error('00-entete.js : ouverture de l\'IIFE introuvable, adapter le banc');
const SOURCE = entete.slice(OUVERTURE.length) +
  ['03-types-de-blocs.js', '05-document.js', '05-migrations.js', '05-synchro-moteur.js', '05-session.js'].map(js).join('\n');
const SCRIPT = new vm.Script(SOURCE, { filename: 'session.js' });

// Un contexte neuf par test : faux document, horloge factice, fausse synchronisation
function monter() {
  const horloge = { t: 0, n: 0, minuteurs: new Map() };
  const sync = [];
  const ctx = vm.createContext({
    document: { querySelector: () => null, querySelectorAll: () => [] },
    setTimeout: (fn, ms) => { const id = ++horloge.n; horloge.minuteurs.set(id, { fn, at: horloge.t + ms }); return id; },
    clearTimeout: (id) => { horloge.minuteurs.delete(id); },
    // la synchronisation telle que la session l'appelle aujourd'hui (l'adaptateur viendra au ticket 02)
    synHistMark: () => 0,
    synLocal: () => { sync.push('local'); },
    synTrim: (m) => { sync.push('trim'); },
    synRebase: (json) => json,
    synKeep: () => {},
    synSetCfg: (d, cfg) => { Object.defineProperty(d, 'sync', { value: cfg, writable: true, configurable: true, enumerable: false }); },
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
  const recu = { rendu: [], modifie: [], historique: [] };
  const s = ctx.creerSession();
  s.abonner('rendu', (focus, info) => recu.rendu.push({ focus, info }));
  s.abonner('modifie', (depuisHistorique) => recu.modifie.push(depuisHistorique));
  s.abonner('historique', (etat) => recu.historique.push(etat));
  s.remplacer({ title: 'Doc', pages: [{ id: 'p1', title: 'Accueil', blocks: [{ id: 'b1', type: 'p', html: 'a' }] }] }, 'demarrage');
  const vider = () => { recu.rendu.length = 0; recu.modifie.length = 0; recu.historique.length = 0; sync.length = 0; };
  vider();
  return { s, ctx, avancer, recu, sync, vider, get doc() { return ctx.doc; }, texte: () => ctx.doc.pages[0].blocks[0].html };
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
  egal(m.sync, ['local']);
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
  egal(m.sync, ['local']);
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

test('consigner valide une étape sans redessiner', () => {
  const m = monter();
  ecrire(m, 'b');
  m.s.consigner();
  egal(m.recu.rendu.length, 0);
  egal(m.s.historique(), { annuler: true, retablir: false });
  m.s.annuler();
  egal(m.texte(), 'a');
});

test('remplacerCourant met le document dans l\'état courant sans créer d\'étape', () => {
  const m = monter();
  m.s.modifier(() => ecrire(m, 'b'));
  ecrire(m, 'reçu');
  m.s.remplacerCourant();
  egal(m.s.historique(), { annuler: true, retablir: false });
  m.s.annuler(); m.s.retablir();
  egal(m.texte(), 'reçu');
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
  egal(m.s.historique(), { annuler: false, retablir: false });
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
  egal(m.s.historique(), { annuler: false, retablir: false });
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
  egal(m.s.historique(), { annuler: false, retablir: false });
  egal(m.recu.modifie, [], 'un nouveau document n\'est pas marqué modifié');
  const autre = m.doc.id;
  m.s.remplacer(FICHIER(), 'nouveau');
  if (m.doc.id === autre) throw new Error('deux nouveaux documents ont le même identifiant');
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
  egal(m.s.historique(), { annuler: false, retablir: false });
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

for (const [nom, fn] of tests) {
  try { fn(); n++; } catch (e) { console.error(`ÉCHEC : ${nom}\n${e.stack || e.message}`); process.exit(1); }
}
console.log(`session du document : OK (${n} tests)`);
