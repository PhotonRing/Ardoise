// Banc navigateur : dist/ardoise.html ouvert dans Chromium sans affichage, piloté par le protocole DevTools (sans dépendance).
// Sujet : mise en page sur écran étroit. Ni la page, ni la barre du haut, ni le menu ☰ ne débordent ; la pastille d'état reste entière.
// Origine : spec corrections-1-19, où 3 px de débordement de la page élargissaient la barre et le menu sur téléphone.
// Sans Chromium (ou sans WebSocket dans Node), le banc est ignoré en local et échoue en CI.  node scripts/test-navigateur.mjs
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
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
const chr = spawn(binaire, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=0', '--user-data-dir=' + dir, '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const fin = (code) => { try { chr.kill(); } catch (_) { /* déjà fermé */ } try { rmSync(dir, { recursive: true, force: true }); } catch (_) { /* rien */ } process.exit(code); };

let port; for (let i = 0; i < 150 && !port; i++) { await attendre(100); const f = join(dir, 'DevToolsActivePort'); if (existsSync(f)) port = readFileSync(f, 'utf8').split('\n')[0]; }
if (!port) { console.error('navigateur : Chromium ne répond pas'); fin(1); }
const cibles = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(cibles.find((c) => c.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const attente = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && attente.has(m.id)) { attente.get(m.id)(m); attente.delete(m.id); } });
const cdp = (method, params = {}) => new Promise((r) => { const n = ++id; attente.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evalue = async (expr) => { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
const charger = async () => { await cdp('Page.navigate', { url: page }); for (let i = 0; i < 100; i++) { await attendre(50); if (await evalue('!!document.querySelector(".tb .doc-name") && document.readyState === "complete"')) return; } throw new Error('la barre du haut n\'apparaît pas'); };

// pire cas réaliste : titre long, état d'enregistrement long, synchronisation active, libellés d'annulation longs
const LONG = 'Paragraphe « Réserver les billets de train pour Inverness et les nuits à Édimbourg » : texte modifié';
const TITRE = 'Préparation du grand voyage en Écosse avec toute la famille et les cousins';
const POLICES = {
  normale: '',
  large: '#ui *{font-family:"DejaVu Serif",serif!important;letter-spacing:.08em!important}',
  agrandie: '#ui .sh-big,#ui .sh-big *{font-size:22px!important}#ui .tb,#ui .tb *{font-size:18px!important}',
};
const prep = (police) => `(() => {
  const s = document.createElement('style'); s.textContent = ${JSON.stringify(police)}; document.head.appendChild(s);
  document.querySelector('.tb .doc-name').textContent = ${JSON.stringify(TITRE)};
  const st = document.querySelector('.tb #st'); if (st) { st.className = 'st ok'; st.querySelector('span').textContent = 'Enregistré · un-nom-de-fichier-assez-long.html'; }
  const sy = document.querySelector('.tb .syn'); if (sy) { sy.hidden = false; sy.innerHTML = '<button type="button" class="syn-b ok" data-ui="sync"><i></i><span class="syn-l">Synchronisé · 3 personnes</span><span class="syn-av" style="background:#c33">A</span><span class="syn-av" style="background:#36c">B</span></button>'; }
  return true; })()`;
// débordements : page plus large que l'écran, élément visible dont le bord droit sort de l'écran, texte qui sort de son gros bouton
const MESURE = `(() => {
  const iw = innerWidth, o = { page: document.documentElement.scrollWidth - iw, barre: [], menu: [], textes: [] };
  const deb = (el) => [...el.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && getComputedStyle(e).display !== 'none' && r.right > iw + 0.5; }).slice(0, 5).map((e) => (e.dataset.ui || e.dataset.sh || e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().right));
  const tb = document.querySelector('.tb');
  if (tb && getComputedStyle(tb).display !== 'none') { o.barre = deb(tb); const st = tb.querySelector('#st'); if (st && getComputedStyle(st).display !== 'none') o.etat = st.getBoundingClientRect().width; }
  const sh = document.querySelector('.sheet');
  if (sh) { o.menu = deb(sh); o.menuDeborde = sh.scrollWidth - sh.clientWidth;
    o.textes = [...sh.querySelectorAll('.sh-big')].filter((b) => [...b.querySelectorAll('*')].some((e) => e.getBoundingClientRect().right > b.getBoundingClientRect().right + 0.5)).map((b) => b.dataset.sh); }
  return o; })()`;
const OUVRIR = `(() => { document.querySelector('[data-ui=burger]').click(); for (const k of ['undo', 'redo']) { const u = document.querySelector('.sheet [data-sh=' + k + ']'); u.disabled = false; u.querySelector('.sub').textContent = ${JSON.stringify(LONG)}; } return true; })()`;

const echecs = []; let n = 0;
const verifier = (cas, o) => {
  n++;
  if (o.page > 0) echecs.push(`${cas} : la page déborde de ${o.page} px`);
  if (o.barre.length) echecs.push(`${cas} : la barre du haut déborde (${o.barre.join(', ')})`);
  if (o.etat !== undefined && o.etat < 8) echecs.push(`${cas} : pastille d'état rognée (${o.etat.toFixed(1)} px de large)`);
  if (o.menu.length || o.menuDeborde > 0) echecs.push(`${cas} : le menu ☰ déborde (${o.menu.join(', ') || o.menuDeborde + ' px'})`);
  if (o.textes.length) echecs.push(`${cas} : texte qui sort de son bouton dans le menu ☰ (${o.textes.join(', ')})`);
};
try {
  await cdp('Runtime.enable');
  for (const [w, mobile] of [[320, true], [360, true], [412, true], [780, false], [820, false], [880, false], [1000, false]]) {
    for (const [nom, police] of Object.entries(POLICES)) {
      const cas = `${w} px ${mobile ? 'mobile' : 'bureau'}, police ${nom}`;
      await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: 760, deviceScaleFactor: mobile ? 2.625 : 1, mobile });
      await charger(); await evalue(prep(police)); await attendre(50);
      verifier(cas + ', édition', await evalue(MESURE));
      if (mobile) { await evalue(OUVRIR); await attendre(100); verifier(cas + ', menu ☰', await evalue(MESURE)); }
    }
  }
} catch (e) { console.error('navigateur : ÉCHEC\n' + (e.stack || e.message)); ws.close(); fin(1); }
ws.close();
if (echecs.length) { console.error('navigateur : ÉCHEC\n' + echecs.join('\n')); fin(1); }
console.log(`navigateur : OK (${n} mesures de mise en page)`);
fin(0);
