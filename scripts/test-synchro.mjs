// Banc d'essai du moteur de synchronisation (src/js/05-synchro-moteur.js) : plusieurs copies modifient au hasard
// un document de type Ardoise, s'échangent leurs opérations par un relais simulé (dans le désordre de leurs
// connexions, en double, après une période hors ligne, ou en repartant d'un instantané), et doivent toutes
// aboutir exactement au même document.  node scripts/test-synchro.mjs [parties] [graine]
import { readdirSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import { contexte as appli } from './rendu/commun.mjs';

const ctx = vm.createContext({});
vm.runInContext(readFileSync(new URL('../src/js/05-synchro-moteur.js', import.meta.url), 'utf8') +
  '\nthis.E = { synCreate, synLoad, synDump, synDiff, synApply, synJSON, synEq };', ctx);
const { synCreate, synLoad, synDump, synDiff, synApply, synJSON, synEq } = ctx.E;

let seed = +(process.argv[3] || 12345);
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const ri = (n) => Math.floor(rnd() * n);
const pick = (a) => a[ri(a.length)];
const clone = (x) => JSON.parse(JSON.stringify(x));
let uidN = 0;
const uid = () => 'b' + (uidN++).toString(36) + ri(1e6).toString(36);
const WORDS = ['carte', 'été', 'Brest', '<b>gras</b>', '&amp;', 'café ☕', 'x', 'nœud', '<a href="#p1">lien</a>', '😀', 'deux mots'];
const word = () => pick(WORDS);
const text = () => Array.from({ length: ri(4) }, word).join(' ');
const block = () => {
  const t = pick(['p', 'check', 'table', 'map', 'kanban']), b = { id: uid(), type: t };
  if (t === 'p') b.html = text();
  if (t === 'check') b.items = Array.from({ length: 1 + ri(3) }, () => ({ html: text(), done: rnd() < 0.5 }));
  if (t === 'table') b.rows = [['A', 'B'], [text(), text()]];
  if (t === 'map') { b.markers = [{ lat: 1, lon: 2, label: word() }]; b.view = { lat: 1, lon: 2, z: 3 }; }
  if (t === 'kanban') b.cols = [{ id: uid(), title: word(), cards: [{ id: uid(), title: text() }] }];
  return b;
};
const editText = (s) => {
  const r = ri(4);
  if (r === 0 || !s) return s + word();
  const i = ri(s.length + 1);
  if (r === 1) return s.slice(0, i) + word() + s.slice(i);
  if (r === 2) return s.slice(0, i) + s.slice(i + 1 + ri(4));
  return word();
};
// une modification aléatoire, faite directement sur le JSON (comme le fait l'éditeur)
function mutate(d) {
  const pg = pick(d.pages), bl = pg.blocks;
  const r = ri(14);
  if (r === 0 || !bl.length) { bl.splice(ri(bl.length + 1), 0, block()); return; }
  if (r === 1 && bl.length > 1) { bl.splice(ri(bl.length), 1); return; }
  if (r === 2 && bl.length > 1) { const [m] = bl.splice(ri(bl.length), 1); bl.splice(ri(bl.length + 1), 0, m); return; }
  if (r === 3) { d.title = editText(d.title); return; }
  if (r === 4) { d.palette = pick(['ambre', 'graphite', 'bleu']); return; }
  if (r === 5 && d.pages.length < 4) { d.pages.push({ id: uid(), title: word(), blocks: [block()] }); return; }
  if (r === 6) { pg.title = editText(pg.title); return; }
  if (r === 7) { if (d.tags && rnd() < 0.5) delete d.tags; else d.tags = Object.assign(d.tags || {}, { [word().toLowerCase()]: { c: ri(16) } }); return; }
  const b = pick(bl);
  if (b.type === 'p') { if (rnd() < 0.9) b.html = editText(b.html); else b.html = text(); }
  else if (b.type === 'check') {
    const it = b.items, q = ri(5);
    if (q === 0) it.splice(ri(it.length + 1), 0, { html: text(), done: false });
    else if (q === 1 && it.length > 1) it.splice(ri(it.length), 1);
    else if (q === 2 && it.length) pick(it).done = !pick(it).done;
    else if (it.length) { const x = pick(it); x.html = editText(x.html); if (rnd() < 0.2) x.lv = ri(3); }
  } else if (b.type === 'table') {
    const q = ri(4);
    if (q === 0) b.rows.push(b.rows[0].map(() => text()));
    else if (q === 1 && b.rows.length > 2) b.rows.splice(1 + ri(b.rows.length - 1), 1);
    else if (q === 2) b.rows.forEach((row, i) => row.push(i ? '' : 'C'));
    else { const row = pick(b.rows), j = ri(row.length); row[j] = editText(row[j]); }
  } else if (b.type === 'map') {
    if (rnd() < 0.5) b.markers.push({ lat: ri(90), lon: ri(180), label: word() }); else if (b.markers.length) pick(b.markers).label = editText(pick(b.markers).label);
    if (rnd() < 0.3) b.view = { lat: ri(9), lon: ri(9), z: ri(5) };
  } else if (b.type === 'kanban') {
    const c = pick(b.cols), q = ri(3);
    if (q === 0) c.cards.push({ id: uid(), title: text() });
    else if (q === 1 && c.cards.length) { const [k] = c.cards.splice(ri(c.cards.length), 1); pick(b.cols).cards.push(k); }
    else if (c.cards.length) { const k = pick(c.cards); k.title = editText(k.title); }
    if (rnd() < 0.1) b.cols.push({ id: uid(), title: word(), cards: [] });
  }
}

let checks = 0, snaps = 0, reloads = 0;
function game(n) {
  const base = { title: 'Doc', palette: 'ambre', pages: [{ id: 'p0', title: 'Accueil', blocks: [block(), block()] }] };
  // relais : les numéros de trames sont absolus (r.cur) ; le tableau ne garde que celles depuis « first »
  const relay = { log: [], snap: null, first: 0 };
  const mk = (actor) => ({ actor, st: null, doc: null, cur: 0, pending: [], online: true });
  const reps = Array.from({ length: n }, (_, i) => mk('r' + i + '-' + ri(1e6).toString(36)));
  // la première copie active la synchronisation ; les autres sont des copies de son fichier
  reps[0].st = synCreate(reps[0].actor); reps[0].doc = clone(base);
  const init = synDiff(reps[0].st, {}, reps[0].doc); reps[0].pending.push(...init);
  const saved = JSON.stringify({ st: synDump(reps[0].st), doc: reps[0].doc, pending: reps[0].pending });
  for (const r of reps.slice(1)) { const f = JSON.parse(saved); r.st = synLoad(f.st, r.actor); r.doc = f.doc; r.pending = f.pending; }
  const send = (r) => { if (r.pending.length) { relay.log.push(r.pending); r.pending = []; } };
  const receive = (r, all) => {
    if (r.cur < relay.first) {
      // trop en retard : on repart de l'instantané, puis on rejoue ses propres modifications non envoyées
      const lam = r.st.lamport; reloads++;
      r.st = synLoad(JSON.parse(JSON.stringify(relay.snap.st)), r.actor); if (r.st.lamport < lam) r.st.lamport = lam;
      synApply(r.st, r.pending); r.cur = relay.snap.upto;
    }
    const total = relay.first + relay.log.length;
    const end = all ? total : Math.min(total, r.cur + 1 + ri(4));
    for (; r.cur < end; r.cur++) synApply(r.st, relay.log[r.cur - relay.first] || []);
    r.doc = synJSON(r.st.root);
  };
  for (let step = 0; step < 120; step++) {
    const r = pick(reps), act = ri(10);
    if (act < 5) {
      const before = clone(r.doc); mutate(r.doc);
      const ops = synDiff(r.st, before, r.doc); r.pending.push(...ops);
      const got = synJSON(r.st.root); checks++;
      if (!synEq(got, r.doc)) throw new Error('modification locale mal reproduite\n' + JSON.stringify(r.doc) + '\n' + JSON.stringify(got));
      r.doc = got;
      if (r.online) send(r);
    } else if (act < 8) { if (r.online) receive(r, false); }
    else if (act === 8) { r.online = !r.online; if (r.online) send(r); }
    else if (relay.log.length - relay.first > 8) {
      // une copie à jour dépose un instantané ; le relais oublie les trames qu'il contient
      const s = reps.find((x) => x.online && x.cur === relay.first + relay.log.length);
      if (s) { relay.snap = { st: synDump(s.st), upto: s.cur }; relay.log = []; relay.first = s.cur; snaps++; }
    }
  }
  // tout le monde se reconnecte et rattrape tout
  for (const r of reps) { r.online = true; send(r); }
  for (const r of reps) receive(r, true);
  for (const r of reps) {
    checks++;
    if (!synEq(r.doc, reps[0].doc)) throw new Error('copies divergentes\n' + JSON.stringify(reps[0].doc) + '\n' + JSON.stringify(r.doc));
    // l'état enregistré dans le fichier redonne le même document
    const back = synLoad(JSON.parse(JSON.stringify(synDump(r.st))), 'x');
    if (!synEq(synJSON(back.root), r.doc)) throw new Error('état enregistré incomplet');
  }
}
// Scénarios précis : ce que chacun voit après fusion
function pair(doc) {
  const a = synCreate('A'), init = synDiff(a, {}, doc), b = synCreate('B'); synApply(b, init);
  return { a, b, da: clone(doc), db: clone(doc) };
}
function swap(x, opsA, opsB) { synApply(x.a, opsB); synApply(x.b, opsA); const ja = synJSON(x.a.root), jb = synJSON(x.b.root); if (!synEq(ja, jb)) throw new Error('scénario : divergence'); checks++; return ja; }
function expect(cond, msg) { checks++; if (!cond) throw new Error('scénario : ' + msg); }
{ // deux personnes écrivent dans le même paragraphe : les deux saisies sont gardées
  const x = pair({ pages: [{ id: 'p', blocks: [{ id: 'b', type: 'p', html: 'Bonjour le monde' }] }] });
  const na = clone(x.da); na.pages[0].blocks[0].html = 'Bonjour le <b>vaste</b> monde';
  const nb = clone(x.db); nb.pages[0].blocks[0].html = 'Bonjour tout le monde !';
  const r = swap(x, synDiff(x.a, x.da, na), synDiff(x.b, x.db, nb));
  expect(r.pages[0].blocks[0].html === 'Bonjour tout le <b>vaste</b> monde !', 'fusion du texte : ' + r.pages[0].blocks[0].html);
}
{ // l'un supprime un mot pendant que l'autre en ajoute un ailleurs
  const x = pair({ pages: [{ id: 'p', blocks: [{ id: 'b', type: 'p', html: 'un deux trois' }] }] });
  const na = clone(x.da); na.pages[0].blocks[0].html = 'un trois';
  const nb = clone(x.db); nb.pages[0].blocks[0].html = 'un deux trois quatre';
  const r = swap(x, synDiff(x.a, x.da, na), synDiff(x.b, x.db, nb));
  expect(r.pages[0].blocks[0].html === 'un trois quatre', 'suppression et ajout : ' + r.pages[0].blocks[0].html);
}
{ // chacun ajoute un bloc, l'un coche une case, l'autre modifie le texte de la même case
  const x = pair({ pages: [{ id: 'p', blocks: [{ id: 'c', type: 'check', items: [{ html: 'lait', done: false }] }] }] });
  const na = clone(x.da); na.pages[0].blocks.push({ id: 'n1', type: 'p', html: 'A' }); na.pages[0].blocks[0].items[0].done = true;
  const nb = clone(x.db); nb.pages[0].blocks.unshift({ id: 'n2', type: 'p', html: 'B' }); nb.pages[0].blocks[0 + 1].items[0].html = 'lait entier';
  const r = swap(x, synDiff(x.a, x.da, na), synDiff(x.b, x.db, nb));
  expect(r.pages[0].blocks.map((b) => b.id).join() === 'n2,c,n1', 'blocs ajoutés : ' + r.pages[0].blocks.map((b) => b.id));
  expect(r.pages[0].blocks[1].items[0].done === true && r.pages[0].blocks[1].items[0].html === 'lait entier', 'case cochée et modifiée');
}
{ // modèle diamant : deux personnes écrivent dans le même sommet, puis dans deux sommets ; frappes fusionnées caractère par caractère
  const D = { id: 'd', type: 'diamond', title: 'Campagne', adversaire: 'APT28', capacite: '', infrastructure: '', victime: 'Mairie' };
  const x = pair({ pages: [{ id: 'p', blocks: [D] }] });
  const na = clone(x.da); na.pages[0].blocks[0].adversaire = 'APT28 (Fancy Bear)'; na.pages[0].blocks[0].capacite = 'Mimikatz';
  const nb = clone(x.db); nb.pages[0].blocks[0].adversaire = 'Groupe APT28'; nb.pages[0].blocks[0].victime = 'Mairie de X'; nb.pages[0].blocks[0].title = 'Campagne X';
  const r = swap(x, synDiff(x.a, x.da, na), synDiff(x.b, x.db, nb)), d = r.pages[0].blocks[0];
  expect(d.adversaire === 'Groupe APT28 (Fancy Bear)', 'diamant, même sommet : ' + d.adversaire);
  expect(d.capacite === 'Mimikatz' && d.victime === 'Mairie de X' && d.title === 'Campagne X', 'diamant, sommets différents : ' + JSON.stringify(d));
}
{ // un bloc supprimé d'un côté, modifié de l'autre : il reste supprimé
  const x = pair({ pages: [{ id: 'p', blocks: [{ id: 'b', type: 'p', html: 'x' }, { id: 'c', type: 'p', html: 'y' }] }] });
  const na = clone(x.da); na.pages[0].blocks.shift();
  const nb = clone(x.db); nb.pages[0].blocks[0].html = 'x modifié';
  const r = swap(x, synDiff(x.a, x.da, na), synDiff(x.b, x.db, nb));
  expect(r.pages[0].blocks.length === 1 && r.pages[0].blocks[0].id === 'c', 'bloc supprimé');
}
{ // même réglage changé des deux côtés : une seule valeur, la même partout
  const x = pair({ palette: 'ambre', pages: [] });
  const na = clone(x.da); na.palette = 'bleu'; const nb = clone(x.db); nb.palette = 'vert';
  const r = swap(x, synDiff(x.a, x.da, na), synDiff(x.b, x.db, nb));
  expect(r.palette === 'bleu' || r.palette === 'vert', 'réglage');
}
{ // groupe repliable : l'autre copie le reçoit avec son contenu et son pli ; deux frappes dans un bloc du groupe fusionnées
  const x = pair({ pages: [{ id: 'p', blocks: [{ id: 'b', type: 'p', html: 'avant' }] }] });
  const na = clone(x.da); na.pages[0].blocks.push({ id: 'g', type: 'group', title: 'Détails', folded: true, blocks: [{ id: 'c', type: 'p', html: 'Bonjour le monde' }] });
  const r0 = swap(x, synDiff(x.a, x.da, na), []);
  expect(r0.pages[0].blocks[1].type === 'group' && r0.pages[0].blocks[1].folded === true && r0.pages[0].blocks[1].blocks[0].html === 'Bonjour le monde', 'groupe reçu');
  x.da = clone(r0); x.db = clone(r0);
  const ma = clone(x.da); ma.pages[0].blocks[1].blocks[0].html = 'Bonjour le <b>vaste</b> monde'; ma.pages[0].blocks[1].title = 'Détails A';
  const mb = clone(x.db); mb.pages[0].blocks[1].blocks[0].html = 'Bonjour tout le monde !'; mb.pages[0].blocks[1].blocks.push({ id: 'c2', type: 'p', html: 'ajout B' });
  const r = swap(x, synDiff(x.a, x.da, ma), synDiff(x.b, x.db, mb));
  const g = r.pages[0].blocks[1];
  expect(g.blocks[0].html === 'Bonjour tout le <b>vaste</b> monde !', 'frappe dans un bloc d\'un groupe : ' + g.blocks[0].html);
  expect(g.title === 'Détails A' && g.blocks.map((b) => b.id).join() === 'c,c2', 'titre et bloc ajouté au groupe');
}
{ // requête : l'un règle les colonnes, l'autre un filtre et l'ordre des colonnes ; tout converge, sans texte mélangé
  const Q = { id: 'q', type: 'query', title: 'Incidents', src: 'table', scope: 'doc', view: 'table' };
  const x = pair({ pages: [{ id: 'p', blocks: [Q] }] });
  const na = clone(x.da); na.pages[0].blocks[0].colonnes = { mode: 'sauf', noms: ['état'], ordre: [] };
  const nb = clone(x.db); nb.pages[0].blocks[0].filtres = [{ id: 'f1', prop: 'tags', vals: ['urgent'] }];
  const r = swap(x, synDiff(x.a, x.da, na), synDiff(x.b, x.db, nb)), q = r.pages[0].blocks[0];
  expect(JSON.stringify(q.colonnes) === '{"mode":"sauf","noms":["état"],"ordre":[]}' && q.filtres[0].vals.join() === 'urgent', 'colonnes et filtre : ' + JSON.stringify(q));
  x.da = clone(r); x.db = clone(r);
  const ma = clone(x.da); ma.pages[0].blocks[0].colonnes.ordre = ['#source', 'risque'];
  const mb = clone(x.db); mb.pages[0].blocks[0].colonnes.noms = ['état', 'hôte'];
  const r2 = swap(x, synDiff(x.a, x.da, ma), synDiff(x.b, x.db, mb)), c = r2.pages[0].blocks[0].colonnes;
  expect(c.ordre.join() === '#source,risque' && c.noms.join() === 'état,hôte' && c.mode === 'sauf', 'ordre et noms réglés à deux : ' + JSON.stringify(c));
}
{ // requête kanban : l'un règle les champs des cartes, l'autre le filtre « Bloquées » ; tout converge
  const Q = { id: 'q', type: 'query', title: 'Suivi', src: 'kanban', scope: 'doc', view: 'kanban' };
  const x = pair({ pages: [{ id: 'p', blocks: [Q] }] });
  const na = clone(x.da); na.pages[0].blocks[0].champs = { masques: ['texte'], ordre: ['attend'] };
  const nb = clone(x.db); nb.pages[0].blocks[0].filtres = [{ id: 'f1', prop: 'bloquees', vals: ['oui'] }];
  const q = swap(x, synDiff(x.a, x.da, na), synDiff(x.b, x.db, nb)).pages[0].blocks[0];
  expect(JSON.stringify(q.champs) === '{"masques":["texte"],"ordre":["attend"]}' && q.filtres[0].prop === 'bloquees', 'champs et bloquées : ' + JSON.stringify(q));
}
{ // filtres d'une requête (format 7) : deux filtres posés en même temps gardés ; valeurs cochées à deux gardées ; mode : dernière écriture
  const Q = { id: 'q', type: 'query', title: 'Suivi', src: 'kanban', scope: 'doc', view: 'table', filtres: [{ id: 'f1', prop: 'col', vals: ['à faire'] }] };
  const x = pair({ pages: [{ id: 'p', blocks: [Q] }] });
  const na = clone(x.da); na.pages[0].blocks[0].filtres.push({ id: 'a1', prop: 'kbWho', vals: ['alice'] });
  const nb = clone(x.db); nb.pages[0].blocks[0].filtres.push({ id: 'b1', prop: 'tags', vals: ['urgent'], mode: 'aucun' });
  const r = swap(x, synDiff(x.a, x.da, na), synDiff(x.b, x.db, nb)), ids = r.pages[0].blocks[0].filtres.map((f) => f.id).sort().join();
  expect(ids === 'a1,b1,f1', 'deux filtres posés en même temps : ' + ids);
  x.da = clone(r); x.db = clone(r);
  const ma = clone(x.da); ma.pages[0].blocks[0].filtres[0].vals.push('en cours'); ma.pages[0].blocks[0].filtres[0].mode = 'aucun';
  const mb = clone(x.db); mb.pages[0].blocks[0].filtres[0].vals.push('fait');
  const r2 = swap(x, synDiff(x.a, x.da, ma), synDiff(x.b, x.db, mb)), f = r2.pages[0].blocks[0].filtres[0];
  expect(f.vals.slice().sort().join() === 'en cours,fait,à faire' && f.mode === 'aucun', 'valeurs cochées à deux : ' + JSON.stringify(f));
  x.da = clone(r2); x.db = clone(r2);
  const pa = clone(x.da); pa.pages[0].blocks[0].filtres[0].mode = 'tous';
  const r3 = swap(x, synDiff(x.a, x.da, pa), []);
  x.da = clone(r3); x.db = clone(r3);
  const pb = clone(x.db); delete pb.pages[0].blocks[0].filtres[0].mode;
  const r4 = swap(x, [], synDiff(x.b, x.db, pb));
  expect(!('mode' in r4.pages[0].blocks[0].filtres[0]), 'mode : dernière écriture gagne');
}
{ // document 1.23 synchronisé (format 6) : deux copies passent à la nouvelle version et l'ouvrent ; la normalisation ne donne pas d'id
  // aux anciennes cartes de nombre (repérées par leur rang), sinon chaque copie supprimerait la carte et insérerait la sienne
  const ancien = { v: '1.23.0', id: 'd', title: 'Doc', pages: [{ id: 'p', title: 'Accueil', blocks: [
    { id: 'q', type: 'query', title: 'Suivi', src: 'kanban', scope: 'doc', view: 'count', cards: [{ label: '', tags: [], match: 'any', state: 'all', col: 'fait', total: 'none' }] },
    { id: 'q7', type: 'query', title: '1.7', src: 'facts', scope: 'doc', view: 'count' }] }] };
  const x = pair(clone(ancien)), ouvrir = () => appli().normalize(clone(ancien));
  const r = swap(x, synDiff(x.a, x.da, ouvrir()), synDiff(x.b, x.db, ouvrir())), bl = r.pages[0].blocks;
  expect(bl[0].cards.length === 1 && bl[0].cards[0].filtres[0].vals[0] === 'fait', 'carte de nombre migrée par deux copies : ' + JSON.stringify(bl[0].cards));
  expect(bl[1].cards.length === 1, 'carte par défaut (1.7) ajoutée par deux copies : ' + JSON.stringify(bl[1].cards));
}
{ // ouvrir un document est déterministe : chaque copie d'un document synchronisé le normalise de son côté, un id
  // tiré au hasard pour un élément qui n'en a pas ferait diverger les copies (lot 7 : cartes de nombre dédoublées).
  // Documents de référence des formats qu'une copie synchronisée peut avoir (synchro depuis la 1.13, format 5) ;
  // un document synchronisé porte toujours son id.
  const dossier = new URL('./fixtures/', import.meta.url);
  for (const f of readdirSync(dossier).filter((n) => /^format-\d+\.json$/.test(n) && +n.match(/\d+/)[0] >= 5)) {
    const brut = { id: 'doc-synchronise', ...JSON.parse(readFileSync(new URL(f, dossier), 'utf8')) };
    const a = JSON.stringify(appli().normalize(clone(brut))), b = JSON.stringify(appli().normalize(clone(brut)));
    expect(a === b, `${f} : deux ouvertures donnent deux documents différents (id tiré au hasard à la normalisation ?)`);
  }
}
const games = +(process.argv[2] || 300);
for (let g = 0; g < games; g++) game(2 + (g % 3));
if (games >= 50 && (!snaps || !reloads)) throw new Error('instantanés non exercés');
console.log(`synchronisation : OK (${games} parties, ${checks} vérifications, ${snaps} instantanés, ${reloads} reprises depuis un instantané)`);
