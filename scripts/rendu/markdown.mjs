// Import Markdown (05-markdown.js) : conversion d'une note en blocs du document, sans DOM. Le HTML produit reste brut :
// l'assainissement se fait à l'appel, dans le navigateur (banc navigateur, sujet importer-markdown).
import { readFileSync } from 'node:fs';
import { contexte, test, egal } from './commun.mjs';

const ctx = contexte();
const md = (t) => JSON.parse(JSON.stringify(ctx.blocsDuMarkdown(t, [])));
const blocs = (t) => md(t).blocs;
// bloc texte attendu d'un paragraphe : une ligne par <br> (la conversion elle-même est vérifiée dans bloc-texte.mjs)
// html d'un bloc : lignes d'un bloc texte jointes par <br>, html des autres
const H = (b) => (b.lignes ? b.lignes.map((l) => l.html).join('<br>') : b.html);
const TX = (h) => ({ type: 'texte', lignes: h.split('<br>').map((x) => ({ html: x })) });

test('markdown : le premier # donne le titre de l\'en-tête, les suivants et ## des sections, ### une sous-section, #### et plus des sous-titres', () => {
  const r = md('# Ma note\n\nIntro\n\n# Autre\n## Section\n### Sous\n#### Petit\n###### Tout petit ##');
  egal(r.entete, { title: 'Ma note' });
  egal(r.blocs, [TX('Intro'), { type: 'h2', html: 'Autre' }, { type: 'h2', html: 'Section' }, { type: 'h3', html: 'Sous' },
    { type: 'subtitle', html: 'Petit' }, { type: 'subtitle', html: 'Tout petit' }]);
  egal(r.imagesManquantes, 0);
});

test('markdown : sans titre #, pas d\'en-tête ; #mot en début de ligne n\'est pas un titre', () => {
  const r = md('## Section\n#tag seul');
  egal(r.entete, null);
  egal(r.blocs, [{ type: 'h2', html: 'Section' }, TX('<span class="pill">tag</span> seul')], 'pastille (vocabulaire d\'Obsidian, markdown-obsidian.mjs)');
});

test('markdown : paragraphes séparés par une ligne vide, chaque retour à la ligne gardé (aussi deux espaces ou \\ en fin de ligne)', () => {
  // un paragraphe et ses sauts de ligne durs : un seul bloc texte, une ligne par retour à la ligne
  egal(blocs('Un\ndeux  \ntrois\\\nquatre\n\n\nAutre'), [{ type: 'texte', lignes: [{ html: 'Un' }, { html: 'deux' }, { html: 'trois' }, { html: 'quatre' }] }, { type: 'texte', lignes: [{ html: 'Autre' }] }]);
});

test('markdown : gras, italique, barré, code en ligne et liens web', () => {
  egal(H(blocs('**g** __g2__ *i* _i2_ ~~b~~ `x < *y*` [site](https://ex.fr/a?b=1&c=2) [m](mailto:a@b.fr)')[0]),
    '<b>g</b> <b>g2</b> <i>i</i> <i>i2</i> <s>b</s> <code>x &lt; *y*</code> <a href="https://ex.fr/a?b=1&amp;c=2">site</a> <a href="mailto:a@b.fr">m</a>');
  egal(H(blocs('***gi*** [**lien gras**](https://ex.fr)')[0]), '<b><i>gi</i></b> <a href="https://ex.fr"><b>lien gras</b></a>');
});

test('markdown : _ au milieu d\'un mot, \\* échappé, lien vers un fichier local, < isolé et & restent du texte', () => {
  egal(H(blocs('snake_case_nom \\*pas italique\\* [note](autre.md) a < b && c &amp; d')[0]), 'snake_case_nom *pas italique* note a &lt; b &amp;&amp; c &amp; d');
});

test('markdown : le HTML brut reste brut, pour l\'assainisseur appelé dans le navigateur', () => {
  egal(H(blocs('Texte <script>alert(1)</script> <u>souligné</u>')[0]), 'Texte <script>alert(1)</script> <u>souligné</u>');
});

// bloc texte attendu d'une liste : [html, genre, lv, done] par ligne, valeurs par défaut omises
const LS = (...ls) => ({ type: 'texte', lignes: ls.map(([html, genre, lv, done]) => {
  const o = { html }; if (lv) o.lv = lv; if (genre) o.genre = genre; if (done) o.done = true; return o;
}) });

test('markdown : liste à puces → bloc texte de puces, niveaux (2 espaces, tabulation, 4 espaces), ligne de suite gardée, plafond de 6 niveaux', () => {
  egal(blocs('- a\n  - b\n\t\t- c\n    suite\n* d\n+ e\n    - f'), [LS(['a', 'puce'], ['b', 'puce', 1], ['c<br>suite', 'puce', 2], ['d', 'puce'], ['e', 'puce'], ['f', 'puce', 1])]);
  const profond = Array.from({ length: 9 }, (_, i) => '  '.repeat(i) + '- n' + i).join('\n');
  egal(blocs(profond)[0].lignes.map((l) => l.lv || 0), [0, 1, 2, 3, 4, 5, 6, 6, 6]);
});

test('markdown : liste numérotée → lignes de numéro, une ligne vide entre deux éléments ne coupe pas la liste, numéro de départ ignoré', () => {
  egal(blocs('1. un\n2) deux\n\n3. trois\n   1. sous\n\nAprès'), [LS(['un', 'numero'], ['deux', 'numero'], ['trois', 'numero'], ['sous', 'numero', 1]), TX('Après')]);
  egal(blocs('3. trois\n4. quatre'), [LS(['trois', 'numero'], ['quatre', 'numero'])], 'les numéros affichés viennent de numerosDesLignes');
});

test('markdown : liste numérotée imbriquée sous des numéros et des puces, chaque élément garde sa marque', () => {
  egal(blocs('1. Tour\n2. Planning\n   - Jalons\n     1. Lot A\n     2. Lot B\n   - Risques\n3. Fin'), [LS(['Tour', 'numero'], ['Planning', 'numero'],
    ['Jalons', 'puce', 1], ['Lot A', 'numero', 2], ['Lot B', 'numero', 2], ['Risques', 'puce', 1], ['Fin', 'numero'])]);
});

test('markdown : - [ ], - [x] et - [X] donnent des cases ; dans une liste mêlée, les puces restent des puces', () => {
  egal(blocs('- [ ] à faire\n- [x] fait\n  - [X] sous-tâche\n- simple\n* [ ]\n1. [x] numéro coché'), [LS(['à faire', 'case'], ['fait', 'case', 0, true],
    ['sous-tâche', 'case', 1, true], ['simple', 'puce'], ['', 'case'], ['numéro coché', 'case', 0, true])]);
  egal(blocs('- [y] pas une case\n- [ ]collé'), [LS(['[y] pas une case', 'puce'], ['[ ]collé', 'puce'])]);
});

test('markdown : l\'import ne crée plus de Liste ni de Liste à cocher', () => {
  egal(blocs('- a\n1. b\n- [ ] c\n\n1. un\n\n- [x] fait').map((b) => b.type), ['texte'], 'liste mêlée : un seul bloc texte');
});

test('markdown : une liste suit un paragraphe sans ligne vide ; *gras* en début de ligne n\'est pas une puce', () => {
  egal(blocs('Courses :\n- pain\n\n*mot* fin'), [TX('Courses :'), LS(['pain', 'puce']), TX('<i>mot</i> fin')], 'pas de fusion du paragraphe et de la liste voisins');
});

test('markdown : tableau → bloc Tableau, première ligne en en-tête, mise en forme gardée, \\| et | dans du code restent dans la cellule', () => {
  egal(blocs('| Nom | **Âge** |\n|:---|---:|\n| a \\| b | `x|y` |\n| [l](https://ex.fr) |\nfin'), [
    { type: 'table', rows: [['Nom', '<b>Âge</b>'], ['a | b', '<code>x|y</code>'], ['<a href="https://ex.fr">l</a>', '']] }, TX('fin')]);
  egal(blocs('a | b\n--|--\n1 | 2'), [{ type: 'table', rows: [['a', 'b'], ['1', '2']] }], 'sans | de bord');
});

test('markdown : code clôturé → bloc de code nommé par son langage, contenu jamais interprété, clôture absente jusqu\'à la fin', () => {
  egal(blocs('```python\n# pas un titre\n- pas une liste\n> ni une citation\n| a |\n---\n```\nAprès'), [
    { type: 'code', variant: 'dark', name: 'python', code: '# pas un titre\n- pas une liste\n> ni une citation\n| a |\n---', tall: false, lang: 'py' }, TX('Après')]);
  egal(blocs('~~~\n**brut**\n```\nencore'), [{ type: 'code', variant: 'dark', name: '', code: '**brut**\n```\nencore', tall: false }], 'langage inconnu ou absent : détection automatique');
  egal(blocs('```mermaid\ngraph\n```')[0].name, 'mermaid');
});

test('markdown : --- seul sur sa ligne (et *** ou ___) → séparateur, pas un titre souligné', () => {
  egal(blocs('Texte\n---\n***\n___'), [TX('Texte'), { type: 'divider' }, { type: 'divider' }, { type: 'divider' }]);
});

test('markdown : encadrés d\'Obsidian selon leur type, titre gardé en gras, type inconnu → Info', () => {
  const note = (t) => blocs(t)[0];
  egal(note('> [!warning] Prudence\n> Texte **gras**\n> suite\n>\n> Deuxième'), { type: 'note', variant: 'warn', html: '<b>Prudence</b><br>Texte <b>gras</b><br>suite<br><br>Deuxième' });
  egal(['note', 'INFO', 'tip', 'caution', 'danger', 'error', 'bug', 'success', 'check', 'inventé'].map((t) => note('> [!' + t + ']\n> x').variant),
    ['info', 'info', 'info', 'warn', 'bad', 'bad', 'bad', 'ok', 'ok', 'info']);
  egal(note('> [!tip] Seul titre'), { type: 'note', variant: 'info', html: '<b>Seul titre</b>' });
});

test('markdown : encadré replié (-) → bloc dépliable fermé, dépliable (+) → ouvert ; citation simple → encadré Info', () => {
  egal(blocs('> [!faq]- Pourquoi ?\n> Parce que.'), [{ type: 'details', title: 'Pourquoi ?', html: 'Parce que.', open: false }]);
  egal(blocs('> [!note]+\n> Visible'), [{ type: 'details', title: 'Note', html: 'Visible', open: true }]);
  egal(blocs('> Une citation\n> sur deux lignes\n\n> Une autre'), [{ type: 'note', variant: 'info', html: 'Une citation<br>sur deux lignes' }, { type: 'note', variant: 'info', html: 'Une autre' }]);
});

test('markdown : fins de ligne Windows et marque d\'ordre des octets lues sans caractère parasite', () => {
  egal(md('﻿# Titre\r\n\r\nUn\r\ndeux\r\n\r\n- a\r\n'), { entete: { title: 'Titre' }, blocs: [TX('Un<br>deux'), LS(['a', 'puce'])], imagesManquantes: 0, images: [] });
  egal(blocs('ligne\rseule'), [TX('ligne<br>seule')], 'ancien Mac');
});

test('markdown : texte vide ou fait de blancs → aucun bloc', () => {
  egal(md('  \n\t\n'), { entete: null, blocs: [], imagesManquantes: 0, images: [] });
});

test('markdown : note de référence (syntaxe documentée d\'Obsidian, fixtures/markdown/note-obsidian.md)', () => {
  const r = md(readFileSync(new URL('../fixtures/markdown/note-obsidian.md', import.meta.url), 'utf8'));
  egal(r.entete, { title: 'Réunion de lancement' });
  egal(r.blocs.map((b) => b.type), ['texte', 'h2', 'texte', 'h3', 'texte', 'note', 'details', 'subtitle', 'table', 'code', 'divider', 'note', 'texte']);
  egal(H(r.blocs[0]), 'Note écrite pour le banc d\'après la syntaxe documentée d\'Obsidian (help.obsidian.md), pas une vraie note du propriétaire.<br>' +
    'Deuxième ligne du même paragraphe, avec <b>gras</b>, <i>italique</i>, <s>barré</s> et <code>code</code>.');
  egal(r.blocs[2], LS(['Tour de table', 'numero'], ['Planning', 'numero'], ['Jalons', 'puce', 1], ['Risques', 'puce', 1]));
  egal(r.blocs[4], LS(['Réserver la salle', 'case', 0, true], ['Envoyer le compte rendu', 'case'], ['Relire', 'case', 1], ['Imprimer', 'puce']));
  egal(r.blocs[5], { type: 'note', variant: 'warn', html: '<b>Budget serré</b><br>Ne pas dépasser <b>10 k€</b>.' });
  egal(r.blocs[6], { type: 'details', title: 'Détails pratiques', html: 'Salle B, 2e étage.', open: false });
  egal(r.blocs[8].rows, [['Poste', 'Montant'], ['Matériel', '4 000'], ['Logiciel', '<a href="https://exemple.fr/devis">devis</a>']]);
  egal(r.blocs[9], { type: 'code', variant: 'dark', name: 'bash', code: '# installation\nnpm install', tall: false, lang: 'bash' });
  egal(H(r.blocs[12]), 'Voir aussi le langage C# et le #123.');
});

test('markdown : page à avertir avant l\'import = un bloc non vide autre que l\'en-tête et le pied de page', () => {
  const avec = (...b) => ctx.pageAContenu([{ type: 'header', title: 'T' }, ...b, { type: 'footer', html: 'pied' }]);
  egal([avec(), avec(TX(''), TX('<br>'), { type: 'h2', html: ' ' }, { type: 'divider' }), avec(TX('<b>x</b>')), avec({ type: 'table', rows: [['', '']] })],
    [false, false, true, true]);
});

// Formules (lot 9, ticket 07) : règle des dollars de la saisie (dollarsFermes), après le code en ligne et les échappements
const F = (s) => '<span class="formule">' + s + '</span>';
test('markdown : $…$ donne une formule, source gardée telle quelle ; \\$, prix, chiffre après le fermant et code restent du texte', () => {
  egal(H(blocs('Aire $x^2$ et $a+b$.')[0]), 'Aire ' + F('x^2') + ' et ' + F('a+b') + '.');
  egal(H(blocs('Coût \\$5 et $x$')[0]), 'Coût $5 et ' + F('x'));
  egal(H(blocs('5 $ et 10 $')[0]), '5 $ et 10 $', 'prix');
  egal(H(blocs('5$ et 10$')[0]), '5$ et 10$', 'prix collés');
  egal(H(blocs('$x$1 et $ x$')[0]), '$x$1 et $ x$');
  egal(H(blocs('`$x$` puis $y$')[0]), '<code>$x$</code> puis ' + F('y'));
  egal(H(blocs('$a_1 * b_2*c$ et $\\{x\\}$ et $\\$5$')[0]), F('a_1 * b_2*c') + ' et ' + F('\\{x\\}') + ' et ' + F('\\$5'), 'ni italique ni échappement mangé');
  egal(H(blocs('$x < y \\& #tag$')[0]), F('x &lt; y \\&amp; #tag'), 'échappée une fois, sans pastille');
});

test('markdown : paragraphe $$…$$ (une ou plusieurs lignes) → bloc formule ; $$…$$ dans un paragraphe → formule en ligne', () => {
  egal(blocs('Avant\n\n$$\\frac{a}{b}$$\n\nAprès'), [TX('Avant'), { type: 'formule', tex: '\\frac{a}{b}' }, TX('Après')]);
  egal(blocs('$$\n\\begin{cases}\n- 1 & x<0 \\\\\n1 | 2\n\\end{cases}\n$$'), [{ type: 'formule', tex: '\\begin{cases}\n- 1 & x<0 \\\\\n1 | 2\n\\end{cases}' }], 'la ligne « - 1 » n\'ouvre pas de liste');
  egal(blocs('Texte\n$$ x $$\nsuite'), [{ type: 'texte', lignes: [{ html: 'Texte' }, { html: F('x') }, { html: 'suite' }] }]);
  egal(H(blocs('dans $$x+1$$ le texte')[0]), 'dans ' + F('x+1') + ' le texte');
  egal(H(blocs('$$x$$ suite\nfin')[0]), F('x') + ' suite<br>fin', 'le $$ fermant ne finit pas la ligne : paragraphe');
  egal(blocs('$$x$$\nsuite'), [{ type: 'formule', tex: 'x' }, TX('suite')], 'le bloc s\'arrête à la ligne du $$ fermant');
});

test('markdown : formule dans un titre, une liste, un tableau et une citation', () => {
  const r = md('# Titre $n$\n\n## Section $x$\n\n- puce $y$\n\n| a |\n| - |\n| $z$ |\n\n> note $w$');
  egal(r.entete, { title: 'Titre ' + F('n') });
  egal(r.blocs[0], { type: 'h2', html: 'Section ' + F('x') });
  egal(r.blocs[1].lignes[0].html, 'puce ' + F('y'));
  egal(r.blocs[2].rows[1], [F('z')]);
  egal(r.blocs[3].html, 'note ' + F('w'));
});
