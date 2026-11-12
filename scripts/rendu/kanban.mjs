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

// Colonne réduite : bande verticale (titre, nombre de cartes), état de vue du contexte puis champ collapsed du fichier.
const reduit = (cols, vue, kbCols) => { const { ctx, d } = monter(KB(cols)); return ctx.renderPage(d, { page: 0, view: vue || 'read', kbCols }); };
// HTML de la colonne d'indice ci
const colonne = (html, ci) => { const m = html.match(new RegExp('<section class="kb-col"[^>]*data-ci="' + ci + '"[\\s\\S]*?</section>')); vrai(m, 'colonne ' + ci + ' introuvable'); return m[0]; };
const bande = (col) => /data-red/.test(col.match(/^<section[^>]*>/)[0]);
const COLS_REDUITE = () => { const c = COLS(); c[2].collapsed = true; return c; };

test('colonne réduite : bande avec titre et nombre de cartes, sans les cartes, en lecture et en édition', () => {
  ['read', 'edit'].forEach((v) => {
    const h = reduit(COLS_REDUITE(), v), c = colonne(h, 2);
    vrai(bande(c), v + ' : bande');
    egal(textes(c, /<span class="kb-title">([\s\S]*?)<\/span>/g), ['Fait'], v + ' : titre');
    egal(textes(c, /<span class="kb-n">([\s\S]*?)<\/span>/g), ['1'], v + ' : nombre');
    vrai(!c.includes('data-kid="k3"'), v + ' : carte non rendue');
    vrai(c.includes('data-kbfold="b1|c3"'), v + ' : bande cliquable');
    vrai(!bande(colonne(h, 0)) && colonne(h, 0).includes('data-kid="k1"'), v + ' : autre colonne dépliée');
  });
  // l'état de vue de l'éditeur (globale viewCol) est ignoré : seul le contexte compte
  const { ctx, d } = monter(KB(COLS()), { kbCols: { c1: { red: true, base: false } } });
  vrai(!bande(colonne(ctx.renderPage(d, { page: 0, view: 'read' }), 0)), 'globale de session ignorée');
});

test('colonne réduite : l\'état de la session l\'emporte sur le fichier, dans les deux sens, en lecture et en édition', () => {
  ['read', 'edit'].forEach((v) => {
    const ouverte = reduit(COLS_REDUITE(), v, { c3: { red: false, base: true } });
    vrai(!bande(colonne(ouverte, 2)) && colonne(ouverte, 2).includes('data-kid="k3"'), v + ' : rouverte pour soi');
    const fermee = reduit(COLS(), v, { c1: { red: true, base: false } });
    vrai(bande(colonne(fermee, 0)) && !colonne(fermee, 0).includes('data-kid="k1"'), v + ' : réduite pour soi');
  });
});

test('colonne réduite : à l\'export, bande et cartes masquées (le runtime de lecture l\'ouvre), état de la session ignoré', () => {
  const h = reduit(COLS_REDUITE(), 'export', { c3: { red: false, base: true }, c1: { red: true, base: false } }), c = colonne(h, 2);
  vrai(bande(c), 'bande');
  egal(textes(c, /<span class="kb-title">([\s\S]*?)<\/span>/g), ['Fait', 'Fait'], 'titre de la bande et de l\'en-tête');
  vrai(c.includes('data-kid="k3"'), 'cartes présentes pour le runtime et l\'impression');
  vrai(c.includes('data-kbfold="b1|c3"') && !c.includes('draggable'), 'bascule, sans déplacement');
  vrai(!bande(colonne(h, 0)), 'état de la session ignoré');
});

test('colonne réduite : un ancien kanban sans le champ se rend comme avant, toutes colonnes affichées', () => {
  ['read', 'edit', 'export'].forEach((v) => {
    const h = reduit(COLS(), v);
    [0, 1, 2].forEach((ci) => vrai(!bande(colonne(h, ci)), v + ' : colonne ' + ci + ' affichée'));
    egal(textes(h, /<article[^>]*data-kid="(k\d)"/g), ['k1', 'k4', 'k2', 'k3'], v + ' : toutes les cartes');
  });
  egal(monter(KB(COLS())).d.pages[0].blocks[0].cols.map((c) => 'collapsed' in c), [false, false, false], 'aucun champ ajouté');
  egal(monter(KB(COLS_REDUITE())).d.pages[0].blocks[0].cols[2].collapsed, true, 'champ gardé par la normalisation');
});

test('colonne réduite : « Attend », « Bloque » et l\'état bloquée inchangés', () => {
  // « Maquette » (en cours) réduite : Écrire l'attend toujours et reste bloquée ; Relire (finie) réduite aussi
  const cols = COLS(); cols[1].collapsed = true; cols[2].collapsed = true;
  ['read', 'edit'].forEach((v) => {
    const h = carte(reduit(cols, v), 'k1');
    egal(ligne(h, 'kb-wait'), ['Attend : Maquette, Relire'], v);
    egal(ligne(h, 'kb-blocks'), ['Bloque : Publier'], v);
    vrai(/class="kb-card[^"]* kb-blocked/.test(h), v + ' : bloquée');
  });
});

test('colonne réduite : l\'état pour soi cède dès que le fichier change (réduction reçue par synchronisation)', () => {
  ['read', 'edit'].forEach((v) => {
    // ouverte pour soi quand le fichier l'affichait ; le fichier la réduit ensuite : la réduction se voit
    vrai(bande(colonne(reduit(COLS_REDUITE(), v, { c3: { red: false, base: false } }), 2)), v + ' : réduction reçue visible');
    // réduite pour soi quand le fichier la réduisait ; le fichier l'affiche ensuite : elle s'affiche
    vrai(!bande(colonne(reduit(COLS(), v, { c1: { red: true, base: true } }), 0)), v + ' : affichage reçu visible');
  });
});

test('colonne réduite : les états pour soi périmés ou de colonnes disparues sont retirés', () => {
  const { ctx, d } = monter(KB(COLS_REDUITE()));
  const vc = { c3: { red: false, base: true }, c1: { red: true, base: true }, cx: { red: true, base: false } };
  ctx.kbColsPerimes(vc, d);
  egal(Object.keys(vc), ['c3']);
});

test('colonne réduite : aria-expanded de la bande et du bouton ⇤ suit l\'état de la colonne, à l\'export', () => {
  const h = reduit(COLS_REDUITE(), 'export');
  egal(textes(colonne(h, 2), /data-kbfold="[^"]*"[^>]*aria-expanded="(\w+)"/g), ['false', 'false'], 'réduite');
  egal(textes(colonne(h, 0), /data-kbfold="[^"]*"[^>]*aria-expanded="(\w+)"/g), ['true', 'true'], 'affichée');
});
