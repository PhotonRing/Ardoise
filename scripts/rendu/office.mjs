// Export Office (src/js/08-office.js) : éléments neutres d'un bloc, HTML à styles en ligne en thème clair, texte brut.
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
const office = (id, doc = DOC, opts) => { const { ctx, d } = monter(doc); const b = d.pages[0].blocks.find((x) => x.id === id); const e = ctx.officeBloc(b, d, opts || { page: 0 }); return { e, html: ctx.officeHtml(e, d), texte: ctx.officeTexte(e), d, ctx }; };
const pur = (x) => JSON.parse(JSON.stringify(x));

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
  vrai(html.includes('<span style="background:#e3f3ea;color:#1f7a4d;border-radius:999px'), 'pastille du registre en thème clair');
  vrai(html.includes('<b>gras</b>') && html.includes('<i>it</i>') && html.includes('<s>bar</s>') && /<code style="[^"]*">x&lt;y<\/code>/.test(html), 'formes');
  vrai(html.includes('<br>ligne 2'), 'saut de ligne');
});

test('office : titres de niveaux (en-tête, section, sous-section, sous-titre, étapes numérotées)', () => {
  const niveaux = ['hd', 's1', 's2', 's3', 'e1', 'e2'].map((id) => office(id).e.filter((x) => x.t === 'titre').map((x) => [x.niveau, office(id).ctx.officeTexte([x])]));
  egal(niveaux, [[[0, 'Incident 42']], [[1, 'Section']], [[2, 'Sous-section']], [[3, 'Petit titre']], [[1, '1 Isoler']], [[1, '2 Nettoyer']]]);
  const { e, html } = office('hd');
  egal(e.map((x) => x.style || x.t), ['surtitre', 'titre', 'chapeau']);
  vrai(/^<div style="[^"]*"><p style="[^"]*text-transform:uppercase[^"]*">Rapport<\/p><h1 style="[^"]*font-size:24pt/.test(html), html);
  vrai(/<h2 style="[^"]*">Sous-section<\/h2>/.test(office('s2').html) && /<h3 style="[^"]*">Petit titre<\/h3>/.test(office('s3').html), 'h2 et h3');
});

test('office : listes à niveaux et liste à cocher', () => {
  egal(office('l1').texte, '1. un\n  1. sous\n2. deux');
  vrai(/^<div[^>]*><ol style="[^"]*"><li>un<ol style="[^"]*"><li>sous<\/li><\/ol><\/li><li>deux<\/li><\/ol><\/div>$/.test(office('l1').html), office('l1').html);
  const c = office('c1');
  egal(c.texte, '☑ fait\n☐ à faire');
  // Writer reprend une liste <ul> sans puce comme une liste à puces après la première ligne : des paragraphes, sans liste
  vrai(!/<[ou]l|<li/.test(c.html) && /<p style="[^"]*">☑ fait<\/p><p style="[^"]*">☐ à faire<\/p>/.test(c.html), c.html);
  const n = office('c2', { v: 6, title: 'D', pages: [{ id: 'p1', blocks: [{ id: 'c2', type: 'check', items: [{ html: 'haut' }, { html: 'dessous', lv: 1 }, { html: 'plus bas', lv: 2 }] }] }] });
  const retraits = [...n.html.matchAll(/<p style="([^"]*)">☐ /g)].map((m) => (m[1].match(/margin-left:([\d.]+pt)/) || [])[1] || '0');
  egal(retraits, ['0', '18pt', '36pt'], 'retrait par niveau : ' + n.html);
  egal(n.texte, '☐ haut\n  ☐ dessous\n    ☐ plus bas');
});

test('office : tableau à en-tête gras et bordures fines ; fiche de faits à deux colonnes, alerte en rouge', () => {
  const t = office('t1');
  egal(t.texte, 'Nom\tÉtat\nServeur\t#KO');
  vrai(/<table width="100%" style="border-collapse:collapse[^"]*"><tr><th style="border:1px solid #d9e0e5;[^"]*font-weight:bold[^"]*">/.test(t.html), t.html);
  vrai(t.html.includes('background:#fdecea;color:#b42318'), 'pastille rouge du registre');
  const f = office('f1');
  egal(f.texte, 'Hôte\tsrv1\nRisque\télevé');
  vrai(!/<th/.test(f.html) && f.html.includes('<b>Hôte</b>') && f.html.includes('<span style="color:#b42318">élevé</span>'), f.html);
});

test('office : encadré teinté avec sa barre, code à chasse fixe sans coloration', () => {
  const n = office('n1');
  vrai(/<table width="100%" [^>]*><tr><td width="100%" style="background:#fdecea;[^"]*border-left:4px solid #b42318">/.test(n.html), n.html);
  const k = office('k1');
  egal(k.texte, 'a.sh\necho "<a>"\nls');
  // fond sur une cellule pleine largeur : Google Docs ne teinte un <pre> que sous le texte
  // LibreOffice Writer ignore la largeur en style : l'attribut width la donne
  vrai(/<table width="100%" style="[^"]*width:100%[^"]*"><tr><td width="100%" style="background:#eef2f4;[^"]*"><pre style="font-family:Consolas[^"]*margin:0[^"]*white-space:pre-wrap">echo &quot;&lt;a&gt;&quot;\nls<\/pre><\/td><\/tr><\/table>/.test(k.html), k.html);
});

test('office : kanban en colonnes, cartes en paragraphes (titre gras, échéance, responsable, priorité)', () => {
  const k = office('kb');
  egal(k.texte, 'À faire\tFait\nTâche Échéance : 12 mars 2026 · Responsable : Alice · Priorité P1 (haute)\t');
  vrai(k.html.includes('<th') && k.html.includes('<b>Tâche</b>'), k.html);
});

test('office : dépliable ouvert, image avec légende, cartes en cadres, séparateur, pied de page', () => {
  egal(office('dt').texte, 'Plus\nCaché');
  vrai(office('dt').html.includes('<b>Plus</b>'), 'titre du dépliable en gras');
  const im = office('im', DOC, { page: 0, images: { im: { src: 'data:image/png;base64,AAAA', mime: 'image/png', l: 1360, h: 400 } } });
  egal(pur(im.e[0]), { t: 'image', src: 'data:image/png;base64,AAAA', mime: 'image/png', l: 1360, h: 400, alt: 'Légende', legende: [{ texte: 'Légende' }] });
  vrai(im.html.includes('width="680" height="200"') && /font-style:italic[^"]*">Légende<\/p>/.test(im.html), im.html);
  egal(office('cd').texte, 'Carte A\ntexte\n☑ case');
  vrai(/<td width="100%" style="background:#ffffff;[^"]*border:1px solid #d9e0e5">/.test(office('cd').html), 'carte en cadre');
  vrai(office('dv').html.includes('<hr style='), 'séparateur');
  egal(office('ft').e[0].style, 'pied');
});

test('office : carte et chronologie en image fournie, sinon en texte', () => {
  egal(office('tl').texte, '- 2024 — Début : détail');
  egal(office('mp').texte, 'Carte\n- Brest (48.3800, -4.4700)');
  const img = { src: 'data:image/png;base64,BBBB', mime: 'image/png', l: 1360, h: 800 };
  egal(pur(office('tl', DOC, { page: 0, images: { tl: img } }).e), [{ t: 'image', ...img, alt: 'Chronologie', legende: [] }]);
  egal(office('mp', DOC, { page: 0, images: { mp: img } }).e[0].t, 'image');
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
  const { e, texte, html } = office('g1', DOC6);
  egal(e.map((x) => x.t), ['para', 'para', 'tableau'], 'titre, paragraphe, diamant');
  egal(pur(e[0].segs), [{ texte: 'Détails ', gras: true }, { texte: 'repliés', italique: true, gras: true }]);
  vrai(texte.startsWith('Détails repliés\ndans le groupe\n'), texte);
  vrai(/<p style="[^"]*"><b>Détails <\/b><i><b>repliés<\/b><\/i><\/p><p style="[^"]*">dans le groupe<\/p><table/.test(html), html);
  const vide = office('g1', { ...DOC6, pages: [{ id: 'p1', blocks: [{ id: 'g1', type: 'group', title: '', blocks: [{ id: 'x', type: 'p', html: 'seul' }] }] }] });
  egal(vide.texte, 'seul', 'titre vide : omis');
});

test('office : modèle diamant en tableau, titre puis les quatre sommets nommés dans l\'ordre de l\'écran', () => {
  const { e, texte, html } = office('d1', DOC6);
  egal(e.length, 1); egal(e[0].t, 'tableau'); egal(e[0].entete, false);
  egal(texte, 'Titre\tCampagne X\nAdversaire\tA\nCapacité\tC\nInfrastructure\tI\nVictime\tV');
  vrai(html.includes('<b>Adversaire</b>') && html.includes('<b>Titre</b>'), html);
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
