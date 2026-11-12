// Banc navigateur : dist/ardoise.html ouvert dans Chromium sans affichage, piloté par le protocole DevTools (sans dépendance).
// Les sujets sont rangés dans scripts/navigateur/ : un fichier par sujet, qui exporte `nom` et une fonction par défaut
// recevant les outils ci-dessous (ecran, charger, evalue, cdp, attendre, dialogues, mesure, echec), pour que des tickets parallèles n'éditent pas le même fichier.
// Sans Chromium (ou sans WebSocket dans Node), le banc est ignoré en local et échoue en CI.  node scripts/test-navigateur.mjs [sujet…]
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const enCI = !!process.env.CI;
const ignorer = (pourquoi) => { if (enCI) { console.error('navigateur : ÉCHEC, ' + pourquoi); process.exit(1); } console.log('navigateur : ignoré (' + pourquoi + ')'); process.exit(0); };
const trouver = () => {
  if (process.env.CHROME) return process.env.CHROME;
  for (const nom of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    try { return execFileSync('which', [nom], { encoding: 'utf8' }).trim(); } catch (_) { /* suivant */ }
  }
  return null;
};
const binaire = trouver();
if (!binaire) ignorer('aucun Chromium trouvé ; variable CHROME pour en indiquer un');
if (typeof WebSocket !== 'function') ignorer('WebSocket absent de Node ' + process.version + ' ; Node 22 ou plus');

const page = 'file://' + fileURLToPath(new URL('../dist/ardoise.html', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'ardoise-cdp-'));
const chr = spawn(binaire, ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0', '--user-data-dir=' + dir, '--allow-file-access-from-files', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
let journal = ''; chr.stderr.on('data', (d) => { journal = (journal + d).slice(-4000); });   // montré si Chromium ne démarre pas
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const fin = (code) => { try { chr.kill(); } catch (_) { /* déjà fermé */ } try { rmSync(dir, { recursive: true, force: true }); } catch (_) { /* rien */ } process.exit(code); };

// démarrage à froid lent sur les machines de CI : jusqu'à 45 s
let port; for (let i = 0; i < 450 && !port && chr.exitCode === null; i++) { await attendre(100); const f = join(dir, 'DevToolsActivePort'); if (existsSync(f)) port = readFileSync(f, 'utf8').split('\n')[0]; }
if (!port) { console.error('navigateur : Chromium ne répond pas (' + binaire + (chr.exitCode !== null ? ', sorti avec le code ' + chr.exitCode : '') + ')\n' + journal.trim()); fin(1); }
const cibles = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(cibles.find((c) => c.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const attente = new Map();
// boîtes de dialogue (avertissement de sortie d'une page modifiée, confirm, prompt) : acceptées d'office et notées,
// sinon la page reste bloquée et le banc avec elle ; un sujet lit `dialogues` pour vérifier qu'une boîte est apparue
const dialogues = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Page.javascriptDialogOpening') { dialogues.push({ type: m.params.type, message: m.params.message }); ws.send(JSON.stringify({ id: ++id, method: 'Page.handleJavaScriptDialog', params: { accept: true } })); return; }
  if (m.id && attente.has(m.id)) { attente.get(m.id)(m); attente.delete(m.id); }
});
// chaque appel a un délai : un sujet bloqué échoue en nommant l'appel au lieu de suspendre tout le banc
const cdp = (method, params = {}, delai = 30000) => new Promise((r, rej) => {
  const n = ++id, t = setTimeout(() => { attente.delete(n); rej(new Error('pas de réponse de Chromium en ' + delai / 1000 + ' s à ' + method)); }, delai);
  attente.set(n, (m) => { clearTimeout(t); r(m); }); ws.send(JSON.stringify({ id: n, method, params }));
});
const evalue = async (expr) => { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
const charger = async () => { await cdp('Page.navigate', { url: page }); for (let i = 0; i < 100; i++) { await attendre(50); if (await evalue('!!document.querySelector(".tb .doc-name") && document.readyState === "complete"')) return; } throw new Error('la barre du haut n\'apparaît pas'); };
const ecran = (largeur, mobile, hauteur = 760) => cdp('Emulation.setDeviceMetricsOverride', { width: largeur, height: hauteur, deviceScaleFactor: mobile ? 2.625 : 1, mobile });

const dossier = new URL('./navigateur/', import.meta.url);
const choisis = process.argv.slice(2);
const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.mjs')).sort().filter((f) => !choisis.length || choisis.includes(f.replace(/\.mjs$/, '')));
const echecs = []; let n = 0;
await cdp('Runtime.enable'); await cdp('Page.enable');
for (const f of fichiers) {
  const sujet = await import(new URL(f, dossier)), nom = sujet.nom || f.replace(/\.mjs$/, '');
  const outils = { ecran, charger, evalue, cdp, attendre, dialogues, mesure: () => { n++; }, echec: (m) => echecs.push(`[${nom}] ${m}`) };
  try { await sujet.default(outils); } catch (e) { echecs.push(`[${nom}] erreur : ${e.stack || e.message}`); }
}
ws.close();
if (echecs.length) { console.error('navigateur : ÉCHEC\n' + echecs.join('\n')); fin(1); }
console.log(`navigateur : OK (${n} mesures, ${fichiers.length} sujet${fichiers.length > 1 ? 's' : ''})`);
fin(0);
