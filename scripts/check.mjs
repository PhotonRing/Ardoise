// Vérifications rapides du fichier assemblé (utilisées par la CI)
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../dist/ardoise.html', import.meta.url), 'utf8');
const grab = (id) => {
  const m = html.match(new RegExp(`<script id="${id}"[^>]*>([\\s\\S]*?)</script>`));
  if (!m) throw new Error(`balise #${id} introuvable`);
  return m[1];
};
new vm.Script(grab('ardoise-app'), { filename: 'ardoise-app.js' }); // erreur de syntaxe = échec
JSON.parse(grab('ardoise-geo'));
if (grab('ardoise-doc').trim() !== '{}') throw new Error('le document embarqué doit être vide ({})');
if (!/<style id="page-css">[\s\S]+?<\/style>/.test(html) || !/<style id="editor-css">[\s\S]+?<\/style>/.test(html)) throw new Error('styles manquants');
if (/\{\{[\w./-]+\}\}/.test(html)) throw new Error('marqueur de gabarit non remplacé');
console.log('dist/ardoise.html : OK');

// Plugin Obsidian : syntaxe, document embarqué identique, manifeste cohérent
const dir = new URL('../dist/obsidian/', import.meta.url);
const main = readFileSync(new URL('main.js', dir), 'utf8');
new vm.Script(main, { filename: 'obsidian/main.js' });
if (main.includes('__ARDOISE_TEMPLATE__') || !main.includes(JSON.stringify(html))) throw new Error('plugin Obsidian : document embarqué absent ou différent');
const manifest = JSON.parse(readFileSync(new URL('manifest.json', dir), 'utf8'));
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
if (manifest.id !== 'ardoise' || manifest.version !== version) throw new Error('plugin Obsidian : manifeste incohérent');
readFileSync(new URL('styles.css', dir), 'utf8');
console.log('dist/obsidian : OK');
