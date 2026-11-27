// Copier pour Office, tableau (src/js/06-bloc-listes.js ; officeTabTableau : 08-office.js) et bloc de code (src/js/09-office-tableaux.js) : tableau, bloc de code par variante.
import { readFileSync } from 'node:fs';
import { test, egal, vrai } from './commun.mjs';
import { monterOffice, verifierSocle } from './office-socle.mjs';

const P = (t, cls) => '<span class="pill' + (cls ? ' ' + cls : '') + '">' + t + '</span>';
// document en thème sombre à la palette indigo : le collage reste en thème clair
const DOC = { v: 6, title: 'Doc', theme: 'dark', palette: 'indigo', tags: { ko: { c: 1 } }, pages: [{ id: 'p1', title: 'Accueil', blocks: [
  { id: 't1', type: 'table', rows: [['Nom', 'État'], ['Serveur', P('KO')], ['Poste', 'sain']] },
  { id: 't0', type: 'table', rows: [] },
  { id: 'k1', type: 'code', variant: 'dark', name: 'a.sh', lang: 'bash', code: '# liste\necho "x  y"\nls\n' },
  { id: 'k2', type: 'code', name: '', lang: 'bash', code: 'ls' },
  { id: 'k3', type: 'code', variant: 'box', name: 'app.js', lang: 'js', code: 'const a = 1;\n' },
  { id: 'k4', type: 'code', variant: 'box', name: '', lang: 'js', code: 'x' },
  { id: 'k5', type: 'code', variant: 'cmd', name: 'ignoré', lang: 'bash', code: 'sudo apt update\n' },
  { id: 'k6', type: 'code', variant: 'cmd', lang: 'js', code: 'a  b\n\tc = `x\ny`\n' },
] }] };
const office = (id, doc) => { const r = monterOffice(doc || DOC, id); verifierSocle(r.html, id); return r; };
const cellules = (html) => html.match(/<td[^>]*>[\s\S]*?<\/td>/g) || [];

test('office (tableaux) : tableau à cadre et filets entre les lignes, en-tête en étiquette, pastilles en thème clair', () => {
  const { html, texte } = office('t1');
  vrai(!/<th/.test(html), 'pas de <th> (Writer le centre en gras) : ' + html);
  const td = cellules(html);
  egal(td.length, 6, 'six cellules');
  // en-tête : étiquette du socle (Consolas 8,25 pt gris, capitales écrites) ; espacement des lettres sur le <span>, jamais dans le style d'une cellule
  for (const [i, t] of [[0, 'NOM'], [1, 'ÉTAT']]) vrai(new RegExp('^<td[^>]*style="[^"]*font-size:8\\.25pt;[^"]*"><span style="font-family:Consolas,monospace;font-size:8\\.25pt;color:#566573;letter-spacing:0\\.5pt">' + t + '</span></td>$').test(td[i]), 'en-tête : ' + td[i]);
  vrai(!/<td[^>]*letter-spacing/.test(html), 'pas d\'espacement des lettres dans le style d\'une cellule');
  // filets entre les lignes ; cadre : haut de la 1re ligne, bords gauche et droit, bas de la dernière (filet sous la dernière ligne)
  for (const i of [0, 1, 2, 3]) vrai(/border-bottom:1px solid #d9e0e5/.test(td[i]), 'filet sous la ligne : ' + td[i]);
  vrai(/border-top:1px solid #d9e0e5/.test(td[0]) && /border-left:1px solid #d9e0e5/.test(td[0]) && !/border-left/.test(td[1]), 'cadre en haut à gauche : ' + td[0]);
  vrai(/border-right:1px solid #d9e0e5/.test(td[1]) && /border-right:1px solid #d9e0e5/.test(td[5]) && !/border-right/.test(td[4]), 'cadre à droite');
  vrai(/border-bottom:1px solid #d9e0e5/.test(td[4]) && /border-bottom:1px solid #d9e0e5/.test(td[5]), 'le cadre ferme la dernière ligne');
  vrai(td.every((c) => (c.match(/border-bottom/g) || []).length === 1), 'un seul trait sous chaque cellule');
  vrai(td.every((c) => /background:#ffffff/.test(c)), 'fond surface');
  vrai(/<span style="background:#fdecea;color:#b42318;[^"]*">KO<\/span>/.test(td[3]), 'pastille rouge du registre : ' + td[3]);
  vrai(/font-family:'Segoe UI',sans-serif;font-size:11\.25pt;[^"]*">Poste<\/td>/.test(td[4]), 'corps en Segoe UI : ' + td[4]);
  egal(texte, 'Nom\tÉtat\nServeur\t#KO\nPoste\tsain', 'texte brut inchangé');
});

test('office (tableaux) : un tableau sans ligne n\'écrit rien', () => {
  egal(office('t0').html.includes('<table'), false);
});

// couleurs des jetons dans page.css : bloc sombre (règle .code) et thème clair (:root)
const CSS = readFileSync(new URL('../../src/css/page.css', import.meta.url), 'utf8');
const jetons = (re) => Object.fromEntries([...CSS.match(re)[1].matchAll(/--tk-(\w):(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]));
const TK_SOMBRE = jetons(/^\.code\{(--tk-[^}]*)\}/m), TK_CLAIR = jetons(/^:root\{(--tk-[^}]*)\}/m);

test('office (code) : couleurs des jetons reprises de page.css (bloc sombre et thème clair)', () => {
  const { ctx } = monterOffice(DOC, 'k1');
  egal(JSON.parse(JSON.stringify(ctx.OFFICE_TAB_TK_SOMBRE)), TK_SOMBRE);
  egal(JSON.parse(JSON.stringify(ctx.OFFICE_TAB_TK_CLAIR)), TK_CLAIR);
  egal(Object.keys(TK_SOMBRE).length, 8);
});

test('office (code) : « Sombre » dans une cellule code-bg, texte code-fg, coloration en ligne, nom de fichier', () => {
  const { html, texte } = office('k1');
  // bordure de la couleur du fond : sans bordure, Writer ignore le retrait intérieur de la cellule
  vrai(/<table width="100%"[^>]*><tr><td valign="top" width="100%" style="[^"]*background:#14202b;[^"]*border:1px solid #14202b[^"]*">/.test(html), 'cellule sombre : ' + html);
  vrai(/<p style="[^"]*"><span style="font-family:Consolas,monospace;font-size:8\.25pt;color:#7f93a3;letter-spacing:0\.5pt">A\.SH<\/span><\/p>/.test(html), 'nom en capitales : ' + html);
  vrai(/<pre style="[^"]*font-family:Consolas,monospace;font-size:9\.38pt;[^"]*color:#e4ebf0[^"]*">/.test(html), 'code clair sur sombre : ' + html);
  vrai(html.includes('<span style="color:' + TK_SOMBRE.c + ';font-style:italic"># liste</span>'), 'commentaire');
  vrai(html.includes('<span style="color:' + TK_SOMBRE.f + '">echo</span>'), 'commande');
  vrai(html.includes('<span style="color:' + TK_SOMBRE.s + '">&quot;x  y&quot;</span>'), 'chaîne, espaces gardés');
  vrai(!/\sclass=/.test(html), 'sans classe');
  egal(texte, 'a.sh\n# liste\necho "x  y"\nls', 'texte brut inchangé');
  const sans = office('k2').html;
  vrai(/background:#14202b/.test(sans) && !/<p /.test(sans), 'variante absente : sombre, sans nom : ' + sans);
});

test('office (code) : « Boîte + fichier » en barre de nom sur fond blanc puis code sur code-soft, cadre clair', () => {
  const { html, texte } = office('k3'), td = cellules(html);
  egal(td.length, 2, 'barre puis code');
  vrai(/background:#ffffff/.test(td[0]) && /font-family:Consolas,monospace;font-size:9\.38pt;color:#566573/.test(td[0]) && />app\.js<\/td>$/.test(td[0]), 'barre du nom : ' + td[0]);
  vrai(['top', 'left', 'right'].every((c) => td[0].includes('border-' + c + ':1px solid #d9e0e5')) && !/border-bottom/.test(td[0]), 'barre bordée');
  vrai(/background:#eef2f4;[^"]*border:1px solid #d9e0e5/.test(td[1]), 'code bordé, un seul filet sous la barre : ' + td[1]);
  vrai(/<pre style="[^"]*color:#17212b[^"]*"><span style="color:#8a2bb5">const<\/span> a = <span style="color:#b4450a">1<\/span><span style="color:#5d6b78">;<\/span><\/pre>/.test(html), 'jetons du thème clair : ' + html);
  egal(texte, 'app.js\nconst a = 1;', 'texte brut inchangé');
  const sans = cellules(office('k4').html);
  egal(sans.length, 1, 'sans nom : pas de barre');
  vrai(/border:1px solid #d9e0e5/.test(sans[0]), 'cadre fermé');
});

test('office (code) : « Commande » sur code-soft bordé, plus grand, sans nom', () => {
  const { html, texte } = office('k5'), td = cellules(html);
  egal(td.length, 1);
  vrai(/background:#eef2f4;[^"]*border:1px solid #d9e0e5/.test(td[0]), 'cellule : ' + td[0]);
  vrai(/<pre style="[^"]*font-family:Consolas,monospace;font-size:10\.13pt;[^"]*color:#17212b/.test(html) && !html.includes('ignoré'), html);
  vrai(html.includes('<span style="color:#1d5fbf">sudo</span>'), 'jetons clairs');
  egal(texte, 'ignoré\nsudo apt update', 'texte brut inchangé (nom compris)');
});

test('office (code) : espaces, tabulations et retours gardés ; un jeton sur deux lignes refermé à chaque ligne', () => {
  const { html } = office('k6');
  const pre = html.match(/<pre style="([^"]*)">([\s\S]*)<\/pre>/);
  vrai(/white-space:pre-wrap/.test(pre[1]) && /font-family:Consolas,monospace/.test(pre[1]), pre[1]);
  egal(pre[2].replace(/<[^>]*>/g, ''), 'a  b\n\tc = `x\ny`');
  vrai(pre[2].includes('<span style="color:#2b7a1b">`x</span>\n<span style="color:#2b7a1b">y`</span>'), pre[2]);
});

test('office (tableaux) : texte brut et éléments neutres (donc .docx) inchangés', () => {
  for (const id of ['t1', 'k1', 'k3', 'k5']) {
    const { e } = monterOffice(DOC, id);
    vrai(['tableau', 'code'].includes(e[0].t) && e.length === 1, id);
  }
  egal(JSON.parse(JSON.stringify(monterOffice(DOC, 'k3').e)), [{ t: 'code', texte: 'const a = 1;', nom: 'app.js' }]);
});

test('office (tableaux) : officeTabTableau sert aux vues en tableau (taille, lignes atténuées, fonds)', () => {
  const { ctx, d } = monterOffice(DOC, 't1');
  const x = { C: ctx.OFFICE_CLAIR, segs: (a) => ctx.officeSegmentsHtml(a, d) };
  const html = ctx.officeTabTableau([[{ texte: 'Hôte' }]], [['a'], ['b']], x, { taille: 14, attenues: [1], fonds: [['#ececfb']] });
  verifierSocle(html, 'officeTabTableau', ['#ececfb']);
  const td = cellules(html);
  vrai(/>HÔTE<\/span><\/td>$/.test(td[0]), td[0]);
  vrai(/font-size:10\.5pt;background:#ececfb;/.test(td[1]) && !/color:#566573/.test(td[1]), td[1]);
  vrai(/background:#ffffff;[^"]*color:#566573;/.test(td[2]), 'ligne atténuée : ' + td[2]);
  const sansEntete = cellules(ctx.officeTabTableau(null, [['a']], x));
  vrai(sansEntete.length === 1 && /border-top/.test(sansEntete[0]), 'sans en-tête');
  egal(ctx.officeTabTableau(null, [], x), '');
});
