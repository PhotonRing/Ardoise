// Essai du relais (relais/relais.mjs) : deux copies, diffusion, rattrapage, instantané, clé refusée, redémarrage.
// node scripts/test-relais.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = mkdtempSync(path.join(tmpdir(), 'relais-'));
const port = 20000 + Math.floor(Math.random() * 20000);
const url = `ws://127.0.0.1:${port}`;
let proc;
const demarrer = () => new Promise((res, rej) => {
  proc = spawn(process.execPath, [new URL('../relais/relais.mjs', import.meta.url).pathname], { env: { ...process.env, PORT: port, HOTE: '127.0.0.1', DONNEES: dir, MAX_TRAME: '1' } });
  proc.stdout.on('data', (d) => { if (String(d).includes('Relais')) res(); });
  proc.stderr.on('data', (d) => process.stderr.write(d));
  proc.on('exit', (c) => { if (c) rej(new Error('relais arrêté : ' + c)); });
});
const arreter = () => new Promise((res) => { proc.once('exit', res); proc.kill(); });
const client = () => new Promise((res, rej) => {
  const ws = new WebSocket(url), file = [], att = [];
  ws.onmessage = (e) => { const m = JSON.parse(e.data); const w = att.findIndex((a) => a.f(m)); if (w >= 0) att.splice(w, 1)[0].r(m); else file.push(m); };
  ws.onopen = () => res({
    ws, send: (o) => ws.send(JSON.stringify(o)),
    attendre: (f, ms = 2000) => new Promise((r, j) => { const i = file.findIndex(f); if (i >= 0) return r(file.splice(i, 1)[0]); const t = setTimeout(() => j(new Error('attente dépassée')), ms); att.push({ f, r: (m) => { clearTimeout(t); r(m); } }); }),
  });
  ws.onerror = rej;
});
const ok = (c, m) => { if (!c) throw new Error(m); };
const salonId = 'S'.repeat(43), auth = 'A'.repeat(43);
try {
  await demarrer();
  const a = await client(), b = await client();
  a.send({ t: 'rejoindre', salon: salonId, auth, depuis: 0 });
  const w = await a.attendre((m) => m.t === 'bienvenue'); ok(w.seq === 0 && !w.trames.length, 'salon vide');
  b.send({ t: 'rejoindre', salon: salonId, auth, depuis: 0 }); await b.attendre((m) => m.t === 'bienvenue');
  a.send({ t: 'presence', d: 'chiffré-A' }); ok((await b.attendre((m) => m.t === 'presence')).d === 'chiffré-A', 'présence diffusée');
  a.send({ t: 'envoi', id: 1, d: 'x1' });
  ok((await a.attendre((m) => m.t === 'recu')).s === 1, 'accusé de réception');
  ok((await b.attendre((m) => m.t === 'trame')).d === 'x1', 'trame diffusée');
  for (let i = 2; i <= 5; i++) { a.send({ t: 'envoi', id: i, d: 'x' + i }); await a.attendre((m) => m.t === 'recu'); }
  // une copie en retard rattrape ce qui lui manque
  const c = await client(); c.send({ t: 'rejoindre', salon: salonId, auth, depuis: 2 });
  const wc = await c.attendre((m) => m.t === 'bienvenue');
  ok(wc.trames.map((t) => t.d).join() === 'x3,x4,x5' && wc.presents.length === 1, 'rattrapage depuis 2 : ' + JSON.stringify(wc));
  // instantané : remplace les trames 1 à 4
  a.send({ t: 'instantane', jusqua: 4, d: 'etat-1-4' }); await new Promise((r) => setTimeout(r, 100));
  // mauvaise clé
  const d = await client(); d.send({ t: 'rejoindre', salon: salonId, auth: 'B'.repeat(43), depuis: 0 });
  ok((await d.attendre((m) => m.t === 'erreur')).code === 'cle', 'clé refusée');
  // trop gros (MAX_TRAME = 1 Mo)
  a.send({ t: 'envoi', id: 9, d: 'z'.repeat(1.2 * 1024 * 1024) });
  ok((await a.attendre((m) => m.t === 'erreur')).code === 'trop-gros', 'envoi trop gros refusé');
  // départ
  b.ws.close(); ok((await a.attendre((m) => m.t === 'depart')).de, 'départ annoncé');
  [a, c, d].forEach((x) => x.ws.close());
  // redémarrage : tout est relu depuis le disque
  await arreter(); await demarrer();
  const e = await client(); e.send({ t: 'rejoindre', salon: salonId, auth, depuis: 0 });
  const we = await e.attendre((m) => m.t === 'bienvenue');
  ok(we.seq === 5 && we.snap && we.snap.d === 'etat-1-4' && we.trames.map((t) => t.d).join() === 'x5', 'après redémarrage : ' + JSON.stringify(we));
  e.send({ t: 'envoi', id: 1, d: 'x6' }); ok((await e.attendre((m) => m.t === 'recu')).s === 6, 'numérotation reprise');
  e.ws.close();
  console.log('relais : OK');
} finally {
  if (proc && proc.exitCode === null) await arreter();
  rmSync(dir, { recursive: true, force: true });
}
