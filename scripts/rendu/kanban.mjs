// Kanban : dépendances entre cartes (« Attend », « Bloque », état bloquée) et cartes proposables sans cycle.
import { monter, test, egal, vrai, textes } from './commun.mjs';

// trois colonnes ; « Écrire » attend « Maquette » (en cours) et « Relire » (finie) ; « Publier » attend « Écrire »
const KB = (cols) => ({ title: 'Doc', pages: [{ id: 'p1', title: 'Accueil', blocks: [{ id: 'b1', type: 'kanban', cols }] }] });
const COLS = () => [
  { id: 'c1', title: 'À faire', cards: [{ id: 'k1', title: 'Écrire', dep: ['k2', 'k3'] }, { id: 'k4', title: 'Publier', dep: ['k1'] }] },
  { id: 'c2', title: 'En cours', cards: [{ id: 'k2', title: 'Maquette' }] },
  { id: 'c3', title: 'Fait', cards: [{ id: 'k3', title: 'Relire' }] },
];
const rendu = (cols, view) => { const { ctx, d } = monter(KB(cols)); return ctx.renderPage(d, { page: 0, view: view || 'read' }); };
// article d'une carte, par identifiant
const carte = (html, kid) => { const m = html.match(new RegExp('<article[^>]*data-kid="' + kid + '"[\\s\\S]*?</article>')); vrai(m, 'carte ' + kid + ' introuvable'); return m[0]; };
const ligne = (html, cls) => textes(html, new RegExp('<div class="' + cls + '[^"]*">([\\s\\S]*?)</div>', 'g'));

test('dépendances : « Attend » et « Bloque » avec les titres, en lecture, édition et export', () => {
  ['read', 'edit', 'export'].forEach((v) => {
    const h = rendu(COLS(), v);
    egal(ligne(carte(h, 'k1'), 'kb-wait'), ['Attend : Maquette, Relire'], v);
    egal(ligne(carte(h, 'k2'), 'kb-blocks'), ['Bloque : Écrire'], v);
    egal(ligne(carte(h, 'k1'), 'kb-blocks'), ['Bloque : Publier'], v);
    egal(ligne(carte(h, 'k2'), 'kb-wait'), [], v);
  });
});

test('dépendances : titres cliquables hors export, simples textes à l\'export', () => {
  vrai(carte(rendu(COLS()), 'k1').includes('data-kbgo="b1|k2"'), 'lecture : lien vers Maquette');
  vrai(!rendu(COLS(), 'export').includes('data-kbgo'), 'export : pas de lien');
});

test('dépendances : bloquée tant qu\'une carte attendue n\'est pas dans la dernière colonne', () => {
  vrai(/class="kb-card[^"]* kb-blocked/.test(carte(rendu(COLS()), 'k1')), 'Maquette en cours : bloquée');
  vrai(/class="kb-wait blocked"/.test(carte(rendu(COLS()), 'k1')), 'ligne Attend en alerte');
  const cols = COLS(); cols[2].cards.push(cols[1].cards.pop());
  const h = carte(rendu(cols), 'k1');
  vrai(!h.includes('kb-blocked') && !h.includes('kb-wait blocked'), 'Maquette finie : plus bloquée');
});

test('dépendances : titre vide affiché « Carte sans titre »', () => {
  const cols = COLS(); cols[1].cards[0].title = '';
  egal(ligne(carte(rendu(cols), 'k1'), 'kb-wait'), ['Attend : Carte sans titre, Relire']);
});

test('dépendances : carte supprimée ignorée au rendu et retirée par la normalisation', () => {
  const cols = COLS(); cols[0].cards[1].dep = ['k1', 'kx', 'k4', 'k1', 3];
  const { ctx, d } = monter(KB(cols));
  egal(d.pages[0].blocks[0].cols[0].cards[1].dep, ['k1'], 'normalisée');
  const sansDep = KB(COLS()); sansDep.pages[0].blocks[0].cols[1].cards[0].dep = ['kx'];
  const n = monter(sansDep).d;
  vrai(!('dep' in n.pages[0].blocks[0].cols[1].cards[0]), 'liste vide : clé retirée');
  egal(ligne(carte(ctx.renderPage(d, { page: 0 }), 'k4'), 'kb-wait'), ['Attend : Écrire'], 'rendu');
  const brut = monter(KB(COLS())); brut.d.pages[0].blocks[0].cols[1].cards = [];
  egal(ligne(carte(brut.ctx.renderPage(brut.d, { page: 0 }), 'k1'), 'kb-wait'), ['Attend : Relire'], 'avant normalisation : ignorée');
});

test('dépendances : cartes proposables sans la carte elle-même ni les cycles directs et indirects', () => {
  const { ctx, d } = monter(KB(COLS()));
  const b = d.pages[0].blocks[0];
  const ids = (kid) => JSON.parse(JSON.stringify(ctx.kbDepCandidates(b, kid))).map((g) => [g.ci, g.cards.map((k) => k.id)]);
  // k4 attend k1 qui attend k2 et k3 : ni k2 ni k3 ne peuvent attendre k1 ou k4
  egal(ids('k2'), [[0, []], [1, []], [2, ['k3']]]);
  egal(ids('k1'), [[0, []], [1, ['k2']], [2, ['k3']]]);
  egal(ids('k4'), [[0, ['k1']], [1, ['k2']], [2, ['k3']]]);
});

test('dépendances : cycle déjà présent dans les données, les cartes cochées restent proposées pour être décochées', () => {
  const cols = COLS(); cols[1].cards[0].dep = ['k1'];
  const { ctx, d } = monter(KB(cols));
  const ids = (kid) => JSON.parse(JSON.stringify(ctx.kbDepCandidates(d.pages[0].blocks[0], kid))).map((g) => [g.ci, g.cards.map((k) => k.id)]);
  // k1 attend k2 qui attend k1 : chacune garde l'autre, déjà cochée
  egal(ids('k1'), [[0, []], [1, ['k2']], [2, ['k3']]]);
  egal(ids('k2'), [[0, ['k1']], [1, []], [2, ['k3']]]);
});

test('dépendances : un ancien fichier sans dépendances ressort identique après normalisation', () => {
  const cols = [{ id: 'c1', title: 'À faire', cards: [{ id: 'k1', title: 'Écrire', html: '', due: '2026-11-07', who: 'Théo' }, { id: 'k2', title: 'Relire', html: '', due: '', who: '' }] }];
  egal(monter(KB(cols)).d.pages[0].blocks[0].cols, cols);
});
