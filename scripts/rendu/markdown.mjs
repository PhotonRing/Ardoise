// Import Markdown (05-markdown.js) : conversion d'une note en blocs du document, sans DOM. Le HTML produit reste brut :
// l'assainissement se fait à l'appel, dans le navigateur (banc navigateur, sujet importer-markdown).
import { readFileSync } from 'node:fs';
import { contexte, test, egal } from './commun.mjs';

const ctx = contexte();
const md = (t) => JSON.parse(JSON.stringify(ctx.blocsDuMarkdown(t, [])));
const blocs = (t) => md(t).blocs;

test('markdown : le premier # donne le titre de l\'en-tête, les suivants et ## des sections, ### une sous-section, #### et plus des sous-titres', () => {
  const r = md('# Ma note\n\nIntro\n\n# Autre\n## Section\n### Sous\n#### Petit\n###### Tout petit ##');
  egal(r.entete, { title: 'Ma note' });
  egal(r.blocs, [{ type: 'p', html: 'Intro' }, { type: 'h2', html: 'Autre' }, { type: 'h2', html: 'Section' }, { type: 'h3', html: 'Sous' },
    { type: 'subtitle', html: 'Petit' }, { type: 'subtitle', html: 'Tout petit' }]);
  egal(r.imagesManquantes, 0);
});

test('markdown : sans titre #, pas d\'en-tête ; #mot en début de ligne n\'est pas un titre', () => {
  const r = md('## Section\n#tag seul');
  egal(r.entete, null);
  egal(r.blocs, [{ type: 'h2', html: 'Section' }, { type: 'p', html: '#tag seul' }]);
});

test('markdown : paragraphes séparés par une ligne vide, chaque retour à la ligne gardé (aussi deux espaces ou \\ en fin de ligne)', () => {
  egal(blocs('Un\ndeux  \ntrois\\\nquatre\n\n\nAutre'), [{ type: 'p', html: 'Un<br>deux<br>trois<br>quatre' }, { type: 'p', html: 'Autre' }]);
});

test('markdown : gras, italique, barré, code en ligne et liens web', () => {
  egal(blocs('**g** __g2__ *i* _i2_ ~~b~~ `x < *y*` [site](https://ex.fr/a?b=1&c=2) [m](mailto:a@b.fr)')[0].html,
    '<b>g</b> <b>g2</b> <i>i</i> <i>i2</i> <s>b</s> <code>x &lt; *y*</code> <a href="https://ex.fr/a?b=1&amp;c=2">site</a> <a href="mailto:a@b.fr">m</a>');
  egal(blocs('***gi*** [**lien gras**](https://ex.fr)')[0].html, '<b><i>gi</i></b> <a href="https://ex.fr"><b>lien gras</b></a>');
});

test('markdown : _ au milieu d\'un mot, \\* échappé, lien vers un fichier local, < isolé et & restent du texte', () => {
  egal(blocs('snake_case_nom \\*pas italique\\* [note](autre.md) a < b && c &amp; d')[0].html, 'snake_case_nom *pas italique* note a &lt; b &amp;&amp; c &amp; d');
});

test('markdown : le HTML brut reste brut, pour l\'assainisseur appelé dans le navigateur', () => {
  egal(blocs('Texte <script>alert(1)</script> <u>souligné</u>')[0].html, 'Texte <script>alert(1)</script> <u>souligné</u>');
});

test('markdown : liste à puces avec niveaux (2 espaces, tabulation, 4 espaces), ligne de suite jointe, plafond de 6 niveaux', () => {
  egal(blocs('- a\n  - b\n\t\t- c\n    suite\n* d\n+ e\n    - f'), [{ type: 'list', ordered: false, items: [
    { html: 'a' }, { html: 'b', lv: 1 }, { html: 'c<br>suite', lv: 2 }, { html: 'd' }, { html: 'e' }, { html: 'f', lv: 1 }] }]);
  const profond = Array.from({ length: 9 }, (_, i) => '  '.repeat(i) + '- n' + i).join('\n');
  egal(blocs(profond)[0].items.map((it) => it.lv || 0), [0, 1, 2, 3, 4, 5, 6, 6, 6]);
});

test('markdown : liste numérotée, une ligne vide entre deux éléments ne coupe pas la liste', () => {
  egal(blocs('1. un\n2) deux\n\n3. trois\n   1. sous\n\nAprès'), [{ type: 'list', ordered: true, items: [{ html: 'un' }, { html: 'deux' }, { html: 'trois' }, { html: 'sous', lv: 1 }] }, { type: 'p', html: 'Après' }]);
});

test('markdown : - [ ] et - [x] donnent une liste à cocher ; les puces simples d\'une liste mixte deviennent des cases non cochées', () => {
  egal(blocs('- [ ] à faire\n- [x] fait\n  - [X] sous-tâche\n- simple'), [{ type: 'check', items: [
    { html: 'à faire', done: false }, { html: 'fait', done: true }, { html: 'sous-tâche', done: true, lv: 1 }, { html: 'simple', done: false }] }]);
});

test('markdown : une liste suit un paragraphe sans ligne vide ; *gras* en début de ligne n\'est pas une puce', () => {
  egal(blocs('Courses :\n- pain\n\n*mot* fin'), [{ type: 'p', html: 'Courses :' }, { type: 'list', ordered: false, items: [{ html: 'pain' }] }, { type: 'p', html: '<i>mot</i> fin' }]);
});

test('markdown : tableau → bloc Tableau, première ligne en en-tête, mise en forme gardée, \\| et | dans du code restent dans la cellule', () => {
  egal(blocs('| Nom | **Âge** |\n|:---|---:|\n| a \\| b | `x|y` |\n| [l](https://ex.fr) |\nfin'), [
    { type: 'table', rows: [['Nom', '<b>Âge</b>'], ['a | b', '<code>x|y</code>'], ['<a href="https://ex.fr">l</a>', '']] }, { type: 'p', html: 'fin' }]);
  egal(blocs('a | b\n--|--\n1 | 2'), [{ type: 'table', rows: [['a', 'b'], ['1', '2']] }], 'sans | de bord');
});

test('markdown : code clôturé → bloc de code nommé par son langage, contenu jamais interprété, clôture absente jusqu\'à la fin', () => {
  egal(blocs('```python\n# pas un titre\n- pas une liste\n> ni une citation\n| a |\n---\n```\nAprès'), [
    { type: 'code', variant: 'dark', name: 'python', code: '# pas un titre\n- pas une liste\n> ni une citation\n| a |\n---', tall: false, lang: 'py' }, { type: 'p', html: 'Après' }]);
  egal(blocs('~~~\n**brut**\n```\nencore'), [{ type: 'code', variant: 'dark', name: '', code: '**brut**\n```\nencore', tall: false }], 'langage inconnu ou absent : détection automatique');
  egal(blocs('```mermaid\ngraph\n```')[0].name, 'mermaid');
});

test('markdown : --- seul sur sa ligne (et *** ou ___) → séparateur, pas un titre souligné', () => {
  egal(blocs('Texte\n---\n***\n___'), [{ type: 'p', html: 'Texte' }, { type: 'divider' }, { type: 'divider' }, { type: 'divider' }]);
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
  egal(md('﻿# Titre\r\n\r\nUn\r\ndeux\r\n\r\n- a\r\n'), { entete: { title: 'Titre' }, blocs: [{ type: 'p', html: 'Un<br>deux' }, { type: 'list', ordered: false, items: [{ html: 'a' }] }], imagesManquantes: 0 });
  egal(blocs('ligne\rseule'), [{ type: 'p', html: 'ligne<br>seule' }], 'ancien Mac');
});

test('markdown : texte vide ou fait de blancs → aucun bloc', () => {
  egal(md('  \n\t\n'), { entete: null, blocs: [], imagesManquantes: 0 });
});

test('markdown : note de référence (syntaxe documentée d\'Obsidian, fixtures/markdown/note-obsidian.md)', () => {
  const r = md(readFileSync(new URL('../fixtures/markdown/note-obsidian.md', import.meta.url), 'utf8'));
  egal(r.entete, { title: 'Réunion de lancement' });
  egal(r.blocs.map((b) => b.type), ['p', 'h2', 'list', 'h3', 'check', 'note', 'details', 'subtitle', 'table', 'code', 'divider', 'note', 'p']);
  egal(r.blocs[0].html, 'Note écrite pour le banc d\'après la syntaxe documentée d\'Obsidian (help.obsidian.md), pas une vraie note du propriétaire.<br>' +
    'Deuxième ligne du même paragraphe, avec <b>gras</b>, <i>italique</i>, <s>barré</s> et <code>code</code>.');
  egal(r.blocs[2], { type: 'list', ordered: true, items: [{ html: 'Tour de table' }, { html: 'Planning' }, { html: 'Jalons', lv: 1 }, { html: 'Risques', lv: 1 }] });
  egal(r.blocs[4].items, [{ html: 'Réserver la salle', done: true }, { html: 'Envoyer le compte rendu', done: false }, { html: 'Relire', done: false, lv: 1 }, { html: 'Imprimer', done: false }]);
  egal(r.blocs[5], { type: 'note', variant: 'warn', html: '<b>Budget serré</b><br>Ne pas dépasser <b>10 k€</b>.' });
  egal(r.blocs[6], { type: 'details', title: 'Détails pratiques', html: 'Salle B, 2e étage.', open: false });
  egal(r.blocs[8].rows, [['Poste', 'Montant'], ['Matériel', '4 000'], ['Logiciel', '<a href="https://exemple.fr/devis">devis</a>']]);
  egal(r.blocs[9], { type: 'code', variant: 'dark', name: 'bash', code: '# installation\nnpm install', tall: false, lang: 'bash' });
  egal(r.blocs[12].html, 'Voir aussi le langage C# et le #123.');
});

test('markdown : page à avertir avant l\'import = un bloc non vide autre que l\'en-tête et le pied de page', () => {
  const avec = (...b) => ctx.pageAContenu([{ type: 'header', title: 'T' }, ...b, { type: 'footer', html: 'pied' }]);
  egal([avec(), avec({ type: 'p', html: '' }, { type: 'p', html: '<br>' }, { type: 'h2', html: ' ' }, { type: 'divider' }), avec({ type: 'p', html: '<b>x</b>' }), avec({ type: 'table', rows: [['', '']] })],
    [false, false, true, true]);
});
