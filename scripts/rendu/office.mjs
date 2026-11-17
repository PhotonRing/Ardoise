// Export Office (src/js/08-office.js) : éléments neutres d'un bloc et texte brut ; le HTML stylé est vérifié par famille (office-<famille>.mjs).
import { readFileSync } from 'node:fs';
import { monter, test, egal, vrai } from './commun.mjs';

const CSS = readFileSync(new URL('../../src/css/page.css', import.meta.url), 'utf8');
// déclarations des règles :root sans condition (thème clair), puis d'une palette
const clair = {};
for (const m of CSS.matchAll(/^:root\{([^}]*)\}/gm)) for (const d of m[1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)) clair[d[1]] = d[2].toLowerCase();
const palette = (nom) => { const m = CSS.match(new RegExp(':root\\[data-palette="' + nom + '"\\]\\{([^}]*)\\}')); return m && [m[1].match(/--acc-l:(#\w+)/)[1], m[1].match(/--accs-l:(#\w+)/)[1]]; };

test('office : les couleurs du thème clair sont celles de page.css', () => {
  const { ctx } = monter({ title: 'Doc', pages: [{ id: 'p1', blocks: [] }] });
  const t = ctx.OFFICE_CLAIR;
  for (const k of Object.keys(t)) egal(t[k], clair[k], 'variable --' + k);
  for (const k of ['bg', 'surface', 'fg', 'muted', 'line', 'code-soft', 'ok', 'ok-soft', 'bad', 'bad-soft', 'warn', 'warn-soft', 'info', 'info-soft', 't4f', 't15b', 'map-sea']) vrai(t[k], 'variable absente : --' + k);
  egal(ctx.OFFICE_PALETTES.ambre, [clair['acc-l'], clair['accs-l']], 'palette par défaut');
  for (const p of ['petrole', 'indigo', 'rubis', 'foret', 'graphite']) egal(ctx.OFFICE_PALETTES[p], palette(p), 'palette ' + p);
});

const P = (t, cls) => '<span class="pill' + (cls ? ' ' + cls : '') + '">' + t + '</span>';
// un document de chaque type ; « OK » au registre en vert (0), « KO » en rouge (1)
const blocs = [
  { id: 'hd', type: 'header', eyebrow: 'Rapport', title: 'Incident <i>42</i>', lede: 'Résumé court' },
  { id: 's1', type: 'h2', html: 'Section' }, { id: 's2', type: 'h3', html: 'Sous-section' }, { id: 's3', type: 'subtitle', html: 'Petit titre' },
  { id: 'e1', type: 'step', num: '', title: 'Isoler' }, { id: 'e2', type: 'step', num: '', title: 'Nettoyer' },
  { id: 'p1', type: 'p', html: 'A <b>gras</b> <i>it</i> <u>sou</u> <s>bar</s> <code>x&lt;y</code> <a href="https://ex.fr/a?b=1&amp;c=2" target="_blank" rel="noopener">web</a> <a href="#pg-p2">interne</a> ' + P('OK') + ' ' + P('ok', 'pc-3') + ' ' + P('Inconnue') + '<br>ligne 2' },
  { id: 'l1', type: 'list', ordered: true, items: [{ html: 'un' }, { html: 'sous', lv: 1 }, { html: 'deux' }] },
  { id: 'c1', type: 'check', items: [{ html: 'fait', done: true }, { html: 'à faire', done: false }] },
  { id: 't1', type: 'table', rows: [['Nom', 'État'], ['Serveur', P('KO')]] },
  { id: 'f1', type: 'facts', items: [{ k: 'Hôte', v: 'srv1', alert: false }, { k: 'Risque', v: 'élevé', alert: true }] },
  { id: 'n1', type: 'note', variant: 'bad', html: 'Attention' },
  { id: 'k1', type: 'code', variant: 'dark', name: 'a.sh', code: 'echo "<a>"\nls\n' },
  { id: 'kb', type: 'kanban', cols: [{ id: 'c1', title: 'À faire', cards: [{ id: 'x1', title: 'Tâche', html: '', due: '2026-03-12', who: 'Alice', prio: 'p1' }] }, { id: 'c2', title: 'Fait', cards: [] }] },
  { id: 'dt', type: 'details', title: 'Plus', html: 'Caché', open: false },
  { id: 'im', type: 'image', src: 'data:image/png;base64,AAAA', caption: 'Légende', alt: '' },
  { id: 'cd', type: 'cards', min: 340, cards: [{ title: 'Carte A', text: 'texte', checks: [{ html: 'case', done: true }] }] },
  { id: 'dv', type: 'divider' }, { id: 'ft', type: 'footer', html: 'Sources' },
  { id: 'tl', type: 'timeline', orient: 'v', items: [{ date: '2024', title: 'Début', text: 'détail', color: 'ok' }] },
  { id: 'mp', type: 'map', markers: [{ lat: 48.38, lon: -4.47, label: 'Brest' }] },
];
const DOC = { v: 6, title: 'Doc', tags: { ok: { c: 0 }, ko: { c: 1 } }, pages: [{ id: 'p1', title: 'Accueil', blocks: blocs }, { id: 'p2', title: 'Suite', blocks: [] }] };
const office = (id, doc = DOC, opts) => { const { ctx, d } = monter(doc); const b = d.pages[0].blocks.find((x) => x.id === id); const e = ctx.officeBloc(b, d, opts || { page: 0 }); return { e, html: ctx.officeHtmlBloc(b, d, opts || { page: 0 }), texte: ctx.officeTexte(e), d, ctx }; };
const pur = (x) => JSON.parse(JSON.stringify(x));

test('office : le HTML de « Copier pour Office » porte la marque d\'Ardoise autour du rendu du bloc', () => {
  const { ctx, html } = office('p1');
  const copie = ctx.htmlCopieOffice(html);
  vrai(copie.startsWith('<div data-ardoise-office="1">') && copie.endsWith('</div>'), 'marque en tête : ' + copie.slice(0, 80));
  vrai(copie.includes(html), 'rendu du bloc gardé tel quel');
  vrai(ctx.copieOffice(copie), 'marque reconnue');
});

test('office : segments d\'un texte enrichi (formes, liens, pastilles en thème clair, saut de ligne)', () => {
  const { e, d } = office('p1');
  egal(pur(e[0].segs), [
    { texte: 'A ' }, { texte: 'gras', gras: true }, { texte: ' ' }, { texte: 'it', italique: true }, { texte: ' ' }, { texte: 'sou', souligne: true }, { texte: ' ' },
    { texte: 'bar', barre: true }, { texte: ' ' }, { texte: 'x<y', code: true }, { texte: ' ' }, { texte: 'web', lien: 'https://ex.fr/a?b=1&c=2' }, { texte: ' ' },
    { texte: 'interne', interne: true, souligne: true }, { texte: ' ' },
    { texte: 'OK', pastille: { fond: '#e3f3ea', texte: '#1f7a4d' } }, { texte: ' ' },
    { texte: 'ok', pastille: { fond: '#e4eef8', texte: '#1f5f99' } }, { texte: ' ' },
    { texte: 'Inconnue', pastille: { fond: '#d9e0e5', texte: '#17212b' } },
    { saut: true }, { texte: 'ligne 2' },
  ]);
  egal(pur(d.tags), { ok: { c: 0 }, ko: { c: 1 } }, 'l\'export n\'inscrit rien au registre');
});

test('office : HTML à styles en ligne, sans classe, lien interne sans adresse', () => {
  const { html } = office('p1');
  vrai(!/class=/.test(html), 'aucune classe : ' + html);
  vrai(html.includes('<a href="https://ex.fr/a?b=1&amp;c=2"'), 'lien web gardé');
  vrai(html.includes('<u>interne</u>') && !html.includes('#pg-p2'), 'lien interne en texte souligné, sans adresse');
  vrai(html.includes('<span style="background:#e3f3ea;color:#1f7a4d;'), 'pastille du registre en thème clair');
  vrai(html.includes('<b>gras</b>') && html.includes('<i>it</i>') && html.includes('<s>bar</s>') && /<code style="[^"]*">x&lt;y<\/code>/.test(html), 'formes');
  vrai(html.includes('<br>ligne 2'), 'saut de ligne');
});

test('office : titres de niveaux (en-tête, section, sous-section, sous-titre, étapes numérotées)', () => {
  const niveaux = ['hd', 's1', 's2', 's3', 'e1', 'e2'].map((id) => office(id).e.filter((x) => x.t === 'titre').map((x) => [x.niveau, office(id).ctx.officeTexte([x])]));
  egal(niveaux, [[[0, 'Incident 42']], [[1, 'Section']], [[2, 'Sous-section']], [[3, 'Petit titre']], [[1, '1 Isoler']], [[1, '2 Nettoyer']]]);
  const { e } = office('hd');
  egal(e.map((x) => x.style || x.t), ['surtitre', 'titre', 'chapeau']);
});

test('office : listes à niveaux et liste à cocher', () => {
  egal(office('l1').texte, '1. un\n  1. sous\n2. deux');
  const c = office('c1');
  egal(c.texte, '☑ fait\n☐ à faire');
  const n = office('c2', { v: 6, title: 'D', pages: [{ id: 'p1', blocks: [{ id: 'c2', type: 'check', items: [{ html: 'haut' }, { html: 'dessous', lv: 1 }, { html: 'plus bas', lv: 2 }] }] }] });
  egal(n.texte, '☐ haut\n  ☐ dessous\n    ☐ plus bas');
});

test('office : tableau et fiche de faits en texte brut, cellules en tabulations', () => {
  const t = office('t1');
  egal(t.texte, 'Nom\tÉtat\nServeur\t#KO');
  const f = office('f1');
  egal(f.texte, 'Hôte\tsrv1\nRisque\télevé');
});

test('office : code en texte brut, nom de fichier en tête', () => {
  const k = office('k1');
  egal(k.texte, 'a.sh\necho "<a>"\nls');
});

test('office : kanban en texte brut, une colonne par cellule (titre, échéance, responsable, priorité)', () => {
  const k = office('kb');
  egal(k.texte, 'À faire\tFait\nTâche Échéance : 12 mars 2026 · Responsable : Alice · Priorité P1 (haute)\t');
});

test('office : dépliable ouvert, image avec légende, cartes, pied de page en éléments neutres', () => {
  egal(office('dt').texte, 'Plus\nCaché');
  const im = office('im', DOC, { page: 0, images: { im: { src: 'data:image/png;base64,AAAA', mime: 'image/png', l: 1360, h: 400 } } });
  egal(pur(im.e[0]), { t: 'image', src: 'data:image/png;base64,AAAA', mime: 'image/png', l: 1360, h: 400, alt: 'Légende', legende: [{ texte: 'Légende' }] });
  egal(office('cd').texte, 'Carte A\ntexte\n☑ case');
  egal(office('ft').e[0].style, 'pied');
});

test('office : carte et chronologie en image fournie, sinon en texte', () => {
  egal(office('tl').texte, '- 2024 — Début : détail');
  egal(office('mp').texte, 'Carte\n- Brest (48.3800, -4.4700)');
  const img = { src: 'data:image/png;base64,BBBB', mime: 'image/png', l: 1360, h: 800 };
  egal(pur(office('tl', DOC, { page: 0, images: { tl: img } }).e), [{ t: 'image', ...img, alt: 'Chronologie', legende: [] }]);
  egal(office('mp', DOC, { page: 0, images: { mp: img } }).e[0].t, 'image');
  // HTML : image ramenée à 680 px, sinon liste à puces
  vrai(office('mp', DOC, { page: 0, images: { mp: img } }).html.includes('width="680" height="400"'), office('mp', DOC, { page: 0, images: { mp: img } }).html);
  vrai(/<ul style="[^"]*"><li><span style="color:#566573">2024 — <\/span><b>Début<\/b> : détail<\/li><\/ul>/.test(office('tl').html), office('tl').html);
});

test('office : requête figée comme affichée (tableau, liste, nombre « texte : X / total »)', () => {
  const page = (q) => ({ title: 'Doc', tags: { ok: { c: 0 } }, pages: [{ id: 'p1', title: 'Accueil', blocks: [
    { id: 'f1', type: 'facts', items: [{ k: 'Hôte', v: 'srv1 ' + P('OK') }, { k: 'Risque', v: 'haut', alert: true }] },
    { id: 'f2', type: 'facts', items: [{ k: 'Hôte', v: 'srv2' }] },
    { id: 'q', type: 'query', title: 'Hôtes', src: 'facts', scope: 'doc', tags: [], match: 'any', ...q },
  ] }] });
  egal(office('q', page({ view: 'table' })).texte, 'Hôtes\nHôte\tRisque\tSource\nsrv1 #OK\thaut\tAccueil\nsrv2\t\tAccueil');
  vrai(office('q', page({ view: 'table' })).html.includes('<span style="color:#b42318">haut</span>'), 'alerte gardée');
  egal(office('q', page({ view: 'list' })).texte, 'Hôtes\n- Accueil · Hôte srv1 #OK · Risque haut\n- Accueil · Hôte srv2');
  egal(office('q', page({ view: 'count', cards: [{ label: 'Avec OK', tags: ['ok'], match: 'any', state: 'all', total: 'all' }] })).texte, 'Hôtes\nAvec OK : 1 / 2');
  // cartes à filtres (ticket 04) : mêmes comptes et même texte par défaut qu'à l'écran
  egal(office('q', page({ view: 'count', cards: [{ id: 'n', label: '', filtres: [{ id: 'a', prop: 'valeur', colonne: 'risque', vals: [''], mode: 'aucun' }], total: 'filter', tfiltres: [{ id: 'b', prop: 'tags', vals: ['ok'], mode: 'aucun' }] }] })).texte, 'Hôtes\nfiches de faits · Risque : sauf (vide) : 1 / 1');
});

test('office : requête aux colonnes choisies (tableau, liste, en colonnes, cases)', () => {
  const page = (q, plus) => ({ title: 'Doc', pages: [{ id: 'p1', title: 'Accueil', blocks: [
    { id: 'f1', type: 'facts', items: [{ k: 'Hôte', v: 'srv1' }, { k: 'Risque', v: 'haut' }, { k: 'Note', v: 'n' }] },
    ...(plus || []),
    { id: 'q', type: 'query', title: 'Hôtes', src: 'facts', scope: 'doc', tags: [], match: 'any', ...q },
  ] }] });
  const ch = { mode: 'sauf', noms: ['note'], ordre: ['#source', 'risque'] };
  egal(office('q', page({ view: 'table', colonnes: ch })).texte, 'Hôtes\nSource\tRisque\tHôte\nAccueil\thaut\tsrv1');
  egal(office('q', page({ view: 'table', colonnes: { mode: 'seulement', noms: ['hôte'], ordre: [] } })).texte, 'Hôtes\nHôte\nsrv1', 'Source masquée');
  egal(office('q', page({ view: 'list', colonnes: { mode: 'sauf', noms: ['note'], ordre: ['risque'] } })).texte, 'Hôtes\n- Accueil · Risque haut · Hôte srv1', 'liste : Source en tête');
  egal(office('q', page({ view: 'list', colonnes: { mode: 'sauf', noms: ['#source'], ordre: [] } })).texte, 'Hôtes\n- Hôte srv1 · Risque haut · Note n', 'liste sans Source');
  // en colonnes, la carte suit l'écran : colonnes choisies dans leur ordre, sans celle du regroupement, Source à sa place
  // (texte d'une case du tableau : ses paragraphes joints par une espace)
  egal(office('q', page({ view: 'kanban', groupBy: 'c:hôte', colonnes: { mode: 'sauf', noms: ['note'], ordre: [] } })).texte, 'Hôtes\nsrv1 (1)\nRisque haut Accueil', 'en colonnes : Note masquée, Source affichée');
  egal(office('q', page({ view: 'kanban', groupBy: 'c:risque', colonnes: { mode: 'sauf', noms: [], ordre: ['hôte', '#source', 'risque', 'note'] } })).texte, 'Hôtes\nhaut (1)\nHôte srv1 Accueil Note n', 'en colonnes : Source rangée au milieu');
  egal(office('q', page({ view: 'kanban', groupBy: 'c:hôte', colonnes: { mode: 'sauf', noms: ['note', '#source'], ordre: [] } })).texte, 'Hôtes\nsrv1 (1)\nRisque haut', 'en colonnes : Source masquée');
  egal(office('q', page({ src: 'check', view: 'kanban' }, [{ id: 'c1', type: 'check', items: [{ html: 'fait', done: true }] }])).texte, 'Hôtes\nNon cochées (0)\tCochées (1)\n\t☑ fait Accueil', 'cases en colonnes : Source affichée');
  const cases = [{ id: 'c1', type: 'check', items: [{ html: 'fait', done: true }] }];
  egal(office('q', page({ src: 'check', view: 'table', colonnes: { mode: 'sauf', noms: ['#source'], ordre: ['élément'] } }, cases)).texte, 'Hôtes\nÉlément\t✓\nfait\t☑');
});

// groupe et modèle diamant (lot 6) : le groupe arrive ouvert, titre en gras puis ses blocs ; le diamant en tableau
const DOC6 = { v: 6, title: 'Doc', tags: { apt: { c: 1 } }, pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 'g1', type: 'group', title: 'Détails <i>repliés</i>', folded: true, blocks: [
    { id: 'gp', type: 'p', html: 'dans le groupe' },
    { id: 'gd', type: 'diamond', title: '', adversaire: 'Groupe ' + P('APT'), capacite: 'Hameçonnage', infrastructure: '', victime: 'Mairie' },
  ] },
  { id: 'd1', type: 'diamond', title: 'Campagne X', adversaire: 'A', capacite: 'C', infrastructure: 'I', victime: 'V' },
] }] };

test('office : groupe ouvert (même plié), titre en gras puis ses blocs', () => {
  const { e, texte } = office('g1', DOC6);
  egal(e.map((x) => x.t), ['para', 'para', 'tableau'], 'titre, paragraphe, diamant');
  egal(pur(e[0].segs), [{ texte: 'Détails ', gras: true }, { texte: 'repliés', italique: true, gras: true }]);
  vrai(texte.startsWith('Détails repliés\ndans le groupe\n'), texte);
  const vide = office('g1', { ...DOC6, pages: [{ id: 'p1', blocks: [{ id: 'g1', type: 'group', title: '', blocks: [{ id: 'x', type: 'p', html: 'seul' }] }] }] });
  egal(vide.texte, 'seul', 'titre vide : omis');
});

test('office : modèle diamant en tableau, titre puis les quatre sommets nommés dans l\'ordre de l\'écran', () => {
  const { e, texte } = office('d1', DOC6);
  egal(e.length, 1); egal(e[0].t, 'tableau'); egal(e[0].entete, false);
  egal(texte, 'Titre\tCampagne X\nAdversaire\tA\nCapacité\tC\nInfrastructure\tI\nVictime\tV');
  // titre vide : ligne omise ; sommet vide : « — » en gris ; pastille d'un sommet en sa couleur
  const g = office('g1', DOC6).e[2];
  egal(office('g1', DOC6).ctx.officeTexte([g]), 'Adversaire\tGroupe #APT\nCapacité\tHameçonnage\nInfrastructure\t—\nVictime\tMairie');
  egal(pur(g.lignes[2][1][0].segs), [{ texte: '—', couleur: '#566573' }]);
  egal(pur(g.lignes[0][1][0].segs[1]), { texte: 'APT', pastille: { fond: '#fdecea', texte: '#b42318' } });
});

test('office : une fiche de faits ou un tableau sans ligne n\'écrit aucun tableau', () => {
  const doc = { v: 6, title: 'D', pages: [{ id: 'p1', blocks: [{ id: 'f', type: 'facts', items: [] }, { id: 't', type: 'table', rows: [] }] }] };
  for (const id of ['f', 't']) { const { html, texte } = office(id, doc); vrai(!html.includes('<table'), id + ' : ' + html); egal(texte, '', id + ' : texte brut'); }
});

test('office : vue regroupée en fiches (titre gras avec le nombre, tableau à deux colonnes) et en tableau', () => {
  const page = (q) => ({ title: 'Doc', pages: [{ id: 'p1', title: 'Accueil', blocks: [
    { id: 't1', type: 'table', rows: [['Adversaire', 'Technique'], ['APT28', P('T1059')], ['apt28', 'T1071'], ['', 'T1566']] },
    { id: 'q', type: 'query', title: 'Synthèse', src: 'table', scope: 'doc', view: 'regroupee', regX: 'adversaire', regY: ['technique'], ...q },
  ] }] });
  const f = office('q', page({}));
  egal(f.texte, 'Synthèse\nAPT28 (2)\nTechnique\t#T1059, T1071\n(vide) (1)\nTechnique\tT1566');
  egal(office('q', page({ regForme: 'tableau', sortBy: '#n', sortDir: 'asc' })).texte, 'Synthèse\nAdversaire\tTechnique\tLignes\n(vide)\tT1566\t1\nAPT28\t#T1059, T1071\t2');
});

test('office : carte de chaleur en tableau aux cases teintées (couleurs du thème clair), sous-cases sous leur case, légende', () => {
  const page = (q, palette) => ({ title: 'Doc', palette, pages: [{ id: 'p1', title: 'Accueil', blocks: [
    { id: 't1', type: 'table', rows: [['Tactique', 'Technique', 'Sous', 'Score'], ['Exécution', 'T1059', '.001', '3,5'], ['Persistance', 'T1053', '', '1'], ['exécution', 'T1204', '', '1']] },
    { id: 'q', type: 'query', title: 'Matrice', src: 'table', scope: 'doc', view: 'chaleur', chX: 'tactique', chY: 'technique', chZ: 'sous', chN: 'score', ...q },
  ] }] });
  const f = office('q', page({}));
  egal(f.texte, 'Matrice\nExécution (4,5)\tPersistance (1)\nT1059  3,5\tT1053  1\n› .001  3,5\t\nT1204  1\t\nÉchelle : de 1 (clair) à 3,5 (foncé), somme de Score');
  const t = f.e.find((x) => x.t === 'tableau');
  // T1059 et .001 au palier le plus foncé (accent pur), T1053 et T1204 au plus clair (6 % d'accent sur blanc)
  egal(t.fonds, [[null, null], ['#b4540a', '#fbf5f0'], ['#b4540a', null], ['#fbf5f0', null]]);
  vrai(/background:#b4540a[^>]*>[\s\S]*?color:#ffffff[^>]*>T1059/.test(f.html), 'palier foncé : texte blanc');
  vrai(/background:#fbf5f0/.test(f.html), 'palier clair');
  egal(office('q', page({}, 'indigo')).e.find((x) => x.t === 'tableau').fonds[1][0], '#4848c0', 'accent de la palette du document');
});
