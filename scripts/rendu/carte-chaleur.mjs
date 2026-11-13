// Vue « Carte de chaleur » d'une requête sur les lignes de tableaux (chX, chY, chZ, chN) : colonnes, cases, sous-cases, somme, échelle.
import { readFileSync } from 'node:fs';
import { monter, test, egal, vrai, textes } from './commun.mjs';

const P = (t) => '<span class="pill">' + t + '</span>';
const TAB = (id, rows) => ({ id, type: 'table', rows });
// observations : tactique (X), technique (Y), sous-technique (Z), score (N)
const LIGNES = [['Tactique', 'Technique', 'Sous-technique', 'Score'],
  ['Exécution', 'T1059', '.001', '3,5'],
  ['Persistance', 'T1053', '', '2'],
  ['exécution ', 't1059', '.003', 'élevé'],
  ['Exécution', 'T1204', '.002', '1 234,5'],
  ['', 'T1566', '', '1.5']];
const doc = (q, extra) => ({ title: 'Doc', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  TAB('t1', LIGNES), ...(extra || []),
  { id: 'q', type: 'query', src: 'table', scope: 'doc', view: 'chaleur', chX: 'tactique', chY: 'technique', ...q },
] }] });
const rendu = (q, extra) => { const { ctx, d } = monter(doc(q, extra)); const h = ctx.renderPage(d, { page: 0, view: 'read' }); return h.slice(h.indexOf('class="q-res"')); };
const colonnes = (h) => textes(h, /<h4 class="q-ch-t">([\s\S]*?)<\/h4>/g);
const cases = (h) => textes(h, /<div class="q-ch-c[^"]*"[^>]*><span class="q-ch-n">([\s\S]*?)<\/span>/g);
const valeurs = (h) => textes(h, /<span class="q-ch-v">([\s\S]*?)<\/span>/g);

test('carte de chaleur : une colonne par valeur de X, une case par valeur de Y, ordre de première apparition, sans casse ni espaces', () => {
  const h = rendu({});
  egal(colonnes(h), ['Exécution3', 'Persistance1', '(vide)1']);
  egal(cases(h), ['T1059', 'T1204', 'T1053', 'T1566']);
  egal(valeurs(h), ['2', '1', '1', '1'], 'sans N : nombre de lignes');
  vrai(/class="q-ch-wrap"/.test(h), 'matrice dans un conteneur qui défile');
});

test('carte de chaleur : sous-niveau Z, des sous-cases sous chaque case (Z vide : pas de sous-case)', () => {
  const h = rendu({ chZ: 'sous-technique' });
  egal(textes(h, /<div class="q-ch-s[^"]*"[^>]*><span class="q-ch-n">([\s\S]*?)<\/span>/g), ['.001', '.003', '.002']);
  const t1059 = h.slice(h.indexOf('T1059'), h.indexOf('T1204'));
  vrai(/q-ch-sous[\s\S]*\.001[\s\S]*\.003/.test(t1059), 'sous-cases de T1059 sous sa case');
});

test('carte de chaleur : somme de N, virgule française et espaces de milliers lus, valeur non numérique comptée 0', () => {
  const h = rendu({ chN: 'score' });
  egal(valeurs(h), ['3,5', '1234,5', '2', '1,5'], 'T1059 = 3,5 + « élevé » (0)');
  egal(colonnes(h), ['Exécution1238', 'Persistance2', '(vide)1,5']);
  vrai(/somme de Score/.test(h), 'légende : somme de N');
  vrai(/nombre de lignes/.test(rendu({})), 'légende sans N : nombre de lignes');
});

test('carte de chaleur : teinte selon la place du total entre min et max, échelle commune aux cases et sous-cases, légende', () => {
  const { ctx } = monter(doc({}));
  egal([1, 2, 3, 4, 5].map((t) => ctx.qChPalier(t, 1, 5)), [0, 1, 2, 3, 4]);
  egal(ctx.qChPalier(7, 7, 7), 4, 'max = min : palier le plus foncé');
  const h = rendu({ chN: 'score', chZ: 'sous-technique' });
  // min 0 (sous-case .003, « élevé »), max 1234,5 (T1204 et sa sous-case .002)
  egal(textes(h, /<span class="q-ch-lv">([\s\S]*?)<\/span>/g), ['0', '1234,5']);
  vrai(/<div class="q-ch-c q-ch-p4"[^>]*><span class="q-ch-n">T1204/.test(h) && /<div class="q-ch-s q-ch-p0"[^>]*><span class="q-ch-n">\.003/.test(h), 'paliers extrêmes');
  egal((h.match(/q-ch-sw q-ch-p\d/g) || []).length, 5, 'légende : cinq paliers');
});

test('carte de chaleur : bulle de chaque case avec ses lignes et leur source, aucun lien de filtre', () => {
  const h = rendu({});
  const tip = h.slice(h.indexOf('class="q-ch-tip"'), h.indexOf('</div>', h.indexOf('class="q-ch-tip"')));
  egal((tip.match(/<li>/g) || []).length, 2, 'T1059 : deux lignes');
  vrai(/Score<\/span> 3,5/.test(tip) && /q-src/.test(tip), 'cellules et source');
  vrai(/<div class="q-ch-c[^"]*" tabindex="0">/.test(h), 'case atteignable au clavier');
});

test('carte de chaleur : filtre de pastilles appliqué avant la matrice', () => {
  const t2 = TAB('t2', [['Tactique', 'Technique', 'Marque'], ['Impact', 'T1486', P('rançon')], ['Impact', 'T1490', '']]);
  const h = rendu({ scope: 'doc', tags: ['rançon'] }, [t2]);
  egal(colonnes(h), ['Impact1']);
  egal(cases(h), ['T1486']);
});

test('carte de chaleur : réglages absents ou inconnus (X = 1re colonne, Y = la suivante), autre source → tableau', () => {
  const h = rendu({ chX: undefined, chY: 'disparue', chZ: 'tactique', chN: 'inconnue' });
  egal(colonnes(h), ['Exécution3', 'Persistance1', '(vide)1']);
  egal(cases(h), ['T1059', 'T1204', 'T1053', 'T1566']);
  vrai(!/q-ch-sous/.test(h), 'Z égal à X : ignoré');
  const f = rendu({ src: 'facts' });
  vrai(!/q-ch/.test(f), 'fiches de faits : pas de carte');
});

test('carte de chaleur : paliers de page.css égaux à Q_CH_PALIERS', () => {
  const CSS = readFileSync(new URL('../../src/css/page.css', import.meta.url), 'utf8');
  const { ctx } = monter(doc({}));
  ctx.Q_CH_PALIERS.forEach((p, i) => {
    const m = CSS.match(new RegExp('\\.q-ch-p' + i + '\\{([^}]*)\\}'));
    vrai(m, 'règle .q-ch-p' + i);
    if (p === 100) vrai(/background:var\(--accent\)/.test(m[1]) && /color:var\(--on-accent\)/.test(m[1]), 'palier ' + i + ' : accent pur, texte inversé');
    else vrai(m[1].includes('color-mix(in srgb,var(--accent) ' + p + '%,var(--surface))'), 'palier ' + i + ' : ' + m[1]);
  });
});

test('carte de chaleur : puce « vue » et sa fenêtre (proposée seulement pour les lignes de tableaux ; X, Y, Z, N ; ni tri, ni limite, ni colonnes)', () => {
  const monte = (q) => { const { ctx, d } = monter(doc(q)); return { ctx, d, b: d.pages[0].blocks[1] }; };
  const { ctx, d, b } = monte({ chZ: 'sous-technique' });
  const f = ctx.qFenetre(b, d, 0, 'view');
  vrai(/data-qset="view" data-v="chaleur" aria-pressed="true">[\s\S]*?<span>Carte de chaleur<\/span>/.test(f), 'vue choisie');
  egal(ctx.qPuces(b, d, 0).map((p) => p.cle).filter((k) => k === 'view' || k === 'cols' || k === 'sort'), ['view'], 'ni puce colonnes ni puce tri');
  egal(ctx.qPuces(b, d, 0).find((p) => p.cle === 'view').libelle, 'Carte de chaleur');
  const sel = (p) => { const m = f.match(new RegExp('<select data-act="set" data-prop="' + p + '"[^>]*>([\\s\\S]*?)</select>')); return m && textes(m[1], /<option[^>]*>([\s\S]*?)<\/option>/g); };
  egal(sel('chX'), ['Tactique', 'Technique', 'Sous-technique', 'Score']);
  egal(sel('chY'), ['Technique', 'Sous-technique', 'Score'], 'Y : colonnes autres que X');
  egal(sel('chZ'), ['aucun sous-niveau', 'Sous-technique', 'Score'], 'Z : colonnes autres que X et Y');
  egal(sel('chN'), ['nombre de lignes', 'Tactique', 'Technique', 'Sous-technique', 'Score']);
  vrai(/data-prop="chZ"[^>]*>[\s\S]*?<option value="sous-technique" selected>/.test(f), 'Z choisi');
  vrai(!/data-prop="limit"/.test(f), 'pas de limite');
  const m = monte({ src: 'facts' });
  vrai(!/data-v="chaleur"/.test(m.ctx.qFenetre(m.b, m.d, 0, 'view')), 'pas proposée pour les fiches de faits');
});
