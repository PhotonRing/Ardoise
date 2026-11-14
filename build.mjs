// Assemble src/ en un seul fichier autonome : dist/ardoise.html
// Aucune dépendance : node build.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closureLeaks } from './scripts/fermeture.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(root, 'src', p), 'utf8');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

// Le script de l'application : les fichiers de src/js concaténés dans l'ordre de leur numéro
const jsFiles = readdirSync(join(root, 'src', 'js')).filter((f) => f.endsWith('.js')).sort();
const js = jsFiles.map((f) => src(join('js', f))).join('');

// Garde-fous : « </script> » dans le code ou les données fermerait la balise trop tôt
const geo = src('data/geo.json');
if (/<\/script/i.test(js)) throw new Error('src/js contient « </script> » : écrire <\\/script> dans les chaînes.');
JSON.parse(geo);
if (/<\/script/i.test(geo)) throw new Error('src/data/geo.json contient « </script> ».');
// Garde-fou : les fabriques recopiées par toString() dans la page exportée n'y retrouveraient pas les noms de l'éditeur
for (const kit of ['ardoiseReader', 'ardoiseMapKit']) {
  const leaks = closureLeaks(js, kit);
  if (leaks.length) throw new Error(`${kit} cite ${leaks.map((n) => '« ' + n + ' »').join(', ')}${leaks.length > 1 ? ', déclarés' : ', déclaré'} au premier niveau du bundle : la page exportée ne l'aurait pas.`);
}

// Icône d'Ardoise (src/assets/ardoise.svg) : favicon du fichier, reprise aussi dans la barre de l'éditeur
const logo = src('assets/ardoise.svg').trim();
if (!/^<svg[\s\S]*<\/svg>$/.test(logo) || !logo.includes('class="bg"')) throw new Error('src/assets/ardoise.svg : SVG attendu, avec un fond class="bg"');
const favicon = 'data:image/svg+xml,' + encodeURIComponent(logo);

const parts = { favicon, 'css/page.css': src('css/page.css'), 'css/editor.css': src('css/editor.css'), 'data/geo.json': geo, js, version };
const html = src('index.html').replace(/\{\{([\w./-]+)\}\}/g, (m, k) => {
  if (!(k in parts)) throw new Error('Gabarit : inconnu ' + m);
  return parts[k];
});

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'ardoise.html'), html);
console.log(`dist/ardoise.html — Ardoise ${version} — ${(html.length / 1024).toFixed(0)} Ko, ${jsFiles.length} fichiers JS`);

// Relais de synchronisation (un seul fichier, aucune dépendance), joint aux releases
writeFileSync(join(root, 'dist', 'ardoise-relais.mjs'), readFileSync(join(root, 'relais', 'relais.mjs'), 'utf8'));
console.log(`dist/ardoise-relais.mjs — relais de synchronisation`);
