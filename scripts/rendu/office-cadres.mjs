// Copier pour Office, famille Cadres (src/js/09-office-cadres.js) : encadré, fiche de faits, cartes, bloc dépliable, groupe repliable, modèle diamant.
import { readFileSync } from 'node:fs';
import { test, egal, vrai } from './commun.mjs';
import { monterOffice, verifierSocle } from './office-socle.mjs';

const P = (t, cls) => '<span class="pill' + (cls ? ' ' + cls : '') + '">' + t + '</span>';
const CSS = readFileSync(new URL('../../src/css/page.css', import.meta.url), 'utf8');
// document en thème sombre à la palette indigo : le collage reste clair, à l'accent clair de la palette (#4848c0 / #ececfb)
const DOC = { v: 6, title: 'Doc', theme: 'dark', palette: 'indigo', tags: { ok: { c: 0 } }, pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 'nw', type: 'note', variant: 'warn', html: 'Attention' }, { id: 'ni', type: 'note', variant: 'info', html: 'Info' },
  { id: 'nb', type: 'note', variant: 'bad', html: 'Alerte' }, { id: 'no', type: 'note', variant: 'ok', html: 'Succès' },
  { id: 'f5', type: 'facts', items: [{ k: 'Hôte', v: 'srv-web' }, { k: 'Risque', v: 'élevé', alert: true }, { k: 'IP', v: '10.0.0.4' }, { k: 'État', v: P('OK') }, { k: 'Vu', v: 'hier' }] },
  { id: 'f2', type: 'facts', items: [{ k: 'Hôte', v: 'a' }, { k: 'IP', v: 'b' }] }, { id: 'f0', type: 'facts', items: [] },
  { id: 'ce', type: 'cards', min: 220, cards: [{ title: 'Carte A', text: 'texte <b>a</b>', checks: [{ html: 'fait', done: true }, { html: 'à faire' }] }, { title: 'Carte B', text: '' }, { title: '', text: 'seul texte' }] },
  { id: 'cl', type: 'cards', cards: [{ title: 'Large 1', text: 'x' }, { title: 'Large 2', text: 'y' }] },
  { id: 'dt', type: 'details', open: false, title: 'Plus <i>loin</i>', html: 'Caché<br>deux' },
  { id: 'g', type: 'group', title: 'Groupe', folded: true, blocks: [
    { id: 'gf', type: 'facts', items: [{ k: 'Hôte', v: 'srv' }] }, { id: 'gn', type: 'note', variant: 'info', html: 'Dedans' },
    { id: 'gp', type: 'p', html: 'paragraphe' }, { id: 'gm', type: 'map', markers: [] }] },
  { id: 'gv', type: 'group', title: '', blocks: [{ id: 'gv1', type: 'p', html: 'seul' }] },
  { id: 'dm', type: 'diamond', title: 'Campagne X', adversaire: 'Groupe ' + P('OK'), capacite: 'Hameçonnage', infrastructure: '', victime: 'Mairie' },
  { id: 'dn', type: 'diamond', title: '', adversaire: 'A', capacite: 'C', infrastructure: 'I', victime: 'V' },
  { id: 'gx', type: 'group', title: 'Voisins', blocks: [{ id: 'gt', type: 'table', rows: [['Nom', 'État'], ['a', 'b']] }, { id: 'gc', type: 'check', items: [{ html: 'fait', done: true }] }, { id: 'gk', type: 'code', variant: 'dark', name: 'a.sh', code: 'ls\n' }] },
  { id: 'nl', type: 'note', variant: 'line', html: '<b>Note</b> : trait seul' }, { id: 'nx', type: 'note', html: 'Sans variante' },
] }] };
const office = (id, doc = DOC, opts) => { const r = monterOffice(doc, id, opts); verifierSocle(r.html, id); return r; };
// style de la cellule qui contient le texte donné
const cellule = (html, texte) => { const i = html.indexOf(texte), d = html.lastIndexOf('<td', i); return html.slice(d, html.indexOf('>', d)); };
// Writer ignore vertical-align dans un style : les cadres sont calés en haut par l'attribut valign

test('office (cadres) : encadré au fond teinté et trait de 3 px à gauche selon sa variante ; « Trait seul » sans fond', () => {
  const V = { nw: ['#fdf3d8', '#8a5a00'], ni: ['#e4eef8', '#1f5f99'], nb: ['#fdecea', '#b42318'], no: ['#e3f3ea', '#1f7a4d'], nx: ['#fdf3d8', '#8a5a00'] };
  for (const id in V) {
    const { html } = office(id), td = cellule(html, '>' + DOC.pages[0].blocks.find((b) => b.id === id).html);
    vrai(td.includes('background:' + V[id][0]) && td.includes('border-left:3px solid ' + V[id][1]), id + ' : ' + html);
  }
  const { html, texte } = office('nl'), td = cellule(html, 'Note');
  vrai(!/background:#/.test(td) && td.includes('border-left:3px solid #8a5a00'), 'trait seul sans fond : ' + html);
  vrai(html.includes('<span style="color:#8a5a00"><b>Note</b></span> : trait seul'), 'gras en couleur du trait (.note.n-line b) : ' + html);
  egal(texte, 'Note : trait seul', 'texte brut inchangé');
});

// lignes d'un tableau (sans les lignes d'écart) : cellules de chaque ligne, leur style et leur texte
const lignes = (html) => [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<td(?: valign="top")?( width="[^"]*")? style="([^"]*)">([\s\S]*?)<\/td>/g)].map((c) => ({ largeur: (c[1] || '').slice(8, -1), style: c[2], texte: c[3].replace(/<[^>]*>|&nbsp;/g, '') }))).filter((r) => r.length);

test('office (cadres) : fiche de faits sur trois colonnes comme la grille d\'Ardoise à 680 px, clé en étiquette au-dessus de la valeur semi-grasse', () => {
  // grille de .facts : auto-fit, minmax(170px,1fr), gap 20px, cadre de 1 px et 18 px de marge intérieure → 3 colonnes à 680 px
  vrai(/\.facts\{[^}]*padding:16px 18px;[^}]*grid-template-columns:repeat\(auto-fit,minmax\(170px,1fr\)\);gap:14px 20px/.test(CSS), 'grille de .facts changée dans page.css : revoir officeCadreColonnes');
  const { html, texte } = office('f5'), l = lignes(html);
  egal(l.map((r) => r.map((c) => c.texte)), [['HÔTEsrv-web', 'RISQUEélevé', 'IP10.0.0.4'], ['ÉTATOK', 'VUhier', '']], html);
  egal(l[0].map((c) => c.largeur), ['33%', '33%', '33%']);
  vrai(/<p style="[^"]*font-family:Consolas,monospace;[^"]*text-transform:uppercase;[^"]*">HÔTE<\/p><p style="[^"]*font-family:'Segoe UI Semibold','Segoe UI',sans-serif;[^"]*font-weight:600[^"]*">srv-web<\/p>/.test(html), 'clé puis valeur : ' + html);
  vrai(/<p style="[^"]*color:#b42318[^"]*">élevé<\/p>/.test(html), 'alerte en rouge : ' + html);
  vrai(html.includes('background:#e3f3ea;color:#1f7a4d'), 'pastille dans une valeur');
  // cadre blanc bordé : bordure line sur le pourtour, fond blanc
  vrai(l[0][0].style.includes('border-top:1px solid #d9e0e5') && l[0][0].style.includes('border-left:1px solid #d9e0e5') && l[1][2].style.includes('border-right:1px solid #d9e0e5') && l[1][2].style.includes('border-bottom:1px solid #d9e0e5'), 'pourtour : ' + html);
  vrai(!l[0][1].style.includes('border-bottom:1px solid #d9e0e5') && l.flat().every((c) => c.style.includes('background:#ffffff')), 'pas de filet intérieur, fond blanc : ' + html);
  egal(texte, 'Hôte\tsrv-web\nRisque\télevé\nIP\t10.0.0.4\nÉtat\t#OK\nVu\thier', 'texte brut inchangé');
  egal(lignes(office('f2').html).map((r) => r.map((c) => c.largeur)), [['50%', '50%']], 'deux faits : deux colonnes');
  vrai(!office('f0').html.includes('<table'), 'sans fait : aucun tableau');
});

test('office (cadres) : cartes en grille de cellules bordées, autant par ligne qu\'à l\'écran à 680 px', () => {
  // .subs : auto-fit, minmax(min(100%,var(--min,340px)),1fr), écart de 12 px → « Étroites » (220) : 2 par ligne ; « Larges » (340) : 1 (2 × 340 + 12 > 680)
  vrai(/\.subs\{[^}]*minmax\(min\(100%,var\(--min,340px\)\),1fr\)\);gap:12px/.test(CSS), 'grille de .subs changée dans page.css : revoir officeCadreColonnes');
  const cartes = (html) => lignes(html).map((r) => r.filter((c) => c.style.includes('border:1px solid #d9e0e5')).map((c) => c.texte)).filter((r) => r.length);
  const { html, texte } = office('ce');
  egal(cartes(html), [['Carte Atexte a☑ fait☐ à faire', 'Carte B'], ['seul texte']], html);
  vrai(/<p style="[^"]*font-family:'Segoe UI Semibold','Segoe UI',sans-serif;[^"]*font-weight:600[^"]*">Carte A<\/p>/.test(html), 'titre semi-gras : ' + html);
  vrai(!/<li/.test(html) && /<p style="[^"]*"><span style="color:#4848c0">☑<\/span>/.test(html), 'cases en paragraphes (officeListeCases) : ' + html);
  vrai(lignes(html).flat().filter((c) => c.style.includes('border:1px solid #d9e0e5')).every((c) => c.style.includes('background:#ffffff')), 'cartes sur fond blanc');
  egal(html.match(/<td valign="top" width="49%"/g).length, 3, 'cartes calées en haut (Writer ignore vertical-align) : ' + html);
  egal(texte, 'Carte A\ntexte a\n☑ fait\n☐ à faire\nCarte B\nseul texte', 'texte brut inchangé');
  egal(cartes(office('cl').html), [['Large 1x'], ['Large 2y']], 'Larges : une carte par ligne');
});

test('office (cadres) : bloc dépliable collé ouvert, titre marqué comme à l\'écran, dans un cadre blanc bordé', () => {
  const { html, texte } = office('dt');
  vrai(/<td valign="top" width="100%" style="[^"]*background:#ffffff;[^"]*border:1px solid #d9e0e5/.test(html), 'cadre : ' + html);
  vrai(/<p style="[^"]*font-weight:600[^"]*"><span style="color:#4848c0">▾<\/span>&nbsp;Plus <i>loin<\/i><\/p>/.test(html), 'titre marqué : ' + html);
  vrai(/<p style="[^"]*margin-left:[^"]*">Caché<br>deux<\/p>/.test(html), 'contenu ouvert, en retrait : ' + html);
  egal(texte, 'Plus loin\nCaché\ndeux', 'texte brut inchangé');
});

test('office (cadres) : groupe repliable collé ouvert, trait gris à gauche, ses blocs chacun dans son style, cartes en image', () => {
  const images = { gm: { src: 'data:image/png;base64,CCCC', mime: 'image/png', l: 1300, h: 400 } };
  const { html, texte } = office('g', DOC, { page: 0, images });
  vrai(/<td valign="top" width="100%" style="[^"]*border-left:2px solid #d9e0e5[^"]*">/.test(html), 'trait gauche : ' + html);
  vrai(/font-weight:600[^"]*">(<span[^>]*>▾<\/span>&nbsp;)?Groupe<\/p>/.test(html), 'titre : ' + html);
  vrai(/text-transform:uppercase[^"]*">HÔTE<\/p>/.test(html) && html.includes('border-left:3px solid #1f5f99'), 'fiche et encadré dans le style des Cadres : ' + html);
  // Word fusionne deux tableaux qui se suivent : un paragraphe les sépare
  vrai(!/<\/table><table/.test(html), 'deux tableaux voisins séparés : ' + html);
  vrai(/<img src="data:image\/png;base64,CCCC"[^>]* width="650" height="200"/.test(html), 'carte en image, ramenée à la largeur du groupe : ' + html);
  egal(texte, 'Groupe\nHôte\tsrv\nDedans\nparagraphe\n[Image : Carte]', 'texte brut inchangé');
  const vide = office('gv').html;
  vrai(vide.includes('seul') && !/font-weight:600/.test(vide), 'titre vide omis : ' + vide);
});

test('office (cadres) : modèle diamant en losange 3 × 3, sommets bordés au nom en étiquette, sommet vide grisé, titre centré', () => {
  const { html, texte } = office('dm'), l = lignes(html);
  egal(l.map((r) => r.map((c) => c.texte)), [['', 'ADVERSAIREGroupe OK', ''], ['INFRASTRUCTURE—', '', 'CAPACITÉHameçonnage'], ['', 'VICTIMEMairie', '']], html);
  egal(l[0].map((c) => c.largeur), ['33%', '33%', '33%']);
  const sommets = l.flat().filter((c) => c.texte), cases = l.flat().filter((c) => !c.texte);
  vrai(sommets.every((c) => c.style.includes('border:1px solid #d9e0e5') && c.style.includes('background:#ffffff')), 'sommets bordés sur fond blanc : ' + html);
  vrai(cases.every((c) => !c.style.includes('#d9e0e5')), 'cases vides sans cadre ni trait du losange : ' + html);
  vrai(/<span style="color:#566573">—<\/span>/.test(html), 'sommet vide : tiret gris, cadre gardé');
  vrai(/<p style="[^"]*text-align:center[^"]*font-weight:600[^"]*">Campagne X<\/p>/.test(html) || /<p align="center" style="[^"]*font-weight:600[^"]*">Campagne X<\/p>/.test(html), 'titre centré : ' + html);
  vrai(!/<svg|<line/.test(html), 'pas de traits');
  vrai(/<\/p><p style="margin:0;font-size:1pt[^"]*">&nbsp;<\/p><table|Campagne X<\/p><table/.test(html), 'titre puis la grille : ' + html);
  egal(texte, 'Titre\tCampagne X\nAdversaire\tGroupe #OK\nCapacité\tHameçonnage\nInfrastructure\t—\nVictime\tMairie', 'texte brut inchangé');
  vrai(!/Campagne|<p align/.test(office('dn').html.split('<table')[0]), 'titre vide omis');
});

test('office (cadres) : un groupe rend ses tableaux, cases et code dans le style de leur famille', () => {
  const { html } = office('gx');
  vrai(/<td [^>]*text-transform:uppercase[^>]*><span style="letter-spacing:.5pt">NOM<\/span>/.test(html) || /letter-spacing:\.5pt">NOM</.test(html), 'en-tête du tableau en étiquette (09-office-tableaux.js) : ' + html);
  vrai(/<span style="color:#4848c0">☑<\/span>/.test(html) && !/<li/.test(html), 'case en paragraphe (09-office-listes.js) : ' + html);
  vrai(html.includes('#14202b'), 'code sombre (09-office-tableaux.js) : ' + html);
  vrai(!/<\/table><table/.test(html), 'tableaux voisins séparés');
});
