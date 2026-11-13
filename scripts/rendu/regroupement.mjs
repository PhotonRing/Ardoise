// Vue « Regroupée » d'une requête sur les lignes de tableaux (regX, regY, regForme) : groupes, valeurs uniques, tri, fiches, tableau.
import { monter, test, egal, vrai, textes } from './commun.mjs';

const P = (t) => '<span class="pill">' + t + '</span>';
const TAB = (id, rows) => ({ id, type: 'table', rows });
// incidents : adversaire (X), technique et outil (Y)
const LIGNES = [['Adversaire', 'Technique', 'Outil'],
  ['APT28', 'T1059', 'Mimikatz'],
  ['Lazarus', 'T1071', ''],
  ['apt28 ', 't1059', 'Cobalt'],
  ['', 'T1566', 'Word'],
  ['APT28', 'T1071', 'mimikatz']];
const doc = (q, extra) => ({ title: 'Doc', pages: [{ id: 'p1', title: 'Accueil', blocks: [
  TAB('t1', LIGNES), ...(extra || []),
  { id: 'q', type: 'query', src: 'table', scope: 'doc', view: 'regroupee', regX: 'adversaire', regY: ['technique', 'outil'], ...q },
] }] });
const rendu = (q, extra) => { const { ctx, d } = monter(doc(q, extra)); const h = ctx.renderPage(d, { page: 0, view: 'read' }); return h.slice(h.indexOf('class="q-res"')); };
const titres = (h) => textes(h, /<h4 class="q-reg-t">([\s\S]*?)<\/h4>/g);
const faits = (h) => textes(h, /<div class="fact">([\s\S]*?)<\/div>/g);

test('regroupée : une fiche par valeur de X (sans casse ni espaces), nombre de lignes, uniques par Y', () => {
  const h = rendu({});
  egal(titres(h), ['APT283', 'Lazarus1', '(vide)1']);
  egal(faits(h).slice(0, 2), ['TechniqueT1059, T1071', 'OutilMimikatz, Cobalt']);
  egal(faits(h).slice(2, 4), ['TechniqueT1071', 'Outil'], 'Y vide : fait sans valeur');
});

test('regroupée : une cellule faite seulement de pastilles donne une valeur par pastille, comparée par son nom ; les pastilles restent des pastilles', () => {
  const t2 = TAB('t2', [['adversaire', 'Technique'], ['APT28', P('T1059') + ' ' + P('t1105')], ['APT28', P('T1105') + ', texte']]);
  const h = rendu({ regY: ['technique'] }, [t2]);
  const f = faits(h)[0];
  egal(f, 'TechniqueT1059, T1071, t1105, T1105, texte', 'pastilles éclatées, T1059 déjà vu, cellule mixte gardée entière');
  vrai(h.includes('<dd>T1059, T1071, <span class="pill">t1105</span>, <span class="pill">T1105</span>, texte</dd>'), 'pastille rendue en pastille');
});

test('regroupée : tri des groupes sur X ou sur le nombre de lignes, « (vide) » toujours à la fin', () => {
  egal(titres(rendu({ sortBy: 'c:adversaire', sortDir: 'desc' })), ['Lazarus1', 'APT283', '(vide)1']);
  egal(titres(rendu({ sortBy: 'c:adversaire', sortDir: 'asc' })), ['APT283', 'Lazarus1', '(vide)1']);
  egal(titres(rendu({ sortBy: '#n', sortDir: 'asc' })), ['Lazarus1', '(vide)1', 'APT283']);
  egal(titres(rendu({ sortBy: 'c:technique', sortDir: 'desc' })), ['APT283', 'Lazarus1', '(vide)1'], 'tri sur une autre colonne : ignoré');
});

test('regroupée : filtres de pastilles et portée appliqués avant le regroupement', () => {
  const t2 = TAB('t2', [['Adversaire', 'Technique', 'Outil'], ['APT28', 'T9999 ' + P('urgent'), ''], ['FIN7', 'T1566 ' + P('urgent'), '']]);
  const h = rendu({ tags: ['urgent'], match: 'any', regY: ['technique'] }, [t2]);
  egal(titres(h), ['APT281', 'FIN71']);
});

test('regroupée : en tableau, une ligne par groupe, une colonne par Y et le nombre de lignes ; liens vers les sources', () => {
  const h = rendu({ regForme: 'tableau' });
  egal(textes(h, /<th>([\s\S]*?)<\/th>/g), ['Adversaire', 'Technique', 'Outil', 'Lignes']);
  egal(textes(h.slice(h.indexOf('<tbody>')), /<td>([\s\S]*?)<\/td>/g).slice(0, 3), ['APT28', 'T1059, T1071', 'Mimikatz, Cobalt']);
  vrai(!/q-table/.test(h), 'pas la classe de la loupe');
  vrai(h.includes('<summary>3 lignes</summary><ul><li><a class="q-src" href="#pg-p1">Accueil</a> <span class="muted">× 3</span></li></ul>'), 'sources réunies');
});

test('regroupée : réglages manquants ou inconnus, source autre que les lignes, limite sur les groupes', () => {
  egal(titres(rendu({ regX: undefined, regY: undefined })), ['APT283', 'Lazarus1', '(vide)1'], 'X absent : première colonne');
  egal(faits(rendu({ regY: ['disparue', 'outil'] })).length, 3, 'Y inconnue oubliée');
  egal(titres(rendu({ limit: 2 })), ['APT283', 'Lazarus1']);
  vrai(rendu({ limit: 2 }).includes('2 premiers groupes sur 3'), 'message de limite');
  const f = rendu({ src: 'facts' }, [{ id: 'f1', type: 'facts', items: [{ k: 'Hôte', v: 'srv1' }] }]);
  vrai(f.includes('class="q-table"') && !f.includes('q-reg'), 'fiches de faits : vue tableau');
});
