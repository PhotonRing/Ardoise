// Ouvre des fichiers Ardoise dans Chromium sans affichage et échoue sur toute erreur de la page (exception, console.error)
// ou si l'éditeur ne s'affiche pas (barre d'édition, ou boutons de lecture pour un document qui s'ouvre en lecture) : à passer sur chaque fichier d'une vérification manuelle avant de la poser au propriétaire.
//   node scripts/ouvrir-sans-erreur.mjs <fichier.html>…
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const fichiers = process.argv.slice(2);
if (!fichiers.length) { console.error('usage : node scripts/ouvrir-sans-erreur.mjs <fichier.html>…'); process.exit(2); }
const binaire = process.env.CHROME || ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'].map((n) => { try { return execFileSync('which', [n], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (_) { return ''; } }).find(Boolean);
if (!binaire) { console.error('aucun Chromium trouvé ; variable CHROME pour en indiquer un'); process.exit(2); }

// relancé une fois s'il ne démarre pas (voir test-navigateur.mjs)
let dir, chr;
const lancer = () => { dir = mkdtempSync(join(tmpdir(), 'ardoise-ouvrir-')); chr = spawn(binaire, ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0', '--user-data-dir=' + dir, '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' }); };
lancer();
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const fin = (code) => { try { chr.kill(); } catch (_) { /* déjà fermé */ } try { rmSync(dir, { recursive: true, force: true }); } catch (_) { /* rien */ } process.exit(code); };
setTimeout(() => { console.error('ouvrir : plus de 120 s, abandon'); fin(1); }, 120000).unref();

const portDe = async () => { for (let i = 0; i < 450 && chr.exitCode === null; i++) { await attendre(100); const f = join(dir, 'DevToolsActivePort'); if (existsSync(f)) return readFileSync(f, 'utf8').split('\n')[0]; } return null; };
let port = await portDe();
if (!port) { console.error('ouvrir : Chromium ne répond pas, relancé une fois'); try { chr.kill(); } catch (_) { /* déjà fermé */ } try { rmSync(dir, { recursive: true, force: true }); } catch (_) { /* rien */ } lancer(); port = await portDe(); }
if (!port) { console.error('ouvrir : Chromium ne répond pas (' + binaire + ')'); fin(1); }
const cibles = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(cibles.find((c) => c.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const attente = new Map(); let erreurs = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') erreurs.push((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') erreurs.push('console.error : ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Page.javascriptDialogOpening') ws.send(JSON.stringify({ id: ++id, method: 'Page.handleJavaScriptDialog', params: { accept: true } }));
  if (m.id && attente.has(m.id)) { attente.get(m.id)(m); attente.delete(m.id); }
});
const cdp = (method, params = {}) => new Promise((r) => { const n = ++id; attente.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evalue = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, returnByValue: true })).result.result.value;
await cdp('Runtime.enable'); await cdp('Page.enable');

let ko = 0;
for (const f of fichiers) {
  erreurs = [];
  await cdp('Page.navigate', { url: pathToFileURL(resolve(f)).href });
  let pret = false; for (let i = 0; i < 100 && !pret; i++) { await attendre(50); pret = await evalue('!!document.querySelector(".tb .doc-name, .fab [data-ui=mode]") && document.readyState === "complete"'); }
  await attendre(1000);   // erreurs différées (rendu des blocs, minuteries du chargement)
  if (!pret) erreurs.push('l\'éditeur ne s\'affiche pas (ni barre du haut ni boutons de lecture)');
  if (erreurs.length) { ko++; console.error('ÉCHEC ' + f + '\n  ' + erreurs.join('\n  ')); } else console.log('ok ' + f);
}
ws.close();
fin(ko ? 1 : 0);
