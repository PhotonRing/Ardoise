// Import Markdown, vocabulaire d'Obsidian (05-markdown.js) : en-tête YAML → fiche de faits, #tag → pastille,
// [[…]] → lien vers une page ou une section du document, images. Sans DOM : la couleur des pastilles, l'assainissement et
// le téléchargement des images se vérifient au banc navigateur (sujet importer-markdown).
import { readFileSync } from 'node:fs';
import { contexte, test, egal } from './commun.mjs';

const ctx = contexte();
const P = (t) => '<span class="pill">' + t + '</span>';
const md = (t, pages = [], cur) => JSON.parse(JSON.stringify(ctx.blocsDuMarkdown(t, pages, cur)));
const blocs = (t, pages) => md(t, pages).blocs;
// bloc texte attendu d'un paragraphe : une ligne par <br> (la conversion elle-même est vérifiée dans bloc-texte.mjs)
// html d'un bloc : lignes d'un bloc texte jointes par <br>, html des autres
const H = (b) => (b.lignes ? b.lignes.map((l) => l.html).join('<br>') : b.html);
const TX = (h) => ({ type: 'texte', lignes: h.split('<br>').map((x) => ({ html: x })) });

test('obsidian : l\'en-tête YAML au tout début devient une fiche de faits, une ligne par clé, listes jointes par des virgules', () => {
  const r = md('---\ntitre: "Lancement"\nauteurs: [Ana, \'Léo\']\nlieux:\n  - Lyon\n  - Paris\nvide:\n# commentaire\nresume: >-\n  sur deux\n  lignes\n---\n# Note\n\nTexte');
  egal(r.entete, { title: 'Note' });
  egal(r.blocs, [{ type: 'facts', items: [{ k: 'titre', v: 'Lancement' }, { k: 'auteurs', v: 'Ana, Léo' }, { k: 'lieux', v: 'Lyon, Paris' }, { k: 'vide', v: '' }, { k: 'resume', v: 'sur deux lignes' }] },
    TX('Texte')]);
});

test('obsidian : tags et tag de l\'en-tête YAML deviennent des pastilles, # de tête retiré ; valeurs échappées', () => {
  egal(blocs('---\ntags:\n  - projet\n  - "#réunion"\ntag: a, b c\nnote: x < y & z\n---')[0].items,
    [{ k: 'tags', v: P('projet') + ' ' + P('réunion') }, { k: 'tag', v: P('a') + ' ' + P('b') + ' ' + P('c') }, { k: 'note', v: 'x &lt; y &amp; z' }]);
  egal(blocs('---\ntags: [x, "#y"]\n---')[0].items, [{ k: 'tags', v: P('x') + ' ' + P('y') }]);
});

test('obsidian : --- sans fermeture, ou pas en première ligne, n\'est pas un en-tête YAML ; YAML vide → pas de fiche', () => {
  egal(blocs('---\ncle: v'), [{ type: 'divider' }, TX('cle: v')]);
  egal(blocs('Texte\n\n---\ncle: v\n---').map((b) => b.type), ['texte', 'divider', 'texte', 'divider']);
  egal(blocs('---\n---\nTexte'), [TX('Texte')]);
});

test('obsidian : #tag en début de mot devient une pastille, dans un paragraphe, un titre, une liste, une cellule', () => {
  egal(H(blocs('#projet en cours, voir #2024-bilan et #client/acme\n(#entre) **#gras**')[0]),
    P('projet') + ' en cours, voir ' + P('2024-bilan') + ' et ' + P('client/acme') + '<br>(' + P('entre') + ') <b>' + P('gras') + '</b>');
  egal(H(blocs('## Suivi #urgent')[0]), 'Suivi ' + P('urgent'));
  egal(blocs('- [ ] appeler #Léa')[0].lignes[0], { html: 'appeler ' + P('Léa'), genre: 'case' });
  egal(blocs('| a |\n|---|\n| #x |')[0].rows[1][0], P('x'));
});

test('obsidian : # suivi d\'une espace, #123, C#, page#ancre, \\#échappé et # dans du code restent du texte ; ponctuation de fin hors pastille', () => {
  egal(H(blocs('C# et page#ancre, #123, # seul, \\#pas `#code` [#lien](https://ex.fr/#frag) [voir #x](https://ex.fr)')[0]),
    'C# et page#ancre, #123, # seul, #pas <code>#code</code> <a href="https://ex.fr/#frag">#lien</a> <a href="https://ex.fr">voir #x</a>');
  egal(H(blocs('Fin #tag. Puis #autre, et #dernier !')[0]), 'Fin ' + P('tag') + '. Puis ' + P('autre') + ', et ' + P('dernier') + ' !');
  egal(blocs('```\n#pas\n```')[0].code, '#pas');
});

const PAGES = [
  { id: 'p1', title: 'Accueil', blocks: [{ id: 'h1', type: 'header', title: 'Accueil' }, { id: 's0', type: 'h2', html: 'Ancienne' }] },
  { id: 'p2', title: '', blocks: [{ id: 'h2', type: 'header', title: 'Suivi de projet' }, { id: 's1', type: 'h2', html: 'Étapes clés' }, { id: 's2', type: 'h3', html: 'Budget' }] },
  { id: 'p3', title: 'Suivi de projet', blocks: [] },
  { id: 'p4', title: 'Archives', blocks: [] },
];
const lien = (t) => H(md(t, PAGES, 0).blocs[0]);

test('obsidian : [[Page]], [[Page|texte]] et [[Page#Section]] mènent à la page ou à la section, sans casse ni accents, première page du nom', () => {
  egal(lien('Voir [[suivi de PROJET]] et [[Archives|le passé]].'), 'Voir <a href="#pg-p2">suivi de PROJET</a> et <a href="#pg-p4">le passé</a>.');
  egal(lien('[[Suivi de projet#etapes cles]] [[Suivi de projet#Budget|argent]]'), '<a href="#pg-p2/s1">Suivi de projet › etapes cles</a> <a href="#pg-p2/s2">argent</a>');
  egal(lien('[[Suivi de projet#Absente]] [[Archives#^bloc1]] [[dossier/Archives.md]]'), '<a href="#pg-p2">Suivi de projet › Absente</a> <a href="#pg-p4">Archives</a> <a href="#pg-p4">dossier/Archives.md</a>');
});

test('obsidian : [[…]] sans page reste du texte lisible ; [[#Section]] → le nom de la section ; la page importée ne prête pas ses anciennes sections', () => {
  egal(lien('[[Inconnue]], [[Inconnue|alias]], [[Inconnue#Sec]], [[#Plus bas]], [[A & <b>]]'), 'Inconnue, alias, Inconnue › Sec, Plus bas, A &amp; &lt;b&gt;');
  egal(lien('[[Accueil#Ancienne]]'), '<a href="#pg-p1">Accueil › Ancienne</a>');
  egal(lien('`[[Archives]]` ![[Archives]]'), '<code>[[Archives]]</code> <a href="#pg-p4">Archives</a>');
  egal(lien('[[Archives|#pas-pastille]]'), '<a href="#pg-p4">#pas-pastille</a>');
});

test('obsidian : une image distante devient un bloc Image à télécharger, une image locale ou ![[…]] un bloc vide légendé du nom du fichier', () => {
  const r = md('![Logo](https://ex.fr/img/logo.png?v=2 "titre")\n\n![](captures/écran%201.png)\n![[schéma.jpg|300]]');
  egal(r.blocs, [
    { type: 'image', src: '', caption: 'Logo', alt: 'Logo' },
    { type: 'image', src: '', caption: 'écran 1.png', alt: '' },
    { type: 'image', src: '', caption: 'schéma.jpg', alt: '' }]);
  egal(r.images, [{ bloc: 0, url: 'https://ex.fr/img/logo.png?v=2', nom: 'logo.png' }]);
  egal(r.imagesManquantes, 2);
});

test('obsidian : une image au milieu d\'un paragraphe sort en bloc Image juste après lui ; une image dans du code reste du texte', () => {
  const r = md('Avant ![a < b](data:image/png;base64,AAA) après\nsuite\n\n`![x](y.png)`', [], 0);
  egal(r.blocs, [TX('Avant après<br>suite'), { type: 'image', src: '', caption: 'a &lt; b', alt: 'a < b' }, TX('<code>![x](y.png)</code>')]);
  egal(r.images, [{ bloc: 1, url: 'data:image/png;base64,AAA', nom: 'image' }]);
  egal(md('Texte').images, []);
});

test('obsidian : une image dans un élément de liste ou une cellule de tableau sort en bloc Image juste après la liste ou le tableau', () => {
  const r = md('- un ![Logo](https://ex.fr/logo.png) deux\n- ![[plan.png]]\n\n| A | B |\n|---|---|\n| ![](photo.jpg) x | y |\n\nFin', [], 0);
  egal(r.blocs, [
    { type: 'texte', lignes: [{ html: 'un deux', genre: 'puce' }, { html: '', genre: 'puce' }] },
    { type: 'image', src: '', caption: 'Logo', alt: 'Logo' },
    { type: 'image', src: '', caption: 'plan.png', alt: '' },
    { type: 'table', rows: [['A', 'B'], ['x', 'y']] },
    { type: 'image', src: '', caption: 'photo.jpg', alt: '' },
    TX('Fin')]);
  egal(r.images, [{ bloc: 1, url: 'https://ex.fr/logo.png', nom: 'logo.png' }]);
  egal(r.imagesManquantes, 2);
  egal(blocs('- [x] fait ![](a.png)')[0], { type: 'texte', lignes: [{ html: 'fait', genre: 'case', done: true }] }, 'case cochée');
});

test('obsidian : note de référence avec propriétés (syntaxe documentée d\'Obsidian, fixtures/markdown/note-obsidian-proprietes.md)', () => {
  const r = md(readFileSync(new URL('../fixtures/markdown/note-obsidian-proprietes.md', import.meta.url), 'utf8'), PAGES, 0);
  egal(r.entete, { title: 'Point d\'étape' });
  egal(r.blocs.map((b) => b.type), ['facts', 'texte', 'h2', 'texte', 'image', 'texte', 'image', 'code']);
  egal(r.blocs[0].items, [{ k: 'date', v: '2026-11-13' }, { k: 'participants', v: 'Ana, Léo' }, { k: 'tags', v: P('projet') + ' ' + P('réunion') }]);
  egal(H(r.blocs[1]), 'Suite de ' + P('projet') + ', voir <a href="#pg-p2/s1">le planning</a>. Le langage C# n\'est pas une pastille, ni #42.');
  egal(r.blocs[3].lignes, [{ html: 'relire <a href="#pg-p2">Suivi de projet</a>', genre: 'case', done: true }, { html: 'chiffrer ' + P('budget'), genre: 'case' }]);
  egal(H(r.blocs[5]), 'Lien sans page : Inconnue.');
  egal(r.blocs[7].code, '# pas un titre\n#pas-une-pastille');
  egal([r.images.length, r.imagesManquantes], [1, 1]);
});
