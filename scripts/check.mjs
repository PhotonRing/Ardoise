// Vérifications rapides du fichier assemblé (utilisées par la CI)
import { readFileSync, readdirSync } from 'node:fs';
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

// Migrations du format du document (src/js/05-migrations.js) : une étape par format, sans trou,
// et chaque document de scripts/fixtures/format-N.json donne exactement format-N.attendu.json
const js = (f) => readFileSync(new URL('../src/js/' + f, import.meta.url), 'utf8');
const VERSION = +(js('00-entete.js').match(/var VERSION = (\d+);/) || [])[1];
const escSrc = (js('00-entete.js').match(/var esc = [^\n]+/) || [])[0];
if (!VERSION || !escSrc) throw new Error('migrations : VERSION ou esc introuvable dans 00-entete.js');
const ctx = vm.createContext({});
vm.runInContext(`var VERSION = ${VERSION};\n${escSrc}\n${js('05-migrations.js')}\nthis.migrate = migrate; this.MIGRATIONS = MIGRATIONS;`, ctx, { filename: '05-migrations.js' });
for (let v = 1; v < VERSION; v++) {
  const n = ctx.MIGRATIONS.filter((m) => m.from === v).length;
  if (n !== 1) throw new Error(`migrations : ${n} étape(s) pour le format ${v} → ${v + 1} (une seule attendue)`);
}
if (ctx.MIGRATIONS.some((m) => !(m.from >= 1 && m.from < VERSION) || !m.desc)) throw new Error('migrations : étape hors des formats connus ou sans description');
const fixtures = readdirSync(new URL('./fixtures/', import.meta.url)).filter((f) => /^format-\d+\.json$/.test(f));
for (let v = 1; v < VERSION; v++) if (!fixtures.includes(`format-${v}.json`)) throw new Error(`migrations : scripts/fixtures/format-${v}.json manquant`);
const fx = (f) => JSON.parse(readFileSync(new URL('./fixtures/' + f, import.meta.url), 'utf8'));
const canon = (o) => JSON.stringify(o, (k, val) => (val && typeof val === 'object' && !Array.isArray(val) ? Object.fromEntries(Object.keys(val).sort().map((x) => [x, val[x]])) : val));
for (const f of fixtures) {
  const input = fx(f), before = JSON.stringify(input), r = ctx.migrate(input);
  if (JSON.stringify(input) !== before) throw new Error(`migrations : ${f} modifié en place (une copie est attendue)`);
  if (r.doc.v !== VERSION || r.newer) throw new Error(`migrations : ${f} n'arrive pas au format ${VERSION}`);
  if (canon(r.doc) !== canon(fx(f.replace('.json', '.attendu.json')))) throw new Error(`migrations : ${f} ne donne pas ${f.replace('.json', '.attendu.json')}\n${canon(r.doc)}`);
  if (ctx.migrate(r.doc).doc !== r.doc) throw new Error(`migrations : ${f} migré une seconde fois`);
}
const future = { v: VERSION + 1, pages: [] }, rf = ctx.migrate(future);
if (!rf.newer || rf.doc !== future) throw new Error('migrations : un format plus récent doit être signalé et laissé intact');
console.log(`migrations : OK (format ${VERSION}, ${fixtures.length} document(s) de référence)`);

// Session du document (src/js/05-session.js) : seule elle réaffecte le document courant et écrit l'historique.
// Les anciens noms (change, snapshot, markDirty, consigner) et les anciennes variables d'historique ne reviennent pas.
const sansTextes = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, "''").replace(/\/\/[^\n]*/g, '');
const ANCIENS = [
  [/(^|[^.\w$])(change|snapshot|markDirty)\s*\(/, 'ancien nom'],
  [/\.consigner\b/, 'ancien nom'],
  [/\b(htimer|hpos|histMarks|restoreHist|histGo)\b/, 'ancienne variable d\'historique'],
  [/(^|[^.\w$])doc\s*=(?!=)/, 'réaffectation du document hors de la session'],
];
// Noms de premier niveau : tous les fichiers de src/js forment un seul script, un nom déclaré deux fois remplace le premier sans erreur
{
  const vus = new Map();
  for (const f of readdirSync(new URL('../src/js/', import.meta.url)).filter((x) => x.endsWith('.js')).sort()) {
    sansTextes(js(f)).split('\n').forEach((ligne, i) => {
      const m = ligne.match(/^(?:function\s*\*?\s*|var\s+|let\s+|const\s+)([\w$]+)/);
      if (!m) return;
      if (vus.has(m[1])) throw new Error(`noms : ${m[1]} déclaré dans ${vus.get(m[1])} et dans ${f}:${i + 1}`);
      vus.set(m[1], `${f}:${i + 1}`);
    });
  }
  console.log(`noms : OK (${vus.size} noms de premier niveau, aucun en double)`);
}
for (const f of readdirSync(new URL('../src/js/', import.meta.url)).filter((x) => x.endsWith('.js') && x !== '05-session.js')) {
  sansTextes(js(f)).split('\n').forEach((ligne, i) => {
    for (const [re, quoi] of ANCIENS) if (re.test(ligne)) throw new Error(`session : ${quoi} dans ${f}:${i + 1} : ${ligne.trim()}`);
  });
}
console.log('session : OK (aucun ancien nom ni réaffectation du document hors de la session)');
