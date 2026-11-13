// Presse-papier (05-presse-papier.js) : texte brut d'une copie qui contient des pastilles (#nom), et marque de provenance
// des pastilles copiées, pour qu'une couleur d'exception ne passe pas d'un document à l'autre.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { contexte, js, test, egal } from './commun.mjs';

const ctx = contexte();
// compacterLigne et compacterTexte sont purs, mais le contexte commun remplace l'assainisseur : on les prend du vrai module
const asn = vm.createContext({});
new vm.Script(js('02-assainissement.js'), { filename: '02-assainissement.js' }).runInContext(asn);
ctx.compacterLigne = asn.compacterLigne; ctx.compacterTexte = asn.compacterTexte;

test('texte brut : chaque pastille devient # suivi de son nom', () => {
  egal(ctx.texteBrutDePresse('Statut <span class="pill">OK</span> et <span class="pill pc-5">Très urgent</span> fin'), 'Statut #OK et #Très urgent fin');
  egal(ctx.texteBrutDePresse('<span class="pill" data-ad="d1"><b>Gras</b></span>'), '#Gras');
});

test('texte brut : entités décodées, balises de mise en forme retirées', () => {
  egal(ctx.texteBrutDePresse('<b>A &amp; B</b> &lt;c&gt;&nbsp;<i>d</i>'), 'A & B <c> d');
});

test('texte brut : blocs en lignes, cellules en tabulations', () => {
  egal(ctx.texteBrutDePresse('<p>Un <span class="pill">OK</span></p><p>Deux<br>trois</p>'), 'Un #OK\nDeux\ntrois');
  egal(ctx.texteBrutDePresse('<ul><li>a</li><li>b</li></ul>'), 'a\nb');
  egal(ctx.texteBrutDePresse('<table><tbody><tr><td>a</td><td><span class="pill">KO</span></td></tr><tr><td>c</td><td>d</td></tr></tbody></table>'), 'a\t#KO\nc\td');
});

test('copie : les pastilles perdent leur couleur calculée et portent l\'identifiant du document', () => {
  egal(ctx.pastillesSansCouleur('x <span class="pill pa-3" style="color:red">OK</span> <span class="pill pc-5">Urgent</span>', 'd1'),
    'x <span class="pill" data-ad="d1">OK</span> <span class="pill pc-5" data-ad="d1">Urgent</span>');
  egal(ctx.pastillesSansCouleur('sans pastille <b>gras</b>', 'd1'), 'sans pastille <b>gras</b>');
});

test('collage : l\'exception reste dans le même document, part sinon', () => {
  const html = '<span class="pill pc-5" data-ad="d1">Urgent</span> <span class="pill" data-ad="d1">OK</span>';
  egal(ctx.pastillesDuCollage(html, 'd1'), html);
  egal(ctx.pastillesDuCollage(html, 'd2'), '<span class="pill" data-ad="d1">Urgent</span> <span class="pill" data-ad="d1">OK</span>');
  egal(ctx.pastillesDuCollage('<span class="pill pc-5">Urgent</span>', 'd1'), '<span class="pill">Urgent</span>');
});

// Plage collée : grilleDuPressePapier lit le <table> du text/html, sinon le texte à tabulations. Fixtures dans
// scripts/fixtures/presse-papier/ : Calc produite par LibreOffice, Excel et Sheets reconstituées (voir l'en-tête de chacune).
const fixture = (n) => readFileSync(new URL('../fixtures/presse-papier/' + n + '.html', import.meta.url), 'utf8');
const grille = (html, texte) => JSON.parse(JSON.stringify(ctx.grilleDuPressePapier(html, texte)));
const valeurs = (g) => g && g.map((l) => l.map((h) => ctx.htmlText(h)));
const PLAGE = [['Nom', 'Âge', 'Site'], ['Alice', '31', 'Exemple'], ['Bob & Co', '', 'deux lignes']];
const TSV = 'Nom\tÂge\tSite\r\nAlice\t31\tExemple\r\nBob & Co\t\t"deux\nlignes"\r\n';

test('plage : le tableau HTML d\'Excel, de Google Sheets et de LibreOffice Calc donne la même grille', () => {
  for (const n of ['excel', 'sheets', 'calc']) egal(valeurs(grille(fixture(n), TSV)), PLAGE, n);
});

test('plage : le gras et les liens d\'une cellule restent dans son HTML, les cellules vides sont vides', () => {
  const g = grille(fixture('calc'), TSV);
  egal(/<b>[\s\S]*Alice/.test(g[1][0]), true, 'gras de Calc');
  egal(g[1][2], '<a href="https://exemple.fr/">Exemple</a>');
  egal(g[2][1], '');
  egal(grille(fixture('excel'), '')[1][2], '<a href="https://exemple.fr/">Exemple</a>');
});

test('plage : sans tableau HTML, le texte à tabulations est découpé en lignes et en cellules', () => {
  egal(grille('', 'a\tb\nc\td\n'), [['a', 'b'], ['c', 'd']]);
  egal(grille('<span>a b c d</span>', 'a\tb\r\nc\td'), [['a', 'b'], ['c', 'd']], 'HTML sans tableau');
  egal(valeurs(grille('', TSV)), PLAGE, 'cellule entre guillemets à la manière d\'Excel');
  egal(grille('', 'dit\t"il a dit ""oui"""'), [['dit', 'il a dit &quot;oui&quot;']]);
});

test('plage : le texte d\'une cellule reste du texte (un < n\'est pas une balise)', () => {
  egal(grille('', 'x < y\t<b>z</b>'), [['x &lt; y', '&lt;b&gt;z&lt;/b&gt;']]);
});

test('plage : lignes de longueurs différentes complétées, lignes vides de fin ignorées', () => {
  egal(grille('', 'a\tb\tc\nd\n\t\n'), [['a', 'b', 'c'], ['d', '', '']]);
  egal(grille('<table><tr><td>a</td><td>b</td></tr><tr><td>c</td></tr></table>', ''), [['a', 'b'], ['c', '']]);
});

test('plage : ni une cellule seule ni un texte sans tabulation ne forment une plage', () => {
  egal(grille('<table><tr><td>seul</td></tr></table>', 'seul'), null, 'cellule seule en HTML');
  egal(grille('', 'seul\r\n'), null, 'cellule seule en texte');
  egal(grille('<p>un</p><p>deux</p>', 'un\ndeux\ntrois'), null, 'paragraphe multiligne');
  egal(grille('', '\t\n'), null, 'rien que des cellules vides');
  egal(grille('', ''), null);
});

// Copie d'une plage de cellules d'Ardoise : texte à tabulations (pour un tableur) et tableau HTML (pour Ardoise).
const TABLE = () => [['Nom', 'Statut', 'Note'], ['A &amp; B', '<span class="pill pa-3">OK</span>', '<b>bien</b>'], ['C', '<span class="pill pc-5">Très urgent</span>', 'deux<br>lignes'], ['D', 'x', 'y']];

test('copie de plage : texte à tabulations, pastilles en #nom, entités décodées, dans les deux sens de sélection', () => {
  egal(ctx.grilleEnTexte(TABLE(), { r1: 1, c1: 0, r2: 2, c2: 2 }), 'A & B\t#OK\tbien\nC\t#Très urgent\tdeux lignes');
  egal(ctx.grilleEnTexte(TABLE(), { r1: 2, c1: 2, r2: 1, c2: 0 }), 'A & B\t#OK\tbien\nC\t#Très urgent\tdeux lignes', 'sens inverse');
  egal(ctx.grilleEnTexte(TABLE(), { r1: 0, c1: 1, r2: 3, c2: 1 }), 'Statut\n#OK\n#Très urgent\nx', 'une colonne');
  egal(ctx.grilleEnTexte(TABLE(), { r1: 3, c1: 0, r2: 3, c2: 2 }), 'D\tx\ty', 'une ligne');
});

test('copie de plage : les lignes masquées par un filtre sont exclues', () => {
  egal(ctx.grilleEnTexte(TABLE(), { r1: 1, c1: 0, r2: 3, c2: 0, sauf: [2] }), 'A & B\nD');
});

test('copie de plage : le tableau HTML se recolle à l\'identique, pastilles comprises, sans couleur calculée', () => {
  const html = ctx.grilleEnHtml(TABLE(), { r1: 1, c1: 0, r2: 2, c2: 2 }, 'd1');
  egal(/pa-\d/.test(html), false, 'couleur calculée retirée');
  egal(JSON.parse(JSON.stringify(ctx.grilleDuPressePapier(html, ''))), [
    ['A &amp; B', '<span class="pill" data-ad="d1">OK</span>', '<b>bien</b>'],
    ['C', '<span class="pill pc-5" data-ad="d1">Très urgent</span>', 'deux lignes']]);
  egal(ctx.grilleEnHtml(TABLE(), { r1: 1, c1: 0, r2: 3, c2: 0, sauf: [2] }, 'd1'), '<table><tbody><tr><td>A &amp; B</td></tr><tr><td>D</td></tr></tbody></table>', 'ligne masquée exclue');
});
