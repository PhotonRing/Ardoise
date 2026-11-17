// Copier pour Office, famille Kanban et requêtes (src/js/09-office-requetes.js) : kanban, Bloc requête dans chacune de ses vues.
import { test, egal, vrai, monter } from './commun.mjs';
import { monterOffice, verifierSocle } from './office-socle.mjs';

const P = (t) => '<span class="pill">' + t + '</span>';
const cellules = (html) => html.match(/<td[^>]*>[\s\S]*?<\/td>/g) || [];
// document en thème sombre à la palette indigo (#4848c0 / #ececfb) : le collage reste en thème clair
const KB = { id: 'kb', type: 'kanban', cols: [
  { id: 'c1', title: 'À faire', cards: [
    { id: 'x1', title: 'Corriger <b>vite</b>', html: 'détail', due: '2000-01-01', who: 'Alice', prio: 'p1', dep: ['x2'] },
    { id: 'x3', title: 'Sans rien', html: '' }] },
  { id: 'c2', title: 'En cours', cards: [{ id: 'x2', title: 'Préparer', html: '', due: '', who: '', prio: 'p3' }] },
  { id: 'c4', title: '', cards: [] },
  { id: 'c3', title: 'Fait', cards: [{ id: 'x4', title: 'Livré', html: '', due: '2000-01-01', who: '' }] }] };
const DOC = (blocks) => ({ v: 6, title: 'Doc', theme: 'dark', palette: 'indigo', tags: { ok: { c: 0 }, ko: { c: 1 } }, pages: [{ id: 'p1', title: 'Accueil', blocks }] });
const office = (doc, id, en) => { const r = monterOffice(doc, id); verifierSocle(r.html, id, en); return r; };

test('office (requêtes) : kanban en colonnes de cellules côte à côte, titre et compte de chaque colonne', () => {
  const { html, texte } = office(DOC([KB]), 'kb');
  // table extérieure : une ligne, une cellule par colonne au quart de la largeur, fond de page, bordée
  const col = html.match(/<td valign="top" width="25%"[^>]*>/g) || [];
  egal(col.length, 4, 'quatre colonnes au quart : ' + html);
  vrai(col.every((t) => /background:#f5f7f8/.test(t) && /border:1px solid #d9e0e5/.test(t)), 'colonne sur fond de page, bordée : ' + col[0]);
  vrai(/font-weight:600[^"]*">À faire<\/span>/.test(html), 'titre de colonne en semi-gras : ' + html);
  vrai(/>Colonne 3<\/span>/.test(html), 'colonne sans titre : « Colonne 3 »');
  vrai(/<span style="font-family:Consolas,monospace;[^"]*background:#d9e0e5">&nbsp;2&nbsp;<\/span>/.test(html), 'compte en pastille grise : ' + html);
  vrai(/color:#566573[^"]*">—<\/p>/.test(html), 'colonne vide : tiret gris');
  egal(texte, 'À faire\tEn cours\tColonne 3\tFait\nCorriger vite détail Échéance : 1 janv. 2000 · Responsable : Alice · Priorité P1 (haute) Sans rien\tPréparer Priorité P3 (basse)\t\tLivré Échéance : 1 janv. 2000', 'texte brut inchangé');
});

test('office (requêtes) : cartes du kanban en cellules bordées, titre, texte, méta grises, priorité en trait, échéance passée en rouge', () => {
  const { html } = office(DOC([KB]), 'kb');
  const cartes = html.match(/<table width="100%" style="[^"]*"><tr><td valign="top" width="100%"[^>]*>[\s\S]*?<\/td><\/tr><\/table>/g) || [];
  egal(cartes.length, 4, 'une table par carte : ' + html);
  const [c1, c3, c2, c4] = cartes;   // ordre : colonne par colonne (x1, x3, puis x2, puis x4)
  vrai(/background:#ffffff/.test(c1) && /border-left:3px solid #b42318/.test(c1), 'P1 : trait rouge à gauche : ' + c1);
  vrai(/border-left:3px solid #1f5f99/.test(c2) && /border-top:1px solid #1f5f99/.test(c2) && /border-left:1px solid #d9e0e5/.test(c3), 'P3 : trait et cadre bleus ; sans priorité : cadre gris : ' + c2);
  vrai(/font-weight:600;[^"]*">Corriger <b>vite<\/b><\/p>/.test(c1), 'titre en semi-gras : ' + c1);
  vrai(/color:#566573[^"]*">détail<\/p>/.test(c1), 'texte gris');
  vrai(/<span style="background:#fdecea;color:#b42318;[^"]*">&nbsp;P1&nbsp;<\/span>/.test(c1), 'pastille de priorité : ' + c1);
  vrai(/<span style="[^"]*color:#b42318;background:#fdecea[^"]*">1 janv\. 2000<\/span>/.test(c1), 'échéance passée en rouge : ' + c1);
  vrai(/<span style="[^"]*color:#566573[^"]*">1 janv\. 2000<\/span>/.test(c4) && !/#fdecea/.test(c4), 'dernière colonne : échéance grise : ' + c4);
  vrai(/color:#566573[^"]*">Alice<\/span>/.test(c1), 'responsable gris');
  vrai(/color:#566573[^"]*">Bloque : Corriger vite<\/p>/.test(c2), '« Bloque » gris : ' + c2);
  vrai(/color:#b42318[^"]*">Attend : Préparer<\/p>/.test(c1) && /border-top:1px dashed #b42318/.test(c1), 'carte bloquée : « Attend » rouge, cadre en tirets : ' + c1);
  vrai(/>Sans rien<\/p><\/td>/.test(c3), 'carte sans méta : titre seul : ' + c3);
  vrai(/<\/table><p style="[^"]*font-size:1pt[^"]*">&nbsp;<\/p><table/.test(html), 'cartes séparées par un paragraphe (Word fusionne deux tables qui se suivent)');
});

// fiches de faits et cases, requêtes dans chacune des vues
const FAITS = [
  { id: 'f1', type: 'facts', items: [{ k: 'Hôte', v: 'srv1 ' + P('OK') }, { k: 'Risque', v: 'haut', alert: true }] },
  { id: 'f2', type: 'facts', items: [{ k: 'Hôte', v: 'srv2' }] },
  { id: 'f3', type: 'facts', items: [{ k: 'Hôte', v: 'srv3' }, { k: 'Risque', v: 'bas' }] },
  { id: 'c1', type: 'check', items: [{ html: 'fait', done: true }, { html: 'à faire' }] },
];
const Q = (q) => DOC([...FAITS, { id: 'q', type: 'query', title: 'Hôtes', src: 'facts', scope: 'doc', tags: [], match: 'any', ...q }]);

test('office (requêtes) : titre en étiquette, vue tableau sur le tableau d\'Ardoise (en-tête en étiquette, source grise, alerte rouge)', () => {
  const { html, texte } = office(Q({ view: 'table' }), 'q');
  vrai(/^<div[^>]*><p style="margin:0pt 0pt 6pt;font-size:8\.25pt"><span style="font-family:Consolas,monospace;[^"]*">HÔTES<\/span><\/p>/.test(html), 'titre en étiquette, en capitales écrites : ' + html);
  const td = cellules(html);
  egal(td.length, 12, 'en-tête et trois lignes de trois cellules');
  vrai(/<span style="[^"]*letter-spacing:0\.5pt">HÔTE<\/span>/.test(td[0]) && /border-top:1px solid #d9e0e5/.test(td[0]), 'en-tête du tableau d\'Ardoise (officeTabTableau) : ' + td[0]);
  vrai(/font-size:10\.5pt;/.test(td[3]), 'corps à 14 px (.q-table) : ' + td[3]);
  vrai(/<span style="color:#b42318">haut<\/span>/.test(td[4]), 'alerte rouge : ' + td[4]);
  vrai(/<span style="color:#566573;font-size:9\.38pt">Accueil<\/span>/.test(td[5]), 'source grise, sans lien : ' + td[5]);
  egal(texte, 'Hôtes\nHôte\tRisque\tSource\nsrv1 #OK\thaut\tAccueil\nsrv2\t\tAccueil\nsrv3\tbas\tAccueil', 'texte brut inchangé');
  // limite : « 2 premiers résultats sur 3 » en gris sous le tableau
  vrai(/<\/table><p style="[^"]*color:#566573[^"]*">2 premiers résultats sur 3<\/p>/.test(office(Q({ view: 'table', limit: 2 }), 'q').html), 'limite');
  const vide = office(Q({ view: 'table', tags: ['ko'] }), 'q').html;
  vrai(/<p style="[^"]*color:#566573[^"]*">Aucun résultat\.<\/p>/.test(vide) && !/<table/.test(vide), 'aucun résultat : ' + vide);
  const sansTitre = office(Q({ view: 'table', title: '' }), 'q').html;
  vrai(/^<div[^>]*><table/.test(sansTitre), 'sans titre : le tableau d\'abord');
});

test('office (requêtes) : cases en tableau, ligne cochée grise, case accent', () => {
  const { html } = office(Q({ src: 'check', view: 'table' }), 'q');
  const td = cellules(html);
  vrai(/<span style="color:#4848c0">☑<\/span>/.test(html), 'case à l\'accent : ' + html);
  const lignes = (html.match(/<tr>[\s\S]*?<\/tr>/g) || []).slice(1), fait = lignes.find((l) => />fait</.test(l)), aFaire = lignes.find((l) => />à faire</.test(l));
  vrai(cellules(fait).every((c) => /;color:#566573;border/.test(c)), 'ligne cochée en gris : ' + fait);
  vrai(!/;color:#566573;border/.test(aFaire), 'ligne non cochée : ' + aFaire);
});

test('office (requêtes) : vue liste en lignes encadrées, clés en étiquette, source grise ; cases en paragraphes', () => {
  const { html, texte } = office(Q({ view: 'list' }), 'q');
  const td = cellules(html);
  egal(td.length, 3, 'une ligne encadrée par résultat : ' + html);
  vrai(td.every((c) => /background:#ffffff/.test(c) && /border:1px solid #d9e0e5/.test(c)), 'ligne encadrée : ' + td[0]);
  vrai(/<span style="font-family:Consolas,monospace;font-size:8\.25pt;color:#566573;letter-spacing:0\.5pt">HÔTE<\/span> srv1/.test(td[0]), 'clé en étiquette : ' + td[0]);
  vrai(/<span style="color:#b42318">haut<\/span>/.test(td[0]), 'alerte rouge');
  vrai(/>Accueil<\/span>/.test(td[0]), 'source');
  egal(texte, 'Hôtes\n- Accueil · Hôte srv1 #OK · Risque haut\n- Accueil · Hôte srv2\n- Accueil · Hôte srv3 · Risque bas', 'texte brut inchangé');
  const c = office(Q({ src: 'check', view: 'list' }), 'q').html;
  vrai(!/<li/.test(c) && /<span style="color:#4848c0">☑<\/span> <span style="color:#566573;text-decoration:line-through">fait<\/span>/.test(c), 'case cochée grise et barrée : ' + c);
  vrai(/<span style="color:#4848c0">☐<\/span> à faire/.test(c), 'case non cochée');
});

test('office (requêtes) : vue Nombre en cartes de nombre (grand chiffre, libellé en étiquette, trait accent, barre de proportion)', () => {
  const cards = [{ id: 'n1', label: 'Avec OK', filtres: [{ id: 'a', prop: 'tags', vals: ['ok'] }], total: 'all' }, { id: 'n2', label: '', total: 'none' }, { id: 'n3', label: 'Tous', total: 'all' }, { id: 'n4', label: 'Encore', total: 'none' }];
  const { html, texte } = office(Q({ view: 'count', cards }), 'q');
  vrai(/^<div[^>]*><p[^>]*><span[^>]*>HÔTES<\/span><\/p><table/.test(html), 'titre puis cartes');
  // trois cartes par ligne au plus (min 180 px sur 680), séparées par une cellule vide ; la 4e passe à la ligne
  egal((html.match(/<td valign="top" width="32%" style="[^"]*border-left:3px solid #4848c0/g) || []).length, 4, 'quatre cartes au tiers, trait accent : ' + html);
  egal((html.match(/<td width="2%"><\/td>/g) || []).length, 4, 'espaces entre cartes, sur deux lignes');
  vrai(/<span style="font-size:25\.5pt;font-weight:bold;color:#17212b">1<\/span><span style="font-size:13\.5pt;font-weight:600;color:#566573"> \/ 3<\/span>/.test(html), 'chiffre et total : ' + html);
  vrai(/letter-spacing:0\.45pt">AVEC OK<\/span><\/p>/.test(html) && /font-family:Consolas,monospace;font-size:9pt;color:#566573/.test(html), 'libellé en étiquette');
  vrai(/">FICHES DE FAITS<\/span><\/p>/.test(html), 'libellé par défaut, comme à l\'écran');
  // barre : 1 / 3 → 33 % accent et 67 % gris ; 3 / 3 → une seule cellule accent ; sans total, pas de barre
  vrai(/<td valign="top" width="33%" style="[^"]*background:#4848c0;font-size:1pt[^"]*">&nbsp;<\/td><td valign="top" width="67%" style="[^"]*background:#d9e0e5;/.test(html), 'barre en deux cellules : ' + html);
  vrai(/<td valign="top" width="100%" style="[^"]*background:#4848c0;font-size:1pt/.test(html) && !/<td[^>]* width="0%"/.test(html), 'barre pleine en une cellule');
  egal((html.match(/font-size:1pt;line-height:4\.5pt/g) || []).length, 3, 'pas de barre sans total');
  egal(texte, 'Hôtes\nAvec OK : 1 / 3\nfiches de faits : 3\nTous : 3 / 3\nEncore : 3', 'texte brut inchangé');
});

test('office (requêtes) : vue En colonnes d\'un kanban et des autres sources, comme le kanban (colonnes en cellules, cartes bordées)', () => {
  const doc = DOC([KB, { id: 'q', type: 'query', title: '', src: 'kanban', scope: 'doc', tags: [], match: 'any', view: 'kanban', champs: { masques: [], ordre: [] } }]);
  const { html } = office(doc, 'q');
  egal((html.match(/<td valign="top" width="25%"/g) || []).length, 4, 'une cellule par colonne du kanban, vides comprises : ' + html);
  vrai(/>Colonne 3<\/span>|>colonne 3<\/span>|>À faire<\/span>/.test(html), 'titres des colonnes');
  const c1 = (html.match(/<table width="100%" style="[^"]*margin:0pt"><tr><td valign="top" width="100%"[^>]*>(?:(?!<\/table>)[\s\S])*Corriger(?:(?!<\/table>)[\s\S])*<\/table>/) || [''])[0];
  vrai(/border-left:3px solid #b42318/.test(c1) && /border-top:1px dashed #b42318/.test(c1), 'carte P1 bloquée : ' + c1);
  vrai(/color:#b42318;background:#fdecea">1 janv\. 2000/.test(c1) && /color:#566573">Alice/.test(c1), 'méta : ' + c1);
  vrai(/color:#b42318">Attend : Préparer<\/p>/.test(c1) && /9\.38pt">Accueil<\/span><\/p>/.test(c1), 'champs Attend et Source : ' + c1);
  // fiches de faits regroupées par Hôte : la colonne du regroupement n'est pas répétée sur la carte
  const f = office(Q({ view: 'kanban', groupBy: 'c:hôte' }), 'q').html;
  egal((f.match(/<td valign="top" width="33%"/g) || []).length, 3, 'trois groupes : ' + f);
  vrai(/<span style="font-family:Consolas[^"]*">RISQUE<\/span> haut/.test(f) && !/>HÔTE<\/span>/.test(f), 'clé en étiquette, sans la colonne du regroupement : ' + f);
});

const TAB = [
  { id: 't1', type: 'table', rows: [['Tactique', 'Technique', 'Sous', 'Score'], ['Exécution', 'T1059', '.001', '3,5'], ['Persistance', 'T1053', '', '1'], ['exécution', 'T1204', '', '1']] },
];
const QT = (q, palette) => ({ ...DOC([...TAB, { id: 'q', type: 'query', title: 'Matrice', src: 'table', scope: 'doc', ...q }]), palette });

test('office (requêtes) : vue Regroupée en fiches (titre et compte, fiche de faits bordée) et en tableau d\'Ardoise', () => {
  const { html, texte } = office(QT({ view: 'regroupee', regX: 'tactique', regY: ['technique'] }), 'q');
  egal((html.match(/<td valign="top" width="49%"/g) || []).length, 2, 'deux fiches par ligne : ' + html);
  vrai(/<p style="margin:0pt 0pt 6pt;font-weight:600">Exécution <span[^>]*background:#d9e0e5">&nbsp;2&nbsp;<\/span><\/p>/.test(html), 'titre et compte : ' + html);
  vrai(/border:1px solid #d9e0e5[^"]*"><p style="margin-top:0pt;margin-bottom:0pt"><span style="font-family:Consolas[^"]*">TECHNIQUE<\/span><\/p><p style="margin:0pt;font-weight:600">T1059, T1204<\/p>/.test(html), 'fiche de faits : ' + html);
  vrai(/<span style="color:#566573">2 lignes<\/span>/.test(html) && /<span style="color:#566573">1 ligne<\/span>/.test(html), 'nombre de lignes');
  egal(texte, 'Matrice\nExécution (2)\nTechnique\tT1059, T1204\nPersistance (1)\nTechnique\tT1053', 'texte brut inchangé');
  const t = office(QT({ view: 'regroupee', regX: 'tactique', regY: ['technique'], regForme: 'tableau', limit: 1 }), 'q').html;
  vrai(/letter-spacing:0\.5pt">TACTIQUE<\/span>/.test(t) && /letter-spacing:0\.5pt">LIGNES<\/span>/.test(t), 'en-tête en étiquette (officeTabTableau) : ' + t);
  vrai(/>1 premiers groupes sur 2<\/p>/.test(t), 'limite des groupes');
});

test('office (requêtes) : carte de chaleur en colonnes aux cases teintées (teintes actuelles), sous-cases, légende en cinq teintes', () => {
  const q = { view: 'chaleur', chX: 'tactique', chY: 'technique', chZ: 'sous', chN: 'score' };
  const teintes = ['#fbf5f0', '#f3e4d8', '#eacfba', '#e0b798'];   // 6, 16, 28 et 42 % de l'accent ambre sur blanc (le 5e palier est l'accent)
  const r = monterOffice(QT(q), 'q');
  verifierSocle(r.html, 'chaleur', teintes);
  const { html, texte } = r;
  vrai(/^<div[^>]*><p[^>]*><span[^>]*>MATRICE<\/span><\/p><table/.test(html), 'titre');
  vrai(/font-size:10\.13pt">Exécution<\/span> <span[^>]*>&nbsp;4,5&nbsp;<\/span>/.test(html), 'titre de colonne et total : ' + html);
  vrai(/background:#b4540a;[^"]*"><span style="color:#ffffff">T1059&nbsp; <span style="font-family:Consolas[^"]*">3,5<\/span>/.test(html), 'palier foncé : texte blanc : ' + html);
  vrai(/background:#b4540a;[^"]*"><span style="color:#ffffff;font-size:9pt">› \.001/.test(html), 'sous-case : ' + html);
  vrai(/background:#fbf5f0;[^"]*"><span style="color:#17212b">T1053/.test(html), 'palier clair');
  for (const c of [...teintes, '#b4540a']) vrai(new RegExp('<td valign="middle" width="4%" style="[^"]*background:' + c).test(html), 'légende : ' + c);
  vrai(/>1<\/td>/.test(html) && />3,5<\/td>/.test(html) && /">somme de Score<\/td>/.test(html), 'légende : bornes et mesure');
  egal(texte, 'Matrice\nExécution (4,5)\tPersistance (1)\nT1059  3,5\tT1053  1\n› .001  3,5\t\nT1204  1\t\nÉchelle : de 1 (clair) à 3,5 (foncé), somme de Score', 'texte brut inchangé');
  vrai(/background:#4848c0;[^"]*"><span style="color:#ffffff">T1059/.test(office(QT(q, 'indigo'), 'q', ['#f4f4fb', '#e2e2f5', '#cccced', '#b2b2e5']).html), 'accent de la palette du document');
});

test('office (requêtes) : résultats et comptes collés identiques à ceux de l\'écran, dans chaque vue', () => {
  const tous = (re, h) => [...h.matchAll(re)].map((m) => m.slice(1).join('|'));
  const ecran = (doc) => { const { ctx, d } = monter(doc); return ctx.queryResult(d.pages[0].blocks.find((b) => b.id === 'q'), d, { page: 0, view: 'read' }); };
  const cas = [
    [Q({ view: 'count', cards: [{ id: 'n1', label: 'OK', filtres: [{ id: 'a', prop: 'tags', vals: ['ok'] }], total: 'all' }, { id: 'n2', label: 'Tout', total: 'none' }] }),
      /<b>(\d+)(?:<small> \/ (\d+)<\/small>)?<\/b>/g, /25\.5pt;[^"]*">(\d+)<\/span>(?:<span[^>]*> \/ (\d+)<\/span>)?/g],
    [Q({ view: 'kanban', groupBy: 'c:risque' }), /class="kb-n">([^<]*)</g, /background:#d9e0e5">&nbsp;([^&]*)&nbsp;/g],
    [DOC([KB, { id: 'q', type: 'query', src: 'kanban', scope: 'doc', tags: [], match: 'any', view: 'kanban', filtres: [{ id: 'f', prop: 'kbPrio', vals: ['p1', 'p3'] }] }]), /class="kb-n">([^<]*)</g, /background:#d9e0e5">&nbsp;([^&]*)&nbsp;/g],
    [QT({ view: 'regroupee', regX: 'tactique', regY: ['technique'] }), /class="kb-n">([^<]*)</g, /background:#d9e0e5">&nbsp;([^&]*)&nbsp;/g],
    [QT({ view: 'chaleur', chX: 'tactique', chY: 'technique', chZ: 'sous', chN: 'score' }), /class="(?:kb-n|q-ch-v)">([^<]*)</g, /(?:background:#d9e0e5">&nbsp;([^&]*)&nbsp;|font-weight:600;font-size:9pt">([^<]*)<)/g, true],
    [Q({ view: 'table', limit: 2 }), /q-more">([^<]*)</g, /color:#566573">(\d+ premiers résultats sur \d+)</g],
    [Q({ view: 'list', limit: 1 }), /q-more">([^<]*)</g, /color:#566573">(\d+ premiers résultats sur \d+)</g],
  ];
  // carte de chaleur : à l'écran colonne par colonne, collée rang par rang (cases alignées) : mêmes valeurs, autre ordre
  for (const [doc, reE, reO, rangs] of cas) {
    const nets = (l) => { const n = l.map((s) => s.replace(/^\||\|$/g, '')); return rangs ? n.sort() : n; };
    const e = nets(tous(reE, ecran(doc))), o = nets(tous(reO, monterOffice(doc, 'q').html));
    vrai(e.length > 0, 'comptes trouvés à l\'écran');
    egal(o, e, 'comptes de l\'écran');
  }
  // lignes collées : mêmes lignes, dans le même ordre (tri enregistré)
  const doc = Q({ view: 'table', sortBy: 'c:hôte', sortDir: 'desc' });
  egal(tous(/>(srv\d)/g, monterOffice(doc, 'q').html), tous(/>(srv\d)/g, ecran(doc)), 'ordre des lignes');
});
